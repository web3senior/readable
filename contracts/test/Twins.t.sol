// SPDX-License-Identifier: MIT
pragma solidity ^0.8.35;

import {IReadable} from "../src/IReadable.sol";
import {Fixture} from "./Fixture.sol";

/// @dev What the name rules refuse since the review of 2026-10-03 that their first build took, and
///      what they still take beside it.
contract TwinsTest is Fixture {
    // What tools/look-alikes.mjs prints from confusables.txt 18.0.0: Greek, Cyrillic, Armenian
    uint24[66] internal LOOK_ALIKES = [
        uint24(0x390), 0x3ac, 0x3af, 0x3b1, 0x3b2, 0x3b3, 0x3b7, 0x3b9, 0x3bd, 0x3bf, 0x3c1, 0x3c3, 0x3c5, 0x3ca, 0x3cb, 0x3cc,
        0x3cd,
        0x430, 0x431, 0x433, 0x435, 0x43e, 0x440, 0x441, 0x443, 0x445, 0x448, 0x450, 0x451, 0x453, 0x455, 0x456, 0x457, 0x458,
        0x45b, 0x461, 0x475, 0x479, 0x4ab, 0x4af, 0x4bb, 0x4bd, 0x4bf, 0x4cf, 0x4d1, 0x4d3, 0x4d5, 0x4d7, 0x4e7, 0x4f1, 0x501,
        0x51b, 0x51d,
        0x561, 0x563, 0x566, 0x570, 0x572, 0x575, 0x578, 0x57c, 0x57d, 0x581, 0x582, 0x584, 0x585
    ];

    uint256 internal constant THETA = 0x3b8;
    uint256 internal constant ZHE = 0x436;
    uint256 internal constant MEN = 0x574;

    function _valid(bytes memory label) internal view returns (bool valid) {
        (valid, , ) = rules.measure(label);
    }

    function _assertTaken(bytes memory label, string memory what) internal view {
        assertTrue(_valid(label), what);
        assertEq(uint8(registry.lookup(arc, string(label)).validity), uint8(IReadable.Validity.Valid), what);
    }

    function _assertRefused(bytes memory label, string memory what) internal view {
        assertFalse(_valid(label), what);
        assertEq(uint8(registry.lookup(arc, string(label)).validity), uint8(IReadable.Validity.InvalidCharacter), what);
    }

    function _listed(uint256 cp) internal view returns (bool) {
        for (uint256 i = 0; i < LOOK_ALIKES.length; i++) if (LOOK_ALIKES[i] == cp) return true;
        return false;
    }

    function _word(uint256 a, uint256 b, uint256 c) internal pure returns (bytes memory) {
        return abi.encodePacked(_utf8(a), _utf8(b), _utf8(c));
    }

    function _word(uint256 a, uint256 b, uint256 c, uint256 d) internal pure returns (bytes memory) {
        return abi.encodePacked(_utf8(a), _utf8(b), _utf8(c), _utf8(d));
    }

    /// @dev Every letter of the script from `from` to `to`: a label of it alone is taken exactly
    ///      when it isn't a look-alike, and beside a letter of the script's own it always is.
    function _checkScript(uint256 from, uint256 to, uint256 own) internal view returns (uint256 letters) {
        for (uint256 cp = from; cp <= to; cp++) {
            if (!_valid(abi.encodePacked(_utf8(own), _utf8(cp)))) {
                assertFalse(_listed(cp), string.concat("listed but no letter: ", vm.toString(cp)));
                continue;
            }
            letters++;
            assertEq(_valid(abi.encodePacked(_utf8(cp), _utf8(cp), _utf8(cp))), !_listed(cp), vm.toString(cp));
        }
    }

    // --- LOOK-ALIKES ---

    function test_TheLookAlikesAreExactlyTheList() public view {
        assertEq(_checkScript(0x370, 0x3ff, THETA), 36, "Greek");
        assertGt(_checkScript(0x400, 0x52f, ZHE), 100, "Cyrillic");
        assertEq(_checkScript(0x530, 0x58f, MEN), 38, "Armenian");
    }

    function test_ACyrillicPaypalIsRefused() public view {
        // er, a, u, er, a and the palochka for the l
        bytes memory paypal = abi.encodePacked(_word(0x440, 0x430, 0x443), _word(0x440, 0x430, 0x4cf));
        _assertRefused(paypal, "paypal with a palochka");
        _assertRefused(_word(0x4af, 0x435, 0x455), "yes with a straight u");
        _assertRefused(_word(0x441, 0x451, 0x441), "c, e with diaeresis, c");
        // Kappa and ka pass for kra alone, which no name is worth impersonating with
        _assertTaken(_word(0x441, 0x43e, 0x43a), "sok");
        _assertTaken(_word(0x3ba, 0x3b1, 0x3b9), "kai");
    }

    function test_GreekLookAlikesNeedALetterOfTheirOwn() public view {
        _assertRefused(_word(0x3b3, 0x3bf, 0x3c5), "you");
        _assertRefused(_word(0x3bd, 0x3b9, 0x3c1), "vip");
        _assertTaken(_word(0x3b3, 0x3b5, 0x3b9, 0x3ac), "geia");
    }

    function test_AnArmenianLabelNeedsALetterOfItsOwn() public view {
        _assertRefused(_word(0x570, 0x57d, 0x581), "hug");
        _assertRefused(_word(0x578, 0x585, 0x561), "now");
        _assertTaken(_word(MEN, 0x561, 0x575, 0x580), "mayr");
    }

    function test_HebrewArabicAndGeorgianNeedNoLetterOfTheirOwn() public view {
        // samekh, vav, samekh: horse, drawn like olo
        _assertTaken(_word(0x5e1, 0x5d5, 0x5e1), "sus");
        _assertTaken(_word(0x627, 0x647, 0x644), "ahl");
        _assertTaken(_word(0x10e7, 0x10e7, 0x10e7), "Georgian look-alikes alone");
    }

    // --- COMPATIBILITY FORMS ---

    function test_CompatibilityFormsAreRefused() public view {
        _assertRefused(abi.encodePacked("b", _utf8(0x133), "s"), "the ij ligature");
        _assertTaken("bijs", "i and j");
        _assertRefused(abi.encodePacked("co", _utf8(0x140), "legi"), "l with middle dot");
        for (uint256 cp = 0x675; cp <= 0x678; cp++) {
            _assertRefused(_word(0x628, 0x628, cp), vm.toString(cp));
        }
        // The letter and the high hamza, the one spelling left
        _assertTaken(_word(0x628, 0x628, 0x627, 0x674), "alef and high hamza");
    }

    function test_MiddleWelshLettersAreOut() public view {
        _assertRefused(abi.encodePacked("ab", _utf8(0x1efb)), "middle-welsh ll");
        _assertRefused(abi.encodePacked("ab", _utf8(0x1efd)), "middle-welsh v");
        _assertRefused(abi.encodePacked("ab", _utf8(0x1eff)), "y with loop");
        _assertTaken(abi.encodePacked("ab", _utf8(0x1ef9)), "y with tilde, Vietnamese");
    }

    // --- RIGHT TO LEFT ---

    function test_ARightToLeftLabelDoesNotStartWithADigit() public view {
        bytes memory shalom = _word(0x5e9, 0x5dc, 0x5d5, 0x5dd);
        bytes memory ali = _word(0x639, 0x644, 0x6cc);
        _assertRefused(abi.encodePacked("1", shalom), "a digit before Hebrew");
        _assertRefused(abi.encodePacked("12", ali), "digits before Arabic");
        _assertTaken(abi.encodePacked(shalom, "1"), "a digit after Hebrew");
        _assertTaken(abi.encodePacked(ali, "12"), "digits after Arabic");
        _assertTaken(abi.encodePacked(_utf8(0x5e9), "1", _utf8(0x5dc)), "a digit inside");
        // Left to right, a digit leads as before
        _assertTaken("1abc", "Latin");
        _assertTaken(abi.encodePacked("1", _word(0x4f60, 0x597d, 0x5417)), "Chinese");
    }

    // --- KATAKANA ---

    function test_TheLongVowelMarkFollowsKana() public view {
        _assertTaken(_word(0x30ab, 0x30fc, 0x30c9), "card");
        _assertTaken(_word(0x3089, 0x30fc, 0x3081, 0x3093), "ramen in hiragana");
        _assertTaken(abi.encodePacked(_word(0x30b9, 0x30fc, 0x30fc), _utf8(0x30d1)), "a long mark held longer");
        _assertRefused(_word(0x529b, 0x30fc, 0x30c9), "after a Chinese character");
        _assertRefused(_word(0x30fc, 0x30ab, 0x30c9), "first");
        _assertRefused(abi.encodePacked("ab", _utf8(0x30fc)), "after a Latin letter");
    }

    // --- XN-- ---

    function test_HyphensThirdAndFourthCountCharacters() public view {
        _assertRefused("ab--c", "ab--c");
        _assertTaken(abi.encodePacked(_utf8(0xe9), "--x"), "hyphens second and third");
        _assertRefused(abi.encodePacked(_utf8(0xe9), "a--x"), "hyphens third and fourth");
    }
}
