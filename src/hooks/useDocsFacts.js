'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { registry, registryEnabled } from '@/config/registry'
import { site } from '@/config/site'
import { launchFacts, registryFacts } from '@/lib/docs'
import { readRegistryTerms } from '@/lib/registry'

/**
 * What the docs quote from the registry: prices, extensions and the grace period. Read by the
 * browser after the page has arrived, so the page never waits for the chain.
 * Until the registry answers, and if it doesn't, the launch values stand in.
 */
export default function useDocsFacts() {
  const query = useQuery({
    // Shares the 'registry' prefix with useNamespaces, so one invalidation refreshes both
    queryKey: ['registry', 'terms', registry.address],
    queryFn: readRegistryTerms,
    enabled: registryEnabled,
    staleTime: site.docs.staleMs,
  })

  const facts = useMemo(() => (query.data ? registryFacts(query.data) : launchFacts), [query.data])

  return { facts, isPending: registryEnabled && query.isPending }
}
