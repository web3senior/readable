import { records } from '@/config/records'

const isObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value)

/** The document behind a stored text; anything unreadable reads as an empty one. */
export const parseRecords = (text) => {
  if (!text) return {}
  try {
    const parsed = JSON.parse(text)
    return isObject(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

export const readField = (document, path) => {
  const value = path.split('.').reduce((node, key) => (isObject(node) ? node[key] : undefined), document)
  return typeof value === 'string' || typeof value === 'number' ? String(value) : ''
}

const writeField = (document, path, value) => {
  const keys = path.split('.')
  const last = keys.pop()
  let node = document
  for (const key of keys) {
    if (!isObject(node[key])) node[key] = {}
    node = node[key]
  }
  if (value) node[last] = value
  else delete node[last]
}

const prune = (node) => {
  for (const [key, value] of Object.entries(node)) {
    if (isObject(value) && Object.keys(prune(value)).length === 0) delete node[key]
  }
  return node
}

/**
 * The text to store for `values` (field path to string), laid over the stored document so keys
 * written by other apps survive. Empty when nothing is left to store.
 */
export function serializeRecords(stored, values) {
  const { v: _version, ...document } = structuredClone(parseRecords(stored))
  for (const [path, value] of Object.entries(values)) writeField(document, path, value)
  prune(document)
  return Object.keys(document).length ? JSON.stringify({ v: records.version, ...document }) : ''
}

export const byteLength = (text) => new TextEncoder().encode(text).length

// A site as people paste it: no scheme, no www.
const bare = (link) => link.replace(/^https?:\/\//i, '').replace(/^www\./i, '')

/** `x.com/`, the site part a handle field shows before the handle. */
export const profilePrefix = (field) => bare(field.profile)

/**
 * The handle alone, from `alice`, `@alice` or a pasted profile link such as
 * `https://x.com/alice?s=20`. Checking it against the field's pattern is the caller's part.
 */
export function toHandle(field, raw) {
  let handle = bare(String(raw ?? '').trim())
  for (const site of [profilePrefix(field), ...(field.aliases ?? [])]) {
    if (handle.toLowerCase().startsWith(site.toLowerCase())) {
      handle = handle.slice(site.length)
      break
    }
  }
  handle = handle.replace(/^@+/, '').replace(/[/?#].*$/, '')
  return field.lowercase ? handle.toLowerCase() : handle
}

/** Where a stored photo link can be shown from: ipfs:// and ar:// go through a gateway. */
export function photoUrl(link) {
  const value = String(link ?? '').trim()
  const [, scheme, rest] = value.match(/^(ipfs|ar):\/\/(?:ipfs\/)?(\S+)$/i) ?? []
  if (scheme) return `${records.gateways[scheme.toLowerCase()]}${rest}`
  return /^https:\/\/\S+$/i.test(value) ? value : null
}
