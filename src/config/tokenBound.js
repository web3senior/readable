import { zeroHash } from 'viem'
import { base, robinhood } from 'viem/chains'

/**
 * A wallet of a name's own (ERC-6551): an account whose owner is whoever holds the name's NFT,
 * at an address fixed by the token id. Nothing in the registry knows of it. The registry is the
 * standard's own, at one address on every chain; the account is Tokenbound's AccountV3 behind its
 * proxy, with salt 0, the pair Tokenbound's tools create (the last thousand accounts made with the
 * proxy on Base all used salt 0), so apps that show token-bound accounts find the same wallet.
 * A new account runs nothing until it is initialized with AccountV3, which anyone may do once and
 * with no other implementation (Tokenbound's guardian decides which it takes), so the two are
 * sent together. Each checked onchain on Base and on a fork, 2026-10-04, and on Robinhood
 * Chain, 2026-10-06.
 */
export const tokenBound = {
  registry: '0x000000006551c19487814612e58FE06813775758',
  // Tokenbound's AccountProxy, the code every name's account is a copy of
  implementation: '0x55266d75D1a14E4572138116aF39863Ed6596E7F',
  // Tokenbound's AccountV3, what the proxy runs once initialized
  account: '0x41C8f39463A868d3A88af00cd0fe7102F30E44eC',
  salt: zeroHash,
  // ERC-1967's slot, where the proxy keeps what it runs: empty until initialized
  implementationSlot: '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc',
  // Where both are deployed. Elsewhere a name has no wallet of its own
  chainIds: [base.id, robinhood.id],
  registryAbi: [
    {
      type: 'function',
      name: 'createAccount',
      stateMutability: 'nonpayable',
      inputs: [
        { name: 'implementation', type: 'address' },
        { name: 'salt', type: 'bytes32' },
        { name: 'chainId', type: 'uint256' },
        { name: 'tokenContract', type: 'address' },
        { name: 'tokenId', type: 'uint256' },
      ],
      outputs: [{ name: 'account', type: 'address' }],
    },
    {
      type: 'function',
      name: 'account',
      stateMutability: 'view',
      inputs: [
        { name: 'implementation', type: 'address' },
        { name: 'salt', type: 'bytes32' },
        { name: 'chainId', type: 'uint256' },
        { name: 'tokenContract', type: 'address' },
        { name: 'tokenId', type: 'uint256' },
      ],
      outputs: [{ name: 'account', type: 'address' }],
    },
  ],
  // IERC6551Executable: the holder's wallet calls it; operation 0 is a plain call. `initialize`
  // is the proxy's
  accountAbi: [
    {
      type: 'function',
      name: 'initialize',
      stateMutability: 'nonpayable',
      inputs: [{ name: 'implementation', type: 'address' }],
      outputs: [],
    },
    {
      type: 'function',
      name: 'execute',
      stateMutability: 'payable',
      inputs: [
        { name: 'to', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'data', type: 'bytes' },
        { name: 'operation', type: 'uint8' },
      ],
      outputs: [{ name: 'result', type: 'bytes' }],
    },
    { type: 'function', name: 'owner', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'address' }] },
  ],
}

export const tokenBoundOn = (chainId) => tokenBound.chainIds.includes(Number(chainId))
