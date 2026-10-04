/**
 * The price of one ETH in dollars, from Chainlink's ETH/USD feed on Base. Server-only: one
 * reading serves every visitor for `site.usd.cacheSeconds`.
 */

import { createPublicClient, http, parseAbi } from 'viem'
import { ethUsdFeed } from '@/config/chains'
import { site } from '@/config/site'

const { cacheSeconds, staleSeconds } = site.usd
const SECOND = 1000
const feedAbi = parseAbi(['function latestRoundData() view returns (uint80, int256, uint256, uint256, uint80)', 'function decimals() view returns (uint8)'])

let client = null
const reader = () => (client ??= createPublicClient({ chain: ethUsdFeed.chain, transport: http(ethUsdFeed.rpc) }))

async function loadEthUsd() {
  const read = (functionName) => reader().readContract({ address: ethUsdFeed.address, abi: feedAbi, functionName })
  const [[, answer, , updatedAt], decimals] = await Promise.all([read('latestRoundData'), read('decimals')])
  const at = Number(updatedAt) * SECOND
  // A feed that stopped answering, or answers nonsense, shows no dollar value at all
  if (answer <= 0n || Date.now() - at > staleSeconds * SECOND) return { usd: null, at }
  return { usd: Number(answer) / 10 ** decimals, at }
}

let kept = null

/** `{ usd, at }`: dollars for one ETH and when the feed set it, or `usd: null` when it can't be told. */
export function readEthUsd() {
  if (!kept || Date.now() >= kept.until) {
    const reading = loadEthUsd()
    kept = { reading, until: Date.now() + cacheSeconds * SECOND }
    // A failed reading is not kept, so the next visitor tries again
    reading.catch(() => {
      if (kept?.reading === reading) kept = null
    })
  }
  return kept.reading
}
