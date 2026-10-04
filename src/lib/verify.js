import { site } from '@/config/site'
import { readable } from '@/lib/api'
import { claimedProofs, proofMessage, signaturesIn } from '@/lib/proofs'
import { publicClient } from '@/lib/registry'

/**
 * Checks the proofs a name's records link to, on the server: each network says who posted and
 * what the post says, and the post must carry a signature of the statement by the wallet that
 * holds the name now. Server-only, since it reads other sites.
 */

const FETCH_TIMEOUT_MS = 8000
const CACHE_MS = site.verify.cacheSeconds * 1000

async function fetchJson(url, headers = {}) {
  const response = await fetch(url, { headers, cache: 'no-store', signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
  if (!response.ok) throw new Error(`${new URL(url).host} answered ${response.status}`)
  return response.json()
}

// Each network's own record of a post: who wrote it, and its text. Neither needs a key
const READERS = {
  // X's embed endpoint names the author and quotes the post
  x: async (link) => {
    const body = await fetchJson(`https://publish.x.com/oembed?omit_script=1&url=${encodeURIComponent(link)}`)
    const author = /\/\/(?:www\.)?(?:x|twitter)\.com\/([A-Za-z0-9_]{1,15})/i.exec(body.author_url ?? '')?.[1]
    return { author, text: body.html ?? '' }
  },
  // A gist's owner and its files; GitHub answers 60 of these an hour to one server without a key
  github: async (link, match) => {
    const body = await fetchJson(`https://api.github.com/gists/${match[1]}`, { Accept: 'application/vnd.github+json', 'User-Agent': site.name })
    return { author: body.owner?.login, text: Object.values(body.files ?? {}).map((file) => file.content ?? '').join('\n') }
  },
}

async function check({ network, handle, link }, { name, tokenId, owner }) {
  const match = network.link.exec(link)
  const reader = READERS[network.id]
  if (!match || !reader) return false
  const post = await reader(link, match).catch(() => null)
  if (!post?.author || post.author.toLowerCase() !== handle.toLowerCase()) return false
  const message = proofMessage({ name, tokenId, network, handle })
  for (const signature of signaturesIn(post.text)) {
    // Signed by a key or by a contract account, as the holder's wallet is
    if (await publicClient().verifyMessage({ address: owner, message, signature }).catch(() => false)) return true
  }
  return false
}

const kept = new Map()

/**
 * Which of a name's linked accounts are proven, `{ name, verified: { x: true, … } }`, or null
 * for a name that reaches nobody. A network with no proof link is left out. One answer serves
 * every visitor for `site.verify.cacheSeconds`, and is asked again once the holder or the
 * records change.
 */
export async function readVerification(nameText) {
  const profile = await readable().getProfile(nameText)
  if (!profile?.owner) return null
  const claims = claimedProofs(profile.records)
  const key = `${profile.tokenId}:${profile.owner}:${JSON.stringify(claims.map(({ network, handle, link }) => [network.id, handle, link]))}`
  const cached = kept.get(key)
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.value

  const results = await Promise.all(claims.map((claim) => check(claim, profile)))
  const value = { name: profile.name, verified: Object.fromEntries(claims.map((claim, index) => [claim.network.id, results[index]])) }
  kept.set(key, { at: Date.now(), value })
  return value
}
