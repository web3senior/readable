import { defineChain } from 'viem'

// Robinhood Chain as viem defines it, written out because the viem 2 releases this SDK takes
// don't all export it
export const robinhood = defineChain({
  id: 4663,
  name: 'Robinhood Chain',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.mainnet.chain.robinhood.com'] } },
  blockExplorers: { default: { name: 'Blockscout', url: 'https://robinhoodchain.blockscout.com' } },
  contracts: { multicall3: { address: '0xca11bde05977b3631167028862be2a173976ca11' } },
})

/** The chain Readable lives on, by id. */
export const chains = { [robinhood.id]: robinhood }

/** The registry on each chain; pass `registry` to read another one. */
export const registries = {
  [robinhood.id]: '0x8085d2351F5Bb3675549683495134fc9B4D8A2F9',
}

// The text key a name's records are stored under, one JSON document
export const RECORDS_KEY = 'records'

// IReadable.Kind
export const KIND = { NAME: 0, NUMBER: 1 }

// SLIP-44: the coin type that stands for the name's own EVM address (`resolve`)
export const ETH_COIN_TYPE = 60

// ENSIP-11: an EVM chain's coin type is 0x80000000 | its chain id
export const EVM_FLAG = 0x80000000

// A name's own wallet (ERC-6551), its agent wallet on readable.name: ERC-6551's registry with
// Tokenbound's account proxy and salt 0. It exists on the registry's chain alone
export const AGENT_WALLET = {
  registry: '0x000000006551c19487814612e58FE06813775758',
  implementation: '0x55266d75D1a14E4572138116aF39863Ed6596E7F',
}

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
