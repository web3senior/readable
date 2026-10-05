// SPDX-License-Identifier: MIT
pragma solidity ^0.8.35;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable, Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {EnumerableSet} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import {IERC4906} from "@openzeppelin/contracts/interfaces/IERC4906.sol";
import {IReadable} from "./IReadable.sol";
import {INameRules} from "./INameRules.sol";

/**
 * @title Readable
 * @author Hup Labs
 * @notice Readable names for wallets and agents: names under an extension and onchain numbers,
 *         each an ERC-721 held for a paid term.
 * @dev Uses IReadable for shared types, events and errors. The owner adds namespaces (extensions,
 *      number ranges) and prices them per label length; it can pause a namespace or reserve
 *      labels but can never take a registered name. Labels are validated onchain: numbers here,
 *      names by the rules contract the owner points the registry at. A token
 *      id is keccak256(namespaceId, label), so the app derives it offchain. An expired name
 *      returns to the public after the grace period. Names are paid in the chain's native coin, the
 *      exact price with the call. Each payment is split between the namespace's manager and the
 *      registry, whose share goes to the treasury when one is set. A token's metadata lives
 *      offchain, at `baseURI` followed by its id, so the owner can redesign or move it (ERC-4906
 *      announces the change). Ownership moves in two steps, so it can't be sent to a wrong address.
 *      A holder can name an editor, such as the agent the name stands for, which changes where the
 *      name points, its records and addresses but can't move it. A rotatable ERC-2771 forwarder
 *      relays those changes and the primary name so they cost no fee; purchases, transfers,
 *      approvals, the choice of editor and every owner function answer to their direct caller.
 *      Mints with `_mint` so smart accounts without an ERC-721 receiver can hold names.
 * @custom:version 1.0.0
 * @custom:chain single-chain
 * @custom:website https://readable.name
 * @custom:security-contact security@hup.social
 */
contract Readable is IReadable, ERC721, Ownable2Step, Pausable {
    using EnumerableSet for EnumerableSet.UintSet;

    // --- STATE VARIABLES ---

    uint256 public constant PERIOD = 365 days;
    uint256 public constant MAX_YEARS = 10;
    uint256 public constant MAX_LABEL_BYTES = 256;
    uint64 public constant MIN_GRACE_PERIOD = 30 days;
    uint64 public constant MAX_GRACE_PERIOD = 365 days;

    uint256 public override namespaceCount;
    uint64 public override gracePeriod = MIN_GRACE_PERIOD;
    address public override treasury;
    string public override baseURI;
    address public override nameRules;

    address private _trustedForwarder;

    mapping(uint256 => Namespace) private _namespaces;
    mapping(bytes32 => uint256) private _namespaceIdByName;
    mapping(uint256 => uint256[]) private _prices;
    mapping(uint256 => mapping(bytes32 => bool)) private _reserved;

    mapping(uint256 => Record) private _records;
    // Bumped on every registration and transfer, so records, addresses and an editor left by a previous holder never resurface
    mapping(uint256 => uint256) private _generation;
    mapping(uint256 => mapping(uint256 => mapping(string => string))) private _texts;
    // Token id, then generation, then coin type: reset with the text records
    mapping(uint256 => mapping(uint256 => mapping(uint256 => bytes))) private _addrs;
    // Token id, then generation: reset with the text records
    mapping(uint256 => mapping(uint256 => address)) private _editors;
    mapping(address => uint256) private _primary;
    mapping(address => EnumerableSet.UintSet) private _holdings;

    // --- CONSTRUCTOR ---

    /// @dev `initialOwner` is explicit because a CREATE2 factory is the deploying msg.sender.
    constructor(address initialOwner, address forwarder) ERC721("Readable", "READ") Ownable(initialOwner) {
        _trustedForwarder = forwarder;
    }

    function version() external pure override returns (string memory) {
        return "1.0.0";
    }

    // --- REGISTRATION ---

    function register(uint256 namespaceId, string calldata label, uint256 yearCount)
        external
        payable
        override
        returns (uint256 tokenId)
    {
        return registerFor(namespaceId, label, msg.sender, yearCount);
    }

    function registerFor(uint256 namespaceId, string calldata label, address to, uint256 yearCount)
        public
        payable
        override
        whenNotPaused
        returns (uint256 tokenId)
    {
        if (to == address(0)) revert InvalidAddress();
        (Validity validity, bytes memory normalized, uint256 length) = _check(namespaceId, label, true);
        if (validity != Validity.Valid) revert InvalidLabel(validity);

        tokenId = _claim(namespaceId, normalized, length, to, yearCount);
        _collectPayment(_pricePerYear(namespaceId, length) * yearCount, _namespaces[namespaceId]);
    }

    /// @dev Not stopped by a pause: a name must never run out while its holder is locked out.
    function renew(uint256 tokenId, uint256 yearCount) external payable override {
        if (yearCount == 0 || yearCount > MAX_YEARS) revert InvalidYears(yearCount);
        if (_ownerOf(tokenId) == address(0)) revert NameNotFound(tokenId);

        Record storage record = _records[tokenId];
        if (block.timestamp >= record.expiresAt + gracePeriod) revert NameExpired(tokenId);

        // forge-lint: disable-next-line(unsafe-typecast)
        record.expiresAt += uint64(yearCount * PERIOD);
        emit NameRenewed(tokenId, record.expiresAt);
        emit IERC4906.MetadataUpdate(tokenId);

        uint256 price = _pricePerYear(record.namespaceId, record.length) * yearCount;
        _collectPayment(price, _namespaces[record.namespaceId]);
    }

    function adminRegister(uint256 namespaceId, string calldata label, address to, uint256 yearCount)
        external
        override
        onlyOwner
        returns (uint256 tokenId)
    {
        if (to == address(0)) revert InvalidAddress();
        (Validity validity, bytes memory normalized, uint256 length) = _check(namespaceId, label, false);
        if (validity != Validity.Valid) revert InvalidLabel(validity);

        tokenId = _claim(namespaceId, normalized, length, to, yearCount);
    }

    function _claim(uint256 namespaceId, bytes memory normalized, uint256 length, address to, uint256 yearCount)
        internal
        returns (uint256 tokenId)
    {
        if (yearCount == 0 || yearCount > MAX_YEARS) revert InvalidYears(yearCount);
        tokenId = _tokenId(namespaceId, normalized);

        if (_ownerOf(tokenId) != address(0)) {
            uint64 availableAt = _records[tokenId].expiresAt + gracePeriod;
            if (block.timestamp < availableAt) revert NameUnavailable(tokenId, availableAt);
            _burn(tokenId);
        }

        // forge-lint: disable-next-line(unsafe-typecast)
        uint64 expiresAt = uint64(block.timestamp + yearCount * PERIOD);
        _generation[tokenId]++;
        // forge-lint: disable-next-line(unsafe-typecast)
        _records[tokenId] = Record(namespaceId, string(normalized), to, uint64(block.timestamp), expiresAt, uint32(length));
        _mint(to, tokenId);

        emit NameRegistered(tokenId, namespaceId, string(normalized), to, expiresAt);
    }

    /// @dev Called last in register/renew. The exact price comes with the call, so nothing is
    ///      refunded. The manager takes its percent of the price paid and the rest is the
    ///      registry's. Every payout must arrive or the call reverts: a payout allowed to fail would
    ///      be starved of gas by a wallet's estimate, which only has to make the call succeed.
    function _collectPayment(uint256 amount, Namespace storage namespace) internal {
        if (msg.value != amount) revert IncorrectPayment(amount, msg.value);
        if (amount == 0) return;

        uint256 managerCut = namespace.manager == address(0) ? 0 : (amount * namespace.managerShare) / 100;
        if (managerCut != 0) _pay(namespace.manager, managerCut);

        address treasury_ = treasury;
        uint256 rest = amount - managerCut;
        if (treasury_ != address(0) && rest != 0) _pay(treasury_, rest);
    }

    /// @dev Pays out in the native coin, reverting when it can't be delivered.
    function _pay(address to, uint256 amount) internal {
        (bool success, ) = to.call{value: amount}("");
        if (!success) revert TransferFailed();
    }

    // --- NAME SETTINGS ---

    function setTarget(uint256 tokenId, address target) external override {
        _requireActiveHolder(tokenId, _relayedSender(), true);
        _records[tokenId].target = target;
        emit TargetChanged(tokenId, target);
    }

    /// @notice Pass 0 to clear the caller's primary name.
    function setPrimaryName(uint256 tokenId) external override {
        address account = _relayedSender();
        if (tokenId != 0) {
            if (_ownerOf(tokenId) != account) revert NotNameOwner(tokenId);
            if (block.timestamp >= _records[tokenId].expiresAt) revert NameExpired(tokenId);
        }
        _primary[account] = tokenId;
        emit PrimaryNameChanged(account, tokenId);
    }

    function setText(uint256 tokenId, string calldata key, string calldata value) external override {
        _requireActiveHolder(tokenId, _relayedSender(), true);
        _texts[tokenId][_generation[tokenId]][key] = value;
        emit TextChanged(tokenId, key, key, value);
    }

    /// @dev Takes any coin type but an EVM chain's, and any length: which chains are offered is the
    ///      app's choice, and the holder pays for what it stores. Every EVM chain uses `target`.
    function setAddrs(uint256 tokenId, CoinAddress[] calldata entries) external override {
        _requireActiveHolder(tokenId, _relayedSender(), true);
        mapping(uint256 => bytes) storage addrs = _addrs[tokenId][_generation[tokenId]];
        for (uint256 i = 0; i < entries.length; i++) {
            if (_isEvmCoin(entries[i].coinType)) revert InvalidCoinType(entries[i].coinType);
            addrs[entries[i].coinType] = entries[i].value;
            emit AddressChanged(tokenId, entries[i].coinType, entries[i].value);
        }
    }

    /// @notice Pass address(0) to remove the editor. Not relayed: like an approval, it answers to its caller.
    function setEditor(uint256 tokenId, address editor) external override {
        _requireActiveHolder(tokenId, msg.sender, false);
        _editors[tokenId][_generation[tokenId]] = editor;
        emit EditorChanged(tokenId, editor);
    }

    /// @dev A live name is changed by its holder or an account the holder approved, and, where
    ///      `editorToo`, by the editor the holder named. A name without one stores address(0),
    ///      which a forwarder naming no signer must never pass for.
    function _requireActiveHolder(uint256 tokenId, address account, bool editorToo) internal view {
        address holder = _ownerOf(tokenId);
        if (holder == address(0)) revert NameNotFound(tokenId);
        address editor = _editors[tokenId][_generation[tokenId]];
        if (!_isAuthorized(holder, account, tokenId) && !(editorToo && editor != address(0) && account == editor)) {
            revert NotNameOwner(tokenId);
        }
        if (block.timestamp >= _records[tokenId].expiresAt) revert NameExpired(tokenId);
    }

    // --- VIEW FUNCTIONS ---

    function lookup(uint256 namespaceId, string calldata label) external view override returns (NameInfo memory info) {
        (Validity validity, bytes memory normalized, uint256 length) = _check(namespaceId, label, true);
        info.validity = validity;
        info.length = length;
        if (validity == Validity.UnknownNamespace || validity == Validity.InvalidCharacter) return info;

        info.tokenId = _tokenId(namespaceId, normalized);
        info.pricePerYear = _pricePerYear(namespaceId, length);

        address holder = _ownerOf(info.tokenId);
        Record storage record = _records[info.tokenId];
        bool held = holder != address(0) && block.timestamp < record.expiresAt + gracePeriod;
        if (held) {
            info.owner = holder;
            info.target = record.target;
            info.expiresAt = record.expiresAt;
        }
        info.available = !held && validity == Validity.Valid;
    }

    function tokenIdOf(uint256 namespaceId, string calldata label) external view override returns (uint256) {
        (Validity validity, bytes memory normalized, ) = _check(namespaceId, label, false);
        if (validity == Validity.UnknownNamespace || validity == Validity.InvalidCharacter) revert InvalidLabel(validity);
        return _tokenId(namespaceId, normalized);
    }

    function priceOf(uint256 namespaceId, string calldata label, uint256 yearCount) external view override returns (uint256) {
        if (yearCount == 0 || yearCount > MAX_YEARS) revert InvalidYears(yearCount);
        (Validity validity, , uint256 length) = _check(namespaceId, label, false);
        if (validity == Validity.UnknownNamespace || validity == Validity.InvalidCharacter) revert InvalidLabel(validity);
        return _pricePerYear(namespaceId, length) * yearCount;
    }

    function recordOf(uint256 tokenId) external view override returns (Record memory) {
        return _records[tokenId];
    }

    function nameOf(uint256 tokenId) public view override returns (string memory) {
        if (_ownerOf(tokenId) == address(0)) revert NameNotFound(tokenId);
        Record storage record = _records[tokenId];
        return _display(_namespaces[record.namespaceId], record.label);
    }

    /// @notice The address a live name points to, or address(0) once it has expired.
    function resolve(uint256 tokenId) external view override returns (address) {
        if (_ownerOf(tokenId) == address(0) || block.timestamp >= _records[tokenId].expiresAt) return address(0);
        return _records[tokenId].target;
    }

    function primaryNameOf(address account) external view override returns (uint256 tokenId, string memory name) {
        tokenId = _primary[account];
        if (tokenId == 0 || _ownerOf(tokenId) != account || block.timestamp >= _records[tokenId].expiresAt) return (0, "");
        name = nameOf(tokenId);
    }

    /// @notice The records of a live name. An expired one answers with none, as `resolve` does.
    function text(uint256 tokenId, string calldata key) external view override returns (string memory) {
        if (block.timestamp >= _records[tokenId].expiresAt) return "";
        return _texts[tokenId][_generation[tokenId]][key];
    }

    /// @notice An expired name answers with no address, as it does with no records. An EVM chain's
    ///         coin type answers with the address the name points to, as `resolve` does.
    function addr(uint256 tokenId, uint256 coinType) external view override returns (bytes memory) {
        Record storage record = _records[tokenId];
        if (block.timestamp >= record.expiresAt) return "";
        if (_isEvmCoin(coinType)) return record.target == address(0) ? bytes("") : abi.encodePacked(record.target);
        return _addrs[tokenId][_generation[tokenId]][coinType];
    }

    /// @notice The editor of a live name, or address(0). An expired name answers with none, as it does with no records.
    function editorOf(uint256 tokenId) external view override returns (address) {
        if (block.timestamp >= _records[tokenId].expiresAt) return address(0);
        return _editors[tokenId][_generation[tokenId]];
    }

    function generationOf(uint256 tokenId) external view override returns (uint256) {
        return _generation[tokenId];
    }

    function namesOf(address account) external view override returns (uint256[] memory) {
        return _holdings[account].values();
    }

    function getNamespaces() external view override returns (Namespace[] memory list) {
        list = new Namespace[](namespaceCount);
        for (uint256 i = 0; i < namespaceCount; i++) {
            list[i] = _namespaces[i + 1];
        }
    }

    function getPrices(uint256 namespaceId) external view override returns (uint256[] memory) {
        return _prices[namespaceId];
    }

    function isReserved(uint256 namespaceId, string calldata label) external view override returns (bool) {
        (Validity validity, bytes memory normalized, ) = _measure(_namespaces[namespaceId].kind, bytes(label));
        return validity == Validity.Valid && _reserved[namespaceId][keccak256(normalized)];
    }

    // --- ADMIN CONFIGURATION ---

    function addNamespace(
        Kind kind,
        string calldata name,
        uint8 minLength,
        uint8 maxLength,
        uint8 checkDigitFrom,
        uint256[] calldata prices,
        address manager,
        uint8 managerShare,
        string calldata metadata
    ) external override onlyOwner returns (uint256 namespaceId) {
        if (!_isNamespaceName(kind, bytes(name))) revert InvalidNamespaceName();
        bytes32 key = keccak256(bytes(name));
        if (_namespaceIdByName[key] != 0) revert NamespaceNameTaken(name);
        _requireValidRules(minLength, maxLength, managerShare);

        namespaceId = ++namespaceCount;
        _namespaceIdByName[key] = namespaceId;
        // The price curve counts from the shortest length the namespace starts with, and keeps
        // counting from there whatever the shortest length becomes
        _namespaces[namespaceId] = Namespace(
            namespaceId, kind, name, minLength, maxLength, checkDigitFrom, minLength, false, manager, managerShare, metadata, uint64(block.timestamp)
        );
        emit NamespaceAdded(namespaceId, kind, name);

        _setPrices(namespaceId, prices);
    }

    function updateNamespace(
        uint256 namespaceId,
        uint8 minLength,
        uint8 maxLength,
        uint8 checkDigitFrom,
        bool paused_,
        address manager,
        uint8 managerShare,
        string calldata metadata
    ) external override onlyOwner {
        Namespace storage namespace = _requireNamespace(namespaceId);
        _requireValidRules(minLength, maxLength, managerShare);

        namespace.minLength = minLength;
        namespace.maxLength = maxLength;
        namespace.checkDigitFrom = checkDigitFrom;
        namespace.paused = paused_;
        namespace.manager = manager;
        namespace.managerShare = managerShare;
        namespace.metadata = metadata;

        emit NamespaceUpdated(namespaceId);
    }

    function setPrices(uint256 namespaceId, uint256[] calldata prices) external override onlyOwner {
        _requireNamespace(namespaceId);
        _setPrices(namespaceId, prices);
    }

    function setReserved(uint256 namespaceId, string[] calldata labels, bool reserved) external override onlyOwner {
        Kind kind = _requireNamespace(namespaceId).kind;
        for (uint256 i = 0; i < labels.length; i++) {
            // Reserved under the form it would be registered under, so no spelling slips past
            (Validity validity, bytes memory normalized, ) = _measure(kind, bytes(labels[i]));
            if (validity != Validity.Valid) revert InvalidLabel(validity);
            _reserved[namespaceId][keccak256(normalized)] = reserved;
            emit ReservedUpdated(namespaceId, string(normalized), reserved);
        }
    }

    function setGracePeriod(uint64 gracePeriod_) external override onlyOwner {
        if (gracePeriod_ < MIN_GRACE_PERIOD || gracePeriod_ > MAX_GRACE_PERIOD) revert InvalidGracePeriod();
        gracePeriod = gracePeriod_;
        emit GracePeriodUpdated(gracePeriod_);
    }

    function setTrustedForwarder(address forwarder) external override onlyOwner {
        if (forwarder == address(0)) revert InvalidAddress();
        _trustedForwarder = forwarder;
        emit TrustedForwarderUpdated(forwarder);
    }

    /// @notice Pass address(0) to stop taking new names under extensions.
    function setNameRules(address rules) external override onlyOwner {
        nameRules = rules;
        emit NameRulesUpdated(rules);
    }

    /// @notice Pass address(0) to keep the registry's share in the contract for `withdraw`.
    function setTreasury(address treasury_) external override onlyOwner {
        treasury = treasury_;
        emit TreasuryUpdated(treasury_);
    }

    /// @notice Every token's metadata is read from `baseURI_` followed by its id. Empty leaves tokens without any.
    function setBaseURI(string calldata baseURI_) external override onlyOwner {
        baseURI = baseURI_;
        emit BaseURIUpdated(baseURI_);
        emit IERC4906.BatchMetadataUpdate(0, type(uint256).max);
    }

    /// @notice Sends `amount` of the native coin to `to`; 0 sends the whole balance.
    function withdraw(address to, uint256 amount) external override onlyOwner {
        if (to == address(0)) revert InvalidAddress();
        if (amount == 0) amount = address(this).balance;

        _pay(to, amount);
        emit Withdrawal(to, amount);
    }

    function pause() external override onlyOwner {
        _pause();
    }

    function unpause() external override onlyOwner {
        _unpause();
    }

    // --- INTERNAL HELPERS ---

    function _requireNamespace(uint256 namespaceId) internal view returns (Namespace storage namespace) {
        namespace = _namespaces[namespaceId];
        if (namespace.id == 0) revert UnknownNamespace(namespaceId);
    }

    function _requireValidRules(uint8 minLength, uint8 maxLength, uint8 managerShare) internal pure {
        if (minLength == 0 || maxLength < minLength) revert InvalidLengthRange();
        if (managerShare > 100) revert InvalidShare();
    }

    function _setPrices(uint256 namespaceId, uint256[] calldata prices) internal {
        if (prices.length == 0) revert InvalidPriceCurve();
        for (uint256 i = 1; i < prices.length; i++) {
            if (prices[i] > prices[i - 1]) revert InvalidPriceCurve();
        }
        _prices[namespaceId] = prices;
        emit PricesUpdated(namespaceId, prices);
    }

    function _pricePerYear(uint256 namespaceId, uint256 length) internal view returns (uint256) {
        uint256[] storage tiers = _prices[namespaceId];
        uint256 priceFrom = _namespaces[namespaceId].priceFrom;
        uint256 index = length > priceFrom ? length - priceFrom : 0;
        if (index >= tiers.length) index = tiers.length - 1;
        return tiers[index];
    }

    function _tokenId(uint256 namespaceId, bytes memory normalized) internal pure returns (uint256) {
        return uint256(keccak256(abi.encodePacked(namespaceId, normalized)));
    }

    /// @dev Full validation of `label` in a namespace. `enforceRules` adds the reserved and paused
    ///      checks that only public registration is held to.
    function _check(uint256 namespaceId, string calldata label, bool enforceRules)
        internal
        view
        returns (Validity validity, bytes memory normalized, uint256 length)
    {
        Namespace storage namespace = _namespaces[namespaceId];
        if (namespace.id == 0) return (Validity.UnknownNamespace, bytes(label), 0);

        (validity, normalized, length) = _measure(namespace.kind, bytes(label));
        if (validity != Validity.Valid) return (validity, normalized, length);

        if (length < namespace.minLength) validity = Validity.TooShort;
        else if (length > namespace.maxLength) validity = Validity.TooLong;
        else if (
            namespace.kind == Kind.Number &&
            namespace.checkDigitFrom != 0 &&
            length >= namespace.checkDigitFrom &&
            !_luhn(normalized)
        ) validity = Validity.InvalidCheckDigit;
        else if (enforceRules && _reserved[namespaceId][keccak256(normalized)]) validity = Validity.Reserved;
        else if (enforceRules && namespace.paused) validity = Validity.NamespacePaused;
    }

    /// @dev Character rules and length per kind: a number is digits, a name is what the rules
    ///      contract takes. Rules that are missing or fail take nothing.
    function _measure(Kind kind, bytes memory raw) internal view returns (Validity, bytes memory, uint256) {
        if (raw.length == 0) return (Validity.TooShort, raw, 0);
        if (raw.length > MAX_LABEL_BYTES) return (Validity.TooLong, raw, raw.length);
        if (kind == Kind.Number) return _measureNumber(raw);

        address rules = nameRules;
        if (rules.code.length == 0) return (Validity.InvalidCharacter, raw, 0);
        try INameRules(rules).measure(raw) returns (bool valid, bytes memory normalized, uint256 length) {
            if (!valid || normalized.length == 0 || normalized.length > MAX_LABEL_BYTES) return (Validity.InvalidCharacter, raw, 0);
            return (Validity.Valid, normalized, length);
        } catch {
            return (Validity.InvalidCharacter, raw, 0);
        }
    }

    /// @dev Digits with no leading zero: a zero in front adds nothing to the check digit, so
    ///      `042421230` would be a stranger's twin of `42421230`, reached by writing `+0` without its plus.
    function _measureNumber(bytes memory raw) internal pure returns (Validity, bytes memory, uint256) {
        if (raw[0] == "0") return (Validity.InvalidCharacter, raw, 0);
        for (uint256 i = 0; i < raw.length; i++) {
            if (raw[i] < "0" || raw[i] > "9") return (Validity.InvalidCharacter, raw, 0);
        }
        return (Validity.Valid, raw, raw.length);
    }

    function _luhn(bytes memory digits) internal pure returns (bool) {
        uint256 sum;
        uint256 n = digits.length;
        for (uint256 i = 0; i < n; i++) {
            uint256 digit = uint8(digits[n - 1 - i]) - 48;
            if (i % 2 == 1) {
                digit *= 2;
                if (digit > 9) digit -= 9;
            }
            sum += digit;
        }
        return sum % 10 == 0;
    }

    /// @dev Extensions are lowercase ASCII words; number prefixes are digits.
    function _isNamespaceName(Kind kind, bytes memory name) internal pure returns (bool) {
        if (name.length == 0 || name.length > 32) return false;
        for (uint256 i = 0; i < name.length; i++) {
            bytes1 b = name[i];
            bool digit = b >= "0" && b <= "9";
            bool word = (b >= "a" && b <= "z") || (b == "-" && i != 0 && i != name.length - 1);
            if (kind == Kind.Number ? !digit : !(digit || word)) return false;
        }
        return true;
    }

    function _display(Namespace storage namespace, string memory label) internal view returns (string memory) {
        if (namespace.kind == Kind.Name) return string.concat(label, ".", namespace.name);
        return string.concat("+", namespace.name, " ", label);
    }

    // --- OVERRIDE HELPERS ---

    /// @dev An expired name can't change hands. Every transfer re-points the name at its new holder and
    ///      leaves the previous holder's text records, addresses and editor behind, so nothing keeps
    ///      reaching the one who left.
    function _update(address to, uint256 tokenId, address auth) internal override returns (address from) {
        address holder = _ownerOf(tokenId);
        if (holder != address(0) && to != address(0) && block.timestamp >= _records[tokenId].expiresAt) revert NameExpired(tokenId);

        from = super._update(to, tokenId, auth);

        if (from != address(0)) {
            _holdings[from].remove(tokenId);
            if (_primary[from] == tokenId) {
                delete _primary[from];
                emit PrimaryNameChanged(from, 0);
            }
        }
        if (to != address(0)) {
            _holdings[to].add(tokenId);
            if (from != address(0)) {
                _records[tokenId].target = to;
                _generation[tokenId]++;
                emit TargetChanged(tokenId, to);
            }
        }
    }

    function _baseURI() internal view override returns (string memory) {
        return baseURI;
    }

    function supportsInterface(bytes4 interfaceId) public view override returns (bool) {
        // ERC-4906 declares events only, so its id is fixed by the standard, not derived
        return interfaceId == bytes4(0x49064906) || super.supportsInterface(interfaceId);
    }

    // --- RELAYING ---

    function trustedForwarder() external view override returns (address) {
        return _trustedForwarder;
    }

    /// @dev The forwarder asks this before it relays a request here (ERC-2771).
    function isTrustedForwarder(address forwarder) public view override returns (bool) {
        return forwarder == _trustedForwarder;
    }

    /// @dev Who is changing a name: the signer the trusted forwarder appends, which it has checked,
    ///      or the direct caller. Read by `setTarget`, `setPrimaryName`, `setText` and `setAddrs`
    ///      alone, so a holder or its editor changes a name without paying a fee. Purchases (which
    ///      bring their price with the call), transfers, approvals, `setEditor` and the owner's
    ///      functions answer to `msg.sender`, so no forwarder can move a name, name an editor or act
    ///      as the owner. One the owner replaced could still change any live name's target, records
    ///      and addresses.
    function _relayedSender() internal view returns (address) {
        if (msg.sender == _trustedForwarder && msg.data.length >= 20) return address(bytes20(msg.data[msg.data.length - 20:]));
        return msg.sender;
    }

    /// @dev Ethereum (SLIP-44 60) and every EVM chain by ENSIP-11 (`0x80000000 | chainId`).
    function _isEvmCoin(uint256 coinType) internal pure returns (bool) {
        return coinType == 60 || (coinType >= 0x80000000 && coinType <= 0xffffffff);
    }
}
