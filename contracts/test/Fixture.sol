// SPDX-License-Identifier: MIT
pragma solidity ^0.8.35;

import {Test} from "forge-std/Test.sol";
import {ERC2771Forwarder} from "@openzeppelin/contracts/metatx/ERC2771Forwarder.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {Readable} from "../src/Readable.sol";
import {IReadable} from "../src/IReadable.sol";
import {NameRules} from "../src/NameRules.sol";

/// @dev A smart account with neither an ERC-721 receiver hook nor a way to take the native coin.
contract BareAccount {}

/// @dev A contract that accepts names sent with safeTransferFrom.
contract Vault is IERC721Receiver {
    function onERC721Received(address, address, uint256, bytes calldata) external pure override returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }
}

/// @dev A manager that, on being paid, tries to buy a name with what it got.
contract GreedyManager {
    Readable internal immutable REGISTRY;
    uint256 internal immutable NAMESPACE;
    bool public reentered;

    constructor(Readable registry, uint256 namespaceId) {
        REGISTRY = registry;
        NAMESPACE = namespaceId;
    }

    receive() external payable {
        if (reentered) return;
        reentered = true;
        // Whatever it tries, it pays the full price like anyone else
        try REGISTRY.register{value: msg.value}(NAMESPACE, "9999", 1) {} catch {}
    }
}

/**
 * @dev The registry set up the way it launches on Base: names paid in ETH, Numbers at the launch
 *      prices, one extension with a manager and the first name rules, and a real OpenZeppelin
 *      forwarder trusted for a holder's gasless changes to a name.
 */
abstract contract Fixture is Test {
    // The placeholder prices are dollars turned into ETH at 4,000 dollars an ETH
    uint256 internal constant DOLLAR = 0.00025 ether;
    bytes32 internal constant FORWARD_TYPEHASH =
        keccak256("ForwardRequest(address from,address to,uint256 value,uint256 gas,uint256 nonce,uint48 deadline,bytes data)");
    bytes32 internal constant DOMAIN_TYPEHASH = keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");

    Readable internal registry;
    ERC2771Forwarder internal forwarder;
    NameRules internal rules;

    address internal owner = makeAddr("owner");
    address internal manager = makeAddr("manager");
    address internal dao = makeAddr("dao");
    address internal relayer = makeAddr("relayer");
    address internal stranger = makeAddr("stranger");

    address internal alice;
    uint256 internal aliceKey;
    address internal bob;
    uint256 internal bobKey;

    uint256 internal numbers;
    uint256 internal arc;

    function setUp() public virtual {
        (alice, aliceKey) = makeAddrAndKey("alice");
        (bob, bobKey) = makeAddrAndKey("bob");

        forwarder = new ERC2771Forwarder("HupForwarder");
        registry = new Readable(owner, address(forwarder));
        rules = new NameRules();

        vm.startPrank(owner);
        registry.setNameRules(address(rules));
        numbers = registry.addNamespace(IReadable.Kind.Number, "0", 2, 12, 8, _numberPrices(), address(0), 0, "");
        arc = registry.addNamespace(IReadable.Kind.Name, "arc", 3, 32, 0, _namePrices(), manager, 10, "{\"label\":\".arc\"}");
        vm.stopPrank();

        vm.deal(alice, 100 ether);
        vm.deal(bob, 100 ether);
    }

    // --- PRICES ---

    function _numberPrices() internal pure returns (uint256[] memory prices) {
        prices = new uint256[](7);
        prices[0] = 2000 * DOLLAR;
        prices[1] = 500 * DOLLAR;
        prices[2] = 100 * DOLLAR;
        prices[3] = 25 * DOLLAR;
        prices[4] = 5 * DOLLAR;
        prices[5] = 5 * DOLLAR;
        prices[6] = 1 * DOLLAR;
    }

    function _namePrices() internal pure returns (uint256[] memory prices) {
        prices = new uint256[](3);
        prices[0] = 160 * DOLLAR;
        prices[1] = 40 * DOLLAR;
        prices[2] = 5 * DOLLAR;
    }

    function _flat(uint256 price) internal pure returns (uint256[] memory prices) {
        prices = new uint256[](1);
        prices[0] = price;
    }

    // --- CALLS ---

    function _price(uint256 namespaceId, string memory label, uint256 yearCount) internal view returns (uint256) {
        return registry.priceOf(namespaceId, label, yearCount);
    }

    /// @dev A year of `label` for `who`, at its price. The price is read before the prank.
    function _register(address who, uint256 namespaceId, string memory label) internal returns (uint256 tokenId) {
        uint256 price = _price(namespaceId, label, 1);
        vm.prank(who);
        tokenId = registry.register{value: price}(namespaceId, label, 1);
    }

    /// @dev `yearCount` more years of `tokenId`, paid by `who` at the renewal price.
    function _renew(address who, uint256 tokenId, uint256 yearCount) internal {
        uint256 price = _renewalPrice(tokenId, yearCount);
        vm.prank(who);
        registry.renew{value: price}(tokenId, yearCount);
    }

    /// @dev What a renewal costs: the name's namespace priced by the length it was registered with.
    function _renewalPrice(uint256 tokenId, uint256 yearCount) internal view returns (uint256) {
        IReadable.Record memory record = registry.recordOf(tokenId);
        uint256[] memory tiers = registry.getPrices(record.namespaceId);
        uint256 from = registry.getNamespaces()[record.namespaceId - 1].priceFrom;
        uint256 index = record.length > from ? record.length - from : 0;
        if (index >= tiers.length) index = tiers.length - 1;
        return tiers[index] * yearCount;
    }

    function _coin(uint256 coinType, bytes memory value) internal pure returns (IReadable.CoinAddress[] memory entries) {
        entries = new IReadable.CoinAddress[](1);
        entries[0] = IReadable.CoinAddress(coinType, value);
    }

    function _one(string memory label) internal pure returns (string[] memory labels) {
        labels = new string[](1);
        labels[0] = label;
    }

    function _validity(uint256 namespaceId, string memory label) internal view returns (IReadable.Validity) {
        return registry.lookup(namespaceId, label).validity;
    }

    function _assertValidity(uint256 namespaceId, string memory label, IReadable.Validity expected) internal view {
        assertEq(uint8(_validity(namespaceId, label)), uint8(expected), label);
    }

    function _expectInvalid(IReadable.Validity validity) internal {
        vm.expectRevert(abi.encodeWithSelector(IReadable.InvalidLabel.selector, validity));
    }

    // --- LABELS ---

    /// @dev `cp` as UTF-8, the way a well-formed string carries it.
    function _utf8(uint256 cp) internal pure returns (bytes memory) {
        if (cp < 0x80) return abi.encodePacked(uint8(cp));
        if (cp < 0x800) return abi.encodePacked(uint8(0xc0 | (cp >> 6)), uint8(0x80 | (cp & 0x3f)));
        if (cp < 0x10000) return abi.encodePacked(uint8(0xe0 | (cp >> 12)), uint8(0x80 | ((cp >> 6) & 0x3f)), uint8(0x80 | (cp & 0x3f)));
        return abi.encodePacked(
            uint8(0xf0 | (cp >> 18)), uint8(0x80 | ((cp >> 12) & 0x3f)), uint8(0x80 | ((cp >> 6) & 0x3f)), uint8(0x80 | (cp & 0x3f))
        );
    }

    /// @dev `body` followed by the digit that makes the whole pass the Luhn check.
    function _withCheckDigit(bytes memory body) internal pure returns (string memory) {
        uint256 sum;
        for (uint256 i = 0; i < body.length; i++) {
            uint256 digit = uint8(body[body.length - 1 - i]) - 48;
            // The check digit will sit to the right, so the body's last digit is a doubled one
            if (i % 2 == 0) {
                digit *= 2;
                if (digit > 9) digit -= 9;
            }
            sum += digit;
        }
        return string(abi.encodePacked(body, uint8(48 + ((10 - (sum % 10)) % 10))));
    }

    // --- SIGNATURES ---

    function _forwarderDomain(ERC2771Forwarder target) internal view returns (bytes32) {
        (, string memory name, string memory version, uint256 chainId, address verifying, , ) = target.eip712Domain();
        return keccak256(abi.encode(DOMAIN_TYPEHASH, keccak256(bytes(name)), keccak256(bytes(version)), chainId, verifying));
    }

    /// @dev `data` on the registry as a request signed by `key`, ready for a relayer to execute.
    function _request(uint256 key, bytes memory data) internal view returns (ERC2771Forwarder.ForwardRequestData memory) {
        return _requestThrough(forwarder, key, data);
    }

    function _requestThrough(ERC2771Forwarder target, uint256 key, bytes memory data)
        internal
        view
        returns (ERC2771Forwarder.ForwardRequestData memory request)
    {
        address from = vm.addr(key);
        uint48 deadline = uint48(block.timestamp + 10 minutes);
        uint256 gas = 1_000_000;
        bytes32 structHash =
            keccak256(abi.encode(FORWARD_TYPEHASH, from, address(registry), uint256(0), gas, target.nonces(from), deadline, keccak256(data)));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, keccak256(abi.encodePacked("\x19\x01", _forwarderDomain(target), structHash)));
        request = ERC2771Forwarder.ForwardRequestData(from, address(registry), 0, gas, deadline, data, abi.encodePacked(r, s, v));
    }
}
