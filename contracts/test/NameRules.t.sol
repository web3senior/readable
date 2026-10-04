// SPDX-License-Identifier: MIT
pragma solidity ^0.8.35;

import {INameRules} from "../src/INameRules.sol";
import {IReadable} from "../src/IReadable.sol";
import {Fixture} from "./Fixture.sol";

/// @dev Rules that take any label as it is, of the length of its bytes.
contract LooseRules is INameRules {
    function version() external pure returns (string memory) {
        return "loose";
    }

    function measure(bytes calldata label) external pure returns (bool, bytes memory, uint256) {
        return (true, label, label.length);
    }
}

/// @dev Rules that take nothing.
contract ClosedRules is INameRules {
    function version() external pure returns (string memory) {
        return "closed";
    }

    function measure(bytes calldata label) external pure returns (bool, bytes memory, uint256) {
        return (false, label, 0);
    }
}

/// @dev Rules that fail whatever they are asked.
contract BrokenRules is INameRules {
    function version() external pure returns (string memory) {
        return "broken";
    }

    function measure(bytes calldata) external pure returns (bool, bytes memory, uint256) {
        revert("broken");
    }
}

/// @dev Rules that answer with a form the registry can't store: empty, or past its byte limit.
contract OddRules is INameRules {
    uint256 internal immutable SIZE;

    constructor(uint256 size) {
        SIZE = size;
    }

    function version() external pure returns (string memory) {
        return "odd";
    }

    function measure(bytes calldata) external view returns (bool, bytes memory, uint256) {
        return (true, new bytes(SIZE), 5);
    }
}

/// @dev The first name rules, asked directly and through the registry.
contract NameRulesTest is Fixture {
    function _valid(bytes memory label) internal view returns (bool valid) {
        (valid, , ) = rules.measure(label);
    }

    function _length(bytes memory label) internal view returns (uint256 length) {
        bool valid;
        (valid, , length) = rules.measure(label);
        assertTrue(valid, "not a name");
    }

    function _assertTaken(bytes memory label, string memory what) internal view {
        assertTrue(_valid(label), what);
        // The registry says what its rules say
        assertEq(uint8(registry.lookup(arc, string(label)).validity) == uint8(IReadable.Validity.InvalidCharacter), false, what);
    }

    function _assertRefused(bytes memory label, string memory what) internal view {
        assertFalse(_valid(label), what);
        assertEq(uint8(registry.lookup(arc, string(label)).validity), uint8(IReadable.Validity.InvalidCharacter), what);
    }

    // Deployed ahead of the call that uses them: a deployment inside it would take the prank

    function _deployedLooseRules() internal returns (address) {
        return address(new LooseRules());
    }

    function _deployedClosedRules() internal returns (address) {
        return address(new ClosedRules());
    }

    function _deployedBrokenRules() internal returns (address) {
        return address(new BrokenRules());
    }

    function _deployedOddRules(uint256 size) internal returns (address) {
        return address(new OddRules(size));
    }

    function _useRules(address next) internal {
        vm.prank(owner);
        registry.setNameRules(next);
    }

    function _wrapped(uint256 cp) internal pure returns (bytes memory) {
        return abi.encodePacked("ab", _utf8(cp), "cd");
    }

    // --- ASCII ---

    function test_Version() public view {
        assertEq(rules.version(), "1.0.0");
    }

    function test_TakesLettersDigitsAndHyphens() public view {
        _assertTaken("alice", "letters");
        _assertTaken("alice-2", "a hyphen inside");
        _assertTaken("a-b-c", "hyphens inside");
        _assertTaken("123", "digits alone");
        _assertTaken("a", "one letter");
        assertEq(_length("alice-2"), 7);
    }

    function test_LowersCapitals() public view {
        (bool valid, bytes memory normalized, uint256 length) = rules.measure("AlIcE-Bob");
        assertTrue(valid);
        assertEq(string(normalized), "alice-bob");
        assertEq(length, 9);
    }

    function test_RefusesEveryOtherAsciiCharacter() public view {
        for (uint256 cp = 0; cp < 0x80; cp++) {
            bool letter = (cp >= 0x61 && cp <= 0x7a) || (cp >= 0x41 && cp <= 0x5a);
            bool digit = cp >= 0x30 && cp <= 0x39;
            // Surrounded by letters, so an edge rule never decides
            bytes memory label = abi.encodePacked("ab", uint8(cp), "cd");
            assertEq(_valid(label), letter || digit || cp == 0x2d, vm.toString(cp));
        }
    }

    function test_RefusesAHyphenAtEitherEnd() public view {
        _assertRefused("-alice", "leading");
        _assertRefused("alice-", "trailing");
        _assertRefused("-", "alone");
        _assertRefused("---", "nothing else");
    }

    function test_RefusesTheSpellingOtherSystemsUseForOtherScripts() public view {
        _assertRefused("xn--80ak6aa92e", "punycode");
        _assertRefused("ab--cd", "hyphens third and fourth");
        _assertTaken("a--b", "hyphens second and third");
        _assertTaken("abc--d", "hyphens fourth and fifth");
    }

    function test_AnEmptyLabelHasNoLength() public view {
        (, , uint256 length) = rules.measure("");
        assertEq(length, 0);
        assertEq(uint8(registry.lookup(arc, "").validity), uint8(IReadable.Validity.TooShort));
    }

    // --- SCRIPTS ---

    function test_TakesTheScriptsItLists() public view {
        // Persian: ali, the joiner, reza
        bytes memory persian = abi.encodePacked(_utf8(0x639), _utf8(0x644), _utf8(0x6cc), _utf8(0x200c), _utf8(0x631), _utf8(0x636), _utf8(0x627));
        _assertTaken(persian, "Persian");
        assertEq(_length(persian), 6);

        bytes memory arabic = abi.encodePacked(_utf8(0x645), _utf8(0x62d), _utf8(0x645), _utf8(0x62f));
        _assertTaken(arabic, "Arabic");
        assertEq(_length(arabic), 4);

        bytes memory chinese = abi.encodePacked(_utf8(0x4f60), _utf8(0x597d), _utf8(0x5417));
        _assertTaken(chinese, "Chinese");
        assertEq(_length(chinese), 3);

        _assertTaken(abi.encodePacked(_utf8(0x3053), _utf8(0x3093), _utf8(0x306b), _utf8(0x3061), _utf8(0x306f)), "hiragana");
        _assertTaken(abi.encodePacked(_utf8(0x30c8), _utf8(0x30fc), _utf8(0x30af)), "katakana with a long vowel");
        _assertTaken(abi.encodePacked(_utf8(0x6771), _utf8(0x4eac), _utf8(0x30bf), _utf8(0x30ef), _utf8(0x30fc)), "kanji and katakana");
        _assertTaken(abi.encodePacked(_utf8(0xd55c), _utf8(0xae00)), "Hangul");
        _assertTaken(abi.encodePacked(_utf8(0x43f), _utf8(0x440), _utf8(0x438), _utf8(0x432), _utf8(0x435), _utf8(0x442)), "Russian");
        _assertTaken(abi.encodePacked(_utf8(0x491), _utf8(0x430), _utf8(0x43d), _utf8(0x43e), _utf8(0x43a)), "Ukrainian");
        _assertTaken(abi.encodePacked(_utf8(0x3b3), _utf8(0x3b5), _utf8(0x3b9), _utf8(0x3ac)), "Greek");
        _assertTaken(abi.encodePacked(_utf8(0x5e9), _utf8(0x5dc), _utf8(0x5d5), _utf8(0x5dd)), "Hebrew");
        _assertTaken(abi.encodePacked(_utf8(0x574), _utf8(0x561), _utf8(0x575), _utf8(0x580)), "Armenian");
        _assertTaken(abi.encodePacked(_utf8(0x10e5), _utf8(0x10d0), _utf8(0x10e0)), "Georgian");
    }

    function test_TakesLatinWithItsAccents() public view {
        _assertTaken(abi.encodePacked("caf", _utf8(0xe9)), "French");
        assertEq(_length(abi.encodePacked("caf", _utf8(0xe9))), 4);
        _assertTaken(abi.encodePacked("stra", _utf8(0xdf), "e"), "German");
        _assertTaken(abi.encodePacked("ma", _utf8(0xf1), "ana"), "Spanish");
        _assertTaken(abi.encodePacked(_utf8(0x142), _utf8(0xf3), "d", _utf8(0x17a)), "Polish");
        _assertTaken(abi.encodePacked(_utf8(0x10d), "e", _utf8(0x161), "tina"), "Czech");
        _assertTaken(abi.encodePacked(_utf8(0x219), "i", _utf8(0x21b)), "Romanian");
        _assertTaken(abi.encodePacked("vi", _utf8(0x1ec7), "t"), "Vietnamese");
        _assertTaken(abi.encodePacked("ph", _utf8(0x1edf)), "Vietnamese with horn");
        _assertTaken(abi.encodePacked(_utf8(0x131), _utf8(0x15f), _utf8(0x131), "k"), "Turkish");
    }

    function test_RefusesCapitalsOfEveryScript() public view {
        uint24[14] memory capitals = [
            uint24(0xc9), // E with acute
            0xd6,
            0x100,
            0x141, // L with stroke
            0x14a,
            0x178, // Y with diaeresis
            0x179,
            0x218, // S with comma below
            0x1ea0,
            0x391, // Alpha
            0x3a9, // Omega
            0x410, // Cyrillic A
            0x490, // Ghe with upturn
            0x531 // Armenian Ayb
        ];
        for (uint256 i = 0; i < capitals.length; i++) _assertRefused(_wrapped(capitals[i]), vm.toString(uint256(capitals[i])));
    }

    function test_TellsCapitalsFromSmallLettersWhereTheyAlternate() public view {
        // Latin Extended-A changes twice which of a pair comes first
        assertTrue(_valid(_wrapped(0x101)));
        assertTrue(_valid(_wrapped(0x137)));
        assertTrue(_valid(_wrapped(0x138)));
        assertFalse(_valid(_wrapped(0x139)));
        assertTrue(_valid(_wrapped(0x13a)));
        assertTrue(_valid(_wrapped(0x148)));
        assertFalse(_valid(_wrapped(0x149)));
        assertFalse(_valid(_wrapped(0x14a)));
        assertTrue(_valid(_wrapped(0x14b)));
        assertTrue(_valid(_wrapped(0x177)));
        assertFalse(_valid(_wrapped(0x178)));
        assertFalse(_valid(_wrapped(0x179)));
        assertTrue(_valid(_wrapped(0x17a)));
        assertTrue(_valid(_wrapped(0x17e)));
        // The long s reads as an f
        assertFalse(_valid(_wrapped(0x17f)));
    }

    function test_TellsCyrillicCapitalsFromSmallLettersToo() public view {
        uint24[8] memory small = [uint24(0x430), 0x45f, 0x461, 0x481, 0x48b, 0x4c2, 0x4cf, 0x52f];
        uint24[9] memory other = [
            uint24(0x42f), // the last capital of the basic letters
            0x460,
            0x482, // the thousands sign
            0x483, // a combining mark
            0x48a,
            0x4c0, // palochka
            0x4c1,
            0x4d0,
            0x52e
        ];
        // Beside a letter that is plainly Cyrillic, so the look-alike rule never decides
        for (uint256 i = 0; i < small.length; i++) {
            assertTrue(_valid(abi.encodePacked(_utf8(0x436), _utf8(small[i]))), vm.toString(uint256(small[i])));
        }
        for (uint256 i = 0; i < other.length; i++) {
            assertFalse(_valid(abi.encodePacked(_utf8(0x436), _utf8(other[i]))), vm.toString(uint256(other[i])));
        }
    }

    function test_KeepsToOneScript() public view {
        _assertRefused(abi.encodePacked(_utf8(0x430), "lice"), "a Cyrillic a in a Latin name");
        _assertRefused(abi.encodePacked("alic", _utf8(0x435)), "a Cyrillic e in a Latin name");
        _assertRefused(abi.encodePacked("g", _utf8(0x3bf), _utf8(0x3bf), "gle"), "Greek omicrons in a Latin name");
        _assertRefused(abi.encodePacked(_utf8(0x43f), _utf8(0x3b1), _utf8(0x43f)), "Greek in a Cyrillic name");
        _assertRefused(abi.encodePacked(_utf8(0x639), _utf8(0x644), "i"), "Latin in an Arabic name");
        _assertRefused(abi.encodePacked(_utf8(0x4f60), "a"), "Latin in a Chinese name");

        // Digits and hyphens go with any of them
        _assertTaken(abi.encodePacked(_utf8(0x639), _utf8(0x644), _utf8(0x6cc), "-2"), "Persian with a digit");
        _assertTaken(abi.encodePacked(_utf8(0x4f60), _utf8(0x597d), "88"), "Chinese with digits");
    }

    function test_AWholeNameOfLookAlikesIsRefused() public view {
        // Cyrillic es, o, es, o reads coco
        _assertRefused(abi.encodePacked(_utf8(0x441), _utf8(0x43e), _utf8(0x441), _utf8(0x43e)), "coco");
        // er, u, es reads pyc
        _assertRefused(abi.encodePacked(_utf8(0x440), _utf8(0x443), _utf8(0x441)), "pyc");
        // Greek omicrons read ooo
        _assertRefused(abi.encodePacked(_utf8(0x3bf), _utf8(0x3bf), _utf8(0x3bf)), "ooo");
        // With digits between them they still do
        _assertRefused(abi.encodePacked(_utf8(0x441), "0", _utf8(0x441), "0"), "c0c0");

        // One letter of its own and the name is plainly Cyrillic
        _assertTaken(abi.encodePacked(_utf8(0x441), _utf8(0x43e), _utf8(0x43a)), "sok");
    }

    // --- WHAT IS REFUSED WITHOUT BEING NAMED ---

    function test_RefusesTheInvisible() public view {
        uint24[30] memory hidden = [
            uint24(0x80), // a control
            0xa0, // no-break space
            0xad, // soft hyphen
            0x34f, // combining grapheme joiner
            0x61c, // Arabic letter mark
            0x115f, // Hangul fillers
            0x1160,
            0x17b4, // Khmer vowels that draw nothing
            0x180e, // Mongolian vowel separator
            0x2000, // spaces of every width
            0x200b, // zero width space
            0x200d, // zero width joiner
            0x200e, // direction marks
            0x200f,
            0x2028, // line separator
            0x202e, // right-to-left override
            0x2060, // word joiner
            0x2066, // direction isolates
            0x2800, // the blank Braille pattern
            0x3000, // ideographic space
            0x3164, // Hangul filler
            0xe000, // private use
            0xf8ff,
            0xfe00, // variation selectors
            0xfe0f,
            0xfeff, // zero width no-break space
            0xffa0, // halfwidth Hangul filler
            0xfffd, // the replacement character
            0xfffe,
            0xffff
        ];
        for (uint256 i = 0; i < hidden.length; i++) _assertRefused(_wrapped(hidden[i]), vm.toString(uint256(hidden[i])));
    }

    function test_RefusesSymbolsPunctuationAndEmoji() public view {
        uint24[24] memory symbols = [
            uint24(0xa9), // copyright
            0xd7, // multiplication sign
            0xf7, // division sign
            0x37e, // the Greek question mark, drawn like a semicolon
            0x2010, // a hyphen that isn't the hyphen
            0x2013, // dashes
            0x2014,
            0x2019, // a quotation mark
            0x2030, // per mille
            0x20ac, // euro
            0x20e3, // what makes a digit a keycap
            0x2122, // trade mark
            0x2190, // arrows
            0x2460, // circled digits
            0x2600, // weather
            0x2764, // heart
            0x3002, // ideographic full stop
            0x30fb, // katakana middle dot
            0x60c, // Arabic comma
            0x61f, // Arabic question mark
            0x640, // tatweel, which only stretches a word
            0x6d4, // Arabic full stop
            0xfdfc, // rial sign
            0xff0e // fullwidth full stop
        ];
        for (uint256 i = 0; i < symbols.length; i++) _assertRefused(_wrapped(symbols[i]), vm.toString(uint256(symbols[i])));

        // Past the first plane, where the emoji are, nothing is read at all
        _assertRefused(abi.encodePacked("ab", _utf8(0x1f98a), "cd"), "fox");
        _assertRefused(_utf8(0x1f199), "squared up!");
        _assertRefused(abi.encodePacked("ab", _utf8(0x10330), "cd"), "a Gothic letter");
    }

    function test_RefusesLettersDrawnAnotherWay() public view {
        uint24[12] memory forms = [
            uint24(0xaa), // feminine ordinal, a small raised a
            0x1d00, // small capitals
            0x2071, // superscript i
            0x2113, // script l
            0x212f, // script e
            0x24d0, // circled a
            0xfb01, // the fi ligature
            0xfb50, // Arabic presentation forms
            0xfe8d,
            0xff41, // fullwidth a
            0xff71, // halfwidth katakana
            0xf900 // a compatibility ideograph
        ];
        for (uint256 i = 0; i < forms.length; i++) _assertRefused(_wrapped(forms[i]), vm.toString(uint256(forms[i])));
        // Mathematical letters, the usual way to write alice a second time
        _assertRefused(abi.encodePacked(_utf8(0x1d41a), _utf8(0x1d425), _utf8(0x1d422), _utf8(0x1d41c), _utf8(0x1d41e)), "bold alice");
    }

    function test_RefusesDigitsOfOtherScripts() public view {
        _assertRefused(abi.encodePacked(_utf8(0x639), _utf8(0x644), _utf8(0x6cc), _utf8(0x6f1)), "a Persian digit");
        _assertRefused(abi.encodePacked(_utf8(0x639), _utf8(0x644), _utf8(0x6cc), _utf8(0x661)), "an Arabic digit");
        _assertRefused(abi.encodePacked("ab", _utf8(0xff11)), "a fullwidth digit");
    }

    // --- MARKS ---

    function test_ALetterAndItsMarkNeverSpellWhatOneCodePointSpells() public view {
        // e and a combining acute accent are the e with acute the rules already take
        _assertRefused(abi.encodePacked("caf", "e", _utf8(0x301)), "a combining accent");
        _assertRefused(abi.encodePacked(_utf8(0x438), _utf8(0x306)), "a combining breve on a Cyrillic letter");
        // Alef and a maddah are the alef with maddah
        _assertRefused(abi.encodePacked(_utf8(0x627), _utf8(0x653), _utf8(0x628)), "a combining maddah");
        _assertRefused(abi.encodePacked(_utf8(0x627), _utf8(0x654), _utf8(0x628)), "a combining hamza");
        // Ka and its voicing mark are ga
        _assertRefused(abi.encodePacked(_utf8(0x304b), _utf8(0x3099)), "a combining voicing mark");

        _assertTaken(abi.encodePacked(_utf8(0x622), _utf8(0x628)), "alef with maddah, one code point");
        _assertTaken(abi.encodePacked(_utf8(0x304c), _utf8(0x304b)), "ga, one code point");
    }

    function test_ArabicVowelMarksAddNoLength() public view {
        // mim, fatha, reh, sukun, hah
        bytes memory marked = abi.encodePacked(_utf8(0x645), _utf8(0x64e), _utf8(0x631), _utf8(0x652), _utf8(0x62d));
        _assertTaken(marked, "with vowel marks");
        assertEq(_length(marked), 3);
    }

    function test_TheSuperscriptAlefIsTheLastOfTheMarks() public view {
        bytes memory reh = _utf8(0x631);
        // rahman, as it is written in full
        _assertTaken(abi.encodePacked(reh, _utf8(0x62d), _utf8(0x645), _utf8(0x670), _utf8(0x646)), "after a letter");
        _assertTaken(abi.encodePacked(reh, _utf8(0x651), _utf8(0x670), _utf8(0x646)), "after a shadda");
        _assertRefused(abi.encodePacked(reh, _utf8(0x670), _utf8(0x651), _utf8(0x646)), "before a shadda");
    }

    function test_MarksFollowALetterInOneOrder() public view {
        bytes memory mim = _utf8(0x645);
        bytes memory fatha = _utf8(0x64e);
        bytes memory shadda = _utf8(0x651);

        _assertTaken(abi.encodePacked(mim, fatha, shadda, mim), "fatha then shadda");
        // The other order is the same text to a reader, so only one is a name
        _assertRefused(abi.encodePacked(mim, shadda, fatha, mim), "shadda then fatha");
        _assertRefused(abi.encodePacked(mim, fatha, fatha, mim), "a mark twice");
        _assertRefused(abi.encodePacked(fatha, mim, mim), "a mark with no letter before it");
        _assertRefused(abi.encodePacked(fatha, fatha, fatha), "marks alone");
        _assertRefused(abi.encodePacked("ab", fatha), "an Arabic mark on a Latin letter");
        _assertRefused(abi.encodePacked("12", fatha), "a mark on a digit");
    }

    // --- THE JOINER ---

    function test_TheJoinerIsTakenOnlyWhereItShows() public view {
        bytes memory zwnj = _utf8(0x200c);
        bytes memory yeh = _utf8(0x6cc);
        bytes memory reh = _utf8(0x631);
        bytes memory alef = _utf8(0x627);
        bytes memory khah = _utf8(0x62e);
        bytes memory hamza = _utf8(0x621);

        // After a letter that would join the next one, it keeps them apart
        _assertTaken(abi.encodePacked(khah, yeh, zwnj, reh, alef), "after yeh");
        _assertTaken(abi.encodePacked(khah, yeh, zwnj, khah, alef), "between two joining letters");

        // After a letter that joins nothing after it, it changes nothing a reader sees
        _assertRefused(abi.encodePacked(khah, alef, zwnj, khah, alef), "after alef");
        _assertRefused(abi.encodePacked(khah, reh, zwnj, khah, alef), "after reh");
        _assertRefused(abi.encodePacked(khah, hamza, zwnj, khah, alef), "after hamza");
        _assertRefused(abi.encodePacked(khah, yeh, zwnj, hamza, alef), "before hamza");

        _assertRefused(abi.encodePacked(zwnj, khah, yeh, alef), "first");
        _assertRefused(abi.encodePacked(khah, yeh, alef, zwnj), "last");
        _assertRefused(abi.encodePacked(khah, yeh, zwnj, zwnj, khah), "twice");
        _assertRefused(abi.encodePacked(khah, yeh, zwnj, "2"), "before a digit");
        _assertRefused(abi.encodePacked(khah, yeh, zwnj, "-", khah), "before a hyphen");
        _assertRefused(abi.encodePacked(khah, yeh, _utf8(0x64e), zwnj, khah), "after a mark");
    }

    function test_TheJoinerMakesNoTwinOfALatinName() public view {
        _assertRefused(abi.encodePacked("al", _utf8(0x200c), "ice"), "inside");
        _assertRefused(abi.encodePacked("alice", _utf8(0x200c)), "last");
        _assertRefused(abi.encodePacked("al", _utf8(0x200d), "ice"), "the zero width joiner");
        _assertRefused(abi.encodePacked("al", _utf8(0xfe00), "ice"), "a variation selector");
    }

    // --- MALFORMED TEXT ---

    function test_RefusesMalformedUtf8() public view {
        _assertRefused(hex"6162806364", "a continuation byte alone");
        _assertRefused(hex"6162bf6364", "a continuation byte alone");
        _assertRefused(hex"6162c0af6364", "overlong, two bytes");
        _assertRefused(hex"6162c1bf6364", "overlong, two bytes");
        _assertRefused(hex"6162e080af6364", "overlong, three bytes");
        _assertRefused(hex"6162e09fbf6364", "overlong, three bytes");
        _assertRefused(hex"6162f08080af6364", "overlong, four bytes");
        _assertRefused(hex"6162eda0806364", "a surrogate");
        _assertRefused(hex"6162edbfbf6364", "a surrogate");
        _assertRefused(hex"6162f49080806364", "past the last code point");
        _assertRefused(hex"6162f58080806364", "a byte UTF-8 never uses");
        _assertRefused(hex"6162ff6364", "a byte UTF-8 never uses");
        _assertRefused(hex"6162c3", "cut short, two bytes");
        _assertRefused(hex"6162e4bd", "cut short, three bytes");
        _assertRefused(hex"6162f09f98", "cut short, four bytes");
        _assertRefused(hex"6162c3286364", "a bad second byte");
        _assertRefused(hex"6162e4bd286364", "a bad third byte");
        // A letter spelled the long way is not that letter
        _assertRefused(hex"6162c1a16364", "an a in two bytes");
    }

    // --- THROUGH THE REGISTRY ---

    function test_Registry_StoresTheNormalizedForm() public {
        uint256 tokenId = _register(alice, arc, "AlIcE");
        assertEq(registry.recordOf(tokenId).label, "alice");
        assertEq(registry.nameOf(tokenId), "alice.arc");
        assertEq(tokenId, uint256(keccak256(abi.encodePacked(arc, "alice"))));
        assertFalse(registry.lookup(arc, "ALICE").available);
    }

    function test_Registry_AppliesItsOwnLengthsToWhatTheRulesCount() public view {
        _assertValidity(arc, "ab", IReadable.Validity.TooShort);
        _assertValidity(arc, "abc", IReadable.Validity.Valid);
        _assertValidity(arc, "abcdefghijklmnopqrstuvwxyzabcdef", IReadable.Validity.Valid);
        _assertValidity(arc, "abcdefghijklmnopqrstuvwxyzabcdefg", IReadable.Validity.TooLong);

        // Three letters in seven bytes are three characters
        bytes memory persian = abi.encodePacked(_utf8(0x639), _utf8(0x644), _utf8(0x6cc));
        assertEq(registry.lookup(arc, string(persian)).length, 3);
        assertEq(registry.priceOf(arc, string(persian), 1), 160 * DOLLAR);
    }

    function test_Registry_ReadsNoLabelPastItsByteLimit() public view {
        bytes memory atLimit = new bytes(256);
        bytes memory over = new bytes(257);
        for (uint256 i = 0; i < over.length; i++) {
            if (i < atLimit.length) atLimit[i] = "a";
            over[i] = "a";
        }
        IReadable.NameInfo memory read = registry.lookup(arc, string(atLimit));
        assertEq(uint8(read.validity), uint8(IReadable.Validity.TooLong));
        assertEq(read.length, 256);
        IReadable.NameInfo memory unread = registry.lookup(arc, string(over));
        assertEq(uint8(unread.validity), uint8(IReadable.Validity.TooLong));
        assertEq(unread.length, 257);
    }

    function test_Registry_APersianNameIsSoldAndHeld() public {
        bytes memory label = abi.encodePacked(_utf8(0x639), _utf8(0x644), _utf8(0x6cc), _utf8(0x200c), _utf8(0x631), _utf8(0x636), _utf8(0x627));
        uint256 tokenId = _register(alice, arc, string(label));

        assertEq(registry.ownerOf(tokenId), alice);
        assertEq(registry.recordOf(tokenId).length, 6);
        assertEq(registry.nameOf(tokenId), string(abi.encodePacked(label, ".arc")));
        assertEq(manager.balance, DOLLAR / 2);
    }

    // --- REPLACING THE RULES ---

    function test_SetNameRules_AnnouncesTheChange() public {
        address next = address(new LooseRules());
        vm.expectEmit(true, false, false, true);
        emit IReadable.NameRulesUpdated(next);
        vm.prank(owner);
        registry.setNameRules(next);
        assertEq(registry.nameRules(), next);
    }

    function test_WithoutRulesNoNameIsTaken() public {
        vm.prank(owner);
        registry.setNameRules(address(0));

        _assertValidity(arc, "alice", IReadable.Validity.InvalidCharacter);
        vm.prank(alice);
        _expectInvalid(IReadable.Validity.InvalidCharacter);
        registry.register{value: 5 * DOLLAR}(arc, "alice", 1);

        // Numbers ask no rules
        _register(alice, numbers, "4242");
    }

    function test_RulesThatAreNoContractTakeNothing() public {
        vm.prank(owner);
        registry.setNameRules(stranger);
        _assertValidity(arc, "alice", IReadable.Validity.InvalidCharacter);
        assertFalse(registry.isReserved(arc, "alice"));
    }

    function test_RulesThatFailTakeNothingAndBreakNothing() public {
        uint256 held = _register(alice, arc, "alice");
        uint256 number = _register(alice, numbers, "4242");
        _useRules(_deployedBrokenRules());

        _assertValidity(arc, "bob", IReadable.Validity.InvalidCharacter);
        _assertValidity(arc, "alice", IReadable.Validity.InvalidCharacter);

        // What is held goes on as before
        assertEq(registry.ownerOf(held), alice);
        assertEq(registry.nameOf(held), "alice.arc");
        assertEq(registry.resolve(held), alice);
        vm.startPrank(alice);
        registry.renew{value: 5 * DOLLAR}(held, 1);
        registry.setText(held, "records", "x");
        registry.transferFrom(alice, bob, held);
        registry.renew{value: 100 * DOLLAR}(number, 1);
        vm.stopPrank();
    }

    function test_RulesThatAnswerWhatCannotBeStoredTakeNothing() public {
        vm.startPrank(owner);
        registry.setNameRules(_deployedOddRules(0));
        vm.stopPrank();
        _assertValidity(arc, "alice", IReadable.Validity.InvalidCharacter);

        _useRules(_deployedOddRules(257));
        _assertValidity(arc, "alice", IReadable.Validity.InvalidCharacter);

        _useRules(_deployedOddRules(256));
        _assertValidity(arc, "alice", IReadable.Validity.Valid);
    }

    function test_NewRulesBindNewNamesOnly() public {
        uint256 held = _register(alice, arc, "alice");
        _useRules(_deployedClosedRules());

        vm.prank(bob);
        _expectInvalid(IReadable.Validity.InvalidCharacter);
        registry.register{value: 5 * DOLLAR}(arc, "bobby", 1);

        assertEq(registry.ownerOf(held), alice);
        assertEq(registry.recordOf(held).label, "alice");
        vm.prank(alice);
        registry.setTarget(held, bob);
        assertEq(registry.resolve(held), bob);
    }

    function test_ARenewalIsPricedAsTheNameWasCounted() public {
        // Three letters, the dearest tier
        uint256 held = _register(alice, arc, "abc");
        _useRules(_deployedClosedRules());

        uint256 before = alice.balance;
        vm.prank(alice);
        registry.renew{value: 320 * DOLLAR}(held, 2);
        assertEq(before - alice.balance, 320 * DOLLAR);

        // And a long name stays cheap under rules that would refuse it
        vm.prank(owner);
        registry.setNameRules(address(rules));
        uint256 long = _register(alice, arc, "alice-in-wonderland");
        _useRules(_deployedBrokenRules());
        before = alice.balance;
        vm.prank(alice);
        registry.renew{value: 5 * DOLLAR}(long, 1);
        assertEq(before - alice.balance, 5 * DOLLAR);
    }

    function test_TheOwnerTakesNoNameByChangingTheRules() public {
        uint256 held = _register(alice, arc, "alice");
        uint64 availableAt = registry.recordOf(held).expiresAt + registry.gracePeriod();

        // Rules that spell every label the way alice's is stored
        vm.startPrank(owner);
        registry.setNameRules(_deployedLooseRules());
        vm.expectRevert(abi.encodeWithSelector(IReadable.NameUnavailable.selector, held, availableAt));
        registry.adminRegister(arc, "alice", owner, 1);
        vm.stopPrank();
        assertEq(registry.ownerOf(held), alice);
    }

    function test_AReservationHoldsUnderTheFormItWasMadeIn() public {
        vm.prank(owner);
        registry.setReserved(arc, _one("Admin"), true);
        assertTrue(registry.isReserved(arc, "ADMIN"));
        _assertValidity(arc, "admin", IReadable.Validity.Reserved);

        vm.prank(alice);
        _expectInvalid(IReadable.Validity.Reserved);
        registry.register{value: 5 * DOLLAR}(arc, "aDmIn", 1);
    }
}
