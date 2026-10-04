import { decodeEventLog, encodeEventTopics, getAbiItem, isAddressEqual } from 'viem'
import { eventsApiFor } from '@/config/chains'
import { registry } from '@/config/registry'
import { site } from '@/config/site'
import { publicClient } from '@/lib/registry'

const { recentBlocks } = site.events

const newestFirst = (a, b) => Number(b.block - a.block) || b.index - a.index

/** The registry's `events` the explorer has indexed, newest first, `pages` of them at most. */
async function fromExplorer(events, pages) {
  const api = eventsApiFor(registry.chainId)
  if (!api) return []
  const topics = new Set(events.map((event) => encodeEventTopics({ abi: [event] })[0]))
  const found = []
  // The explorer filters by one topic; several kinds are read from all the registry's logs.
  // It names the next page by the parameters to send for it
  let params = new URLSearchParams(topics.size === 1 ? { topic: [...topics][0] } : {})
  for (let page = 0; params && page < pages; page++) {
    const response = await fetch(`${api}/addresses/${registry.address}/logs?${params}`, { cache: 'no-store' })
    if (!response.ok) throw new Error(`The explorer answered ${response.status}`)
    const { items = [], next_page_params: next } = await response.json()
    for (const item of items) {
      if (!topics.has(item.topics[0])) continue
      // The explorer pads the topics it doesn't have with null
      const { eventName, args } = decodeEventLog({ abi: events, topics: item.topics.filter(Boolean), data: item.data })
      found.push({
        ...args,
        eventName,
        hash: item.transaction_hash,
        index: item.index,
        block: BigInt(item.block_number),
        at: Date.parse(item.block_timestamp),
      })
    }
    params = next ? new URLSearchParams(Object.entries(next).map(([key, value]) => [key, String(value)])) : null
  }
  return found
}

/**
 * What was sent to the registry by calls made inside transaction `hash`, in the order they ran,
 * as the explorer traced them: how a smart account's payment is read, which its own transaction
 * doesn't carry. Empty without an explorer, as on a local chain.
 */
export async function readPaymentsInside(hash) {
  const api = eventsApiFor(registry.chainId)
  if (!api) return []
  const response = await fetch(`${api}/transactions/${hash}/internal-transactions`, { cache: 'no-store' })
  if (!response.ok) throw new Error(`The explorer answered ${response.status}`)
  const { items = [] } = await response.json()
  return items
    .filter((item) => item.type === 'call' && item.success && item.to?.hash && isAddressEqual(item.to.hash, registry.address) && item.value !== '0')
    .map((item) => BigInt(item.value))
}

/** The registry's `events` of the newest blocks, which is all of them on a local chain. */
async function fromChain(events) {
  const client = publicClient()
  // Uncached: viem keeps the block number for a moment, and a read right after a transaction
  // confirms would stop at the block before it and leave its event out
  const head = await client.getBlockNumber({ cacheTime: 0 })
  const span = BigInt(recentBlocks)
  const logs = await client.getLogs({ address: registry.address, events, fromBlock: head > span ? head - span : 0n, toBlock: head })
  return logs.map((log) => ({
    ...log.args,
    eventName: log.eventName,
    hash: log.transactionHash,
    index: log.logIndex,
    block: log.blockNumber,
    at: log.blockTimestamp ? Number(log.blockTimestamp) * 1000 : null,
  }))
}

/**
 * The registry's events by `name`, or of several kinds given a list of names, newest first,
 * each with its `eventName`: what the explorer has indexed, with the newest blocks read from
 * the chain, which the explorer may not have yet. By default the explorer's first page, and one
 * source is enough. With `all`, every page, and the explorer must answer: the chain alone holds
 * the newest blocks only, so the older events would be missing and nothing would say so.
 */
export async function readEvents(name, { all = false } = {}) {
  const events = [name].flat().map((each) => getAbiItem({ abi: registry.abi, name: each }))
  const sources = await Promise.allSettled([fromChain(events), fromExplorer(events, all ? Infinity : 1)])
  const [chain, explorer] = sources
  if (all && explorer.status === 'rejected') throw explorer.reason
  if (chain.status === 'rejected' && explorer.status === 'rejected') throw chain.reason

  const seen = new Map()
  for (const log of sources.flatMap((source) => source.value ?? [])) seen.set(`${log.hash}:${log.index}`, log)
  return [...seen.values()].sort(newestFirst)
}
