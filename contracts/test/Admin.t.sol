// SPDX-License-Identifier: MIT
pragma solidity ^0.8.35;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {IERC4906} from "@openzeppelin/contracts/interfaces/IERC4906.sol";
import {IReadable} from "../src/IReadable.sol";
import {BareAccount, Fixture} from "./Fixture.sol";

/// @dev Every setting of the registry: what it changes, what it refuses and who may call it.
contract AdminTest is Fixture {
    function _expectNotOwner(address caller) internal {
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, caller));
    }

    // --- WHO MAY CALL ---

    function test_EverySettingIsTheOwnersAlone() public {
        uint256[] memory prices = _flat(1);
        string[] memory labels = _one("4242");

        vm.startPrank(alice);
        _expectNotOwner(alice);
        registry.addNamespace(IReadable.Kind.Name, "hup", 3, 32, 0, prices, address(0), 0, "");
        _expectNotOwner(alice);
        registry.updateNamespace(numbers, 2, 12, 8, false, address(0), 0, "");
        _expectNotOwner(alice);
        registry.setPrices(numbers, prices);
        _expectNotOwner(alice);
        registry.setReserved(numbers, labels, true);
        _expectNotOwner(alice);
        registry.adminRegister(numbers, "4242", alice, 1);
        _expectNotOwner(alice);
        registry.setGracePeriod(60 days);
        _expectNotOwner(alice);
        registry.setNameRules(alice);
        _expectNotOwner(alice);
        registry.setTrustedForwarder(alice);
        _expectNotOwner(alice);
        registry.setTreasury(alice);
        _expectNotOwner(alice);
        registry.setBaseURI("https://elsewhere.example/");
        _expectNotOwner(alice);
        registry.withdraw(alice, 0);
        _expectNotOwner(alice);
        registry.pause();
        _expectNotOwner(alice);
        registry.unpause();
        _expectNotOwner(alice);
        registry.transferOwnership(alice);
        _expectNotOwner(alice);
        registry.renounceOwnership();
        _expectNotOwner(alice);
        registry.acceptOwnership();
        vm.stopPrank();
    }

    // --- ADD NAMESPACE ---

    function test_AddNamespace_StoresItAndItsPrices() public {
        vm.expectEmit(true, false, false, true);
        emit IReadable.NamespaceAdded(3, IReadable.Kind.Name, "hup");
        vm.expectEmit(true, false, false, true);
        emit IReadable.PricesUpdated(3, _namePrices());
        vm.prank(owner);
        uint256 id = registry.addNamespace(IReadable.Kind.Name, "hup", 3, 32, 0, _namePrices(), manager, 25, "{}");

        assertEq(id, 3);
        assertEq(registry.namespaceCount(), 3);
        IReadable.Namespace memory stored = registry.getNamespaces()[2];
        assertEq(stored.id, 3);
        assertEq(stored.name, "hup");
        assertEq(stored.manager, manager);
        assertEq(stored.managerShare, 25);
        assertEq(stored.metadata, "{}");
        assertEq(registry.getPrices(3).length, 3);

        uint256 tokenId = _register(alice, id, "alice");
        assertEq(registry.nameOf(tokenId), "alice.hup");
    }

    function test_AddNamespace_TakesOnlyCleanNames() public {
        uint256[] memory prices = _flat(1);
        string[11] memory bad = [
            "",
            "Hup",
            "hu p",
            "-hup",
            "hup-",
            "hup.",
            "h_p",
            "abcdefghijklmnopqrstuvwxyzabcdefg", // 33 characters
            unicode"é",
            ".hup",
            "+0"
        ];

        vm.startPrank(owner);
        for (uint256 i = 0; i < bad.length; i++) {
            vm.expectRevert(IReadable.InvalidNamespaceName.selector);
            registry.addNamespace(IReadable.Kind.Name, bad[i], 3, 32, 0, prices, address(0), 0, "");
        }
        // A number prefix is digits and nothing else
        vm.expectRevert(IReadable.InvalidNamespaceName.selector);
        registry.addNamespace(IReadable.Kind.Number, "1a", 2, 12, 0, prices, address(0), 0, "");
        vm.expectRevert(IReadable.InvalidNamespaceName.selector);
        registry.addNamespace(IReadable.Kind.Number, "1-1", 2, 12, 0, prices, address(0), 0, "");

        registry.addNamespace(IReadable.Kind.Name, "hup-2", 3, 32, 0, prices, address(0), 0, "");
        registry.addNamespace(IReadable.Kind.Name, "abcdefghijklmnopqrstuvwxyzabcdef", 3, 32, 0, prices, address(0), 0, "");
        registry.addNamespace(IReadable.Kind.Number, "1", 2, 12, 0, prices, address(0), 0, "");
        vm.stopPrank();
    }

    function test_AddNamespace_TakesANameOnceAcrossKinds() public {
        uint256[] memory prices = _flat(1);
        vm.startPrank(owner);
        vm.expectRevert(abi.encodeWithSelector(IReadable.NamespaceNameTaken.selector, "arc"));
        registry.addNamespace(IReadable.Kind.Name, "arc", 3, 32, 0, prices, address(0), 0, "");
        // The number prefix 0 and an extension .0 would be the same name
        vm.expectRevert(abi.encodeWithSelector(IReadable.NamespaceNameTaken.selector, "0"));
        registry.addNamespace(IReadable.Kind.Name, "0", 3, 32, 0, prices, address(0), 0, "");
        vm.stopPrank();
    }

    function test_AddNamespace_RefusesBadRules() public {
        uint256[] memory prices = _flat(1);
        uint256[] memory none = new uint256[](0);
        uint256[] memory rising = new uint256[](2);
        rising[0] = 1;
        rising[1] = 2;

        vm.startPrank(owner);
        vm.expectRevert(IReadable.InvalidLengthRange.selector);
        registry.addNamespace(IReadable.Kind.Name, "hup", 0, 32, 0, prices, address(0), 0, "");
        vm.expectRevert(IReadable.InvalidLengthRange.selector);
        registry.addNamespace(IReadable.Kind.Name, "hup", 5, 4, 0, prices, address(0), 0, "");
        vm.expectRevert(IReadable.InvalidShare.selector);
        registry.addNamespace(IReadable.Kind.Name, "hup", 3, 32, 0, prices, manager, 101, "");
        vm.expectRevert(IReadable.InvalidPriceCurve.selector);
        registry.addNamespace(IReadable.Kind.Name, "hup", 3, 32, 0, none, address(0), 0, "");
        vm.expectRevert(IReadable.InvalidPriceCurve.selector);
        registry.addNamespace(IReadable.Kind.Name, "hup", 3, 32, 0, rising, address(0), 0, "");
        vm.stopPrank();

        // Nothing of a refused namespace is kept
        assertEq(registry.namespaceCount(), 2);
        vm.prank(owner);
        assertEq(registry.addNamespace(IReadable.Kind.Name, "hup", 3, 32, 0, prices, address(0), 0, ""), 3);
    }

    function test_AddNamespace_RefusesAKindThatDoesNotExist() public {
        bytes memory call = abi.encodeWithSelector(
            IReadable.addNamespace.selector, uint8(2), "hup", uint8(3), uint8(32), uint8(0), _flat(1), address(0), uint8(0), ""
        );
        vm.prank(owner);
        (bool success, ) = address(registry).call(call);
        assertFalse(success);
    }

    // --- UPDATE NAMESPACE ---

    function test_UpdateNamespace_ChangesTheRulesNotTheName() public {
        vm.expectEmit(true, false, false, true);
        emit IReadable.NamespaceUpdated(arc);
        vm.prank(owner);
        registry.updateNamespace(arc, 5, 10, 0, true, dao, 30, "{\"title\":\"Arc\"}");

        IReadable.Namespace memory stored = registry.getNamespaces()[1];
        assertEq(stored.name, "arc");
        assertEq(uint8(stored.kind), uint8(IReadable.Kind.Name));
        assertEq(stored.minLength, 5);
        assertEq(stored.maxLength, 10);
        assertTrue(stored.paused);
        assertEq(stored.manager, dao);
        assertEq(stored.managerShare, 30);
        assertEq(stored.metadata, "{\"title\":\"Arc\"}");
    }

    function test_UpdateNamespace_NewRulesBindNewNamesOnly() public {
        uint256 tokenId = _register(alice, arc, "abc");
        vm.prank(owner);
        registry.updateNamespace(arc, 5, 10, 0, false, manager, 10, "");

        _assertValidity(arc, "abcd", IReadable.Validity.TooShort);
        assertEq(registry.ownerOf(tokenId), alice);
        assertEq(registry.resolve(tokenId), alice);
        _renew(alice, tokenId, 1);
    }

    function test_UpdateNamespace_RefusesBadRules() public {
        vm.startPrank(owner);
        vm.expectRevert(abi.encodeWithSelector(IReadable.UnknownNamespace.selector, 99));
        registry.updateNamespace(99, 3, 32, 0, false, address(0), 0, "");
        vm.expectRevert(IReadable.InvalidLengthRange.selector);
        registry.updateNamespace(arc, 0, 32, 0, false, address(0), 0, "");
        vm.expectRevert(IReadable.InvalidLengthRange.selector);
        registry.updateNamespace(arc, 9, 8, 0, false, address(0), 0, "");
        vm.expectRevert(IReadable.InvalidShare.selector);
        registry.updateNamespace(arc, 3, 32, 0, false, manager, 101, "");
        registry.updateNamespace(arc, 3, 32, 0, false, manager, 100, "");
        vm.stopPrank();
    }

    function test_UpdateNamespace_TurnsTheCheckDigitOnAndOff() public {
        _assertValidity(numbers, "42421231", IReadable.Validity.InvalidCheckDigit);
        vm.prank(owner);
        registry.updateNamespace(numbers, 2, 12, 0, false, address(0), 0, "");
        _assertValidity(numbers, "42421231", IReadable.Validity.Valid);
    }

    // --- PRICES AND RESERVATIONS ---

    function test_SetPrices_ReplacesTheCurve() public {
        uint256[] memory prices = new uint256[](2);
        prices[0] = 9 * DOLLAR;
        prices[1] = 3 * DOLLAR;

        vm.expectEmit(true, false, false, true);
        emit IReadable.PricesUpdated(numbers, prices);
        vm.prank(owner);
        registry.setPrices(numbers, prices);

        assertEq(registry.getPrices(numbers).length, 2);
        assertEq(registry.priceOf(numbers, "42", 1), 9 * DOLLAR);
        assertEq(registry.priceOf(numbers, "4242", 1), 3 * DOLLAR);
    }

    function test_SetPrices_RefusesABadCurve() public {
        uint256[] memory rising = new uint256[](3);
        rising[0] = 5;
        rising[1] = 5;
        rising[2] = 6;

        vm.startPrank(owner);
        vm.expectRevert(IReadable.InvalidPriceCurve.selector);
        registry.setPrices(numbers, new uint256[](0));
        vm.expectRevert(IReadable.InvalidPriceCurve.selector);
        registry.setPrices(numbers, rising);
        vm.expectRevert(abi.encodeWithSelector(IReadable.UnknownNamespace.selector, 99));
        registry.setPrices(99, _flat(1));
        vm.stopPrank();

        assertEq(registry.getPrices(numbers).length, 7);
    }

    function test_SetReserved_TakesABatchAndGivesItBack() public {
        string[] memory labels = new string[](3);
        labels[0] = "111";
        labels[1] = "222";
        labels[2] = "333";

        vm.expectEmit(true, false, false, true);
        emit IReadable.ReservedUpdated(numbers, "111", true);
        vm.prank(owner);
        registry.setReserved(numbers, labels, true);

        assertTrue(registry.isReserved(numbers, "111"));
        assertTrue(registry.isReserved(numbers, "333"));
        assertFalse(registry.isReserved(numbers, "444"));

        vm.prank(owner);
        registry.setReserved(numbers, _one("222"), false);
        assertFalse(registry.isReserved(numbers, "222"));
        _register(alice, numbers, "222");

        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(IReadable.UnknownNamespace.selector, 99));
        registry.setReserved(99, labels, true);
    }

    function test_SetReserved_TakesOnlyWhatCouldBeAName() public {
        string[] memory labels = new string[](2);
        labels[0] = "333";
        labels[1] = "33 3";

        vm.startPrank(owner);
        _expectInvalid(IReadable.Validity.InvalidCharacter);
        registry.setReserved(numbers, labels, true);
        _expectInvalid(IReadable.Validity.InvalidCharacter);
        registry.setReserved(arc, _one("ad min"), true);
        _expectInvalid(IReadable.Validity.TooShort);
        registry.setReserved(arc, _one(""), true);
        vm.stopPrank();

        // A refused batch reserves nothing of itself
        assertFalse(registry.isReserved(numbers, "333"));
        assertFalse(registry.isReserved(arc, "ad min"));
    }

    function test_SetReserved_AnnouncesTheFormItStores() public {
        vm.expectEmit(true, false, false, true);
        emit IReadable.ReservedUpdated(arc, "admin", true);
        vm.prank(owner);
        registry.setReserved(arc, _one("ADMIN"), true);
    }

    function test_SetReserved_LeavesAHolderItsName() public {
        uint256 tokenId = _register(alice, numbers, "4242");
        vm.prank(owner);
        registry.setReserved(numbers, _one("4242"), true);

        assertEq(registry.ownerOf(tokenId), alice);
        assertEq(registry.resolve(tokenId), alice);
        vm.prank(alice);
        registry.transferFrom(alice, bob, tokenId);
    }

    // --- REGISTRY SETTINGS ---

    function test_SetGracePeriod_StaysWithinItsBounds() public {
        assertEq(registry.MIN_GRACE_PERIOD(), 30 days);
        assertEq(registry.MAX_GRACE_PERIOD(), 365 days);

        vm.startPrank(owner);
        vm.expectRevert(IReadable.InvalidGracePeriod.selector);
        registry.setGracePeriod(0);
        vm.expectRevert(IReadable.InvalidGracePeriod.selector);
        registry.setGracePeriod(30 days - 1);
        vm.expectRevert(IReadable.InvalidGracePeriod.selector);
        registry.setGracePeriod(365 days + 1);
        vm.expectRevert(IReadable.InvalidGracePeriod.selector);
        registry.setGracePeriod(type(uint64).max);

        registry.setGracePeriod(30 days);
        registry.setGracePeriod(365 days);
        vm.stopPrank();
        assertEq(registry.gracePeriod(), 365 days);
    }

    function test_SetGracePeriod_MovesTheRelease() public {
        uint256 tokenId = _register(alice, numbers, "4242");

        vm.expectEmit(false, false, false, true);
        emit IReadable.GracePeriodUpdated(90 days);
        vm.prank(owner);
        registry.setGracePeriod(90 days);
        assertEq(registry.gracePeriod(), 90 days);

        vm.warp(block.timestamp + 365 days + 89 days);
        assertFalse(registry.lookup(numbers, "4242").available);
        _renew(alice, tokenId, 1);
    }

    function test_SetTrustedForwarder_ReplacesTheOldOne() public {
        vm.prank(owner);
        vm.expectRevert(IReadable.InvalidAddress.selector);
        registry.setTrustedForwarder(address(0));

        vm.expectEmit(true, false, false, true);
        emit IReadable.TrustedForwarderUpdated(stranger);
        vm.prank(owner);
        registry.setTrustedForwarder(stranger);

        assertTrue(registry.isTrustedForwarder(stranger));
        assertFalse(registry.isTrustedForwarder(address(forwarder)));
        assertEq(registry.trustedForwarder(), stranger);
    }

    function test_SetTreasury_SetsAndClears() public {
        vm.expectEmit(true, false, false, true);
        emit IReadable.TreasuryUpdated(dao);
        vm.prank(owner);
        registry.setTreasury(dao);
        assertEq(registry.treasury(), dao);

        vm.prank(owner);
        registry.setTreasury(address(0));
        assertEq(registry.treasury(), address(0));
    }

    function test_SetBaseUri_TellsMarketplacesToReload() public {
        vm.expectEmit(false, false, false, true);
        emit IReadable.BaseURIUpdated("https://readable.name/nft/");
        vm.expectEmit(false, false, false, true);
        emit IERC4906.BatchMetadataUpdate(0, type(uint256).max);
        vm.prank(owner);
        registry.setBaseURI("https://readable.name/nft/");
        assertEq(registry.baseURI(), "https://readable.name/nft/");
    }

    // --- WITHDRAW ---

    function test_Withdraw_SendsAnAmountOrEverything() public {
        _register(alice, numbers, "4242");

        vm.expectEmit(true, false, false, true);
        emit IReadable.Withdrawal(dao, 40 * DOLLAR);
        vm.startPrank(owner);
        registry.withdraw(dao, 40 * DOLLAR);
        assertEq(dao.balance, 40 * DOLLAR);

        registry.withdraw(owner, 0);
        assertEq(owner.balance, 60 * DOLLAR);
        assertEq(address(registry).balance, 0);

        vm.expectRevert(IReadable.InvalidAddress.selector);
        registry.withdraw(address(0), 0);
        vm.expectRevert();
        registry.withdraw(dao, 1);
        vm.stopPrank();
    }

    function test_Withdraw_StopsAtAWalletThatCannotReceive() public {
        _register(alice, numbers, "4242");

        address deaf = address(new BareAccount());
        vm.startPrank(owner);
        vm.expectRevert(IReadable.TransferFailed.selector);
        registry.withdraw(deaf, 0);
        registry.withdraw(dao, 0);
        vm.stopPrank();

        assertEq(dao.balance, 100 * DOLLAR);
        assertEq(address(registry).balance, 0);
    }

    function test_Registry_TakesNoStrayCoin() public {
        vm.deal(alice, 1 ether);
        vm.prank(alice);
        (bool success, ) = address(registry).call{value: 1}("");
        assertFalse(success);
    }

    // --- PAUSE ---

    function test_Pause_StopsNewNamesAndNothingElse() public {
        uint256 tokenId = _register(alice, numbers, "4242");
        vm.prank(owner);
        registry.pause();
        assertTrue(registry.paused());

        vm.startPrank(alice);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        registry.register{value: 100 * DOLLAR}(numbers, "4343", 1);

        // A holder is never locked out of its own name
        registry.renew{value: 100 * DOLLAR}(tokenId, 1);
        registry.setTarget(tokenId, bob);
        registry.setText(tokenId, "records", "x");
        registry.setAddrs(tokenId, _coin(0, hex"00"));
        registry.setPrimaryName(tokenId);
        registry.transferFrom(alice, bob, tokenId);
        vm.stopPrank();

        vm.startPrank(owner);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        registry.pause();
        registry.unpause();
        vm.expectRevert(Pausable.ExpectedPause.selector);
        registry.unpause();
        vm.stopPrank();
        assertFalse(registry.paused());
    }

    // --- OWNERSHIP ---

    function test_Ownership_MovesInTwoSteps() public {
        vm.prank(owner);
        registry.transferOwnership(dao);
        // Nothing has moved until the new owner accepts
        assertEq(registry.owner(), owner);
        assertEq(registry.pendingOwner(), dao);
        vm.prank(owner);
        registry.pause();

        vm.prank(stranger);
        _expectNotOwner(stranger);
        registry.acceptOwnership();

        vm.prank(dao);
        registry.acceptOwnership();
        assertEq(registry.owner(), dao);
        assertEq(registry.pendingOwner(), address(0));

        vm.prank(owner);
        _expectNotOwner(owner);
        registry.unpause();
        vm.prank(dao);
        registry.unpause();
    }

    function test_Ownership_AMistypedTransferCanBeTakenBack() public {
        vm.startPrank(owner);
        registry.transferOwnership(stranger);
        registry.transferOwnership(dao);
        assertEq(registry.pendingOwner(), dao);
        // And cancelled altogether
        registry.transferOwnership(address(0));
        assertEq(registry.pendingOwner(), address(0));
        vm.stopPrank();

        vm.prank(stranger);
        _expectNotOwner(stranger);
        registry.acceptOwnership();
        assertEq(registry.owner(), owner);
    }

    function test_Ownership_TheOwnerHoldsNoPowerOverAName() public {
        uint256 tokenId = _register(alice, numbers, "4242");

        vm.startPrank(owner);
        vm.expectRevert();
        registry.transferFrom(alice, owner, tokenId);
        vm.expectRevert(abi.encodeWithSelector(IReadable.NotNameOwner.selector, tokenId));
        registry.setTarget(tokenId, owner);
        vm.expectRevert(abi.encodeWithSelector(IReadable.NotNameOwner.selector, tokenId));
        registry.setText(tokenId, "records", "owner's");
        vm.expectRevert(abi.encodeWithSelector(IReadable.NotNameOwner.selector, tokenId));
        registry.setAddrs(tokenId, _coin(0, hex"00"));
        vm.expectRevert();
        registry.adminRegister(numbers, "4242", owner, 1);
        vm.stopPrank();

        // Pausing, repricing and reserving leave it where it is
        vm.startPrank(owner);
        registry.updateNamespace(numbers, 2, 12, 8, true, address(0), 0, "");
        registry.setPrices(numbers, _flat(1_000_000 * DOLLAR));
        registry.setReserved(numbers, _one("4242"), true);
        vm.stopPrank();
        assertEq(registry.ownerOf(tokenId), alice);
        assertEq(registry.resolve(tokenId), alice);
    }
}
