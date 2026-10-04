// SPDX-License-Identifier: MIT
pragma solidity ^0.8.35;

import {IReadable} from "../src/IReadable.sol";
import {Fixture} from "./Fixture.sol";

/// @dev What a number may be made of, read through `lookup` the way the app reads it. Names are in
///      NameRules.t.sol.
contract LabelsTest is Fixture {
    IReadable.Validity internal constant VALID = IReadable.Validity.Valid;
    IReadable.Validity internal constant INVALID = IReadable.Validity.InvalidCharacter;

    // --- NUMBERS ---

    function test_Number_IsDigitsAndNothingElse() public view {
        _assertValidity(numbers, "42", VALID);
        _assertValidity(numbers, "1002", VALID);
        // No leading zero: it would add nothing to the check digit and make a twin of the number after it
        _assertValidity(numbers, "00", INVALID);
        _assertValidity(numbers, "0042", INVALID);
        _assertValidity(numbers, "042421230", INVALID);
        _assertValidity(numbers, "42421230", VALID);

        string[10] memory bad = ["4 2", "+42", "4-2", "4.2", "42a", "0x42", " 42", "42 ", "4,2", "42\n"];
        for (uint256 i = 0; i < bad.length; i++) _assertValidity(numbers, bad[i], INVALID);

        // Digits of other scripts are not digits here: the app turns them into these first
        _assertValidity(numbers, string(abi.encodePacked(_utf8(0x6f4), _utf8(0x6f2))), INVALID);
        _assertValidity(numbers, string(abi.encodePacked(_utf8(0xff14), _utf8(0xff12))), INVALID);
    }

    function test_Number_LengthIsItsDigits() public view {
        assertEq(registry.lookup(numbers, "42").length, 2);
        assertEq(registry.lookup(numbers, "424242424242").length, 12);
        _assertValidity(numbers, "4", IReadable.Validity.TooShort);
        _assertValidity(numbers, "4242424242424", IReadable.Validity.TooLong);
    }

    function test_Number_CheckDigitStartsAtEightDigits() public view {
        // Below eight digits any number goes
        _assertValidity(numbers, "4242123", VALID);
        _assertValidity(numbers, "42421230", VALID);
        _assertValidity(numbers, _withCheckDigit("424212345"), VALID);
        _assertValidity(numbers, _withCheckDigit("42421234567"), VALID);

        for (uint256 last = 1; last < 10; last++) {
            _assertValidity(numbers, string(abi.encodePacked("4242123", uint8(48 + last))), IReadable.Validity.InvalidCheckDigit);
        }
    }

    function test_Number_OneWrongDigitNeverPasses() public view {
        bytes memory good = bytes(_withCheckDigit("42421234567"));
        for (uint256 at = 0; at < good.length; at++) {
            for (uint8 digit = 0; digit < 10; digit++) {
                if (uint8(good[at]) == 48 + digit) continue;
                bytes memory wrong = bytes.concat(good);
                wrong[at] = bytes1(48 + digit);
                // A zero put first is refused before the check digit is read
                IReadable.Validity expected = at == 0 && digit == 0 ? INVALID : IReadable.Validity.InvalidCheckDigit;
                _assertValidity(numbers, string(wrong), expected);
            }
        }
    }

    function test_AnyLabelIsAnsweredNeverRefused() public view {
        // Whatever bytes arrive, a lookup answers
        bytes[6] memory odd = [bytes(hex""), hex"00", hex"ffffffff", hex"80808080", hex"f4908080", hex"e2808d"];
        for (uint256 i = 0; i < odd.length; i++) {
            registry.lookup(arc, string(odd[i]));
            registry.lookup(numbers, string(odd[i]));
            registry.isReserved(arc, string(odd[i]));
        }
    }
}
