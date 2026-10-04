/**
 * What the relayer pays the network fee for. Shared by the browser (lib/relayGasless.js) and the
 * relay route, so what the site offers and what the server accepts can't drift apart.
 * Dependency-free: the route must not pull in wallet code.
 */

const HOUR = 3_600_000

// A holder's or its editor's changes to a name, and nothing else: the registry believes the
// forwarder for these four alone, and a purchase brings its price in ETH, which no signed request
// can carry. Naming an editor is not one of them: like an approval, it answers to its caller
const CHANGE = { windowMs: HOUR, max: 30 }

export const gasless = {
  path: '/api/relay',
  // A request is sent as soon as it is signed, so it has no reason to stay signable for long
  deadlineSeconds: 600,
  // The most gas one request may ask the relayer to put up. Records past a few kilobytes cost
  // more, and go out from the wallet instead
  maxGas: 1_500_000n,
  // Headroom over the estimate
  gasMargin: { percent: 30n, flat: 50_000n },
  // What the forwarder spends around the call, added to the relayer's own transaction
  overheadGas: 120_000n,
  // Gasless is offered while the relayer can pay for this many of the largest requests
  minSends: 3n,
  // How long the browser trusts what the route said about the relayer
  statusTtlMs: 60_000,
  // Registry functions the relayer sends, each with how many one account gets in a window. They
  // bring in nothing, so the window is what keeps them from being farmed
  sponsored: {
    setTarget: CHANGE,
    setPrimaryName: CHANGE,
    setText: CHANGE,
    setAddrs: CHANGE,
  },
  // A smart wallet signs no forwarded request, so its changes to a name go out as a userOp whose
  // fee a paymaster pays (ERC-7677). The route hands the paymaster only those, a few an hour
  paymaster: { path: '/api/paymaster', windowMs: HOUR, max: 30 },
}

export const sponsoredPolicy = (functionName) => gasless.sponsored[functionName] ?? null

// OpenZeppelin's ERC2771Forwarder request, as the account signs it
export const FORWARD_REQUEST_TYPES = {
  ForwardRequest: [
    { name: 'from', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'gas', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint48' },
    { name: 'data', type: 'bytes' },
  ],
}
