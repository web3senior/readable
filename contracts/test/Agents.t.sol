// SPDX-License-Identifier: MIT
pragma solidity ^0.8.35;

import {IERC721Errors} from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ERC2771Forwarder} from "@openzeppelin/contracts/metatx/ERC2771Forwarder.sol";
import {Readable} from "../src/Readable.sol";
import {IReadable} from "../src/IReadable.sol";
import {BareAccount, Fixture} from "./Fixture.sol";

/// @dev What an app needs to run a name for an agent: buying it into another account, an editor
///      that keeps it up to date without being able to move it, and the generation that tells one
///      holding of a name from the next.
contract AgentsTest is Fixture {
    address internal agent;
    uint256 internal agentKey;

    function setUp() public override {
        super.setUp();
        (agent, agentKey) = makeAddrAndKey("agent");
    }

    /// @dev `4242` for alice with `agent` as its editor.
    function _edited() internal returns (uint256 tokenId) {
        tokenId = _register(alice, numbers, "4242");
        vm.prank(alice);
        registry.setEditor(tokenId, agent);
    }

    function _relay(ERC2771Forwarder.ForwardRequestData memory request) internal {
        vm.prank(relayer);
        forwarder.execute(request);
    }

    // --- REGISTER FOR ---

    function test_RegisterFor_MintsToTheRecipientAndPointsAtIt() public {
        uint256 tokenId = registry.tokenIdOf(numbers, "4242");
        uint256 before = alice.balance;

        vm.expectEmit(true, true, true, true);
        emit IReadable.NameRegistered(tokenId, numbers, "4242", agent, uint64(block.timestamp + 365 days));
        vm.prank(alice);
        uint256 minted = registry.registerFor{value: 100 * DOLLAR}(numbers, "4242", agent, 1);

        assertEq(minted, tokenId);
        assertEq(registry.ownerOf(tokenId), agent);
        assertEq(registry.resolve(tokenId), agent);
        assertEq(registry.namesOf(agent)[0], tokenId);
        assertEq(registry.balanceOf(alice), 0);
        // The payer pays, and holds nothing
        assertEq(before - alice.balance, 100 * DOLLAR);
        assertEq(registry.generationOf(tokenId), 1);
    }

    function test_RegisterFor_PaysOutAsRegisterDoes() public {
        vm.prank(owner);
        registry.setTreasury(dao);

        uint256 price = _price(arc, "alice", 2);
        vm.prank(bob);
        registry.registerFor{value: price}(arc, "alice", agent, 2);

        assertEq(manager.balance, price / 10);
        assertEq(dao.balance, price - price / 10);
        assertEq(address(registry).balance, 0);
    }

    function test_RegisterFor_ReachesAnAccountWithNoReceiver() public {
        address account = address(new BareAccount());
        vm.prank(alice);
        uint256 tokenId = registry.registerFor{value: 100 * DOLLAR}(numbers, "4242", account, 1);
        assertEq(registry.ownerOf(tokenId), account);
    }

    function test_RegisterFor_IsHeldToEveryRuleOfRegister() public {
        vm.startPrank(owner);
        registry.setReserved(numbers, _one("707"), true);
        vm.stopPrank();

        vm.startPrank(alice);
        vm.expectRevert(IReadable.InvalidAddress.selector);
        registry.registerFor{value: 100 * DOLLAR}(numbers, "4242", address(0), 1);

        _expectInvalid(IReadable.Validity.Reserved);
        registry.registerFor{value: 500 * DOLLAR}(numbers, "707", agent, 1);

        vm.expectRevert(abi.encodeWithSelector(IReadable.IncorrectPayment.selector, 100 * DOLLAR, 1));
        registry.registerFor{value: 1}(numbers, "4242", agent, 1);

        vm.expectRevert(abi.encodeWithSelector(IReadable.InvalidYears.selector, 11));
        registry.registerFor{value: 1100 * DOLLAR}(numbers, "4242", agent, 11);
        vm.stopPrank();

        uint256 tokenId = _register(bob, numbers, "4343");
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(IReadable.NameUnavailable.selector, tokenId, uint64(block.timestamp + 365 days + 30 days)));
        registry.registerFor{value: 100 * DOLLAR}(numbers, "4343", agent, 1);
    }

    function test_RegisterFor_StopsWithAPause() public {
        vm.prank(owner);
        registry.updateNamespace(numbers, 2, 12, 8, true, address(0), 0, "");
        vm.prank(alice);
        _expectInvalid(IReadable.Validity.NamespacePaused);
        registry.registerFor{value: 100 * DOLLAR}(numbers, "4242", agent, 1);

        vm.startPrank(owner);
        registry.updateNamespace(numbers, 2, 12, 8, false, address(0), 0, "");
        registry.pause();
        vm.stopPrank();

        vm.prank(alice);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        registry.registerFor{value: 100 * DOLLAR}(numbers, "4242", agent, 1);
        // register goes through registerFor, so the pause stops it too
        vm.prank(alice);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        registry.register{value: 100 * DOLLAR}(numbers, "4242", 1);
    }

    // --- SET EDITOR ---

    function test_SetEditor_NamesAndRemoves() public {
        uint256 tokenId = _register(alice, numbers, "4242");
        assertEq(registry.editorOf(tokenId), address(0));

        vm.expectEmit(true, true, false, true);
        emit IReadable.EditorChanged(tokenId, agent);
        vm.prank(alice);
        registry.setEditor(tokenId, agent);
        assertEq(registry.editorOf(tokenId), agent);

        vm.expectEmit(true, true, false, true);
        emit IReadable.EditorChanged(tokenId, address(0));
        vm.prank(alice);
        registry.setEditor(tokenId, address(0));
        assertEq(registry.editorOf(tokenId), address(0));

        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(IReadable.NotNameOwner.selector, tokenId));
        registry.setText(tokenId, "records", "agent's");
    }

    function test_SetEditor_IsForTheHolderAndWhomItApproves() public {
        uint256 tokenId = _edited();

        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(IReadable.NotNameOwner.selector, tokenId));
        registry.setEditor(tokenId, stranger);

        // The editor can't hand its place on, or keep the holder from taking it back
        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(IReadable.NotNameOwner.selector, tokenId));
        registry.setEditor(tokenId, stranger);

        vm.prank(alice);
        registry.approve(bob, tokenId);
        vm.prank(bob);
        registry.setEditor(tokenId, bob);
        assertEq(registry.editorOf(tokenId), bob);
    }

    function test_SetEditor_RefusesAMissingOrExpiredName() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(IReadable.NameNotFound.selector, 7));
        registry.setEditor(7, agent);

        uint256 tokenId = _register(alice, numbers, "4242");
        vm.warp(block.timestamp + 365 days);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(IReadable.NameExpired.selector, tokenId));
        registry.setEditor(tokenId, agent);
    }

    function test_SetEditor_IsNeverRelayed() public {
        uint256 tokenId = _register(alice, numbers, "4242");
        vm.deal(relayer, 1 ether);

        // Signed by the holder, it arrives from the forwarder, which holds nothing
        ERC2771Forwarder.ForwardRequestData memory request = _request(aliceKey, abi.encodeCall(Readable.setEditor, (tokenId, agent)));
        vm.prank(relayer);
        vm.expectRevert();
        forwarder.execute(request);
        assertEq(registry.editorOf(tokenId), address(0));
    }

    // --- WHAT AN EDITOR DOES ---

    function test_Editor_ChangesWhereTheNamePointsItsRecordsAndAddresses() public {
        uint256 tokenId = _edited();

        vm.startPrank(agent);
        registry.setTarget(tokenId, agent);
        registry.setText(tokenId, "records", "agent's");
        registry.setAddrs(tokenId, _coin(501, hex"a11ce0"));
        vm.stopPrank();

        assertEq(registry.resolve(tokenId), agent);
        assertEq(registry.text(tokenId, "records"), "agent's");
        assertEq(registry.addr(tokenId, 501), hex"a11ce0");
        // A change is no new holding
        assertEq(registry.generationOf(tokenId), 1);
    }

    function test_Editor_ChangesThroughTheForwarderWithNoCoin() public {
        uint256 tokenId = _edited();
        vm.deal(agent, 0);
        vm.deal(relayer, 1 ether);

        _relay(_request(agentKey, abi.encodeCall(Readable.setTarget, (tokenId, agent))));
        _relay(_request(agentKey, abi.encodeCall(Readable.setText, (tokenId, "records", "relayed"))));
        _relay(_request(agentKey, abi.encodeCall(Readable.setAddrs, (tokenId, _coin(0, hex"b0b0")))));

        assertEq(registry.resolve(tokenId), agent);
        assertEq(registry.text(tokenId, "records"), "relayed");
        assertEq(registry.addr(tokenId, 0), hex"b0b0");
    }

    function test_Editor_CantMoveTheNameOrSpeakForItsHolder() public {
        uint256 tokenId = _edited();

        vm.startPrank(agent);
        vm.expectRevert(abi.encodeWithSelector(IERC721Errors.ERC721InsufficientApproval.selector, agent, tokenId));
        registry.transferFrom(alice, agent, tokenId);

        vm.expectRevert(abi.encodeWithSelector(IERC721Errors.ERC721InvalidApprover.selector, agent));
        registry.approve(agent, tokenId);

        // A primary name is its holder's own, set by the holder alone
        vm.expectRevert(abi.encodeWithSelector(IReadable.NotNameOwner.selector, tokenId));
        registry.setPrimaryName(tokenId);
        vm.stopPrank();

        assertEq(registry.ownerOf(tokenId), alice);
    }

    function test_Editor_IsOneNameOnly() public {
        uint256 tokenId = _edited();
        uint256 other = _register(alice, numbers, "4343");

        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(IReadable.NotNameOwner.selector, other));
        registry.setText(other, "records", "agent's");
        assertEq(registry.editorOf(tokenId), agent);
        assertEq(registry.editorOf(other), address(0));
    }

    function test_Editor_IsGoneAfterATransfer() public {
        uint256 tokenId = _edited();

        vm.prank(alice);
        registry.transferFrom(alice, bob, tokenId);
        assertEq(registry.editorOf(tokenId), address(0));

        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(IReadable.NotNameOwner.selector, tokenId));
        registry.setTarget(tokenId, agent);

        // Nor does it come back with the name
        vm.prank(bob);
        registry.transferFrom(bob, alice, tokenId);
        assertEq(registry.editorOf(tokenId), address(0));
    }

    function test_Editor_IsSilentWhileExpiredAndBackOnRenewal() public {
        uint256 tokenId = _edited();

        vm.warp(block.timestamp + 365 days);
        assertEq(registry.editorOf(tokenId), address(0));
        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(IReadable.NameExpired.selector, tokenId));
        registry.setText(tokenId, "records", "agent's");

        // Anyone may renew, the agent among them, and a renewal keeps the holding
        vm.deal(agent, 1 ether);
        _renew(agent, tokenId, 1);
        assertEq(registry.editorOf(tokenId), agent);
        assertEq(registry.generationOf(tokenId), 1);
    }

    function test_Editor_IsGoneWhenTheNameIsRegisteredAgain() public {
        uint256 tokenId = _edited();

        vm.warp(block.timestamp + 365 days + 30 days);
        _register(bob, numbers, "4242");

        assertEq(registry.ownerOf(tokenId), bob);
        assertEq(registry.editorOf(tokenId), address(0));
        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(IReadable.NotNameOwner.selector, tokenId));
        registry.setText(tokenId, "records", "agent's");
    }

    function testFuzz_OnlyTheHolderWhomItApprovesOrTheEditorChangesAName(address who) public {
        assumeNotForgeAddress(who);
        vm.assume(who != alice && who != agent && who != address(0) && who != address(forwarder));
        uint256 tokenId = _edited();

        vm.startPrank(who);
        vm.expectRevert(abi.encodeWithSelector(IReadable.NotNameOwner.selector, tokenId));
        registry.setTarget(tokenId, who);
        vm.expectRevert(abi.encodeWithSelector(IReadable.NotNameOwner.selector, tokenId));
        registry.setText(tokenId, "records", "theirs");
        vm.expectRevert(abi.encodeWithSelector(IReadable.NotNameOwner.selector, tokenId));
        registry.setEditor(tokenId, who);
        vm.stopPrank();
    }

    // --- GENERATION ---

    function test_GenerationOf_CountsEveryHolding() public {
        uint256 tokenId = registry.tokenIdOf(numbers, "4242");
        assertEq(registry.generationOf(tokenId), 0);

        _register(alice, numbers, "4242");
        assertEq(registry.generationOf(tokenId), 1);

        // Changes and renewals stay within the holding
        vm.startPrank(alice);
        registry.setTarget(tokenId, bob);
        registry.setText(tokenId, "records", "alice's");
        registry.setEditor(tokenId, agent);
        vm.stopPrank();
        _renew(alice, tokenId, 1);
        assertEq(registry.generationOf(tokenId), 1);

        vm.prank(alice);
        registry.transferFrom(alice, bob, tokenId);
        assertEq(registry.generationOf(tokenId), 2);

        // Expired and released, then registered by someone else: one more holding, not two
        vm.warp(block.timestamp + 2 * 365 days + 30 days);
        _register(alice, numbers, "4242");
        assertEq(registry.generationOf(tokenId), 3);
    }
}
