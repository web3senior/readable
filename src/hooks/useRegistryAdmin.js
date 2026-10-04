'use client'

import { useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { registry, registryEnabled } from '@/config/registry'
import { readRegistryAdmin } from '@/lib/registry'

/** The registry as its owner sees it. `refresh` also refreshes the lineup the search uses. */
export default function useRegistryAdmin() {
  const queryClient = useQueryClient()
  const query = useQuery({
    // Shares the 'registry' prefix with useNamespaces, so one invalidation refreshes both
    queryKey: ['registry', 'admin', registry.address],
    queryFn: readRegistryAdmin,
    enabled: registryEnabled,
  })

  const refresh = useCallback(() => queryClient.invalidateQueries({ queryKey: ['registry'] }), [queryClient])

  return { data: query.data, isPending: registryEnabled && query.isPending, isError: query.isError, refetch: query.refetch, refresh }
}
