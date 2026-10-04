// SPDX-License-Identifier: MIT
pragma solidity ^0.8.35;

import {IERC721Errors} from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";
import {IReadable} from "../src/IReadable.sol";
import {Readable} from "../src/Readable.sol";
import {Fixture} from "./Fixture.sol";

/// @dev Everything the registry answers without changing anything.
contract ViewsTest is Fixture {
    function test_Deployment_StartsAsDocumented() public {
        Readable fresh = new Readable(owner, address(forwarder));

        assertEq(fresh.version(), "1.0.0");
        assertEq(fresh.gracePeriod(), 30 days);
        assertEq(fresh.treasury(), address(0));
        assertEq(fresh.baseURI(), "");
        assertEq(fresh.namespaceCount(), 0);
        assertEq(fresh.getNamespaces().length, 0);
        assertEq(fresh.nameRules(), address(0));
        assertEq(fresh.trustedForwarder(), address(forwarder));
        assertTrue(fresh.isTrustedForwarder(address(forwarder)));
        assertFalse(fresh.isTrustedForwarder(owner));
    }

    function test_Deployment_NamesTheToken() public view {
        assertEq(registry.name(), "Readable");
        assertEq(registry.symbol(), "READ");
        assertEq(registry.owner(), owner);
        assertEq(registry.pendingOwner(), address(0));
        assertFalse(registry.paused());
        assertEq(registry.PERIOD(), 365 days);
        assertEq(registry.MAX_YEARS(), 10);
        assertEq(registry.MAX_LABEL_BYTES(), 256);
        assertEq(registry.nameRules(), address(rules));
    }

    function test_SupportsInterface() public view {
        assertTrue(registry.supportsInterface(0x01ffc9a7)); // ERC-165
        assertTrue(registry.supportsInterface(0x80ac58cd)); // ERC-721
        assertTrue(registry.supportsInterface(0x5b5e139f)); // ERC-721 metadata
        assertTrue(registry.supportsInterface(0x49064906)); // ERC-4906
        assertFalse(registry.supportsInterface(0xffffffff));
        assertFalse(registry.supportsInterface(0x780e9d63)); // ERC-721 enumerable, which it is not
    }

    // --- LOOKUP ---

    function test_Lookup_AnAvailableName() public view {
        IReadable.NameInfo memory info = registry.lookup(numbers, "4242");
        assertEq(uint8(info.validity), uint8(IReadable.Validity.Valid));
        assertTrue(info.available);
        assertEq(info.tokenId, registry.tokenIdOf(numbers, "4242"));
        assertEq(info.owner, address(0));
        assertEq(info.target, address(0));
        assertEq(info.expiresAt, 0);
        assertEq(info.length, 4);
        assertEq(info.pricePerYear, 100 * DOLLAR);
    }

    function test_Lookup_ATakenName() public {
        uint256 tokenId = _register(alice, numbers, "4242");
        vm.prank(alice);
        registry.setTarget(tokenId, bob);

        IReadable.NameInfo memory info = registry.lookup(numbers, "4242");
        assertEq(uint8(info.validity), uint8(IReadable.Validity.Valid));
        assertFalse(info.available);
        assertEq(info.owner, alice);
        assertEq(info.target, bob);
        assertEq(info.expiresAt, block.timestamp + 365 days);
    }

    function test_Lookup_ThroughExpiryGraceAndRelease() public {
        _register(alice, numbers, "4242");

        vm.warp(block.timestamp + 365 days + 30 days - 1);
        IReadable.NameInfo memory inGrace = registry.lookup(numbers, "4242");
        assertFalse(inGrace.available);
        assertEq(inGrace.owner, alice);

        vm.warp(block.timestamp + 1);
        IReadable.NameInfo memory released = registry.lookup(numbers, "4242");
        assertTrue(released.available);
        assertEq(released.owner, address(0));
        assertEq(released.target, address(0));
        assertEq(released.expiresAt, 0);
    }

    function test_Lookup_SaysWhyANameCannotBeRegistered() public {
        vm.prank(owner);
        registry.setReserved(numbers, _one("707"), true);

        _assertValidity(99, "4242", IReadable.Validity.UnknownNamespace);
        _assertValidity(numbers, "42a2", IReadable.Validity.InvalidCharacter);
        _assertValidity(numbers, "", IReadable.Validity.TooShort);
        _assertValidity(numbers, "4", IReadable.Validity.TooShort);
        _assertValidity(numbers, "1234567890123", IReadable.Validity.TooLong);
        _assertValidity(numbers, "42421231", IReadable.Validity.InvalidCheckDigit);
        _assertValidity(numbers, "707", IReadable.Validity.Reserved);

        IReadable.NameInfo memory reserved = registry.lookup(numbers, "707");
        assertFalse(reserved.available);
        assertEq(reserved.pricePerYear, 500 * DOLLAR);

        vm.prank(owner);
        registry.updateNamespace(numbers, 2, 12, 8, true, address(0), 0, "");
        _assertValidity(numbers, "4242", IReadable.Validity.NamespacePaused);
        assertFalse(registry.lookup(numbers, "4242").available);
    }

    function test_Lookup_AnUnknownNamespaceCarriesNothing() public view {
        IReadable.NameInfo memory info = registry.lookup(99, "4242");
        assertEq(info.tokenId, 0);
        assertEq(info.pricePerYear, 0);
        assertFalse(info.available);
    }

    function test_Lookup_AHeldNameInAPausedNamespaceStillShowsItsHolder() public {
        _register(alice, numbers, "4242");
        vm.prank(owner);
        registry.updateNamespace(numbers, 2, 12, 8, true, address(0), 0, "");

        IReadable.NameInfo memory info = registry.lookup(numbers, "4242");
        assertEq(info.owner, alice);
        assertFalse(info.available);
    }

    // --- TOKEN ID AND PRICE ---

    function test_TokenIdOf_IsTheHashOfNamespaceAndLabel() public view {
        assertEq(registry.tokenIdOf(numbers, "4242"), uint256(keccak256(abi.encodePacked(numbers, "4242"))));
        assertEq(registry.tokenIdOf(arc, "alice"), uint256(keccak256(abi.encodePacked(arc, "alice"))));
        // Capitals are the same name
        assertEq(registry.tokenIdOf(arc, "ALICE"), registry.tokenIdOf(arc, "alice"));
        // The same label under two namespaces is two names
        assertTrue(registry.tokenIdOf(arc, "4242") != registry.tokenIdOf(numbers, "4242"));
        // A leading zero makes no number, rather than a twin of the one after it
        _assertValidity(numbers, "042", IReadable.Validity.InvalidCharacter);
    }

    function test_TokenIdOf_RefusesWhatCanNeverBeAName() public {
        _expectInvalid(IReadable.Validity.UnknownNamespace);
        registry.tokenIdOf(99, "4242");
        _expectInvalid(IReadable.Validity.InvalidCharacter);
        registry.tokenIdOf(numbers, "42 42");

        // A label of the wrong length today may fit tomorrow's rules, so it has an id
        assertTrue(registry.tokenIdOf(numbers, "4") != 0);
    }

    function test_PriceOf_FollowsTheCurve() public view {
        assertEq(registry.priceOf(numbers, "42", 1), 2000 * DOLLAR);
        assertEq(registry.priceOf(numbers, "424", 1), 500 * DOLLAR);
        assertEq(registry.priceOf(numbers, "4242", 1), 100 * DOLLAR);
        assertEq(registry.priceOf(numbers, "42421", 1), 25 * DOLLAR);
        assertEq(registry.priceOf(numbers, "424212", 1), 5 * DOLLAR);
        assertEq(registry.priceOf(numbers, "4242123", 1), 5 * DOLLAR);
        assertEq(registry.priceOf(numbers, "42421230", 1), 1 * DOLLAR);
        assertEq(registry.priceOf(numbers, "42421230", 10), 10 * DOLLAR);
        assertEq(registry.priceOf(arc, "abc", 1), 160 * DOLLAR);
        assertEq(registry.priceOf(arc, "abcd", 1), 40 * DOLLAR);
        assertEq(registry.priceOf(arc, "abcdefghij", 3), 15 * DOLLAR);
        // Shorter than the namespace takes is priced as its shortest
        assertEq(registry.priceOf(numbers, "4", 1), 2000 * DOLLAR);
    }

    function test_PriceOf_RefusesAnOddTermOrLabel() public {
        vm.expectRevert(abi.encodeWithSelector(IReadable.InvalidYears.selector, 0));
        registry.priceOf(numbers, "4242", 0);
        vm.expectRevert(abi.encodeWithSelector(IReadable.InvalidYears.selector, 11));
        registry.priceOf(numbers, "4242", 11);
        _expectInvalid(IReadable.Validity.UnknownNamespace);
        registry.priceOf(99, "4242", 1);
        _expectInvalid(IReadable.Validity.InvalidCharacter);
        registry.priceOf(numbers, "42x2", 1);
    }

    // --- NAMES AND RECORDS ---

    function test_NameOf_WritesEachKindItsOwnWay() public {
        uint256 number = _register(alice, numbers, "4242");
        uint256 long = _register(alice, numbers, "42421230");
        uint256 word = _register(alice, arc, "Alice");

        assertEq(registry.nameOf(number), "+0 4242");
        assertEq(registry.nameOf(long), "+0 42421230");
        assertEq(registry.nameOf(word), "alice.arc");

        vm.expectRevert(abi.encodeWithSelector(IReadable.NameNotFound.selector, 7));
        registry.nameOf(7);
    }

    function test_RecordOf_IsEmptyForWhatWasNeverRegistered() public view {
        IReadable.Record memory record = registry.recordOf(7);
        assertEq(record.namespaceId, 0);
        assertEq(record.label, "");
        assertEq(record.target, address(0));
        assertEq(record.expiresAt, 0);
        assertEq(record.length, 0);
    }

    function test_RecordOf_KeepsTheLengthTheNameWasCountedAs() public {
        assertEq(registry.recordOf(_register(alice, numbers, "4242")).length, 4);
        assertEq(registry.recordOf(_register(alice, numbers, "42421230")).length, 8);
        assertEq(registry.recordOf(_register(alice, arc, "Alice")).length, 5);
    }

    function test_Text_EndsAtExpiry() public {
        uint256 tokenId = _register(alice, numbers, "4242");
        vm.prank(alice);
        registry.setText(tokenId, "records", "alice's");

        vm.warp(block.timestamp + 365 days - 1);
        assertEq(registry.text(tokenId, "records"), "alice's");
        vm.warp(block.timestamp + 1);
        assertEq(registry.text(tokenId, "records"), "");
        assertEq(registry.text(7, "records"), "");

        // A renewal in the grace period brings them back with the name
        _renew(alice, tokenId, 1);
        assertEq(registry.text(tokenId, "records"), "alice's");
    }

    function test_Resolve_EndsAtExpiry() public {
        uint256 tokenId = _register(alice, numbers, "4242");
        assertEq(registry.resolve(tokenId), alice);
        assertEq(registry.resolve(7), address(0));

        vm.warp(block.timestamp + 365 days - 1);
        assertEq(registry.resolve(tokenId), alice);
        vm.warp(block.timestamp + 1);
        assertEq(registry.resolve(tokenId), address(0));
    }

    function test_NamesOf_ListsWhatAnAccountHolds() public {
        assertEq(registry.namesOf(alice).length, 0);
        uint256 first = _register(alice, numbers, "4242");
        uint256 second = _register(alice, arc, "alice");

        uint256[] memory held = registry.namesOf(alice);
        assertEq(held.length, 2);
        assertEq(held[0], first);
        assertEq(held[1], second);
    }

    function test_TokenUri_IsTheBaseFollowedByTheId() public {
        uint256 tokenId = _register(alice, numbers, "4242");
        assertEq(registry.tokenURI(tokenId), "");

        vm.prank(owner);
        registry.setBaseURI("https://readable.name/nft/");
        assertEq(registry.tokenURI(tokenId), string.concat("https://readable.name/nft/", vm.toString(tokenId)));

        vm.expectRevert(abi.encodeWithSelector(IERC721Errors.ERC721NonexistentToken.selector, 7));
        registry.tokenURI(7);
    }

    function test_OwnerOf_RefusesWhatWasNeverRegistered() public {
        vm.expectRevert(abi.encodeWithSelector(IERC721Errors.ERC721NonexistentToken.selector, 7));
        registry.ownerOf(7);
        vm.expectRevert(abi.encodeWithSelector(IERC721Errors.ERC721InvalidOwner.selector, address(0)));
        registry.balanceOf(address(0));
    }

    // --- NAMESPACES ---

    function test_GetNamespaces_ListsThemInOrder() public view {
        IReadable.Namespace[] memory list = registry.getNamespaces();
        assertEq(list.length, 2);
        assertEq(registry.namespaceCount(), 2);

        assertEq(list[0].id, numbers);
        assertEq(uint8(list[0].kind), uint8(IReadable.Kind.Number));
        assertEq(list[0].name, "0");
        assertEq(list[0].minLength, 2);
        assertEq(list[0].maxLength, 12);
        assertEq(list[0].checkDigitFrom, 8);
        assertFalse(list[0].paused);
        assertEq(list[0].manager, address(0));
        assertEq(list[0].managerShare, 0);
        assertEq(list[0].createdAt, block.timestamp);

        assertEq(list[1].id, arc);
        assertEq(uint8(list[1].kind), uint8(IReadable.Kind.Name));
        assertEq(list[1].name, "arc");
        assertEq(list[1].manager, manager);
        assertEq(list[1].managerShare, 10);
        assertEq(list[1].metadata, "{\"label\":\".arc\"}");
    }

    function test_GetPrices_ReturnsTheCurve() public view {
        uint256[] memory prices = registry.getPrices(numbers);
        assertEq(prices.length, 7);
        assertEq(prices[0], 2000 * DOLLAR);
        assertEq(prices[6], 1 * DOLLAR);
        assertEq(registry.getPrices(arc).length, 3);
        assertEq(registry.getPrices(99).length, 0);
    }

    function test_IsReserved_IgnoresCapitalsInNames() public {
        assertFalse(registry.isReserved(arc, "admin"));
        vm.prank(owner);
        registry.setReserved(arc, _one("Admin"), true);

        assertTrue(registry.isReserved(arc, "admin"));
        assertTrue(registry.isReserved(arc, "ADMIN"));
        assertFalse(registry.isReserved(numbers, "admin"));
        _assertValidity(arc, "aDmIn", IReadable.Validity.Reserved);
    }
}
