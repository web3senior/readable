import { site } from '@/config/site'

const { historyStorageKey: KEY, historyLimit: LIMIT } = site.search
const EMPTY = Object.freeze([])
const listeners = new Set()

let cachedRaw = null
let cachedList = EMPTY

// Storage can be missing or throw (private mode, blocked site data); history is a convenience
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
    // Keep the in-memory copy so this session still sees its history
  }
  cachedRaw = JSON.stringify(list)
  cachedList = list
  listeners.forEach((listener) => listener())
}

/** Snapshot for useSyncExternalStore: the same array until the stored value changes. */
export const getHistory = () => {
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

export const getServerHistory = () => EMPTY

export const subscribeHistory = (listener) => {
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

export const addToHistory = (query) => {
  const value = query.trim()
  if (!value) return
  write([value, ...getHistory().filter((item) => item !== value)].slice(0, LIMIT))
}

export const removeFromHistory = (query) => write(getHistory().filter((item) => item !== query))

export const clearHistory = () => write([])
