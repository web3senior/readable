import { base, baseSepolia } from 'viem/chains'

/** The chains Readable lives on, by id. Base is its home; Base Sepolia is where it is rehearsed. */
export const chains = { [base.id]: base, [baseSepolia.id]: baseSepolia }

/** The registry on each chain. Base has none until mainnet; pass `registry` to read another one. */
export const registries = {
  [baseSepolia.id]: '0x7c636853ECFA14e61d3A9Ec0c9501d66D17797D6',
}

// The text key a name's records are stored under, one JSON document
export const RECORDS_KEY = 'records'

// IReadable.Kind
export const KIND = { NAME: 0, NUMBER: 1 }

// SLIP-44: the coin type that stands for the name's own EVM address (`resolve`)
export const ETH_COIN_TYPE = 60

// The read functions the SDK calls, from IReadable
export const abi = [
  {
    type: 'function',
    name: 'getNamespaces',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      {
        type: 'tuple[]',
        components: [
          { name: 'id', type: 'uint256' },
          { name: 'kind', type: 'uint8' },
          { name: 'name', type: 'string' },
          { name: 'minLength', type: 'uint8' },
          { name: 'maxLength', type: 'uint8' },
          { name: 'checkDigitFrom', type: 'uint8' },
          { name: 'priceFrom', type: 'uint8' },
          { name: 'paused', type: 'bool' },
          { name: 'manager', type: 'address' },
          { name: 'managerShare', type: 'uint8' },
          { name: 'metadata', type: 'string' },
          { name: 'createdAt', type: 'uint64' },
        ],
      },
    ],
  },
  {
    type: 'function',
    name: 'tokenIdOf',
    stateMutability: 'view',
    inputs: [
      { name: 'namespaceId', type: 'uint256' },
      { name: 'label', type: 'string' },
    ],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'recordOf',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [
      {
        type: 'tuple',
        components: [
          { name: 'namespaceId', type: 'uint256' },
          { name: 'label', type: 'string' },
          { name: 'target', type: 'address' },
          { name: 'registeredAt', type: 'uint64' },
          { name: 'expiresAt', type: 'uint64' },
          { name: 'length', type: 'uint32' },
        ],
      },
    ],
  },
  { type: 'function', name: 'ownerOf', stateMutability: 'view', inputs: [{ name: 'tokenId', type: 'uint256' }], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'resolve', stateMutability: 'view', inputs: [{ name: 'tokenId', type: 'uint256' }], outputs: [{ type: 'address' }] },
  {
    type: 'function',
    name: 'addr',
    stateMutability: 'view',
    inputs: [
      { name: 'tokenId', type: 'uint256' },
      { name: 'coinType', type: 'uint256' },
    ],
    outputs: [{ type: 'bytes' }],
  },
  {
    type: 'function',
    name: 'text',
    stateMutability: 'view',
    inputs: [
      { name: 'tokenId', type: 'uint256' },
      { name: 'key', type: 'string' },
    ],
    outputs: [{ type: 'string' }],
  },
  {
    type: 'function',
    name: 'primaryNameOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [
      { name: 'tokenId', type: 'uint256' },
      { name: 'name', type: 'string' },
    ],
  },
]
