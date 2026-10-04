'use client'

import { useSyncExternalStore } from 'react'
import { addToHistory, clearHistory, getHistory, getServerHistory, removeFromHistory, subscribeHistory } from '@/lib/history'

export default function useSearchHistory() {
  const history = useSyncExternalStore(subscribeHistory, getHistory, getServerHistory)
  return { history, add: addToHistory, remove: removeFromHistory, clear: clearHistory }
}
