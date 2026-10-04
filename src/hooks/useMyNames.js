'use client'

import { useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { registry, registryEnabled } from '@/config/registry'
import { readNames } from '@/lib/registry'

/** The names the connected wallet holds. `refresh` also refreshes the search's view of them. */
export default function useMyNames(account) {
  const queryClient = useQueryClient()
  const enabled = registryEnabled && Boolean(account)
  const query = useQuery({
    queryKey: ['names', registry.address, account],
    queryFn: () => readNames(account),
    enabled,
  })

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['names'] })
    queryClient.invalidateQueries({ queryKey: ['lookup'] })
  }, [queryClient])

  return { data: query.data, isPending: enabled && query.isPending, isError: query.isError, refetch: query.refetch, refresh }
}
