'use client'

import { useQuery } from '@tanstack/react-query'
import { registry, registryEnabled } from '@/config/registry'
import { site } from '@/config/site'

const { path, refreshMs } = site.activity

const fetchActivity = async () => {
  const response = await fetch(path)
  if (!response.ok) throw new Error(`Latest activity: ${response.status}`)
  return response.json()
}

/**
 * What happened to names lately, asked for again while the page stays open. `total` counts every
 * row the registry's history makes, `readAt` is when it was read.
 */
export default function useLatestActivity() {
  const query = useQuery({
    queryKey: ['activity', registry.address],
    queryFn: fetchActivity,
    enabled: registryEnabled,
    staleTime: refreshMs,
    refetchInterval: refreshMs,
  })

  return {
    rows: query.data?.rows ?? [],
    total: query.data?.total ?? 0,
    currency: query.data?.currency ?? null,
    readAt: query.dataUpdatedAt,
    isPending: registryEnabled && query.isPending,
  }
}
