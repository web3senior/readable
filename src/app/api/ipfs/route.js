import { ipfs } from '@/config/ipfs'
import { addToFilebase, filebaseConfigured } from '@/lib/filebase'
import { visitorOf } from '@/lib/visitor'

// Three tries at Filebase, each bounded, fit well inside this
export const maxDuration = 60

const SECOND = 1000
const { photo, throttle } = ipfs

// What a file is, by its first bytes: a browser's type and a file's name can say anything
const SIGNATURES = [
  { type: 'image/jpeg', test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { type: 'image/png', test: (b) => [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((byte, i) => b[i] === byte) },
  { type: 'image/gif', test: (b) => String.fromCharCode(...b.slice(0, 6)).match(/^GIF8[79]a$/) },
  { type: 'image/webp', test: (b) => String.fromCharCode(...b.slice(0, 4)) === 'RIFF' && String.fromCharCode(...b.slice(8, 12)) === 'WEBP' },
]
const sniff = (bytes) => SIGNATURES.find(({ test }) => test(bytes))?.type ?? null

// --- Throttle ---

// In memory and per instance on purpose, as the relay's: a brake on use, not a security boundary
const hits = new Map()
const SWEEP_AT = 5000

// Seconds until this visitor may upload again, or 0; counts the upload when it may
function waitFor(visitor) {
  const now = Date.now()
  if (hits.size > SWEEP_AT) {
    for (const [key, stamps] of hits) {
      if (stamps.every((stamp) => now - stamp >= throttle.windowMs)) hits.delete(key)
    }
  }
  const recent = (hits.get(visitor) ?? []).filter((stamp) => now - stamp < throttle.windowMs)
  if (recent.length >= throttle.max) return Math.ceil((throttle.windowMs - (now - recent[0])) / SECOND)
  hits.set(visitor, [...recent, now])
  return 0
}

const refuse = (error, status, headers) => Response.json({ error }, { status, headers })

/** Whether this site pins photos, and what it takes. */
export function GET() {
  return Response.json({ enabled: filebaseConfigured(), maxBytes: photo.maxBytes, types: Object.keys(photo.types) })
}

/**
 * Pins one photo for a name's records: `file` in a multipart body, a JPEG, PNG, WebP or GIF up
 * to `ipfs.photo.maxBytes`. Answers `{ cid: 'ipfs://…', url }`.
 */
export async function POST(request) {
  if (!filebaseConfigured()) return refuse('Photo uploads aren’t set up on this site. Paste a link instead.', 503)

  let file
  try {
    file = (await request.formData()).get('file')
  } catch {
    return refuse('Send the photo as a file', 400)
  }
  if (!file || typeof file.arrayBuffer !== 'function') return refuse('Send the photo as a file', 400)
  if (file.size > photo.maxBytes) return refuse(`A photo can be ${Math.floor(photo.maxBytes / (1024 * 1024))} MB at most`, 413)

  const bytes = new Uint8Array(await file.arrayBuffer())
  const type = sniff(bytes)
  if (!type || !photo.types[type]) return refuse('Use a JPEG, PNG, WebP or GIF image', 415)

  const wait = waitFor(visitorOf(request))
  if (wait) return refuse('Too many uploads; try again later', 429, { 'Retry-After': String(wait) })

  try {
    // The name only tells Filebase the type; nothing the visitor sent reaches it but the bytes
    const hash = await addToFilebase(() => {
      const form = new FormData()
      form.append('file', new File([bytes], `photo.${photo.types[type]}`, { type }))
      return form
    })
    return Response.json({ cid: `ipfs://${hash}`, url: `${ipfs.gateway}${hash}` })
  } catch (error) {
    console.error('[ipfs] pinning failed:', error.message)
    return refuse('The photo couldn’t be pinned. Try again.', 502)
  }
}
