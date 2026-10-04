// SPDX-License-Identifier: MIT
pragma solidity ^0.8.35;

import {Test} from "forge-std/Test.sol";
import {IERC4906} from "@openzeppelin/contracts/interfaces/IERC4906.sol";
import {Readable} from "../src/Readable.sol";
import {IReadable} from "../src/IReadable.sol";
import {NameRules} from "../src/NameRules.sol";

/// @dev A smart account with no ERC-721 receiver hook, like many that must still hold names.
contract PlainAccount {}

contract ReadableTest is Test {
    Readable internal registry;

    address internal owner = makeAddr("owner");
    address internal forwarder = makeAddr("forwarder");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal manager = makeAddr("manager");
    address internal dao = makeAddr("dao");

    uint256 internal numbers;
    uint256 internal lyx;

    function setUp() public {
        registry = new Readable(owner, forwarder);

        uint256[] memory numberPrices = new uint256[](7);
        numberPrices[0] = 2000 ether;
        numberPrices[1] = 500 ether;
        numberPrices[2] = 100 ether;
        numberPrices[3] = 25 ether;
        numberPrices[4] = 5 ether;
        numberPrices[5] = 5 ether;
        numberPrices[6] = 0;

        uint256[] memory namePrices = new uint256[](3);
        namePrices[0] = 160 ether;
        namePrices[1] = 40 ether;
        namePrices[2] = 5 ether;

        vm.startPrank(owner);
        registry.setNameRules(address(new NameRules()));
        numbers = registry.addNamespace(IReadable.Kind.Number, "0", 2, 12, 8, numberPrices, address(0), 0, "");
        lyx = registry.addNamespace(IReadable.Kind.Name, "lyx", 3, 32, 0, namePrices, manager, 10, "");
        vm.stopPrank();

        vm.deal(alice, 10_000 ether);
        vm.deal(bob, 10_000 ether);
    }

    function _register(address who, uint256 namespaceId, string memory label, uint256 value) internal returns (uint256) {
        vm.prank(who);
        return registry.register{value: value}(namespaceId, label, 1);
    }

    // --- NUMBERS ---

    function test_RegistersANumber() public {
        uint256 tokenId = _register(alice, numbers, "4242", 100 ether);

        assertEq(registry.ownerOf(tokenId), alice);
        assertEq(registry.nameOf(tokenId), "+0 4242");
        assertEq(registry.resolve(tokenId), alice);
        assertEq(registry.tokenIdOf(numbers, "4242"), tokenId);
        assertEq(registry.recordOf(tokenId).expiresAt, block.timestamp + 365 days);
        assertEq(address(registry).balance, 100 ether);
    }

    function test_RequiresTheExactPrice() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(IReadable.IncorrectPayment.selector, 100 ether, 99 ether));
        registry.register{value: 99 ether}(numbers, "4242", 1);
    }

    function test_LongNumbersNeedAValidCheckDigit() public {
        assertEq(uint8(registry.lookup(numbers, "42421231").validity), uint8(IReadable.Validity.InvalidCheckDigit));

        IReadable.NameInfo memory info = registry.lookup(numbers, "42421230");
        assertEq(uint8(info.validity), uint8(IReadable.Validity.Valid));
        assertTrue(info.available);
        assertEq(info.pricePerYear, 0);

        uint256 tokenId = _register(alice, numbers, "42421230", 0);
        assertEq(registry.ownerOf(tokenId), alice);
    }

    function test_NumbersAreDigitsOnly() public view {
        assertEq(uint8(registry.lookup(numbers, "42a2").validity), uint8(IReadable.Validity.InvalidCharacter));
        assertEq(uint8(registry.lookup(numbers, "1").validity), uint8(IReadable.Validity.TooShort));
        assertEq(registry.lookup(numbers, "42").pricePerYear, 2000 ether);
    }

    function test_MultiYearRegistrationScalesThePrice() public {
        assertEq(registry.priceOf(numbers, "4242", 3), 300 ether);
        vm.prank(alice);
        uint256 tokenId = registry.register{value: 300 ether}(numbers, "4242", 3);
        assertEq(registry.recordOf(tokenId).expiresAt, block.timestamp + 3 * 365 days);
    }

    // --- EMOJI ---

    function test_NamesTakeNoEmoji() public view {
        _assertInvalid(lyx, string(hex"F09FA68A")); // fox
        _assertInvalid(lyx, string(hex"616C696365F09F9A80")); // alice then rocket
        _assertInvalid(lyx, string(hex"F09F91A8E2808DF09F91A9E2808DF09F91A7")); // family ZWJ sequence
        _assertInvalid(lyx, string(hex"F09F87AEF09F87B7")); // flag pair
        _assertInvalid(lyx, string(hex"F09F918DF09F8FBD")); // thumbs up with skin tone
        _assertInvalid(lyx, string(hex"E29DA4EFB88F")); // heart with VS16
        _assertInvalid(lyx, string(hex"31EFB88FE283A3")); // keycap 1
        _assertInvalid(lyx, string(hex"616263EFB88F")); // abc asked to show as emoji
        _assertInvalid(numbers, string(hex"F09FA68A"));
    }

    // --- NAMES ---

    function test_NamesAreCaseInsensitive() public {
        uint256 tokenId = _register(alice, lyx, "Alice", 5 ether);
        assertEq(registry.nameOf(tokenId), "alice.lyx");
        assertEq(registry.tokenIdOf(lyx, "alice"), tokenId);
        assertFalse(registry.lookup(lyx, "ALICE").available);
    }

    function test_NamesKeepZwnjButBlockLookAlikes() public view {
        // Persian "ali<ZWNJ>reza": six letters, the ZWNJ adds no width
        IReadable.NameInfo memory persian = registry.lookup(lyx, string(hex"D8B9D984DB8CE2808CD8B1D8B6D8A7"));
        assertEq(uint8(persian.validity), uint8(IReadable.Validity.Valid));
        assertEq(persian.length, 6);

        _assertInvalid(lyx, string(hex"616C696365E280AE")); // right-to-left override
        _assertInvalid(lyx, string(hex"D985D8B1E2808C")); // trailing ZWNJ
        _assertInvalid(lyx, "-bad");
        _assertInvalid(lyx, "a b");
        _assertInvalid(lyx, "a.b");
    }

    function test_ManagerReceivesItsShare() public {
        _register(alice, lyx, "alice", 5 ether);
        assertEq(manager.balance, 0.5 ether);
        assertEq(address(registry).balance, 4.5 ether);
    }

    // --- EXPIRY ---

    function test_ExpiredNameWaitsOutTheGracePeriod() public {
        uint256 tokenId = _register(alice, numbers, "4242", 100 ether);
        vm.warp(block.timestamp + 366 days);

        IReadable.NameInfo memory inGrace = registry.lookup(numbers, "4242");
        assertFalse(inGrace.available);
        assertEq(inGrace.owner, alice);
        assertEq(registry.resolve(tokenId), address(0));

        vm.prank(bob);
        vm.expectRevert();
        registry.register{value: 100 ether}(numbers, "4242", 1);

        vm.warp(block.timestamp + 30 days);
        assertTrue(registry.lookup(numbers, "4242").available);
        _register(bob, numbers, "4242", 100 ether);
        assertEq(registry.ownerOf(tokenId), bob);
        assertEq(registry.namesOf(alice).length, 0);
    }

    function test_AnyoneCanRenewDuringGrace() public {
        uint256 tokenId = _register(alice, numbers, "4242", 100 ether);
        uint64 expiresAt = registry.recordOf(tokenId).expiresAt;
        vm.warp(block.timestamp + 370 days);

        vm.prank(bob);
        registry.renew{value: 100 ether}(tokenId, 1);
        assertEq(registry.recordOf(tokenId).expiresAt, expiresAt + 365 days);
        assertEq(registry.ownerOf(tokenId), alice);
    }

    function test_ExpiredNameCannotBeTransferred() public {
        uint256 tokenId = _register(alice, numbers, "4242", 100 ether);
        vm.warp(block.timestamp + 366 days);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(IReadable.NameExpired.selector, tokenId));
        registry.transferFrom(alice, bob, tokenId);
    }

    // --- HOLDER SETTINGS ---

    function test_TransferRepointsTheNameAndClearsPrimary() public {
        uint256 tokenId = _register(alice, numbers, "4242", 100 ether);
        vm.startPrank(alice);
        registry.setPrimaryName(tokenId);
        registry.setTarget(tokenId, makeAddr("agent"));
        registry.transferFrom(alice, bob, tokenId);
        vm.stopPrank();

        assertEq(registry.resolve(tokenId), bob);
        (uint256 primary, ) = registry.primaryNameOf(alice);
        assertEq(primary, 0);
        assertEq(registry.namesOf(bob)[0], tokenId);
    }

    function test_PrimaryName() public {
        uint256 tokenId = _register(alice, numbers, "4242", 100 ether);
        vm.prank(alice);
        registry.setPrimaryName(tokenId);
        (uint256 primary, string memory name) = registry.primaryNameOf(alice);
        assertEq(primary, tokenId);
        assertEq(name, "+0 4242");

        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(IReadable.NotNameOwner.selector, tokenId));
        registry.setPrimaryName(tokenId);
    }

    function test_TransferLeavesTextRecordsBehind() public {
        uint256 tokenId = _register(alice, numbers, "4242", 100 ether);
        vm.startPrank(alice);
        registry.setText(tokenId, "records", "{\"agent\":{\"payment\":\"0xA11CE\"}}");
        registry.transferFrom(alice, bob, tokenId);
        vm.stopPrank();

        assertEq(registry.text(tokenId, "records"), "");

        vm.prank(bob);
        registry.setText(tokenId, "records", "{\"name\":\"Bob\"}");
        assertEq(registry.text(tokenId, "records"), "{\"name\":\"Bob\"}");
    }

    function test_TextRecordsResetForTheNextHolder() public {
        uint256 tokenId = _register(alice, numbers, "4242", 100 ether);
        vm.prank(alice);
        registry.setText(tokenId, "mcp", "https://agent.example/mcp");
        assertEq(registry.text(tokenId, "mcp"), "https://agent.example/mcp");

        vm.warp(block.timestamp + 400 days);
        _register(bob, numbers, "4242", 100 ether);
        assertEq(registry.text(tokenId, "mcp"), "");
    }

    // --- ADMIN ---

    function test_ReservedLabelsAreOwnerOnly() public {
        string[] memory labels = new string[](1);
        labels[0] = "707";
        vm.prank(owner);
        registry.setReserved(numbers, labels, true);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(IReadable.InvalidLabel.selector, IReadable.Validity.Reserved));
        registry.register{value: 500 ether}(numbers, "707", 1);

        vm.prank(owner);
        uint256 tokenId = registry.adminRegister(numbers, "707", bob, 1);
        assertEq(registry.ownerOf(tokenId), bob);
    }

    function test_PausedNamespaceBlocksNewNamesOnly() public {
        uint256 tokenId = _register(alice, numbers, "4242", 100 ether);
        vm.prank(owner);
        registry.updateNamespace(numbers, 2, 12, 8, true, address(0), 0, "");

        assertEq(uint8(registry.lookup(numbers, "4243").validity), uint8(IReadable.Validity.NamespacePaused));
        vm.prank(alice);
        registry.renew{value: 100 ether}(tokenId, 1);
    }

    function test_PriceCurveMustNotRise() public {
        uint256[] memory rising = new uint256[](2);
        rising[0] = 1 ether;
        rising[1] = 2 ether;
        vm.prank(owner);
        vm.expectRevert(IReadable.InvalidPriceCurve.selector);
        registry.setPrices(numbers, rising);
    }

    function test_NamespaceNamesAreUniqueAndClean() public {
        uint256[] memory prices = new uint256[](1);
        vm.startPrank(owner);
        vm.expectRevert(abi.encodeWithSelector(IReadable.NamespaceNameTaken.selector, "lyx"));
        registry.addNamespace(IReadable.Kind.Name, "lyx", 3, 32, 0, prices, address(0), 0, "");
        vm.expectRevert(IReadable.InvalidNamespaceName.selector);
        registry.addNamespace(IReadable.Kind.Name, "Bad", 3, 32, 0, prices, address(0), 0, "");
        vm.expectRevert(IReadable.InvalidNamespaceName.selector);
        registry.addNamespace(IReadable.Kind.Number, "x1", 3, 32, 0, prices, address(0), 0, "");
        vm.stopPrank();
    }

    function test_ExtensionsTakeNoEmoji() public {
        uint256[] memory prices = new uint256[](1);
        vm.startPrank(owner);
        vm.expectRevert(IReadable.InvalidNamespaceName.selector);
        registry.addNamespace(IReadable.Kind.Name, string(hex"F09F8699"), 1, 32, 0, prices, address(0), 0, ""); // squared up!
        vm.expectRevert(IReadable.InvalidNamespaceName.selector);
        registry.addNamespace(IReadable.Kind.Name, string(hex"61F09F8699"), 1, 32, 0, prices, address(0), 0, ""); // letter then emoji
        vm.stopPrank();
    }

    function test_OnlyOwnerAdministers() public {
        uint256[] memory prices = new uint256[](1);
        vm.prank(alice);
        vm.expectRevert();
        registry.addNamespace(IReadable.Kind.Name, "hup", 3, 32, 0, prices, address(0), 0, "");
    }

    function test_WithdrawSendsTheBalance() public {
        _register(alice, numbers, "4242", 100 ether);
        address treasury = makeAddr("treasury");
        vm.prank(owner);
        registry.withdraw(treasury, 0);
        assertEq(treasury.balance, 100 ether);
    }

    // --- TREASURY ---

    function _setTreasury(address to) internal {
        vm.prank(owner);
        registry.setTreasury(to);
    }

    function test_SharesCannotPassTheWholePrice() public {
        uint256[] memory prices = new uint256[](1);
        vm.startPrank(owner);
        vm.expectRevert(IReadable.InvalidShare.selector);
        registry.updateNamespace(lyx, 3, 32, 0, false, manager, 101, "");
        vm.expectRevert(IReadable.InvalidShare.selector);
        registry.addNamespace(IReadable.Kind.Name, "arc", 3, 32, 0, prices, manager, 101, "");
        registry.updateNamespace(lyx, 3, 32, 0, false, manager, 100, "");
        vm.stopPrank();
    }

    function test_TreasuryReceivesTheRegistryShare() public {
        _setTreasury(dao);
        vm.prank(alice);
        registry.register{value: 5 ether}(lyx, "alice", 1);

        assertEq(manager.balance, 0.5 ether);
        assertEq(dao.balance, 4.5 ether);
        assertEq(address(registry).balance, 0);
    }

    function test_PayoutThatCannotArriveFailsThePurchase() public {
        // An account that can't receive the native coin
        address deaf = address(new PlainAccount());
        _setTreasury(deaf);
        vm.prank(alice);
        vm.expectRevert(IReadable.TransferFailed.selector);
        registry.register{value: 100 ether}(numbers, "4242", 1);

        // The owner points the treasury elsewhere and sales resume
        _setTreasury(dao);
        vm.prank(alice);
        uint256 tokenId = registry.register{value: 100 ether}(numbers, "4242", 1);
        assertEq(registry.ownerOf(tokenId), alice);
        assertEq(dao.balance, 100 ether);
        assertEq(address(registry).balance, 0);
    }

    function test_OnlyOwnerSetsTheTreasury() public {
        vm.prank(alice);
        vm.expectRevert();
        registry.setTreasury(alice);
    }

    // --- CALLERS ---

    function test_SmartAccountWithoutReceiverCanHoldNames() public {
        address account = address(new PlainAccount());
        vm.deal(account, 1_000 ether);
        uint256 tokenId = _register(account, numbers, "4242", 100 ether);
        assertEq(registry.ownerOf(tokenId), account);
    }

    function test_TrustedForwarderActsForTheSignerOnItsNames() public {
        uint256 tokenId = _register(alice, numbers, "4242", 100 ether);
        bytes memory change = abi.encodeCall(Readable.setTarget, (tokenId, bob));

        vm.prank(forwarder);
        (bool success, ) = address(registry).call(abi.encodePacked(change, alice));
        assertTrue(success);
        assertEq(registry.resolve(tokenId), bob);
    }

    function test_TrustedForwarderBuysNothingForTheSigner() public {
        // A purchase is the caller's own, so the forwarder would be the one buying
        bytes memory purchase = abi.encodeCall(Readable.register, (numbers, "42421230", 1));
        vm.prank(forwarder);
        (bool success, ) = address(registry).call(abi.encodePacked(purchase, alice));
        assertTrue(success);
        assertEq(registry.ownerOf(registry.tokenIdOf(numbers, "42421230")), forwarder);
        assertEq(registry.balanceOf(alice), 0);
    }

    // --- METADATA ---

    function test_TokenUriFollowsTheBaseUri() public {
        uint256 tokenId = _register(alice, numbers, "4242", 100 ether);
        assertEq(registry.tokenURI(tokenId), "");

        vm.expectEmit(false, false, false, true);
        emit IERC4906.BatchMetadataUpdate(0, type(uint256).max);
        vm.prank(owner);
        registry.setBaseURI("https://readable.name/nft/");
        assertEq(registry.tokenURI(tokenId), string.concat("https://readable.name/nft/", vm.toString(tokenId)));

        vm.prank(owner);
        registry.setBaseURI("ipfs://bafy/");
        assertEq(registry.tokenURI(tokenId), string.concat("ipfs://bafy/", vm.toString(tokenId)));

        vm.expectRevert();
        registry.tokenURI(1);
    }

    function test_OnlyOwnerSetsTheBaseUri() public {
        vm.prank(alice);
        vm.expectRevert();
        registry.setBaseURI("https://elsewhere.example/");
    }

    function test_RenewalAnnouncesNewMetadata() public {
        uint256 tokenId = _register(alice, numbers, "4242", 100 ether);
        vm.expectEmit(false, false, false, true);
        emit IERC4906.MetadataUpdate(tokenId);
        vm.prank(alice);
        registry.renew{value: 100 ether}(tokenId, 1);
    }

    function test_SupportsTheMetadataUpdateInterface() public view {
        assertTrue(registry.supportsInterface(0x49064906));
        assertTrue(registry.supportsInterface(0x80ac58cd)); // ERC-721
    }

    // --- HELPERS ---

    function _assertInvalid(uint256 namespaceId, string memory label) internal view {
        assertEq(uint8(registry.lookup(namespaceId, label).validity), uint8(IReadable.Validity.InvalidCharacter), label);
    }
}
