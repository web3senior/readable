'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { previewNamespaces } from '@/config/namespaces'
import { registry, registryEnabled } from '@/config/registry'
import { toNamespace } from '@/lib/namespaces'
import { readRegistry } from '@/lib/registry'

const PREVIEW = previewNamespaces.map((source) => toNamespace(source))
const STALE_MS = 5 * 60_000

/** The namespaces to search: the registry's own once it is configured, the preview lineup before. */
export default function useNamespaces() {
  const query = useQuery({
    queryKey: ['registry', registry.address],
    queryFn: readRegistry,
    enabled: registryEnabled,
    staleTime: STALE_MS,
  })

  const namespaces = useMemo(() => {
    if (!registryEnabled) return PREVIEW
    const { namespaces: list = [], currency } = query.data ?? {}
    return (
      list
        .map((source) => toNamespace(source, { chainId: registry.chainId, currency }))
        // A registry of another version can hold a kind this site has no words for
        .filter((namespace) => namespace.kind)
    )
  }, [query.data])

  return {
    namespaces,
    live: registryEnabled,
    isLoading: registryEnabled && query.isPending,
    isError: query.isError,
    refetch: query.refetch,
  }
}
