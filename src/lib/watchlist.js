import { site } from '@/config/site'

/**
 * The names someone watches, in this browser only: a convenience that remembers them between
 * visits, never something another device or the site sees. Each entry is the name as the site
 * writes it, which the search reads back.
 */

const { storageKey: KEY, limit: LIMIT } = site.watch
const EMPTY = Object.freeze([])
const listeners = new Set()

let cachedRaw = null
let cachedList = EMPTY

// Storage can be missing or throw (private mode, blocked site data)
const readRaw = () => {
  try {
    return window.localStorage.getItem(KEY)
  } catch {
    return null
  }
}

const write = (list) => {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list))
  } catch {
    // Kept in memory, so this visit still sees it
  }
  cachedRaw = JSON.stringify(list)
  cachedList = list
  listeners.forEach((listener) => listener())
}

/** Snapshot for useSyncExternalStore: the same array until the stored value changes. */
export const getWatchlist = () => {
  const raw = readRaw() ?? cachedRaw
  if (raw === cachedRaw) return cachedList
  cachedRaw = raw
  try {
    const parsed = JSON.parse(raw)
    cachedList = Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string').slice(0, LIMIT) : EMPTY
  } catch {
    cachedList = EMPTY
  }
  return cachedList
}

export const getServerWatchlist = () => EMPTY

export const subscribeWatchlist = (listener) => {
  listeners.add(listener)
  const onStorage = (event) => {
    if (event.key === KEY) listener()
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', onStorage)
  }
}

export const watch = (name) => write([name, ...getWatchlist().filter((item) => item !== name)].slice(0, LIMIT))

export const unwatch = (name) => write(getWatchlist().filter((item) => item !== name))
