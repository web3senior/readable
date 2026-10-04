'use client'

import { useQuery } from '@tanstack/react-query'
import { site } from '@/config/site'
import { readNearby } from '@/lib/nearby'

const STALE_MS = 60_000

/** Free numbers next to a taken one, asked of the registry once the name is known to be taken. */
export default function useNearby(candidate, enabled) {
  const { data } = useQuery({
    queryKey: ['nearby', candidate.namespace.id, candidate.label],
    queryFn: () => readNearby(candidate, site.search.nearby.limit),
    enabled,
    staleTime: STALE_MS,
  })
  return data ?? []
}
