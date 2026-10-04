'use client'

import { useSyncExternalStore } from 'react'
import { getServerWatchlist, getWatchlist, subscribeWatchlist, unwatch, watch } from '@/lib/watchlist'

export default function useWatchlist() {
  const names = useSyncExternalStore(subscribeWatchlist, getWatchlist, getServerWatchlist)
  return { names, watch, unwatch, isWatching: (name) => names.includes(name) }
}
