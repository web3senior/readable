'use client'

import { useQuery } from '@tanstack/react-query'
import { lookupCandidate } from '@/lib/providers'

const STALE_MS = 60_000

export default function useNameLookup(candidate) {
  return useQuery({
    queryKey: ['lookup', candidate.namespace.id, candidate.label],
    queryFn: () => lookupCandidate(candidate),
    // A label refused by today's rules is asked about too: it may be held from before
    enabled: Boolean(candidate.checkable),
    staleTime: STALE_MS,
  })
}
