// SPDX-License-Identifier: MIT
pragma solidity ^0.8.35;

/**
 * @title INameRules
 * @author Hup Labs
 * @notice What the label of a name, the part before its extension, may be made of.
 * @dev The registry asks a contract of this shape instead of deciding itself, so the owner can
 *      replace the rules: which scripts are taken, and how look-alikes are told apart, will need
 *      to change long after the registry is deployed. New rules bind new registrations only; a
 *      name already held keeps its label, its token id and its price.
 * @custom:version 1.0.0
 * @custom:website https://readable.name
 * @custom:security-contact security@hup.social
 */
interface INameRules {
    function version() external pure returns (string memory);

    /**
     * @notice Reads `label` as a name.
     * @return valid Whether the rules take it.
     * @return normalized The one form every spelling of the name is stored under. The registry
     *         derives the token id from it.
     * @return length Its characters as a reader counts them, which is what it is priced by.
     */
    function measure(bytes calldata label) external view returns (bool valid, bytes memory normalized, uint256 length);
}
