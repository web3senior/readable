// SPDX-License-Identifier: MIT
pragma solidity ^0.8.35;

import {IERC721Errors} from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IReadable} from "../src/IReadable.sol";
import {BareAccount, Fixture, Vault} from "./Fixture.sol";

/// @dev What a holder does with a name: point it, make it primary, fill its records, move it.
contract HolderTest is Fixture {
    uint256 internal tokenId;

    function setUp() public override {
        super.setUp();
        tokenId = _register(alice, numbers, "4242");
    }

    // --- SET TARGET ---

    function test_SetTarget_PointsTheName() public {
        vm.expectEmit(true, true, false, true);
        emit IReadable.TargetChanged(tokenId, bob);
        vm.prank(alice);
        registry.setTarget(tokenId, bob);

        assertEq(registry.resolve(tokenId), bob);
        assertEq(registry.recordOf(tokenId).target, bob);
        assertEq(registry.lookup(numbers, "4242").target, bob);
        assertEq(registry.ownerOf(tokenId), alice);
    }

    function test_SetTarget_CanPointNowhere() public {
        vm.prank(alice);
        registry.setTarget(tokenId, address(0));
        assertEq(registry.resolve(tokenId), address(0));
    }

    function test_SetTarget_IsForTheHolderAndWhomItApproves() public {
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(IReadable.NotNameOwner.selector, tokenId));
        registry.setTarget(tokenId, stranger);

        vm.prank(alice);
        registry.approve(bob, tokenId);
        vm.prank(bob);
        registry.setTarget(tokenId, bob);
        assertEq(registry.resolve(tokenId), bob);

        vm.prank(alice);
        registry.setApprovalForAll(stranger, true);
        vm.prank(stranger);
        registry.setTarget(tokenId, stranger);
        assertEq(registry.resolve(tokenId), stranger);
    }

    function test_SetTarget_RefusesAMissingOrExpiredName() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(IReadable.NameNotFound.selector, 7));
        registry.setTarget(7, alice);

        vm.warp(block.timestamp + 365 days);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(IReadable.NameExpired.selector, tokenId));
        registry.setTarget(tokenId, bob);
    }

    // --- PRIMARY NAME ---

    function test_SetPrimaryName_SetsAndClears() public {
        vm.expectEmit(true, true, false, true);
        emit IReadable.PrimaryNameChanged(alice, tokenId);
        vm.prank(alice);
        registry.setPrimaryName(tokenId);

        (uint256 primary, string memory name) = registry.primaryNameOf(alice);
        assertEq(primary, tokenId);
        assertEq(name, "+0 4242");

        vm.prank(alice);
        registry.setPrimaryName(0);
        (primary, name) = registry.primaryNameOf(alice);
        assertEq(primary, 0);
        assertEq(name, "");
    }

    function test_SetPrimaryName_TakesOnlyTheCallersOwnLiveName() public {
        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(IReadable.NotNameOwner.selector, tokenId));
        registry.setPrimaryName(tokenId);

        // Being approved moves a name, it doesn't make it yours
        vm.prank(alice);
        registry.approve(bob, tokenId);
        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(IReadable.NotNameOwner.selector, tokenId));
        registry.setPrimaryName(tokenId);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(IReadable.NotNameOwner.selector, 7));
        registry.setPrimaryName(7);

        vm.warp(block.timestamp + 365 days);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(IReadable.NameExpired.selector, tokenId));
        registry.setPrimaryName(tokenId);
    }

    function test_PrimaryNameOf_EndsWithTheName() public {
        vm.prank(alice);
        registry.setPrimaryName(tokenId);

        vm.warp(block.timestamp + 365 days);
        (uint256 primary, string memory name) = registry.primaryNameOf(alice);
        assertEq(primary, 0);
        assertEq(name, "");

        // A renewal brings it back without setting it again
        _renew(alice, tokenId, 1);
        (primary, ) = registry.primaryNameOf(alice);
        assertEq(primary, tokenId);
    }

    function test_PrimaryNameOf_DoesNotFollowTheNameToItsNextHolder() public {
        vm.prank(alice);
        registry.setPrimaryName(tokenId);

        vm.expectEmit(true, true, false, true);
        emit IReadable.PrimaryNameChanged(alice, 0);
        vm.prank(alice);
        registry.transferFrom(alice, bob, tokenId);

        (uint256 primary, ) = registry.primaryNameOf(alice);
        assertEq(primary, 0);
        (primary, ) = registry.primaryNameOf(bob);
        assertEq(primary, 0);
    }

    // --- TEXT RECORDS ---

    function test_SetText_KeepsOneValuePerKey() public {
        vm.expectEmit(true, true, false, true);
        emit IReadable.TextChanged(tokenId, "records", "records", "{\"v\":1}");
        vm.startPrank(alice);
        registry.setText(tokenId, "records", "{\"v\":1}");
        registry.setText(tokenId, "tunnel", "key");
        vm.stopPrank();

        assertEq(registry.text(tokenId, "records"), "{\"v\":1}");
        assertEq(registry.text(tokenId, "tunnel"), "key");
        assertEq(registry.text(tokenId, "missing"), "");

        vm.prank(alice);
        registry.setText(tokenId, "records", "");
        assertEq(registry.text(tokenId, "records"), "");
        assertEq(registry.text(tokenId, "tunnel"), "key");
    }

    function test_SetText_IsForTheHolderAndWhomItApproves() public {
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(IReadable.NotNameOwner.selector, tokenId));
        registry.setText(tokenId, "records", "stranger's");

        vm.prank(alice);
        registry.approve(bob, tokenId);
        vm.prank(bob);
        registry.setText(tokenId, "records", "by bob");
        assertEq(registry.text(tokenId, "records"), "by bob");
    }

    function test_SetText_RefusesAMissingOrExpiredName() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(IReadable.NameNotFound.selector, 7));
        registry.setText(7, "records", "x");

        vm.warp(block.timestamp + 365 days);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(IReadable.NameExpired.selector, tokenId));
        registry.setText(tokenId, "records", "x");
    }

    function test_SetText_TakesALongDocument() public {
        bytes memory document = new bytes(4096);
        for (uint256 i = 0; i < document.length; i++) document[i] = "a";
        vm.prank(alice);
        registry.setText(tokenId, "records", string(document));
        assertEq(bytes(registry.text(tokenId, "records")).length, 4096);
    }

    // --- ADDRESSES ---

    // A Bitcoin output script and a Solana public key, as ENS stores them
    bytes internal constant BTC = hex"0014751e76e8199196d454941c45d1b3a323f1433bd6";
    bytes internal constant SOL = hex"0b0f2a3e5c7d9e1f203142536475869708192a3b4c5d6e7f8091a2b3c4d5e6f7";

    function test_SetAddrs_KeepsOneAddressPerChain() public {
        IReadable.CoinAddress[] memory entries = new IReadable.CoinAddress[](2);
        entries[0] = IReadable.CoinAddress(0, BTC);
        entries[1] = IReadable.CoinAddress(501, SOL);

        vm.expectEmit(true, true, false, true);
        emit IReadable.AddressChanged(tokenId, 0, BTC);
        vm.expectEmit(true, true, false, true);
        emit IReadable.AddressChanged(tokenId, 501, SOL);
        vm.prank(alice);
        registry.setAddrs(tokenId, entries);

        assertEq(registry.addr(tokenId, 0), BTC);
        assertEq(registry.addr(tokenId, 501), SOL);
        // Every EVM chain answers with the address the name points to
        assertEq(registry.addr(tokenId, 60), abi.encodePacked(alice));
        assertEq(registry.resolve(tokenId), alice);

        vm.prank(alice);
        registry.setAddrs(tokenId, _coin(0, ""));
        assertEq(registry.addr(tokenId, 0), "");
        assertEq(registry.addr(tokenId, 501), SOL);
    }

    function test_SetAddrs_IsForTheHolderAndWhomItApproves() public {
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(IReadable.NotNameOwner.selector, tokenId));
        registry.setAddrs(tokenId, _coin(0, BTC));

        vm.prank(alice);
        registry.approve(bob, tokenId);
        vm.prank(bob);
        registry.setAddrs(tokenId, _coin(0, BTC));
        assertEq(registry.addr(tokenId, 0), BTC);
    }

    function test_SetAddrs_RefusesAMissingOrExpiredName() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(IReadable.NameNotFound.selector, 7));
        registry.setAddrs(7, _coin(0, BTC));

        vm.warp(block.timestamp + 365 days);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(IReadable.NameExpired.selector, tokenId));
        registry.setAddrs(tokenId, _coin(0, BTC));
    }

    function test_Addr_IsSilentWhileExpiredAndBackOnRenewal() public {
        vm.prank(alice);
        registry.setAddrs(tokenId, _coin(501, SOL));

        vm.warp(block.timestamp + 365 days);
        assertEq(registry.addr(tokenId, 501), "");

        _renew(alice, tokenId, 1);
        assertEq(registry.addr(tokenId, 501), SOL);
    }

    // --- TRANSFERS ---

    function test_Transfer_MovesTheNameAndResetsIt() public {
        vm.startPrank(alice);
        registry.setTarget(tokenId, stranger);
        registry.setText(tokenId, "records", "alice's");
        registry.setAddrs(tokenId, _coin(0, BTC));
        vm.expectEmit(true, true, false, true);
        emit IReadable.TargetChanged(tokenId, bob);
        registry.transferFrom(alice, bob, tokenId);
        vm.stopPrank();

        assertEq(registry.ownerOf(tokenId), bob);
        assertEq(registry.resolve(tokenId), bob);
        assertEq(registry.text(tokenId, "records"), "");
        assertEq(registry.addr(tokenId, 0), "");
        assertEq(registry.balanceOf(alice), 0);
        assertEq(registry.balanceOf(bob), 1);
        assertEq(registry.namesOf(alice).length, 0);
        assertEq(registry.namesOf(bob)[0], tokenId);
        // The term is the name's, not the holder's
        assertEq(registry.recordOf(tokenId).expiresAt, block.timestamp + 365 days);
    }

    function test_Transfer_ByAnApprovedAccount() public {
        vm.prank(alice);
        registry.approve(bob, tokenId);
        assertEq(registry.getApproved(tokenId), bob);

        vm.prank(bob);
        registry.transferFrom(alice, stranger, tokenId);
        assertEq(registry.ownerOf(tokenId), stranger);
        assertEq(registry.getApproved(tokenId), address(0));
    }

    function test_Transfer_ByAnOperator() public {
        vm.prank(alice);
        registry.setApprovalForAll(bob, true);
        assertTrue(registry.isApprovedForAll(alice, bob));

        vm.prank(bob);
        registry.transferFrom(alice, bob, tokenId);
        assertEq(registry.ownerOf(tokenId), bob);
    }

    function test_Transfer_IsRefusedToAStranger() public {
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(IERC721Errors.ERC721InsufficientApproval.selector, stranger, tokenId));
        registry.transferFrom(alice, stranger, tokenId);
    }

    function test_Transfer_IsRefusedToNobody() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(IERC721Errors.ERC721InvalidReceiver.selector, address(0)));
        registry.transferFrom(alice, address(0), tokenId);
    }

    function test_Transfer_IsRefusedOnceTheNameExpired() public {
        vm.warp(block.timestamp + 365 days);
        vm.startPrank(alice);
        vm.expectRevert(abi.encodeWithSelector(IReadable.NameExpired.selector, tokenId));
        registry.transferFrom(alice, bob, tokenId);
        vm.expectRevert(abi.encodeWithSelector(IReadable.NameExpired.selector, tokenId));
        registry.safeTransferFrom(alice, bob, tokenId);
        vm.stopPrank();

        // One second earlier it still moved
        vm.warp(block.timestamp - 1);
        vm.prank(alice);
        registry.transferFrom(alice, bob, tokenId);
    }

    function test_SafeTransfer_AsksTheReceivingContract() public {
        address vault = address(new Vault());
        address bare = address(new BareAccount());

        vm.startPrank(alice);
        vm.expectRevert(abi.encodeWithSelector(IERC721Errors.ERC721InvalidReceiver.selector, bare));
        registry.safeTransferFrom(alice, bare, tokenId);

        registry.safeTransferFrom(alice, vault, tokenId);
        vm.stopPrank();
        assertEq(registry.ownerOf(tokenId), vault);
        assertEq(registry.resolve(tokenId), vault);
    }

    function test_Transfer_APlainTransferReachesAnyContract() public {
        address bare = address(new BareAccount());
        vm.prank(alice);
        registry.transferFrom(alice, bare, tokenId);
        assertEq(registry.ownerOf(tokenId), bare);
    }

    function test_Transfer_KeepsTheListOfNamesRight() public {
        uint256 second = _register(alice, numbers, "4343");
        uint256 third = _register(alice, numbers, "4444");
        assertEq(registry.namesOf(alice).length, 3);

        vm.prank(alice);
        registry.transferFrom(alice, bob, second);

        uint256[] memory held = registry.namesOf(alice);
        assertEq(held.length, 2);
        assertTrue((held[0] == tokenId && held[1] == third) || (held[0] == third && held[1] == tokenId));
        assertEq(registry.namesOf(bob)[0], second);
        assertEq(registry.balanceOf(alice), 2);
    }

    function test_Approve_AnnouncesItself() public {
        vm.expectEmit(true, true, true, true);
        emit IERC721.Approval(alice, bob, tokenId);
        vm.prank(alice);
        registry.approve(bob, tokenId);

        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(IERC721Errors.ERC721InvalidApprover.selector, stranger));
        registry.approve(stranger, tokenId);
    }
}
