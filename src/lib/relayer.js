/**
 * The relayer's one road to the chain: the wallet that pays the network fee of a gasless call.
 * Server-only, since it reads the key.
 */

import { createPublicClient, createWalletClient, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { chainById, rpcUrlFor } from '@/config/chains'
import { registry } from '@/config/registry'

const chain = chainById(registry.chainId)
// A private endpoint when there is one: public ones limit a server's address sooner than a visitor's
const transport = () => http(process.env.RELAYER_RPC || rpcUrlFor(registry.chainId))

let cached = null

/** The relayer's clients and address, or null while no usable key is set. */
export const relayer = () => {
  if (cached) return cached
  const key = process.env.RELAYER_PRIVATE_KEY?.trim()
  if (!key || !registry.address) return null
  try {
    const account = privateKeyToAccount(key.startsWith('0x') ? key : `0x${key}`)
    cached = {
      account,
      reader: createPublicClient({ chain, transport: transport() }),
      wallet: createWalletClient({ account, chain, transport: transport() }),
    }
    return cached
  } catch {
    console.error('RELAYER_KEY_INVALID')
    return null
  }
}

// --- Throttle ---

// In memory and per instance on purpose: a brake on spending, not a security boundary
const hits = new Map()
const SWEEP_AT = 5000
const SECOND = 1000

// The times `account` had `kind` relayed within `windowMs`, oldest first
const recentHits = (kind, account, windowMs) => {
  const now = Date.now()
  if (hits.size > SWEEP_AT) {
    for (const [key, entry] of hits) {
      if (entry.stamps.every((stamp) => now - stamp >= entry.windowMs)) hits.delete(key)
    }
  }
  const key = `${kind}:${account.toLowerCase()}`
  const stamps = (hits.get(key)?.stamps ?? []).filter((stamp) => now - stamp < windowMs)
  hits.set(key, { windowMs, stamps })
  return stamps
}

/** Seconds until `account` may have `kind` relayed again under `policy` ({ windowMs, max }), or 0. */
export const waitFor = (kind, account, { windowMs, max }) => {
  const recent = recentHits(kind, account, windowMs)
  return recent.length < max ? 0 : Math.ceil((windowMs - (Date.now() - recent[0])) / SECOND)
}

/** Counts one request of `kind` sent for `account`; counted once it goes out, so a refused one never starts a wait. */
export const countHit = (kind, account, { windowMs }) => recentHits(kind, account, windowMs).push(Date.now())

// Two sends at once race on the relayer's account nonce, so they go out one after another
let queue = Promise.resolve()

/** Runs `task` after every earlier send, and resolves to what it returns. */
export const enqueueSend = (task) => {
  const next = queue.then(task, task)
  queue = next.catch(() => {})
  return next
}
