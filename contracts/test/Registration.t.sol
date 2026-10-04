// SPDX-License-Identifier: MIT
pragma solidity ^0.8.35;

import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC4906} from "@openzeppelin/contracts/interfaces/IERC4906.sol";
import {IReadable} from "../src/IReadable.sol";
import {BareAccount, Fixture, GreedyManager} from "./Fixture.sol";

/// @dev register, renew and adminRegister, and the payment they collect.
contract RegistrationTest is Fixture {
    // --- REGISTER ---

    function test_Register_WritesTheRecordAndMints() public {
        uint256 tokenId = registry.tokenIdOf(numbers, "4242");
        uint256 before = alice.balance;

        vm.expectEmit(true, true, true, true);
        emit IReadable.NameRegistered(tokenId, numbers, "4242", alice, uint64(block.timestamp + 365 days));
        vm.prank(alice);
        uint256 minted = registry.register{value: 100 * DOLLAR}(numbers, "4242", 1);

        assertEq(minted, tokenId);
        assertEq(registry.ownerOf(tokenId), alice);
        assertEq(registry.balanceOf(alice), 1);

        IReadable.Record memory record = registry.recordOf(tokenId);
        assertEq(record.namespaceId, numbers);
        assertEq(record.label, "4242");
        assertEq(record.target, alice);
        assertEq(record.registeredAt, block.timestamp);
        assertEq(record.expiresAt, block.timestamp + 365 days);

        assertEq(address(registry).balance, 100 * DOLLAR);
        assertEq(before - alice.balance, 100 * DOLLAR);
    }

    function test_Register_PricesByLength() public {
        uint256 before = alice.balance;
        _register(alice, numbers, "42");
        assertEq(before - alice.balance, 2000 * DOLLAR);

        before = alice.balance;
        _register(alice, numbers, "424");
        assertEq(before - alice.balance, 500 * DOLLAR);

        before = alice.balance;
        _register(alice, numbers, _withCheckDigit("4242123"));
        assertEq(before - alice.balance, 1 * DOLLAR);

        // Past the end of the curve the last price applies
        before = alice.balance;
        _register(alice, numbers, _withCheckDigit("42421234567"));
        assertEq(before - alice.balance, 1 * DOLLAR);
    }

    function test_Register_EveryTermFromOneToTenYears() public {
        for (uint256 yearCount = 1; yearCount <= 10; yearCount++) {
            string memory label = string.concat("55", vm.toString(yearCount + 10));
            uint256 before = alice.balance;
            vm.prank(alice);
            uint256 tokenId = registry.register{value: 100 * DOLLAR * yearCount}(numbers, label, yearCount);

            assertEq(before - alice.balance, 100 * DOLLAR * yearCount);
            assertEq(registry.recordOf(tokenId).expiresAt, block.timestamp + yearCount * 365 days);
        }
    }

    function test_Register_RefusesAnOddTerm() public {
        vm.startPrank(alice);
        vm.expectRevert(abi.encodeWithSelector(IReadable.InvalidYears.selector, 0));
        registry.register(numbers, "4242", 0);
        vm.expectRevert(abi.encodeWithSelector(IReadable.InvalidYears.selector, 11));
        registry.register{value: 1100 * DOLLAR}(numbers, "4242", 11);
        vm.stopPrank();
    }

    function test_Register_RefusesEveryInvalidLabel() public {
        vm.startPrank(owner);
        registry.setReserved(numbers, _one("707"), true);
        vm.stopPrank();

        vm.startPrank(alice);
        _expectInvalid(IReadable.Validity.UnknownNamespace);
        registry.register(99, "4242", 1);
        _expectInvalid(IReadable.Validity.InvalidCharacter);
        registry.register(numbers, "42a2", 1);
        _expectInvalid(IReadable.Validity.TooShort);
        registry.register(numbers, "4", 1);
        _expectInvalid(IReadable.Validity.TooShort);
        registry.register(numbers, "", 1);
        _expectInvalid(IReadable.Validity.TooLong);
        registry.register(numbers, "1234567890123", 1);
        _expectInvalid(IReadable.Validity.InvalidCheckDigit);
        registry.register(numbers, "42421231", 1);
        _expectInvalid(IReadable.Validity.Reserved);
        registry.register{value: 500 * DOLLAR}(numbers, "707", 1);
        vm.stopPrank();

        vm.prank(owner);
        registry.updateNamespace(numbers, 2, 12, 8, true, address(0), 0, "");
        vm.prank(alice);
        _expectInvalid(IReadable.Validity.NamespacePaused);
        registry.register{value: 100 * DOLLAR}(numbers, "4242", 1);
    }

    function test_Register_RefusesATakenName() public {
        uint256 tokenId = _register(alice, numbers, "4242");
        uint64 availableAt = registry.recordOf(tokenId).expiresAt + registry.gracePeriod();

        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(IReadable.NameUnavailable.selector, tokenId, availableAt));
        registry.register{value: 100 * DOLLAR}(numbers, "4242", 1);

        // The holder can't register it twice either
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(IReadable.NameUnavailable.selector, tokenId, availableAt));
        registry.register{value: 100 * DOLLAR}(numbers, "4242", 1);
    }

    function test_Register_StopsWhileTheRegistryIsPaused() public {
        vm.prank(owner);
        registry.pause();
        vm.prank(alice);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        registry.register{value: 100 * DOLLAR}(numbers, "4242", 1);

        vm.prank(owner);
        registry.unpause();
        _register(alice, numbers, "4242");
    }

    function test_Register_TheLastSecondOfGraceStillBelongsToTheHolder() public {
        uint256 tokenId = _register(alice, numbers, "4242");
        uint256 availableAt = registry.recordOf(tokenId).expiresAt + registry.gracePeriod();

        vm.warp(availableAt - 1);
        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(IReadable.NameUnavailable.selector, tokenId, uint64(availableAt)));
        registry.register{value: 100 * DOLLAR}(numbers, "4242", 1);

        vm.warp(availableAt);
        _register(bob, numbers, "4242");
        assertEq(registry.ownerOf(tokenId), bob);
    }

    function test_Register_AReleasedNameStartsClean() public {
        uint256 tokenId = _register(alice, numbers, "4242");
        vm.startPrank(alice);
        registry.setPrimaryName(tokenId);
        registry.setTarget(tokenId, stranger);
        registry.setText(tokenId, "records", "alice's");
        registry.setAddrs(tokenId, _coin(501, hex"a11ce0"));
        registry.approve(stranger, tokenId);
        vm.stopPrank();

        vm.warp(block.timestamp + 365 days + 30 days);
        _register(bob, numbers, "4242");

        assertEq(registry.ownerOf(tokenId), bob);
        assertEq(registry.resolve(tokenId), bob);
        assertEq(registry.text(tokenId, "records"), "");
        assertEq(registry.addr(tokenId, 501), "");
        assertEq(registry.getApproved(tokenId), address(0));
        assertEq(registry.recordOf(tokenId).registeredAt, block.timestamp);
        assertEq(registry.balanceOf(alice), 0);
        assertEq(registry.namesOf(alice).length, 0);
        assertEq(registry.namesOf(bob).length, 1);
        (uint256 primary, ) = registry.primaryNameOf(alice);
        assertEq(primary, 0);

        // What alice approved no longer moves the name
        vm.prank(stranger);
        vm.expectRevert();
        registry.transferFrom(bob, stranger, tokenId);
    }

    // --- PAYMENT ---

    function test_Payment_WantsTheExactPrice() public {
        vm.startPrank(alice);
        vm.expectRevert(abi.encodeWithSelector(IReadable.IncorrectPayment.selector, 100 * DOLLAR, 100 * DOLLAR - 1));
        registry.register{value: 100 * DOLLAR - 1}(numbers, "4242", 1);
        vm.expectRevert(abi.encodeWithSelector(IReadable.IncorrectPayment.selector, 100 * DOLLAR, 100 * DOLLAR + 1));
        registry.register{value: 100 * DOLLAR + 1}(numbers, "4242", 1);
        vm.expectRevert(abi.encodeWithSelector(IReadable.IncorrectPayment.selector, 100 * DOLLAR, 0));
        registry.register(numbers, "4242", 1);

        registry.register{value: 100 * DOLLAR}(numbers, "4242", 1);
        vm.stopPrank();
        assertEq(address(registry).balance, 100 * DOLLAR);
    }

    function test_Payment_NeedsTheBalance() public {
        address carol = makeAddr("carol");
        vm.deal(carol, 100 * DOLLAR - 1);
        vm.prank(carol);
        vm.expectRevert();
        registry.register{value: 100 * DOLLAR}(numbers, "4242", 1);
    }

    function test_Payment_AFreeTierTakesNothing() public {
        uint256[] memory prices = new uint256[](2);
        prices[0] = 10 * DOLLAR;
        prices[1] = 0;
        vm.prank(owner);
        uint256 free = registry.addNamespace(IReadable.Kind.Name, "free", 3, 32, 0, prices, manager, 10, "");

        address carol = makeAddr("carol");
        vm.deal(carol, 1 ether);
        // Nothing is the price, so a coin sent with it is refused
        vm.prank(carol);
        vm.expectRevert(abi.encodeWithSelector(IReadable.IncorrectPayment.selector, 0, 1));
        registry.register{value: 1}(free, "carol", 10);

        vm.prank(carol);
        uint256 tokenId = registry.register(free, "carol", 10);
        assertEq(registry.ownerOf(tokenId), carol);
        assertEq(address(registry).balance, 0);
        assertEq(manager.balance, 0);
    }

    function test_Payment_APayeeThatCannotReceiveStopsTheSale() public {
        address deaf = address(new BareAccount());
        vm.prank(owner);
        registry.setTreasury(deaf);

        vm.prank(alice);
        vm.expectRevert(IReadable.TransferFailed.selector);
        registry.register{value: 100 * DOLLAR}(numbers, "4242", 1);
    }

    function test_Payment_AManagerThatCallsBackGainsNothing() public {
        GreedyManager greedy = new GreedyManager(registry, numbers);
        vm.prank(owner);
        registry.updateNamespace(numbers, 2, 12, 8, false, address(greedy), 20, "");

        vm.prank(alice);
        uint256 tokenId = registry.register{value: 100 * DOLLAR}(numbers, "4242", 1);

        assertTrue(greedy.reentered());
        assertEq(registry.ownerOf(tokenId), alice);
        // Its cut is a fifth of the price, short of the price of a name of its own
        assertEq(address(greedy).balance, 20 * DOLLAR);
        assertEq(registry.balanceOf(address(greedy)), 0);
        assertEq(address(registry).balance, 80 * DOLLAR);
    }

    // --- THE SPLIT ---

    function test_Split_ManagerAndTreasury() public {
        vm.prank(owner);
        registry.setTreasury(dao);
        _register(alice, arc, "alice");

        assertEq(manager.balance, DOLLAR / 2);
        assertEq(dao.balance, (9 * DOLLAR) / 2);
        assertEq(address(registry).balance, 0);
    }

    function test_Split_WithoutATreasuryTheRegistryKeepsItsShare() public {
        _register(alice, arc, "alice");
        assertEq(manager.balance, DOLLAR / 2);
        assertEq(address(registry).balance, (9 * DOLLAR) / 2);
    }

    function test_Split_ANamespaceWithoutAManagerPaysNone() public {
        _register(alice, numbers, "4242");
        assertEq(manager.balance, 0);
        assertEq(address(registry).balance, 100 * DOLLAR);
    }

    function test_Split_TheWholePriceCanGoToTheManager() public {
        vm.startPrank(owner);
        uint256 full = registry.addNamespace(IReadable.Kind.Name, "full", 3, 32, 0, _flat(10 * DOLLAR), manager, 100, "");
        registry.setTreasury(dao);
        vm.stopPrank();

        _register(alice, full, "alice");

        assertEq(manager.balance, 10 * DOLLAR);
        assertEq(dao.balance, 0);
        assertEq(address(registry).balance, 0);
    }

    function test_Split_RoundsInTheRegistrysFavour() public {
        vm.prank(owner);
        uint256 odd = registry.addNamespace(IReadable.Kind.Name, "odd", 3, 32, 0, _flat(10), manager, 33, "");

        vm.prank(alice);
        registry.register{value: 10}(odd, "alice", 1);

        // A third of ten wei is three; the rest stays with the registry
        assertEq(manager.balance, 3);
        assertEq(address(registry).balance, 7);
    }

    // --- RENEW ---

    function test_Renew_AddsToTheCurrentExpiry() public {
        uint256 tokenId = _register(alice, numbers, "4242");
        uint64 expiresAt = registry.recordOf(tokenId).expiresAt;
        vm.warp(block.timestamp + 100 days);

        vm.expectEmit(true, false, false, true);
        emit IReadable.NameRenewed(tokenId, expiresAt + 3 * 365 days);
        vm.expectEmit(false, false, false, true);
        emit IERC4906.MetadataUpdate(tokenId);
        vm.prank(alice);
        registry.renew{value: 300 * DOLLAR}(tokenId, 3);

        assertEq(registry.recordOf(tokenId).expiresAt, expiresAt + 3 * 365 days);
        assertEq(address(registry).balance, 400 * DOLLAR);
    }

    function test_Renew_WantsTheExactPrice() public {
        uint256 tokenId = _register(alice, numbers, "4242");
        vm.startPrank(alice);
        vm.expectRevert(abi.encodeWithSelector(IReadable.IncorrectPayment.selector, 100 * DOLLAR, 0));
        registry.renew(tokenId, 1);
        vm.expectRevert(abi.encodeWithSelector(IReadable.IncorrectPayment.selector, 100 * DOLLAR, 101 * DOLLAR));
        registry.renew{value: 101 * DOLLAR}(tokenId, 1);
        vm.stopPrank();
    }

    function test_Renew_AnyoneMayPayAndTheHolderKeepsTheName() public {
        uint256 tokenId = _register(alice, numbers, "4242");
        uint256 before = bob.balance;
        _renew(bob, tokenId, 1);

        assertEq(registry.ownerOf(tokenId), alice);
        assertEq(before - bob.balance, 100 * DOLLAR);
    }

    function test_Renew_InGraceBringsTheNameBack() public {
        uint256 tokenId = _register(alice, numbers, "4242");
        vm.warp(block.timestamp + 365 days + 29 days);
        assertEq(registry.resolve(tokenId), address(0));

        _renew(alice, tokenId, 1);
        assertEq(registry.resolve(tokenId), alice);
    }

    function test_Renew_IsTooLateAfterGrace() public {
        uint256 tokenId = _register(alice, numbers, "4242");
        vm.warp(block.timestamp + 365 days + 30 days);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(IReadable.NameExpired.selector, tokenId));
        registry.renew{value: 100 * DOLLAR}(tokenId, 1);
    }

    function test_Renew_RefusesWhatIsNotThere() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(IReadable.NameNotFound.selector, 7));
        registry.renew(7, 1);

        uint256 tokenId = _register(alice, numbers, "4242");
        vm.startPrank(alice);
        vm.expectRevert(abi.encodeWithSelector(IReadable.InvalidYears.selector, 0));
        registry.renew(tokenId, 0);
        vm.expectRevert(abi.encodeWithSelector(IReadable.InvalidYears.selector, 11));
        registry.renew{value: 1100 * DOLLAR}(tokenId, 11);
        vm.stopPrank();
    }

    function test_Renew_PaysTheCurrentPrice() public {
        uint256 tokenId = _register(alice, numbers, "4242");
        vm.prank(owner);
        registry.setPrices(numbers, _flat(7 * DOLLAR));

        uint256 before = alice.balance;
        vm.prank(alice);
        registry.renew{value: 14 * DOLLAR}(tokenId, 2);
        assertEq(before - alice.balance, 14 * DOLLAR);
    }

    function test_Renew_GoesOnWhileItsNamespaceIsPaused() public {
        uint256 tokenId = _register(alice, numbers, "4242");
        vm.prank(owner);
        registry.updateNamespace(numbers, 2, 12, 8, true, address(0), 0, "");
        _renew(alice, tokenId, 1);
    }

    function test_Renew_OfAReservedNameGoesOn() public {
        uint256 tokenId = _register(alice, numbers, "4242");
        vm.prank(owner);
        registry.setReserved(numbers, _one("4242"), true);
        _renew(alice, tokenId, 1);
    }

    function test_Renew_SplitsThePayment() public {
        address carol = makeAddr("carol");
        vm.deal(carol, 1 ether);
        vm.prank(owner);
        registry.setTreasury(dao);
        uint256 tokenId = _register(alice, arc, "alice");
        uint256 managerBefore = manager.balance;
        uint256 daoBefore = dao.balance;

        vm.prank(carol);
        registry.renew{value: 10 * DOLLAR}(tokenId, 2);

        assertEq(manager.balance - managerBefore, 1 * DOLLAR);
        assertEq(dao.balance - daoBefore, 9 * DOLLAR);
        assertEq(carol.balance, 1 ether - 10 * DOLLAR);
    }

    function test_Renew_CanReachPastTenYearsInSteps() public {
        uint256 tokenId = _register(alice, numbers, "4242");
        uint64 expiresAt = registry.recordOf(tokenId).expiresAt;
        _renew(alice, tokenId, 10);
        _renew(alice, tokenId, 10);
        assertEq(registry.recordOf(tokenId).expiresAt, expiresAt + 20 * 365 days);
    }

    // --- ADMIN REGISTER ---

    function test_AdminRegister_GrantsWithoutPayment() public {
        uint256 before = bob.balance;
        vm.prank(owner);
        uint256 tokenId = registry.adminRegister(numbers, "42", bob, 5);

        assertEq(registry.ownerOf(tokenId), bob);
        assertEq(registry.resolve(tokenId), bob);
        assertEq(registry.recordOf(tokenId).expiresAt, block.timestamp + 5 * 365 days);
        assertEq(bob.balance, before);
        assertEq(address(registry).balance, 0);
    }

    function test_AdminRegister_PassesReservationsAndPauses() public {
        vm.startPrank(owner);
        registry.setReserved(numbers, _one("707"), true);
        registry.updateNamespace(numbers, 2, 12, 8, true, address(0), 0, "");
        registry.pause();
        uint256 tokenId = registry.adminRegister(numbers, "707", bob, 1);
        vm.stopPrank();
        assertEq(registry.ownerOf(tokenId), bob);
    }

    function test_AdminRegister_KeepsTheLabelRules() public {
        vm.startPrank(owner);
        _expectInvalid(IReadable.Validity.UnknownNamespace);
        registry.adminRegister(99, "4242", bob, 1);
        _expectInvalid(IReadable.Validity.InvalidCharacter);
        registry.adminRegister(numbers, "42x2", bob, 1);
        _expectInvalid(IReadable.Validity.TooShort);
        registry.adminRegister(numbers, "4", bob, 1);
        _expectInvalid(IReadable.Validity.TooLong);
        registry.adminRegister(numbers, "1234567890123", bob, 1);
        _expectInvalid(IReadable.Validity.InvalidCheckDigit);
        registry.adminRegister(numbers, "42421231", bob, 1);
        vm.expectRevert(abi.encodeWithSelector(IReadable.InvalidYears.selector, 0));
        registry.adminRegister(numbers, "4242", bob, 0);
        vm.expectRevert(abi.encodeWithSelector(IReadable.InvalidYears.selector, 11));
        registry.adminRegister(numbers, "4242", bob, 11);
        vm.expectRevert(IReadable.InvalidAddress.selector);
        registry.adminRegister(numbers, "4242", address(0), 1);
        vm.stopPrank();
    }

    function test_AdminRegister_NeverTakesAHeldName() public {
        uint256 tokenId = _register(alice, numbers, "4242");
        uint64 availableAt = registry.recordOf(tokenId).expiresAt + registry.gracePeriod();

        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(IReadable.NameUnavailable.selector, tokenId, availableAt));
        registry.adminRegister(numbers, "4242", owner, 1);

        // Nor one that expired and is still in its grace period
        vm.warp(block.timestamp + 365 days + 29 days);
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(IReadable.NameUnavailable.selector, tokenId, availableAt));
        registry.adminRegister(numbers, "4242", owner, 1);
    }

    function test_AdminRegister_IsTheOwnersAlone() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        registry.adminRegister(numbers, "4242", alice, 1);
    }
}
