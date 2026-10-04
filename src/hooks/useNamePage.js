'use client'

import { useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { registry, registryEnabled } from '@/config/registry'
import { readNamePage } from '@/lib/registry'

/**
 * One name for its page, from a search candidate. Shares the 'names' prefix with useMyNames, so a
 * change saved on either refreshes both.
 */
export default function useNamePage(candidate) {
  const queryClient = useQueryClient()
  const enabled = registryEnabled && Boolean(candidate?.valid && candidate.namespace.onchainId)
  const query = useQuery({
    queryKey: ['names', 'page', registry.address, candidate?.namespace.id, candidate?.label],
    queryFn: () => readNamePage(candidate.namespace.onchainId, candidate.label),
    enabled,
  })

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['names'] })
    queryClient.invalidateQueries({ queryKey: ['lookup'] })
  }, [queryClient])

  return { data: query.data, isPending: enabled && query.isPending, isError: query.isError, refetch: query.refetch, refresh }
}
