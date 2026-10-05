import { base, lukso, robinhood } from 'viem/chains'

// The registry lives on one chain, so a name belongs to one holder: Robinhood Chain
const SUPPORTED = [robinhood]

// NEXT_PUBLIC_ values are inlined only when referenced literally
const HOME_ID = Number(process.env.NEXT_PUBLIC_READABLE_CHAIN_ID) || robinhood.id
const RPC_OVERRIDE = process.env.NEXT_PUBLIC_READABLE_RPC

// Blockscout hands out a contract's events newest first in one request, where its API answers a
// server. Robinhood Chain's sits behind a browser check, so its events come from the chain
const EVENT_APIS = {}

// How many blocks a chain's public RPC serves logs for in one request, where that reaches back to
// the registry's deployment in a few reads: its events are read from there, window by window.
// Robinhood Chain's serves ten million, eleven days of its blocks
const LOG_SPANS = {
  [robinhood.id]: 10_000_000,
}

// Where a name's NFT is listed and an offer reaches its holder
const MARKETPLACES = {
  [base.id]: 'https://opensea.io/item/base/{contract}/{tokenId}',
}

// The network name Coinbase's onramp delivers to. It sells real coins only, so a testnet has none
const ONRAMP_NETWORKS = {
  [base.id]: 'base',
}

// What viem exports each chain as, for the code the docs print
const VIEM_EXPORTS = {
  [robinhood.id]: 'robinhood',
}

export const home = SUPPORTED.find((chain) => chain.id === HOME_ID) ?? robinhood

// Chainlink's ETH/USD feed on Base, read for the dollar value shown beside a price in ETH, on
// whichever chain the registry is. Checked onchain 2026-10-03: "ETH / USD", 8 decimals
export const ethUsdFeed = { chain: base, address: '0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70', rpc: base.rpcUrls.default.http[0] }

// LUKSO, where Universal Profiles live. A profile in a name's records is checked and read there
// whichever chain the registry is on
export const universalProfiles = { chain: lukso, rpc: lukso.rpcUrls.default.http[0] }

export const chains = [home]

export const chainById = (chainId) => chains.find((chain) => chain.id === Number(chainId)) ?? null

export const rpcUrlFor = (chainId) => (Number(chainId) === home.id && RPC_OVERRIDE) || chainById(chainId)?.rpcUrls.default.http[0] || null

export const eventsApiFor = (chainId) => EVENT_APIS[Number(chainId)] ?? null

/** How many blocks one read of logs may span on this chain, or null where only the newest are read. */
export const logSpanFor = (chainId) => LOG_SPANS[Number(chainId)] ?? null

export const viemExportFor = (chainId) => VIEM_EXPORTS[Number(chainId)] ?? null

/** The network Coinbase's onramp delivers to on this chain, or null when it serves none. */
export const onrampNetworkFor = (chainId) => ONRAMP_NETWORKS[Number(chainId)] ?? null

/** The marketplace page of a name's NFT, or null on a chain with none. */
export const marketplaceFor = (chainId, contract, tokenId) =>
  MARKETPLACES[Number(chainId)]?.replace('{contract}', contract).replace('{tokenId}', String(tokenId)) ?? null

export const chainNameFor =(chainId) => chainById(chainId)?.name ?? `Chain ${chainId}`

export const explorerFor = (chainId) => chainById(chainId)?.blockExplorers?.default.url ?? null
