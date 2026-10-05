// SPDX-License-Identifier: MIT
pragma solidity ^0.8.35;

import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {IReadable} from "../src/IReadable.sol";
import {Readable} from "../src/Readable.sol";
import {BareAccount, Fixture} from "./Fixture.sol";

/// @dev A forwarder an owner could write and trust: it names any account it likes as the caller.
contract RogueForwarder {
    function act(address registry, address as_, bytes calldata data) external returns (bool success) {
        (success, ) = registry.call(abi.encodePacked(data, as_));
    }
}

/**
 * @dev What the review of 2026-09-30 found, by its number there. A fixed finding is held by a
 *      test of the fix. An open one is held by a test of what the registry still does, which
 *      fails the day it is fixed and is then rewritten.
 */
contract FindingsTest is Fixture {
    // --- FIXED ---

    function test_Fixed1_TheForwarderGetterFollowsAChange() public {
        assertEq(registry.trustedForwarder(), address(forwarder));
        vm.prank(owner);
        registry.setTrustedForwarder(stranger);

        assertEq(registry.trustedForwarder(), stranger);
        assertTrue(registry.isTrustedForwarder(stranger));
        assertFalse(registry.isTrustedForwarder(address(forwarder)));
    }

    function test_Fixed2_ANameIsRenewedThroughAPause() public {
        uint256 tokenId = _register(alice, numbers, "42");
        vm.prank(owner);
        registry.pause();

        // New names wait for the pause to end
        vm.prank(bob);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        registry.register{value: 2000 * DOLLAR}(numbers, "43", 1);

        // Held ones never do, up to the last second of their grace period
        vm.warp(block.timestamp + 365 days + 30 days - 1);
        _renew(alice, tokenId, 1);
        assertEq(registry.resolve(tokenId), alice);

        vm.prank(owner);
        vm.expectRevert();
        registry.adminRegister(numbers, "42", owner, 10);
        assertEq(registry.ownerOf(tokenId), alice);
    }

    function test_Fixed3_AnExpiredNameKeepsThirtyDaysWhateverTheOwnerSets() public {
        uint256 tokenId = _register(alice, numbers, "42");
        uint256 expiresAt = registry.recordOf(tokenId).expiresAt;
        vm.prank(owner);
        registry.setGracePeriod(365 days);

        vm.startPrank(owner);
        vm.expectRevert(IReadable.InvalidGracePeriod.selector);
        registry.setGracePeriod(0);
        vm.expectRevert(IReadable.InvalidGracePeriod.selector);
        registry.setGracePeriod(type(uint64).max);
        // The shortest it can be cut to
        registry.setGracePeriod(30 days);
        vm.stopPrank();

        vm.warp(expiresAt + 30 days - 1);
        assertFalse(registry.lookup(numbers, "42").available);
        vm.prank(owner);
        vm.expectRevert();
        registry.adminRegister(numbers, "42", owner, 10);

        _renew(alice, tokenId, 1);
        assertEq(registry.ownerOf(tokenId), alice);
    }

    function test_Fixed4_ANameHasNoInvisibleTwin() public {
        uint256 real = _register(alice, arc, "alice");

        bytes[5] memory twins = [
            abi.encodePacked("al", _utf8(0x200c), "ice"), // zero width non-joiner
            abi.encodePacked("al", _utf8(0x200d), "ice"), // zero width joiner
            abi.encodePacked("alice", _utf8(0x200d)), // a joiner as the last character
            abi.encodePacked("al", _utf8(0xfe00), "ice"), // a variation selector
            abi.encodePacked(_utf8(0x430), "lice") // the Cyrillic a
        ];
        for (uint256 i = 0; i < twins.length; i++) {
            _assertValidity(arc, string(twins[i]), IReadable.Validity.InvalidCharacter);
            vm.prank(bob);
            _expectInvalid(IReadable.Validity.InvalidCharacter);
            registry.register{value: 5 * DOLLAR}(arc, string(twins[i]), 1);
        }

        // Every spelling that is taken is the one name
        assertEq(registry.tokenIdOf(arc, "ALICE"), real);
        assertEq(registry.balanceOf(bob), 0);
    }

    function test_Fixed4_APersianNameHasNoTwinThroughItsJoiner() public view {
        // mirza, khan: the joiner after an alef changes nothing a reader sees
        bytes memory plain = abi.encodePacked(_utf8(0x645), _utf8(0x6cc), _utf8(0x631), _utf8(0x632), _utf8(0x627), _utf8(0x62e), _utf8(0x627), _utf8(0x646));
        bytes memory twin =
            abi.encodePacked(_utf8(0x645), _utf8(0x6cc), _utf8(0x631), _utf8(0x632), _utf8(0x627), _utf8(0x200c), _utf8(0x62e), _utf8(0x627), _utf8(0x646));

        _assertValidity(arc, string(plain), IReadable.Validity.Valid);
        _assertValidity(arc, string(twin), IReadable.Validity.InvalidCharacter);
    }

    function test_Fixed5_OnlyLettersDigitsAndHyphensPass() public view {
        uint24[5] memory odd = [
            uint24(0xe000), // private use, first
            0xf8ff, // private use, last
            0x2800, // the blank Braille pattern
            0x2010, // a hyphen that isn't the hyphen
            0x2030 // per mille
        ];
        for (uint256 i = 0; i < odd.length; i++) {
            _assertValidity(arc, string(abi.encodePacked("ab", _utf8(odd[i]), "cd")), IReadable.Validity.InvalidCharacter);
        }
    }

    function test_Fixed6_RecordsEndWithTheName() public {
        uint256 tokenId = _register(alice, numbers, "4242");
        vm.prank(alice);
        registry.setText(tokenId, "records", "{\"agent\":{\"payment\":\"0xA11CE\"}}");
        vm.prank(alice);
        registry.setAddrs(tokenId, _coin(0, hex"a11ce0"));

        vm.warp(block.timestamp + 365 days);
        assertEq(registry.resolve(tokenId), address(0));
        assertEq(registry.text(tokenId, "records"), "");
        assertEq(registry.addr(tokenId, 0), "");
    }

    function test_Fixed7_OwnershipMovesOnlyToAnAddressThatAccepts() public {
        vm.prank(owner);
        registry.transferOwnership(stranger);
        assertEq(registry.owner(), owner);
        vm.prank(stranger);
        registry.acceptOwnership();
        assertEq(registry.owner(), stranger);
    }

    // 8, gone with the ERC-20 (2026-10-03): there is one currency, so no balance waits for another
    function test_Fixed8_WithdrawSendsTheWholeBalance() public {
        _register(alice, numbers, "4242");
        vm.prank(owner);
        registry.withdraw(dao, 0);
        assertEq(dao.balance, 100 * DOLLAR);
        assertEq(address(registry).balance, 0);
    }

    // --- OPEN ---

    // 4, what is left of it: letters of one script that look alike are two names
    function test_Open4_LookAlikesWithinAScriptAreTwoNames() public {
        // ali with the Persian yeh, and with the Arabic one
        uint256 persian = _register(alice, arc, string(abi.encodePacked(_utf8(0x639), _utf8(0x644), _utf8(0x6cc))));
        uint256 arabic = _register(bob, arc, string(abi.encodePacked(_utf8(0x639), _utf8(0x644), _utf8(0x64a))));
        assertTrue(persian != arabic);

        // l and the digit one
        assertTrue(registry.tokenIdOf(arc, "paypal") != registry.tokenIdOf(arc, "paypa1"));
    }

    // 6, what is left of it: an expired name is still an NFT of its last holder
    function test_Open6_AnExpiredNameStaysInItsLastHoldersWallet() public {
        uint256 tokenId = _register(alice, numbers, "4242");
        vm.warp(block.timestamp + 365 days + 30 days);

        assertTrue(registry.lookup(numbers, "4242").available);
        assertEq(registry.ownerOf(tokenId), alice);
        assertEq(registry.balanceOf(alice), 1);
        assertEq(registry.namesOf(alice).length, 1);

        // It can't be moved, and it leaves when someone registers it
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(IReadable.NameExpired.selector, tokenId));
        registry.transferFrom(alice, bob, tokenId);
        _register(bob, numbers, "4242");
        assertEq(registry.balanceOf(alice), 0);
    }

    // 7, what is left: ownership can still be given up, by the owner alone and on purpose
    function test_Open7_TheRegistryCanBeLeftWithoutAnOwner() public {
        _register(alice, numbers, "4242");
        vm.prank(owner);
        registry.renounceOwnership();
        assertEq(registry.owner(), address(0));

        // What it had collected stays in it for good
        vm.prank(owner);
        vm.expectRevert();
        registry.withdraw(owner, 0);
        assertEq(address(registry).balance, 100 * DOLLAR);
    }

    // 9: a payee that can't take the coin stops every sale that pays it. A token's block list is
    //    gone with the ERC-20; a contract without a way to receive is what is left
    function test_Open9_APayeeThatRefusesStopsTheSale() public {
        address deaf = address(new BareAccount());
        vm.prank(owner);
        registry.setTreasury(deaf);

        vm.prank(alice);
        vm.expectRevert(IReadable.TransferFailed.selector);
        registry.register{value: 100 * DOLLAR}(numbers, "4242", 1);

        vm.prank(owner);
        registry.setTreasury(address(0));
        _register(alice, numbers, "4242");
    }
}

/**
 * @dev What the review of 2026-10-03 found, by its number there, held the same way: a fixed
 *      finding by a test of the fix, an open one by a test of what the registry still does.
 *      The name rules' share of it is in Twins.t.sol.
 */
contract SecondReviewTest is Fixture {
    // --- FIXED ---

    function test_Fixed2_LatinLookAlikesNeedALetterOfTheirOwn() public view {
        bytes memory paypal = abi.encodePacked(_utf8(0x440), _utf8(0x430), _utf8(0x443), _utf8(0x440), _utf8(0x430), _utf8(0x4cf));
        _assertValidity(arc, string(paypal), IReadable.Validity.InvalidCharacter);
        bytes memory hug = abi.encodePacked(_utf8(0x570), _utf8(0x57d), _utf8(0x581));
        _assertValidity(arc, string(hug), IReadable.Validity.InvalidCharacter);
    }

    function test_Fixed3_ANumberHasNoLeadingZeroTwin() public {
        _register(alice, numbers, "42421230");
        _assertValidity(numbers, "042421230", IReadable.Validity.InvalidCharacter);

        vm.prank(bob);
        _expectInvalid(IReadable.Validity.InvalidCharacter);
        registry.register{value: 1 * DOLLAR}(numbers, "042421230", 1);

        vm.prank(owner);
        _expectInvalid(IReadable.Validity.InvalidCharacter);
        registry.adminRegister(numbers, "042", owner, 1);
    }

    function test_Fixed4_RaisingTheShortestLengthChangesNoPrice() public {
        uint256 three = _register(alice, numbers, "123");
        IReadable.Namespace memory before = registry.getNamespaces()[0];
        assertEq(before.priceFrom, 2);

        vm.prank(owner);
        registry.updateNamespace(numbers, 3, before.maxLength, before.checkDigitFrom, false, address(0), 0, "");

        // Two digits are no longer sold, and nothing else moved
        _assertValidity(numbers, "42", IReadable.Validity.TooShort);
        assertEq(registry.getNamespaces()[0].priceFrom, 2);
        assertEq(registry.priceOf(numbers, "124", 1), 500 * DOLLAR);
        uint256 balance = alice.balance;
        vm.prank(alice);
        registry.renew{value: 500 * DOLLAR}(three, 1);
        assertEq(balance - alice.balance, 500 * DOLLAR);
    }

    function test_Fixed6_CompatibilityFormsAndRightToLeftDigits() public view {
        _assertValidity(arc, string(abi.encodePacked("b", _utf8(0x133), "s")), IReadable.Validity.InvalidCharacter);
        bytes memory shalom = abi.encodePacked(_utf8(0x5e9), _utf8(0x5dc), _utf8(0x5d5), _utf8(0x5dd));
        _assertValidity(arc, string(abi.encodePacked("1", shalom)), IReadable.Validity.InvalidCharacter);
        _assertValidity(arc, string(abi.encodePacked(shalom, "1")), IReadable.Validity.Valid);
    }

    // 7, gone with the ERC-20 (2026-10-03): there is no payment token to switch
    function test_Fixed7_ThereIsNoPaymentTokenToSwitch() public {
        vm.prank(owner);
        (bool switched, ) = address(registry).call(abi.encodeWithSignature("setPaymentToken(address)", address(0)));
        assertFalse(switched);
        (bool read, ) = address(registry).call(abi.encodeWithSignature("paymentToken()"));
        assertFalse(read);
    }

    function test_Fixed8_EveryEvmChainUsesTheTarget() public {
        uint256 tokenId = _register(alice, numbers, "4242");
        uint256 base = 0x80000000 | 8453;
        assertEq(registry.addr(tokenId, 60), abi.encodePacked(alice));
        assertEq(registry.addr(tokenId, base), abi.encodePacked(alice));

        vm.prank(alice);
        registry.setTarget(tokenId, bob);
        assertEq(registry.addr(tokenId, base), abi.encodePacked(bob));

        // None can be stored apart from it
        uint256[3] memory evm = [uint256(60), 0x80000000, base];
        for (uint256 i = 0; i < evm.length; i++) {
            vm.prank(alice);
            vm.expectRevert(abi.encodeWithSelector(IReadable.InvalidCoinType.selector, evm[i]));
            registry.setAddrs(tokenId, _coin(evm[i], abi.encodePacked(stranger)));
        }
        // Just outside that range a coin type is kept like any other
        vm.startPrank(alice);
        registry.setAddrs(tokenId, _coin(0x7fffffff, hex"01"));
        registry.setAddrs(tokenId, _coin(0x100000000, hex"02"));
        registry.setTarget(tokenId, address(0));
        vm.stopPrank();
        assertEq(registry.addr(tokenId, 0x7fffffff), hex"01");
        assertEq(registry.addr(tokenId, 0x100000000), hex"02");
        assertEq(registry.addr(tokenId, 60), "");

        vm.warp(block.timestamp + 365 days);
        assertEq(registry.addr(tokenId, 0x7fffffff), "");
    }

    // --- OPEN ---

    // 1, by the user's choice (2026-10-03): a holder's changes are relayed and the owner can replace
    //    the forwarder, so one it wrote can change any live name. It still can't move a name, buy
    //    one for someone, or act as the owner. Said on /docs
    function test_Open1_AForwarderTheOwnerWroteChangesNamesAndMovesNone() public {
        uint256 tokenId = _register(alice, numbers, "4242");
        RogueForwarder rogue = new RogueForwarder();
        vm.prank(owner);
        registry.setTrustedForwarder(address(rogue));

        // What it can't do
        bytes memory take = abi.encodeWithSignature("transferFrom(address,address,uint256)", alice, owner, tokenId);
        assertFalse(rogue.act(address(registry), alice, take));
        assertFalse(rogue.act(address(registry), alice, abi.encodeWithSignature("approve(address,uint256)", owner, tokenId)));
        assertFalse(rogue.act(address(registry), owner, abi.encodeCall(Readable.withdraw, (stranger, 0))));
        assertFalse(rogue.act(address(registry), owner, abi.encodeCall(Readable.pause, ())));
        assertFalse(rogue.act(address(registry), alice, abi.encodeCall(Readable.register, (numbers, "4343", 1))));
        assertEq(registry.ownerOf(tokenId), alice);

        // What it can
        assertTrue(rogue.act(address(registry), alice, abi.encodeCall(Readable.setTarget, (tokenId, owner))));
        assertTrue(rogue.act(address(registry), alice, abi.encodeCall(Readable.setText, (tokenId, "records", "owner's"))));
        assertEq(registry.resolve(tokenId), owner);
        assertEq(registry.text(tokenId, "records"), "owner's");
    }

    // 5: the owner prices renewals, so it can price a holder out and wait. Said on /docs
    function test_Open5_TheOwnerSetsWhatARenewalCosts() public {
        uint256 tokenId = _register(alice, numbers, "42");
        vm.prank(owner);
        registry.setPrices(numbers, _flat(type(uint128).max));

        vm.prank(alice);
        vm.expectRevert();
        registry.renew{value: 2000 * DOLLAR}(tokenId, 1);

        vm.warp(block.timestamp + 365 days + 30 days);
        vm.prank(owner);
        registry.adminRegister(numbers, "42", owner, 10);
        assertEq(registry.ownerOf(tokenId), owner);
    }

    // 6, what is left: letters of two languages drawn alike are two names
    function test_Open6_TwinsAcrossLanguagesAreTwoNames() public view {
        // s with a comma below (Romanian) and with a cedilla (Turkish)
        string memory comma = string(abi.encodePacked(_utf8(0x219), "tiri"));
        string memory cedilla = string(abi.encodePacked(_utf8(0x15f), "tiri"));
        assertTrue(registry.tokenIdOf(arc, comma) != registry.tokenIdOf(arc, cedilla));
        // card in katakana, and in Chinese characters drawn alike
        _assertValidity(arc, string(abi.encodePacked(_utf8(0x30ab), _utf8(0x30fc), _utf8(0x30c9))), IReadable.Validity.Valid);
        _assertValidity(arc, string(abi.encodePacked(_utf8(0x529b), _utf8(0x4e00), _utf8(0x30c9))), IReadable.Validity.Valid);
    }
}

/**
 * @dev What the review of 2026-10-05 found, held the same way.
 */
contract ThirdReviewTest is Fixture {
    // --- FIXED ---

    // 1: a name without an editor stores address(0), so a forwarder that lets a request through as
    //    address(0), as a hand-written ecrecover does on a bad signature, passed for the editor of
    //    every such name. Hup's forwarders never name address(0); the registry no longer relies on it
    function test_Fixed1_NoSignerIsNoEditor() public {
        uint256 tokenId = _register(alice, numbers, "4242");
        assertEq(registry.editorOf(tokenId), address(0));
        RogueForwarder rogue = new RogueForwarder();
        vm.prank(owner);
        registry.setTrustedForwarder(address(rogue));

        assertFalse(rogue.act(address(registry), address(0), abi.encodeCall(Readable.setTarget, (tokenId, stranger))));
        assertFalse(rogue.act(address(registry), address(0), abi.encodeCall(Readable.setText, (tokenId, "records", "stranger's"))));
        assertFalse(rogue.act(address(registry), address(0), abi.encodeCall(Readable.setAddrs, (tokenId, _coin(0, hex"b0b0")))));
        assertEq(registry.resolve(tokenId), alice);
        assertEq(registry.text(tokenId, "records"), "");

        // An editor the holder named still changes the name through it
        vm.prank(alice);
        registry.setEditor(tokenId, bob);
        assertTrue(rogue.act(address(registry), bob, abi.encodeCall(Readable.setTarget, (tokenId, bob))));
        assertEq(registry.resolve(tokenId), bob);
    }
}
