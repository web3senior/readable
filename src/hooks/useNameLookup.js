'use client'

import { useQuery } from '@tanstack/react-query'
import { lookupCandidate } from '@/lib/providers'

const STALE_MS = 60_000

export default function useNameLookup(candidate) {
  return useQuery({
    queryKey: ['lookup', candidate.namespace.id, candidate.label],
    queryFn: () => lookupCandidate(candidate),
    enabled: candidate.valid,
    staleTime: STALE_MS,
  })
}
