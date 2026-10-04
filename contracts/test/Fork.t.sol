// SPDX-License-Identifier: MIT
pragma solidity ^0.8.35;

import {Test} from "forge-std/Test.sol";
import {ERC2771Forwarder} from "@openzeppelin/contracts/metatx/ERC2771Forwarder.sol";
import {Readable} from "../src/Readable.sol";
import {IReadable} from "../src/IReadable.sol";
import {NameRules} from "../src/NameRules.sol";

/**
 * @dev The registry against Base as it is: names paid in ETH, a holder's changes relayed through
 *      the Hup forwarder that is deployed there. Runs when BASE_RPC_URL is set, and is skipped
 *      otherwise:
 *        BASE_RPC_URL=https://mainnet.base.org forge test --match-contract ForkTest
 */
contract ForkTest is Test {
    uint256 internal constant BASE = 8453;
    ERC2771Forwarder internal constant FORWARDER = ERC2771Forwarder(0xae95e44D2642F568D0e0Fc0d60202B55c8764567);
    // EIP-170
    uint256 internal constant CODE_LIMIT = 24_576;
    // The placeholder prices are dollars turned into ETH at 4,000 dollars an ETH
    uint256 internal constant DOLLAR = 0.00025 ether;

    bytes32 internal constant FORWARD_TYPEHASH =
        keccak256("ForwardRequest(address from,address to,uint256 value,uint256 gas,uint256 nonce,uint48 deadline,bytes data)");
    bytes32 internal constant DOMAIN_TYPEHASH = keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");

    Readable internal registry;
    NameRules internal rules;
    uint256 internal numbers;
    uint256 internal arc;

    address internal owner = makeAddr("owner");
    address internal relayer = makeAddr("relayer");
    address internal dao = makeAddr("dao");
    address internal buyer;
    uint256 internal buyerKey;

    function setUp() public {
        string memory url = vm.envOr("BASE_RPC_URL", string(""));
        if (bytes(url).length == 0) {
            vm.skip(true);
            return;
        }
        vm.createSelectFork(url);
        assertEq(block.chainid, BASE, "BASE_RPC_URL is not Base");

        (buyer, buyerKey) = makeAddrAndKey("buyer");
        registry = new Readable(owner, address(FORWARDER));
        rules = new NameRules();

        uint256[] memory prices = new uint256[](7);
        prices[0] = 2000 * DOLLAR;
        prices[1] = 500 * DOLLAR;
        prices[2] = 100 * DOLLAR;
        prices[3] = 25 * DOLLAR;
        prices[4] = 5 * DOLLAR;
        prices[5] = 5 * DOLLAR;
        prices[6] = 1 * DOLLAR;

        vm.startPrank(owner);
        numbers = registry.addNamespace(IReadable.Kind.Number, "0", 2, 12, 8, prices, address(0), 0, "");
        registry.setNameRules(address(rules));
        uint256[] memory namePrices = new uint256[](3);
        namePrices[0] = 160 * DOLLAR;
        namePrices[1] = 40 * DOLLAR;
        namePrices[2] = 5 * DOLLAR;
        arc = registry.addNamespace(IReadable.Kind.Name, "arc", 3, 32, 0, namePrices, address(0), 0, "");
        registry.setTreasury(dao);
        vm.stopPrank();

        vm.deal(buyer, 1 ether);
        vm.deal(relayer, 1 ether);
    }

    function test_WhatTheRegistryReliesOnIsThere() public view {
        assertGt(address(FORWARDER).code.length, 0, "no forwarder");
        assertGt(CREATE2_FACTORY.code.length, 0, "no CREATE2 factory");

        (, string memory name, string memory version, uint256 chainId, address verifying, , ) = FORWARDER.eip712Domain();
        assertEq(name, "HupForwarder");
        assertEq(version, "1");
        assertEq(chainId, BASE);
        assertEq(verifying, address(FORWARDER));
    }

    function test_BothContractsFitTheCodeLimit() public view {
        assertLt(address(registry).code.length, CODE_LIMIT);
        assertLt(address(rules).code.length, CODE_LIMIT);
    }

    function test_BuysAPersianNameWithEth() public {
        // ali, the joiner, reza
        string memory label = string(hex"d8b9d984db8ce2808cd8b1d8b6d8a7");
        vm.prank(buyer);
        uint256 tokenId = registry.register{value: 5 * DOLLAR}(arc, label, 1);

        assertEq(registry.ownerOf(tokenId), buyer);
        assertEq(registry.recordOf(tokenId).length, 6);
        assertEq(dao.balance, 5 * DOLLAR);
    }

    function test_BuysAndRenewsANumberWithEth() public {
        uint256 gasBefore = gasleft();
        vm.prank(buyer);
        uint256 tokenId = registry.register{value: 100 * DOLLAR}(numbers, "4242", 1);
        emit log_named_uint("gas of a registration", gasBefore - gasleft());
        uint64 expiresAt = registry.recordOf(tokenId).expiresAt;

        vm.prank(buyer);
        registry.renew{value: 300 * DOLLAR}(tokenId, 3);

        assertEq(registry.ownerOf(tokenId), buyer);
        assertEq(registry.recordOf(tokenId).expiresAt, expiresAt + 3 * 365 days);
        assertEq(dao.balance, 400 * DOLLAR);
        assertEq(address(registry).balance, 0);
    }

    function test_ChangesANameThroughTheRealForwarderWithNoCoin() public {
        vm.prank(buyer);
        uint256 tokenId = registry.register{value: 100 * DOLLAR}(numbers, "4242", 1);
        vm.deal(buyer, 0);

        uint256 gasBefore = gasleft();
        vm.prank(relayer);
        FORWARDER.execute(_request(abi.encodeCall(Readable.setTarget, (tokenId, dao))));
        emit log_named_uint("gas of a relayed change of target", gasBefore - gasleft());
        vm.prank(relayer);
        FORWARDER.execute(_request(abi.encodeCall(Readable.setText, (tokenId, "records", "{\"v\":1,\"name\":\"Buyer\"}"))));

        assertEq(registry.resolve(tokenId), dao);
        assertEq(registry.text(tokenId, "records"), "{\"v\":1,\"name\":\"Buyer\"}");
        assertEq(buyer.balance, 0);
    }

    function test_TheRealForwarderRelaysNoPurchase() public {
        ERC2771Forwarder.ForwardRequestData memory request = _request(abi.encodeCall(Readable.register, (numbers, "4242", 1)));
        vm.prank(relayer);
        vm.expectRevert();
        FORWARDER.execute(request);
    }

    function test_TheRealForwarderRefusesAForgedRequest() public {
        vm.prank(buyer);
        uint256 tokenId = registry.register{value: 100 * DOLLAR}(numbers, "4242", 1);

        ERC2771Forwarder.ForwardRequestData memory request = _request(abi.encodeCall(Readable.setTarget, (tokenId, dao)));
        request.from = makeAddr("someone else");

        vm.prank(relayer);
        vm.expectRevert();
        FORWARDER.execute(request);
        assertEq(registry.resolve(tokenId), buyer);
    }

    // --- SIGNATURES ---

    function _request(bytes memory data) internal view returns (ERC2771Forwarder.ForwardRequestData memory) {
        (, string memory name, string memory version, uint256 chainId, address verifying, , ) = FORWARDER.eip712Domain();
        bytes32 domain = keccak256(abi.encode(DOMAIN_TYPEHASH, keccak256(bytes(name)), keccak256(bytes(version)), chainId, verifying));

        uint48 deadline = uint48(block.timestamp + 10 minutes);
        uint256 gas = 1_000_000;
        bytes32 structHash =
            keccak256(abi.encode(FORWARD_TYPEHASH, buyer, address(registry), uint256(0), gas, FORWARDER.nonces(buyer), deadline, keccak256(data)));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(buyerKey, keccak256(abi.encodePacked("\x19\x01", domain, structHash)));
        return ERC2771Forwarder.ForwardRequestData(buyer, address(registry), 0, gas, deadline, data, abi.encodePacked(r, s, v));
    }
}
