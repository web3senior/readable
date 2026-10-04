import { base, baseSepolia, lukso } from 'viem/chains'

// The registry lives on one chain, so a name belongs to one holder. Base is its home; Base
// Sepolia is where it is rehearsed
const SUPPORTED = [base, baseSepolia]

// NEXT_PUBLIC_ values are inlined only when referenced literally
const HOME_ID = Number(process.env.NEXT_PUBLIC_READABLE_CHAIN_ID) || base.id
const RPC_OVERRIDE = process.env.NEXT_PUBLIC_READABLE_RPC

// Blockscout hands out a contract's events newest first in one request. The public RPCs serve
// logs a thousand blocks at a time, which is half an hour of Base
const EVENT_APIS = {
  [base.id]: 'https://base.blockscout.com/api/v2',
  [baseSepolia.id]: 'https://base-sepolia.blockscout.com/api/v2',
}

// Where a name's NFT is listed and an offer reaches its holder. OpenSea has no testnets, so
// Base Sepolia has none
const MARKETPLACES = {
  [base.id]: 'https://opensea.io/item/base/{contract}/{tokenId}',
}

// The network name Coinbase's onramp delivers to. It sells real coins only, so a testnet has none
const ONRAMP_NETWORKS = {
  [base.id]: 'base',
}

// What viem exports each chain as, for the code the docs print
const VIEM_EXPORTS = {
  [base.id]: 'base',
  [baseSepolia.id]: 'baseSepolia',
}

export const home = SUPPORTED.find((chain) => chain.id === HOME_ID) ?? base

// Chainlink's ETH/USD feed on Base, read for the dollar value shown beside a price in ETH, on
// whichever chain the registry is: a testnet's ETH is shown at the real one's price. Checked
// onchain 2026-10-03: "ETH / USD", 8 decimals
export const ethUsdFeed = { chain: base, address: '0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70', rpc: base.rpcUrls.default.http[0] }

// LUKSO, where Universal Profiles live. A profile in a name's records is checked and read there
// whichever chain the registry is on: a testnet registry still links real profiles
export const universalProfiles = { chain: lukso, rpc: lukso.rpcUrls.default.http[0] }

export const chains = [home]

export const chainById = (chainId) => chains.find((chain) => chain.id === Number(chainId)) ?? null

export const rpcUrlFor = (chainId) => (Number(chainId) === home.id && RPC_OVERRIDE) || chainById(chainId)?.rpcUrls.default.http[0] || null

export const eventsApiFor = (chainId) => EVENT_APIS[Number(chainId)] ?? null

export const viemExportFor = (chainId) => VIEM_EXPORTS[Number(chainId)] ?? null

/** The network Coinbase's onramp delivers to on this chain, or null when it serves none. */
export const onrampNetworkFor = (chainId) => ONRAMP_NETWORKS[Number(chainId)] ?? null

/** The marketplace page of a name's NFT, or null on a chain with none. */
export const marketplaceFor = (chainId, contract, tokenId) =>
  MARKETPLACES[Number(chainId)]?.replace('{contract}', contract).replace('{tokenId}', String(tokenId)) ?? null

export const chainNameFor =(chainId) => chainById(chainId)?.name ?? `Chain ${chainId}`

export const explorerFor = (chainId) => chainById(chainId)?.blockExplorers?.default.url ?? null
