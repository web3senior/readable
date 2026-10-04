// SPDX-License-Identifier: MIT
pragma solidity ^0.8.35;

/**
 * @title IReadable
 * @author Hup Labs
 * @notice Shared interface for Readable, the registry of readable names for wallets and agents.
 * @dev Structs, events, custom errors and the public surface used by the Readable registry, its app
 *      and offchain indexers.
 * @custom:version 1.0.0
 * @custom:chain single-chain
 * @custom:website https://readable.name
 * @custom:security-contact security@hup.social
 */
interface IReadable {
    // --- SHARED TYPES ---

    /// @dev What a namespace's labels are made of. Name kinds display as `label.name`, Number kinds
    ///      as `+name label`.
    enum Kind {
        Name,
        Number
    }

    /// @dev Why a label is or is not registrable. Reserved and NamespacePaused bind public registration only.
    enum Validity {
        Valid,
        UnknownNamespace,
        NamespacePaused,
        InvalidCharacter,
        TooShort,
        TooLong,
        InvalidCheckDigit,
        Reserved
    }

    /// @dev A family of names. Kind and name are fixed at creation because every token id and every
    ///      displayed name is derived from them. So is `priceFrom`, the length the price curve's
    ///      first entry applies to: the shortest length the namespace started with, so a later
    ///      change of `minLength` changes what is sold and never what a name costs.
    struct Namespace {
        uint256 id;
        Kind kind;
        string name;
        uint8 minLength;
        uint8 maxLength;
        uint8 checkDigitFrom;
        uint8 priceFrom;
        bool paused;
        address manager;
        uint8 managerShare;
        string metadata;
        uint64 createdAt;
    }

    /// @dev One registered name. `target` is the address it points to, reset to the holder on
    ///      transfer and kept after the name expires: read `resolve` to send to a name. `length` is what the label was counted as when it was registered, so a
    ///      renewal is priced the same way whatever the rules have become.
    struct Record {
        uint256 namespaceId;
        string label;
        address target;
        uint64 registeredAt;
        uint64 expiresAt;
        uint32 length;
    }

    /// @dev Everything the app shows for one candidate name, in a single read.
    struct NameInfo {
        uint256 tokenId;
        Validity validity;
        bool available;
        address owner;
        address target;
        uint64 expiresAt;
        uint256 length;
        uint256 pricePerYear;
    }

    /// @dev Where a name receives on a chain that isn't EVM, as ENS keeps it (ENSIP-9): `coinType`
    ///      is the chain's SLIP-44 number (Bitcoin 0, Solana 501) and `value` the address in that
    ///      chain's own binary form. An empty `value` removes it. Every EVM chain uses `target`.
    struct CoinAddress {
        uint256 coinType;
        bytes value;
    }

    // --- SHARED EVENTS ---

    event NamespaceAdded(uint256 indexed namespaceId, Kind kind, string name);
    event NamespaceUpdated(uint256 indexed namespaceId);
    event PricesUpdated(uint256 indexed namespaceId, uint256[] prices);
    event ReservedUpdated(uint256 indexed namespaceId, string label, bool reserved);
    event NameRegistered(uint256 indexed tokenId, uint256 indexed namespaceId, string label, address indexed owner, uint64 expiresAt);
    event NameRenewed(uint256 indexed tokenId, uint64 expiresAt);
    event TargetChanged(uint256 indexed tokenId, address indexed target);
    event PrimaryNameChanged(address indexed account, uint256 indexed tokenId);
    event TextChanged(uint256 indexed tokenId, string indexed indexedKey, string key, string value);
    event AddressChanged(uint256 indexed tokenId, uint256 indexed coinType, bytes value);
    event EditorChanged(uint256 indexed tokenId, address indexed editor);
    event GracePeriodUpdated(uint64 gracePeriod);
    event TrustedForwarderUpdated(address indexed forwarder);
    event NameRulesUpdated(address indexed rules);
    event TreasuryUpdated(address indexed treasury);
    event BaseURIUpdated(string baseURI);
    event Withdrawal(address indexed recipient, uint256 amount);

    // --- SHARED ERRORS ---

    error UnknownNamespace(uint256 namespaceId);
    error InvalidNamespaceName();
    error NamespaceNameTaken(string name);
    error InvalidLengthRange();
    error InvalidShare();
    error InvalidPriceCurve();
    error InvalidLabel(Validity validity);
    error InvalidYears(uint256 yearCount);
    error NameUnavailable(uint256 tokenId, uint64 availableAt);
    error NameNotFound(uint256 tokenId);
    error NameExpired(uint256 tokenId);
    error NotNameOwner(uint256 tokenId);
    error IncorrectPayment(uint256 required, uint256 provided);
    error TransferFailed();
    error InvalidAddress();
    error InvalidGracePeriod();
    error InvalidCoinType(uint256 coinType);

    function version() external pure returns (string memory);

    // --- STATE GETTERS ---

    function namespaceCount() external view returns (uint256);
    function gracePeriod() external view returns (uint64);

    function isTrustedForwarder(address forwarder) external view returns (bool);

    /// @notice The forwarder trusted now, which the owner can replace. It relays a holder's or an
    ///         editor's `setTarget`, `setPrimaryName`, `setText` and `setAddrs` for the account
    ///         that signed them, and nothing else.
    function trustedForwarder() external view returns (address);

    /// @notice The contract that decides what the label of a name may be made of, or address(0)
    ///         while names under extensions are not taken. Numbers are digits whatever it says.
    function nameRules() external view returns (address);

    /// @notice Where the registry's share of each payment is sent, or address(0) to keep it for `withdraw`.
    ///         A payment reverts when its treasury or manager can't be paid.
    function treasury() external view returns (address);

    /// @notice What `tokenURI` puts before a token's id. Empty until the owner sets it.
    function baseURI() external view returns (string memory);

    // --- REGISTRATION ---

    /// @notice Registers `label` in a namespace for `yearCount` years, minted to the caller, who
    ///         sends the exact price in the native coin as `msg.value`.
    function register(uint256 namespaceId, string calldata label, uint256 yearCount) external payable returns (uint256 tokenId);

    /// @notice As `register`, minted to `to` and pointing at it, so an app can buy a name for an
    ///         account, an agent's among them, in one call.
    function registerFor(uint256 namespaceId, string calldata label, address to, uint256 yearCount)
        external
        payable
        returns (uint256 tokenId);

    /// @notice Extends a name by `yearCount` years for the exact price in `msg.value`. Anyone may
    ///         pay; the grace period is the last chance. A pause of the registry never stops it,
    ///         so no name runs out behind one.
    function renew(uint256 tokenId, uint256 yearCount) external payable;

    // --- NAME SETTINGS ---

    function setTarget(uint256 tokenId, address target) external;
    function setPrimaryName(uint256 tokenId) external;
    /// @notice Text records belong to one holding of a name: a transfer or a fresh registration
    ///         starts with none, and an expired name answers with none.
    function setText(uint256 tokenId, string calldata key, string calldata value) external;
    /// @notice Sets the name's addresses on chains that aren't EVM, several in one call. They
    ///         belong to one holding of the name, as text records do. An EVM chain's coin type
    ///         (60, or ENSIP-11's `0x80000000 | chainId`) is refused: those use `target`.
    function setAddrs(uint256 tokenId, CoinAddress[] calldata entries) external;
    /// @notice Names the one account besides the holder (and whom it approved) that may change
    ///         where a live name points, its records and its addresses, such as the agent the name
    ///         stands for. It can't move the name, approve, name an editor or set a primary name.
    ///         It belongs to one holding of the name, as text records do; address(0) removes it.
    function setEditor(uint256 tokenId, address editor) external;

    // --- VIEW FUNCTIONS ---

    function lookup(uint256 namespaceId, string calldata label) external view returns (NameInfo memory);
    function tokenIdOf(uint256 namespaceId, string calldata label) external view returns (uint256);
    function priceOf(uint256 namespaceId, string calldata label, uint256 yearCount) external view returns (uint256);
    /// @notice The stored record, expired or not. Its `target` outlives the term; `resolve` doesn't.
    function recordOf(uint256 tokenId) external view returns (Record memory);
    function nameOf(uint256 tokenId) external view returns (string memory);
    function resolve(uint256 tokenId) external view returns (address);
    function primaryNameOf(address account) external view returns (uint256 tokenId, string memory name);
    function text(uint256 tokenId, string calldata key) external view returns (string memory);
    /// @notice A live name's address on the chain of `coinType`, empty when none is set. An EVM
    ///         chain's coin type answers with the 20 bytes of `target`.
    function addr(uint256 tokenId, uint256 coinType) external view returns (bytes memory);
    function editorOf(uint256 tokenId) external view returns (address);
    /// @notice Counts the holdings of a name: it grows with every registration and transfer, and
    ///         never with a renewal or a change. Key what belongs to one holding (a reputation, a
    ///         rating) by token id and generation, so it never passes to the name's next holder.
    function generationOf(uint256 tokenId) external view returns (uint256);
    function namesOf(address account) external view returns (uint256[] memory);
    function getNamespaces() external view returns (Namespace[] memory);
    function getPrices(uint256 namespaceId) external view returns (uint256[] memory);
    function isReserved(uint256 namespaceId, string calldata label) external view returns (bool);

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
    ) external returns (uint256 namespaceId);

    function updateNamespace(
        uint256 namespaceId,
        uint8 minLength,
        uint8 maxLength,
        uint8 checkDigitFrom,
        bool paused,
        address manager,
        uint8 managerShare,
        string calldata metadata
    ) external;

    /**
     * @notice Sets a namespace's yearly price curve. `prices[0]` applies at the namespace's
     *         `priceFrom` and to anything shorter, each next entry one unit longer, and the last
     *         entry to everything longer. Must be non-empty and non-increasing; an entry of 0
     *         makes those lengths free. It prices renewals as well as registrations.
     */
    function setPrices(uint256 namespaceId, uint256[] calldata prices) external;
    function setReserved(uint256 namespaceId, string[] calldata labels, bool reserved) external;

    /// @notice Registers a name for `to` without payment, reservation or pause checks.
    function adminRegister(uint256 namespaceId, string calldata label, address to, uint256 yearCount) external returns (uint256 tokenId);

    /// @notice Between MIN_GRACE_PERIOD and MAX_GRACE_PERIOD, so a holder always has the shorter to renew in.
    function setGracePeriod(uint64 gracePeriod) external;
    function setTrustedForwarder(address forwarder) external;

    /// @notice Replaces the rules for the labels of names. They bind new registrations only.
    function setNameRules(address rules) external;

    function setTreasury(address treasury) external;
    function setBaseURI(string calldata baseURI) external;
    function withdraw(address to, uint256 amount) external;
    function pause() external;
    function unpause() external;
}
