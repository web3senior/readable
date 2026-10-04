// SPDX-License-Identifier: MIT
pragma solidity ^0.8.35;

import {IReadable} from "../src/IReadable.sol";
import {Fixture} from "./Fixture.sol";

/// @dev Rules that must hold for any input, tried with random ones.
contract FuzzTest is Fixture {
    /// forge-config: default.fuzz.runs = 512
    function testFuzz_ThePriceIsSharedOutToTheLastUnit(uint96 price, uint8 managerShare, uint8 yearCount) public {
        managerShare = uint8(bound(managerShare, 0, 100));
        yearCount = uint8(bound(yearCount, 1, 10));
        price = uint96(bound(price, 1, 1_000_000_000 * DOLLAR));

        vm.startPrank(owner);
        uint256 shop = registry.addNamespace(IReadable.Kind.Name, "shop", 3, 32, 0, _flat(price), manager, managerShare, "");
        registry.setTreasury(dao);
        vm.stopPrank();

        uint256 total = uint256(price) * yearCount;
        vm.deal(alice, total);
        vm.prank(alice);
        registry.register{value: total}(shop, "alice", yearCount);

        uint256 toManager = manager.balance;
        uint256 toTreasury = dao.balance;

        assertEq(alice.balance, 0, "the payer pays the price");
        assertEq(toManager + toTreasury, total, "every wei goes to someone");
        assertEq(toManager, (total * managerShare) / 100);
        assertEq(address(registry).balance, 0, "nothing stays behind with a treasury set");
    }

    /// forge-config: default.fuzz.runs = 512
    function testFuzz_WithoutATreasuryTheRestStaysForWithdrawal(uint96 price, uint8 managerShare) public {
        managerShare = uint8(bound(managerShare, 0, 100));
        price = uint96(bound(price, 1, 1_000_000_000 * DOLLAR));

        vm.startPrank(owner);
        uint256 shop = registry.addNamespace(IReadable.Kind.Name, "shop", 3, 32, 0, _flat(price), manager, managerShare, "");
        vm.stopPrank();

        vm.deal(alice, price);
        vm.prank(alice);
        registry.register{value: price}(shop, "alice", 1);

        uint256 kept = address(registry).balance;
        assertEq(kept + manager.balance, price);

        vm.prank(owner);
        registry.withdraw(dao, 0);
        assertEq(dao.balance, kept);
        assertEq(address(registry).balance, 0);
    }

    function testFuzz_ATermIsWholeYears(uint8 yearCount, uint32 start) public {
        yearCount = uint8(bound(yearCount, 1, 10));
        vm.warp(uint256(start) + 1);

        vm.prank(alice);
        uint256 tokenId = registry.register{value: 100 * DOLLAR * yearCount}(numbers, "4242", yearCount);
        uint256 expiresAt = registry.recordOf(tokenId).expiresAt;
        assertEq(expiresAt, block.timestamp + uint256(yearCount) * 365 days);

        // Live until its last second, in grace for thirty days, free after
        vm.warp(expiresAt - 1);
        assertEq(registry.resolve(tokenId), alice);
        vm.warp(expiresAt);
        assertEq(registry.resolve(tokenId), address(0));
        assertFalse(registry.lookup(numbers, "4242").available);
        vm.warp(expiresAt + 30 days);
        assertTrue(registry.lookup(numbers, "4242").available);
    }

    function testFuzz_OnlyOneToTenYearsAreSold(uint256 yearCount) public {
        vm.assume(yearCount == 0 || yearCount > 10);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(IReadable.InvalidYears.selector, yearCount));
        registry.register(numbers, "4242", yearCount);
    }

    function testFuzz_ANumberIsItsDigits(uint256 seed, uint8 length) public view {
        length = uint8(bound(length, 2, 7));
        bytes memory digits = new bytes(length);
        for (uint256 i = 0; i < length; i++) {
            uint256 roll = uint256(keccak256(abi.encode(seed, i)));
            // No leading zero
            digits[i] = bytes1(uint8(i == 0 ? 49 + (roll % 9) : 48 + (roll % 10)));
        }

        IReadable.NameInfo memory info = registry.lookup(numbers, string(digits));
        assertEq(uint8(info.validity), uint8(IReadable.Validity.Valid));
        assertEq(info.length, length);
        assertEq(info.tokenId, uint256(keccak256(abi.encodePacked(numbers, digits))));
    }

    function testFuzz_ANumberWithAnythingElseInItIsRefused(uint256 seed, uint8 at, uint8 stray) public view {
        vm.assume(stray < 48 || stray > 57);
        bytes memory digits = bytes("424242");
        digits[bound(at, 0, digits.length - 1)] = bytes1(stray);
        seed;

        assertEq(uint8(registry.lookup(numbers, string(digits)).validity), uint8(IReadable.Validity.InvalidCharacter));
    }

    function testFuzz_ALongNumberPassesWithItsCheckDigitAlone(uint256 seed, uint8 length) public view {
        length = uint8(bound(length, 7, 11));
        bytes memory body = new bytes(length);
        for (uint256 i = 0; i < length; i++) {
            uint256 roll = uint256(keccak256(abi.encode(seed, i)));
            body[i] = bytes1(uint8(i == 0 ? 49 + (roll % 9) : 48 + (roll % 10)));
        }
        bytes memory good = bytes(_withCheckDigit(body));
        assertEq(uint8(registry.lookup(numbers, string(good)).validity), uint8(IReadable.Validity.Valid));

        // Any other last digit is refused
        uint8 last = uint8(good[good.length - 1]);
        good[good.length - 1] = bytes1(48 + ((last - 48 + 1 + uint8(seed % 9)) % 10));
        assertEq(uint8(registry.lookup(numbers, string(good)).validity), uint8(IReadable.Validity.InvalidCheckDigit));
    }

    /// forge-config: default.fuzz.runs = 2048
    function testFuzz_AnyBytesGetAnAnswer(bytes calldata label) public view {
        // A lookup never reverts, whatever it is handed
        IReadable.NameInfo memory name = registry.lookup(arc, string(label));
        IReadable.NameInfo memory number = registry.lookup(numbers, string(label));

        if (name.validity == IReadable.Validity.Valid) {
            assertGe(name.length, 3);
            assertLe(name.length, 32);
            assertTrue(name.available);
        }
        if (number.validity == IReadable.Validity.Valid) {
            assertEq(number.length, label.length);
        }
    }

    /// forge-config: default.fuzz.runs = 2048
    function testFuzz_AValidNameIsWellFormedText(bytes calldata label) public view {
        if (registry.lookup(arc, string(label)).validity != IReadable.Validity.Valid) return;

        // Whatever the registry takes as a name decodes as UTF-8 with no capital, space or control in it
        uint256 i;
        while (i < label.length) {
            uint8 first = uint8(label[i]);
            uint256 width = first < 0x80 ? 1 : first < 0xe0 ? 2 : first < 0xf0 ? 3 : 4;
            assertLe(i + width, label.length, "a character is cut short");
            if (width == 1) {
                // Capitals arrive and are stored lowered
                bool letter = (first >= 0x61 && first <= 0x7a) || (first >= 0x41 && first <= 0x5a);
                assertTrue(letter || (first >= 0x30 && first <= 0x39) || first == 0x2d, "a stray ASCII character");
            } else {
                assertTrue(first >= 0xc2 && first <= 0xf4, "a byte UTF-8 never starts with");
                for (uint256 k = 1; k < width; k++) assertEq(uint8(label[i + k]) & 0xc0, 0x80, "a bad continuation byte");
            }
            i += width;
        }
    }

    /// forge-config: default.fuzz.runs = 2048
    function testFuzz_TheRulesAnswerAnyBytes(bytes calldata label) public view {
        (bool valid, bytes memory normalized, uint256 length) = rules.measure(label);
        assertEq(normalized.length, label.length);
        if (valid) _assertStandsAsAName(normalized, length);
    }

    /// forge-config: default.fuzz.runs = 4096
    function testFuzz_WhatTheRulesTakeIsOneNameOnly(uint256 seed, uint8 size) public view {
        // Letters of several scripts, marks, joiners, symbols and emoji, in any order
        uint24[40] memory palette = [
            uint24(0x61), 0x62, 0x7a, 0x41, 0x30, 0x39, 0x2d, 0x2d, 0xe9, 0xdf,
            0x639, 0x644, 0x6cc, 0x631, 0x627, 0x62e, 0x621, 0x200c, 0x200c, 0x64e,
            0x651, 0x430, 0x43a, 0x441, 0x3bf, 0x3b3, 0x4f60, 0x597d, 0x30fc, 0xac00,
            0x200d, 0xfe0f, 0x301, 0x20, 0x2e, 0x1f98a, 0x6f1, 0x640, 0xe000, 0x5d0
        ];
        size = uint8(bound(size, 1, 12));
        bytes memory label;
        for (uint256 i = 0; i < size; i++) {
            label = abi.encodePacked(label, _utf8(palette[uint256(keccak256(abi.encode(seed, i))) % palette.length]));
        }

        (bool valid, bytes memory normalized, uint256 length) = rules.measure(label);
        if (!valid) return;
        _assertStandsAsAName(normalized, length);

        // Nothing the rules take carries what a reader can't see, but the joiner between letters
        for (uint256 i = 0; i + 2 < normalized.length; i++) {
            bool joiner = normalized[i] == 0xe2 && normalized[i + 1] == 0x80 && normalized[i + 2] == 0x8c;
            if (joiner) {
                assertGt(i, 0, "a joiner first");
                assertLt(i + 3, normalized.length, "a joiner last");
            }
            assertFalse(normalized[i] == 0xe2 && normalized[i + 1] == 0x80 && normalized[i + 2] == 0x8d, "a zero width joiner");
        }
        assertTrue(normalized[0] != "-" && normalized[normalized.length - 1] != "-", "a hyphen at an end");
    }

    /// @dev The form the rules store is itself taken, as the same name of the same length, and has no capital in it.
    function _assertStandsAsAName(bytes memory normalized, uint256 length) internal view {
        (bool again, bytes memory same, uint256 sameLength) = rules.measure(normalized);
        assertTrue(again, "the stored form is refused");
        assertEq(keccak256(same), keccak256(normalized), "the stored form changes when read again");
        assertEq(sameLength, length);
        assertLe(length, normalized.length);
        for (uint256 i = 0; i < normalized.length; i++) {
            assertFalse(normalized[i] >= "A" && normalized[i] <= "Z", "a capital is stored");
        }
    }

    function testFuzz_ARenewalCostsWhatTheRegistrationDid(uint8 size, uint8 yearCount) public {
        size = uint8(bound(size, 3, 32));
        yearCount = uint8(bound(yearCount, 1, 10));
        bytes memory label = new bytes(size);
        for (uint256 i = 0; i < size; i++) label[i] = "a";

        uint256 paid = _price(arc, string(label), yearCount);
        vm.prank(alice);
        uint256 tokenId = registry.register{value: paid}(arc, string(label), yearCount);

        // Whatever becomes of the rules, the same amount renews it
        vm.prank(owner);
        registry.setNameRules(address(0));
        uint256 before = alice.balance;
        vm.prank(alice);
        registry.renew{value: paid}(tokenId, yearCount);
        assertEq(before - alice.balance, paid);
        assertEq(registry.recordOf(tokenId).length, size);
    }

    function testFuzz_TheGracePeriodStaysWithinItsBounds(uint64 period) public {
        vm.prank(owner);
        if (period < 30 days || period > 365 days) {
            vm.expectRevert(IReadable.InvalidGracePeriod.selector);
            registry.setGracePeriod(period);
            assertEq(registry.gracePeriod(), 30 days);
        } else {
            registry.setGracePeriod(period);
            assertEq(registry.gracePeriod(), period);
        }
    }

    function testFuzz_CapitalsAreTheSameName(uint256 seed) public view {
        bytes memory lower = bytes("alicebob");
        bytes memory mixed = bytes("alicebob");
        for (uint256 i = 0; i < mixed.length; i++) {
            if ((seed >> i) & 1 == 1) mixed[i] = bytes1(uint8(mixed[i]) - 32);
        }
        assertEq(registry.tokenIdOf(arc, string(mixed)), registry.tokenIdOf(arc, string(lower)));
    }

    function testFuzz_OnlyTheHolderChangesAName(address caller) public {
        uint256 tokenId = _register(alice, numbers, "4242");
        vm.assume(caller != alice && caller != address(forwarder));

        vm.startPrank(caller);
        vm.expectRevert();
        registry.setTarget(tokenId, caller);
        vm.expectRevert();
        registry.setText(tokenId, "records", "x");
        vm.expectRevert();
        registry.setAddrs(tokenId, _coin(0, hex"00"));
        vm.expectRevert();
        registry.setPrimaryName(tokenId);
        vm.expectRevert();
        registry.transferFrom(alice, caller, tokenId);
        vm.stopPrank();

        assertEq(registry.ownerOf(tokenId), alice);
        assertEq(registry.resolve(tokenId), alice);
    }

    function testFuzz_OnlyTheOwnerChangesTheRegistry(address caller) public {
        vm.assume(caller != owner && caller != address(forwarder));

        vm.startPrank(caller);
        vm.expectRevert();
        registry.setPrices(numbers, _flat(1));
        vm.expectRevert();
        registry.setTrustedForwarder(caller);
        vm.expectRevert();
        registry.setNameRules(caller);
        vm.expectRevert();
        registry.setGracePeriod(60 days);
        vm.expectRevert();
        registry.setTreasury(caller);
        vm.expectRevert();
        registry.withdraw(caller, 0);
        vm.expectRevert();
        registry.pause();
        vm.expectRevert();
        registry.adminRegister(numbers, "4242", caller, 1);
        vm.expectRevert();
        registry.transferOwnership(caller);
        vm.stopPrank();
    }

    function testFuzz_AHeldNameIsNeverSoldTwice(uint32 wait) public {
        uint256 tokenId = _register(alice, numbers, "4242");
        uint256 releasedAt = registry.recordOf(tokenId).expiresAt + registry.gracePeriod();
        vm.warp(block.timestamp + bound(wait, 0, 3 * 365 days));

        vm.prank(bob);
        if (block.timestamp < releasedAt) {
            vm.expectRevert(abi.encodeWithSelector(IReadable.NameUnavailable.selector, tokenId, uint64(releasedAt)));
            registry.register{value: 100 * DOLLAR}(numbers, "4242", 1);
            assertEq(registry.ownerOf(tokenId), alice);
        } else {
            registry.register{value: 100 * DOLLAR}(numbers, "4242", 1);
            assertEq(registry.ownerOf(tokenId), bob);
            assertEq(registry.balanceOf(alice), 0);
        }
    }
}
