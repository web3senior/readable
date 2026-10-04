// SPDX-License-Identifier: MIT
pragma solidity ^0.8.35;

import {ERC2771Forwarder} from "@openzeppelin/contracts/metatx/ERC2771Forwarder.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Readable} from "../src/Readable.sol";
import {Fixture} from "./Fixture.sol";

/// @dev A holder's changes to a name arrive through the trusted forwarder: signed by the holder,
///      paid for by a relayer. Everything else is sent by the account itself.
contract GaslessTest is Fixture {
    uint256 internal tokenId;

    function setUp() public override {
        super.setUp();
        tokenId = _register(alice, numbers, "4242");
        // The holder keeps not one wei for fees
        vm.deal(alice, 0);
        vm.deal(relayer, 1 ether);
    }

    function _relay(ERC2771Forwarder.ForwardRequestData memory request) internal {
        vm.prank(relayer);
        forwarder.execute(request);
    }

    function _refused(ERC2771Forwarder.ForwardRequestData memory request) internal {
        vm.prank(relayer);
        vm.expectRevert();
        forwarder.execute(request);
    }

    function test_EveryChangeToANameWithNoCoin() public {
        _relay(_request(aliceKey, abi.encodeCall(Readable.setTarget, (tokenId, bob))));
        _relay(_request(aliceKey, abi.encodeCall(Readable.setText, (tokenId, "records", "relayed"))));
        _relay(_request(aliceKey, abi.encodeCall(Readable.setPrimaryName, (tokenId))));
        _relay(_request(aliceKey, abi.encodeCall(Readable.setAddrs, (tokenId, _coin(501, hex"a11ce0")))));

        assertEq(registry.resolve(tokenId), bob);
        assertEq(registry.text(tokenId, "records"), "relayed");
        assertEq(registry.addr(tokenId, 501), hex"a11ce0");
        (uint256 primary, ) = registry.primaryNameOf(alice);
        assertEq(primary, tokenId);
        assertEq(alice.balance, 0);
    }

    function test_AnApprovedOperatorChangesItToo() public {
        vm.deal(alice, 1 ether);
        vm.prank(alice);
        registry.approve(bob, tokenId);

        _relay(_request(bobKey, abi.encodeCall(Readable.setTarget, (tokenId, bob))));
        assertEq(registry.resolve(tokenId), bob);
    }

    function test_ASignatureChangesOnlyItsOwnName() public {
        // Signed by bob, who holds nothing
        _refused(_request(bobKey, abi.encodeCall(Readable.setTarget, (tokenId, bob))));
        _refused(_request(bobKey, abi.encodeCall(Readable.setText, (tokenId, "records", "bob's"))));
        _refused(_request(bobKey, abi.encodeCall(Readable.setPrimaryName, (tokenId))));

        assertEq(registry.resolve(tokenId), alice);
        assertEq(registry.text(tokenId, "records"), "");
    }

    function test_NothingElseIsRelayed() public {
        // Signed by the holder and still refused: a name moves, and is bought, by its account alone
        _refused(_request(aliceKey, abi.encodeWithSignature("transferFrom(address,address,uint256)", alice, bob, tokenId)));
        _refused(_request(aliceKey, abi.encodeWithSignature("approve(address,uint256)", bob, tokenId)));
        _refused(_request(aliceKey, abi.encodeCall(Readable.renew, (tokenId, 1))));
        _refused(_request(aliceKey, abi.encodeCall(Readable.register, (numbers, "4343", 1))));

        assertEq(registry.ownerOf(tokenId), alice);
        assertEq(registry.getApproved(tokenId), address(0));
        assertFalse(registry.isApprovedForAll(alice, bob));

        // An approval of all goes through, as the forwarder's own: it holds nothing, so it gives nothing
        _relay(_request(aliceKey, abi.encodeWithSignature("setApprovalForAll(address,bool)", bob, true)));
        assertFalse(registry.isApprovedForAll(alice, bob));
        assertTrue(registry.isApprovedForAll(address(forwarder), bob));
    }

    function test_OwnerActionsAreNeverRelayed() public {
        (address signer, uint256 signerKey) = makeAddrAndKey("signing owner");
        vm.prank(owner);
        registry.transferOwnership(signer);

        // Not even the acceptance: the owner acts from its own wallet
        _refused(_request(signerKey, abi.encodeWithSignature("acceptOwnership()")));
        assertEq(registry.owner(), owner);

        vm.prank(signer);
        registry.acceptOwnership();
        _refused(_request(signerKey, abi.encodeCall(Readable.setGracePeriod, (45 days))));
        assertEq(registry.gracePeriod(), 30 days);
    }

    function test_ARequestRunsOnce() public {
        ERC2771Forwarder.ForwardRequestData memory request = _request(aliceKey, abi.encodeCall(Readable.setTarget, (tokenId, bob)));
        _relay(request);
        _refused(request);
    }

    function test_ARequestExpires() public {
        ERC2771Forwarder.ForwardRequestData memory request = _request(aliceKey, abi.encodeCall(Readable.setTarget, (tokenId, bob)));
        vm.warp(block.timestamp + 10 minutes + 1);
        vm.prank(relayer);
        vm.expectRevert(abi.encodeWithSelector(ERC2771Forwarder.ERC2771ForwarderExpiredRequest.selector, request.deadline));
        forwarder.execute(request);
    }

    function test_AChangedRequestIsRefused() public {
        ERC2771Forwarder.ForwardRequestData memory request = _request(aliceKey, abi.encodeCall(Readable.setTarget, (tokenId, bob)));
        request.data = abi.encodeCall(Readable.setTarget, (tokenId, stranger));
        _refused(request);
        assertEq(registry.resolve(tokenId), alice);
    }

    function test_AnAddressAtTheEndOfACallFoolsNobody() public {
        // Only the trusted forwarder is believed about who is calling
        vm.prank(stranger);
        (bool success, ) = address(registry).call(abi.encodePacked(abi.encodeCall(Readable.setTarget, (tokenId, stranger)), alice));
        assertFalse(success);

        vm.prank(stranger);
        (success, ) = address(registry).call(abi.encodePacked(abi.encodeCall(Readable.pause, ()), owner));
        assertFalse(success);

        assertEq(registry.resolve(tokenId), alice);
        assertFalse(registry.paused());
    }

    function test_AReplacedForwarderLosesItsWord() public {
        ERC2771Forwarder next = new ERC2771Forwarder("HupForwarder");
        vm.prank(owner);
        registry.setTrustedForwarder(address(next));
        bytes memory change = abi.encodeCall(Readable.setTarget, (tokenId, bob));

        // The old forwarder won't even send to a registry that stopped trusting it
        ERC2771Forwarder.ForwardRequestData memory stale = _request(aliceKey, change);
        vm.prank(relayer);
        vm.expectRevert(abi.encodeWithSelector(ERC2771Forwarder.ERC2771UntrustfulTarget.selector, address(registry), address(forwarder)));
        forwarder.execute(stale);

        // And called directly, it is the forwarder itself that is taken for the caller
        vm.prank(address(forwarder));
        (bool success, ) = address(registry).call(abi.encodePacked(change, alice));
        assertFalse(success);

        vm.prank(relayer);
        next.execute(_requestThrough(next, aliceKey, change));
        assertEq(registry.resolve(tokenId), bob);
    }

    function test_ADirectCallStillWorksBesideTheForwarder() public {
        vm.deal(alice, 1 ether);
        vm.prank(alice);
        registry.setTarget(tokenId, bob);
        assertEq(registry.resolve(tokenId), bob);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        registry.pause();
    }
}
