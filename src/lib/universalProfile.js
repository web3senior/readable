import { createPublicClient, getAddress, hexToBytes, http } from 'viem'
import { universalProfiles } from '@/config/chains'
import { site } from '@/config/site'
import { photoUrl } from '@/lib/records'

/**
 * LUKSO Universal Profiles, read where they live. A profile's LSP3 profile, a name and pictures,
 * is a document its own ERC725Y storage links to. Server-only: it fetches that document.
 */

const { universalProfile: copy } = site

// keccak256('LSP3Profile'): the ERC725Y key of the link to a profile's document
const LSP3_PROFILE_KEY = '0x5ef83ad9559033e6e941db7d7c495acdce616347d28e90c7ce47cbfcfcad3bc5'
// A profile's name as the card shows it, in characters
const NAME_MAX = 64
const CACHE_MS = copy.cacheSeconds * 1000

const abi = [
  {
    type: 'function',
    name: 'getData',
    stateMutability: 'view',
    inputs: [{ name: 'dataKey', type: 'bytes32' }],
    outputs: [{ name: '', type: 'bytes' }],
  },
]

let client = null
const lukso = () => (client ??= createPublicClient({ chain: universalProfiles.chain, transport: http(universalProfiles.rpc) }))

// LSP2's VerifiableURI: 0x0000, a 4-byte method, a 2-byte hash length, the hash, then the link.
// Profiles set before it hold a JSONURL: a 4-byte method, a 32-byte hash, then the link
function linkIn(value) {
  const bytes = hexToBytes(value)
  if (bytes.length < 8) return null
  const start = bytes[0] === 0 && bytes[1] === 0 ? 8 + ((bytes[6] << 8) | bytes[7]) : 36
  if (bytes.length <= start) return null
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(start))
  } catch {
    return null
  }
}

// The server fetches content-addressed documents alone, through the gateway, or one written into
// the link itself: never a link to a host the profile names
const documentUrl = (link) => (/^data:application\/json[;,]/i.test(link) ? link : /^(ipfs|ar):\/\//i.test(link) ? photoUrl(link) : null)

// The smallest picture at least `imageWidth` wide, or the largest there is
function pictureOf(images) {
  const list = (Array.isArray(images) ? images.flat() : [])
    .filter((image) => image && typeof image.url === 'string')
    .map((image) => ({ url: photoUrl(image.url), width: Number(image.width) || 0 }))
    .filter((image) => image.url)
    .sort((a, b) => a.width - b.width)
  return (list.find((image) => image.width >= copy.imageWidth) ?? list.at(-1))?.url ?? null
}

async function readProfile(address) {
  const value = await lukso()
    .readContract({ address, abi, functionName: 'getData', args: [LSP3_PROFILE_KEY] })
    .catch(() => '0x')
  const link = value === '0x' ? null : linkIn(value)
  const url = link && documentUrl(link)
  if (!url) return null
  const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(copy.timeoutMs) }).catch(() => null)
  const document = response?.ok ? (await response.json().catch(() => null))?.LSP3Profile : null
  if (!document || typeof document !== 'object') return null
  const name = typeof document.name === 'string' ? Array.from(document.name.trim()).slice(0, NAME_MAX).join('') : ''
  return { address, name: name || null, image: pictureOf(document.profileImage) }
}

const kept = new Map()

/**
 * What the profile at `address` publishes: `{ address, name, image }`, either of the last two
 * null when it gives none, or null when the address has no document that can be read. One
 * answer serves every visitor for `cacheSeconds`.
 */
export async function readUniversalProfile(address) {
  const key = getAddress(address)
  const cached = kept.get(key)
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.value
  const value = await readProfile(key)
  kept.set(key, { at: Date.now(), value })
  return value
}
