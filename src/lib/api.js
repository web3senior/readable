import { createReadable } from 'readable-sdk'
import { chainById, rpcUrlFor } from '@/config/chains'
import { registry } from '@/config/registry'
import { site } from '@/config/site'

let reader = null

/** The SDK, reading the registry this site is configured for. Rebuilt when that changes. */
export function readable() {
  if (reader?.registry !== registry.address) {
    reader = createReadable({ chain: chainById(registry.chainId), registry: registry.address, rpc: rpcUrlFor(registry.chainId) })
  }
  return reader
}

// Any page may call the API, from any origin
const OPEN = { 'Access-Control-Allow-Origin': '*' }

/** A JSON answer, kept by caches for `site.api.cacheSeconds`. */
export const apiAnswer = (body, status = 200) =>
  Response.json(body, {
    status,
    headers: { ...OPEN, 'Cache-Control': `public, max-age=${site.api.cacheSeconds}, stale-while-revalidate=${site.api.staleSeconds}` },
  })

/** A refusal, never cached. */
export const apiError = (message, status) => Response.json({ error: message }, { status, headers: { ...OPEN, 'Cache-Control': 'no-store' } })

/** A path segment as it was typed: `+0%204242` is `+0 4242`. */
export const segment = (value) => {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}
