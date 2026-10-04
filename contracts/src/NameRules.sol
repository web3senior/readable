// SPDX-License-Identifier: MIT
pragma solidity ^0.8.35;

import {INameRules} from "./INameRules.sol";

/**
 * @title NameRules
 * @author Hup Labs
 * @notice The rules for the labels of Readable names: lowercase letters of one script, digits
 *         and hyphens.
 * @dev Refuses by default. A character is taken only when it is a lowercase letter of a script
 *      listed here, an ASCII digit or a hyphen, so everything invisible, every symbol, every
 *      emoji and every compatibility form of a letter is out without being named. What is left
 *      of the look-alike problem is handled by these rules:
 *      - one script per label, so a Cyrillic letter can't stand in a Latin name;
 *      - a Greek, Cyrillic or Armenian label needs a letter that doesn't pass for a Latin one, by
 *        Unicode's confusables data (tools/look-alikes.mjs);
 *      - no combining marks but the Arabic vowel marks, in their canonical order, so a letter and
 *        its mark can never spell what a single code point already spells;
 *      - the zero width non-joiner only where it changes how the text is drawn: between an Arabic
 *        letter that would join the next one and that next letter;
 *      - a Hebrew or Arabic label doesn't start with a digit, which would draw like the same label
 *        ending in it (the Bidi rule of RFC 5893);
 *      - the katakana long vowel mark only after kana, where it can't stand for the Chinese one.
 *      Not told apart: letters of one script that look alike (Arabic and Persian yeh and kaf,
 *      l and 1, the Romanian s and t with a comma and with a cedilla, katakana and Chinese
 *      characters drawn alike), and look-alikes between scripts other than Latin. Hebrew, Arabic
 *      and Georgian need no letter of their own: their Latin look-alikes spell no more than l, o,
 *      v and y, and the rule would refuse common words. The app maps what it can before a label
 *      is sent. Scripts that need marks or joiners to be written (the Indic scripts, Thai) wait
 *      for rules that order those marks.
 * @custom:version 1.0.0
 * @custom:website https://readable.name
 * @custom:security-contact security@hup.social
 */
contract NameRules is INameRules {
    // --- SCRIPTS ---

    uint256 internal constant REFUSED = 0;
    // Digits and hyphens belong to every script
    uint256 internal constant SHARED = 1;
    uint256 internal constant LATIN = 2;
    uint256 internal constant GREEK = 3;
    uint256 internal constant CYRILLIC = 4;
    uint256 internal constant ARMENIAN = 5;
    uint256 internal constant HEBREW = 6;
    uint256 internal constant ARABIC = 7;
    uint256 internal constant GEORGIAN = 8;
    uint256 internal constant EAST_ASIAN = 9;

    uint256 internal constant HYPHEN = 0x2d;
    uint256 internal constant ZWNJ = 0x200c;
    uint256 internal constant LONG_VOWEL = 0x30fc;

    function version() external pure override returns (string memory) {
        return "1.0.0";
    }

    function measure(bytes calldata label) external pure override returns (bool valid, bytes memory normalized, uint256 length) {
        normalized = _lower(label);
        (valid, length) = _read(normalized);
    }

    // --- READING ---

    function _read(bytes memory label) internal pure returns (bool, uint256) {
        uint256 length;
        uint256 script;
        uint256 previous;
        uint256 first;
        // The combining class of the mark before, 0 after anything else
        uint256 order;
        // Whether a letter was met that no Latin letter looks like
        bool own;
        // Bytes and characters read so far
        uint256 i;
        uint256 count;

        while (i < label.length) {
            (uint256 cp, uint256 width) = _decode(label, i);
            if (width == 0) return (false, 0);

            if (cp == ZWNJ) {
                if (!_joinsNext(previous)) return (false, 0);
            } else {
                if (previous == ZWNJ && !_joinsPrevious(cp)) return (false, 0);

                uint256 kind = _script(cp);
                if (kind == REFUSED) return (false, 0);
                if (kind != SHARED) {
                    if (script == 0) script = kind;
                    else if (script != kind) return (false, 0);
                    if (_needsOwnLetter(kind) && !_passesForLatin(cp)) own = true;
                }
                if (cp == LONG_VOWEL && !_isKana(previous) && previous != LONG_VOWEL) return (false, 0);

                uint256 class = _markClass(cp);
                if (class == 0) {
                    length++;
                } else if (!_takesMarks(previous) || class <= order) {
                    // A mark sits on a letter of its script, and marks follow each other in one order
                    return (false, 0);
                }
                order = class;
            }

            if (count == 0) {
                if (cp == HYPHEN) return (false, 0);
                first = cp;
            }
            // xn-- and its like, hyphens third and fourth, are how other systems spell names of other scripts
            if (cp == HYPHEN && count == 3 && previous == HYPHEN) return (false, 0);
            previous = cp;
            i += width;
            count++;
        }

        if (previous == HYPHEN || previous == ZWNJ) return (false, 0);
        if (_needsOwnLetter(script) && !own) return (false, 0);
        if ((script == HEBREW || script == ARABIC) && first >= 0x30 && first <= 0x39) return (false, 0);
        return (true, length);
    }

    /// @dev One UTF-8 code point at `i`; width 0 marks bytes that are malformed, overlong or a
    ///      surrogate, and everything past the first plane, where no script listed here lives.
    function _decode(bytes memory s, uint256 i) internal pure returns (uint256 cp, uint256 width) {
        uint256 b0 = uint8(s[i]);
        if (b0 < 0x80) return (b0, 1);
        if (b0 < 0xc2 || b0 > 0xef) return (0, 0);

        width = b0 < 0xe0 ? 2 : 3;
        if (i + width > s.length) return (0, 0);

        uint256 b1 = uint8(s[i + 1]);
        uint256 low = b0 == 0xe0 ? 0xa0 : 0x80;
        uint256 high = b0 == 0xed ? 0x9f : 0xbf;
        if (b1 < low || b1 > high) return (0, 0);

        if (width == 2) return (((b0 & 0x1f) << 6) | (b1 & 0x3f), 2);

        uint256 b2 = uint8(s[i + 2]);
        if (b2 < 0x80 || b2 > 0xbf) return (0, 0);
        cp = ((b0 & 0x0f) << 12) | ((b1 & 0x3f) << 6) | (b2 & 0x3f);
    }

    function _lower(bytes calldata raw) internal pure returns (bytes memory lowered) {
        lowered = new bytes(raw.length);
        for (uint256 i = 0; i < raw.length; i++) {
            bytes1 b = raw[i];
            lowered[i] = b >= "A" && b <= "Z" ? bytes1(uint8(b) + 32) : b;
        }
    }

    // --- WHAT IS TAKEN ---

    /// @dev The script `cp` is a lowercase letter or a mark of, SHARED for a digit or a hyphen,
    ///      REFUSED for everything else. Capitals are refused: the registry lowers the ASCII
    ///      ones and the app lowers the rest, so a capital here is a second spelling of a name.
    function _script(uint256 cp) internal pure returns (uint256) {
        if (cp < 0x80) {
            if (cp >= 0x61 && cp <= 0x7a) return LATIN;
            if ((cp >= 0x30 && cp <= 0x39) || cp == HYPHEN) return SHARED;
            return REFUSED;
        }
        if (cp < 0x250) return _isLatinLetter(cp) ? LATIN : REFUSED;
        if (cp < 0x400) return cp == 0x390 || (cp >= 0x3ac && cp <= 0x3ce) ? GREEK : REFUSED;
        if (cp < 0x530) return _isCyrillicLetter(cp) ? CYRILLIC : REFUSED;
        if (cp < 0x590) return cp >= 0x561 && cp <= 0x586 ? ARMENIAN : REFUSED;
        if (cp < 0x600) return cp >= 0x5d0 && cp <= 0x5ea ? HEBREW : REFUSED;
        if (cp < 0x780) return _isArabicLetter(cp) || _markClass(cp) != 0 ? ARABIC : REFUSED;
        if (cp < 0x1e00) return cp >= 0x10d0 && cp <= 0x10fa ? GEORGIAN : REFUSED;
        // Latin Extended Additional, where Vietnamese lives: capitals even, small letters odd. The
        // Middle Welsh letters after the last Vietnamese one are out
        if (cp < 0x1f00) return cp % 2 == 1 && (cp <= 0x1e95 || (cp >= 0x1ea1 && cp <= 0x1ef9)) ? LATIN : REFUSED;
        if (cp < 0x3041) return REFUSED;
        if (
            _isKana(cp) ||
            cp == LONG_VOWEL ||
            (cp >= 0x3400 && cp <= 0x4dbf) || // Chinese characters
            (cp >= 0x4e00 && cp <= 0x9fff) ||
            (cp >= 0xac00 && cp <= 0xd7a3) // Hangul syllables
        ) return EAST_ASIAN;
        return REFUSED;
    }

    function _isLatinLetter(uint256 cp) internal pure returns (bool) {
        // Latin-1: from sharp s to y with diaeresis, without the division sign
        if (cp < 0x100) return cp >= 0xdf && cp != 0xf7;
        // Latin Extended-A pairs a capital with its small letter, and twice changes which comes
        // first. The ij ligature and l with middle dot are compatibility forms of two characters
        if (cp < 0x138) return cp % 2 == 1 && cp != 0x133;
        if (cp == 0x138) return true;
        if (cp < 0x149) return cp % 2 == 0 && cp != 0x140;
        if (cp == 0x149) return false;
        if (cp < 0x178) return cp % 2 == 1;
        if (cp < 0x17f) return cp == 0x17a || cp == 0x17c || cp == 0x17e;
        // o and u with horn (Vietnamese), s and t with comma below (Romanian)
        return cp == 0x1a1 || cp == 0x1b0 || cp == 0x219 || cp == 0x21b;
    }

    function _isCyrillicLetter(uint256 cp) internal pure returns (bool) {
        if (cp < 0x430) return false;
        if (cp < 0x460) return true;
        // The extended letters pair a capital with its small letter
        if (cp < 0x482) return cp % 2 == 1;
        if (cp < 0x48b) return false;
        if (cp < 0x4c0) return cp % 2 == 1;
        if (cp == 0x4c0) return false;
        if (cp < 0x4cf) return cp % 2 == 0;
        if (cp == 0x4cf) return true;
        return cp % 2 == 1;
    }

    /// @dev Letters of the Arabic script. The tatweel, which only stretches a word, is not one,
    ///      nor are the four letters with a high hamza (U+0675 to U+0678), compatibility forms of
    ///      a letter followed by the high hamza.
    function _isArabicLetter(uint256 cp) internal pure returns (bool) {
        return
            (cp >= 0x620 && cp <= 0x63f) ||
            (cp >= 0x641 && cp <= 0x64a) ||
            (cp >= 0x66e && cp <= 0x66f) ||
            (cp >= 0x671 && cp <= 0x674) ||
            (cp >= 0x679 && cp <= 0x6d3) ||
            cp == 0x6d5 ||
            (cp >= 0x6ee && cp <= 0x6ef) ||
            (cp >= 0x6fa && cp <= 0x6fc) ||
            cp == 0x6ff ||
            (cp >= 0x750 && cp <= 0x77f);
    }

    /// @dev Hiragana and katakana, the only letters the long vowel mark may follow.
    function _isKana(uint256 cp) internal pure returns (bool) {
        return (cp >= 0x3041 && cp <= 0x3096) || (cp >= 0x30a1 && cp <= 0x30fa);
    }

    /// @dev The canonical combining class of a mark, 0 for what is not one. The Arabic vowel
    ///      marks are the only marks taken. The hamza and maddah marks are refused: on a
    ///      letter they spell what a letter of its own already spells.
    function _markClass(uint256 cp) internal pure returns (uint256) {
        if (cp >= 0x64b && cp <= 0x652) return 27 + (cp - 0x64b);
        if (cp == 0x670) return 35;
        return 0;
    }

    function _takesMarks(uint256 cp) internal pure returns (bool) {
        return _isArabicLetter(cp) || _markClass(cp) != 0;
    }

    // --- JOINING ---

    /// @dev Arabic letters that join the letter before them and never the one after.
    function _joinsBackOnly(uint256 cp) internal pure returns (bool) {
        return
            (cp >= 0x622 && cp <= 0x625) ||
            cp == 0x627 ||
            cp == 0x629 ||
            (cp >= 0x62f && cp <= 0x632) ||
            cp == 0x648 ||
            (cp >= 0x671 && cp <= 0x673) ||
            (cp >= 0x688 && cp <= 0x699) ||
            cp == 0x6c0 ||
            (cp >= 0x6c3 && cp <= 0x6cb) ||
            cp == 0x6cd ||
            cp == 0x6cf ||
            (cp >= 0x6d2 && cp <= 0x6d3) ||
            cp == 0x6d5 ||
            (cp >= 0x6ee && cp <= 0x6ef) ||
            (cp >= 0x759 && cp <= 0x75b) ||
            (cp >= 0x76b && cp <= 0x76c) ||
            cp == 0x771 ||
            (cp >= 0x773 && cp <= 0x774) ||
            (cp >= 0x778 && cp <= 0x779);
    }

    /// @dev The hamza and the high hamza join nothing.
    function _joinsNothing(uint256 cp) internal pure returns (bool) {
        return cp == 0x621 || cp == 0x674;
    }

    function _joinsPrevious(uint256 cp) internal pure returns (bool) {
        return _isArabicLetter(cp) && !_joinsNothing(cp);
    }

    function _joinsNext(uint256 cp) internal pure returns (bool) {
        return _isArabicLetter(cp) && !_joinsNothing(cp) && !_joinsBackOnly(cp);
    }

    // --- LOOK-ALIKES ---

    /// @dev The scripts whose letters can spell a Latin name, so a label of them needs one letter
    ///      that no Latin letter looks like.
    function _needsOwnLetter(uint256 script) internal pure returns (bool) {
        return script == GREEK || script == CYRILLIC || script == ARMENIAN;
    }

    /// @dev Letters of those scripts that Unicode's confusables data (version 18.0) draws like a
    ///      Latin letter, a digit or a run of them that these rules take, kra aside. Printed by
    ///      tools/look-alikes.mjs; run it again when a script or a Latin letter is added.
    function _passesForLatin(uint256 cp) internal pure returns (bool) {
        if (cp < 0x400) {
            // iota with dialytika and tonos, alpha and iota with tonos, alpha, beta, gamma, eta,
            // iota, nu, omicron, rho, sigma, upsilon, iota and upsilon with dialytika, omicron
            // and upsilon with tonos
            return
                cp == 0x390 ||
                cp == 0x3ac ||
                cp == 0x3af ||
                cp == 0x3b1 ||
                cp == 0x3b2 ||
                cp == 0x3b3 ||
                cp == 0x3b7 ||
                cp == 0x3b9 ||
                cp == 0x3bd ||
                cp == 0x3bf ||
                cp == 0x3c1 ||
                cp == 0x3c3 ||
                cp == 0x3c5 ||
                cp == 0x3ca ||
                cp == 0x3cb ||
                cp == 0x3cc ||
                cp == 0x3cd;
        }
        if (cp < 0x530) {
            // a, be, ghe, ie, o, er, es, u, ha, sha, ie with grave, io, gje, dze, the
            // Byelorussian-Ukrainian i, yi, je, tshe, omega, izhitsa, uk, es with descender,
            // straight u, shha, abkhasian che and che with descender, palochka, a with breve and
            // with diaeresis, ligature a ie, ie with breve, o and u with diaeresis, komi de, qa, we
            return
                cp == 0x430 ||
                cp == 0x431 ||
                cp == 0x433 ||
                cp == 0x435 ||
                cp == 0x43e ||
                cp == 0x440 ||
                cp == 0x441 ||
                cp == 0x443 ||
                cp == 0x445 ||
                cp == 0x448 ||
                cp == 0x450 ||
                cp == 0x451 ||
                cp == 0x453 ||
                cp == 0x455 ||
                cp == 0x456 ||
                cp == 0x457 ||
                cp == 0x458 ||
                cp == 0x45b ||
                cp == 0x461 ||
                cp == 0x475 ||
                cp == 0x479 ||
                cp == 0x4ab ||
                cp == 0x4af ||
                cp == 0x4bb ||
                cp == 0x4bd ||
                cp == 0x4bf ||
                cp == 0x4cf ||
                cp == 0x4d1 ||
                cp == 0x4d3 ||
                cp == 0x4d5 ||
                cp == 0x4d7 ||
                cp == 0x4e7 ||
                cp == 0x4f1 ||
                cp == 0x501 ||
                cp == 0x51b ||
                cp == 0x51d;
        }
        // Armenian ayb, gim, za, ho, ghad, yi, vo, ra, seh, co, yiwn, keh, oh
        return
            cp == 0x561 ||
            cp == 0x563 ||
            cp == 0x566 ||
            cp == 0x570 ||
            cp == 0x572 ||
            cp == 0x575 ||
            cp == 0x578 ||
            cp == 0x57c ||
            cp == 0x57d ||
            cp == 0x581 ||
            cp == 0x582 ||
            cp == 0x584 ||
            cp == 0x585;
    }
}
