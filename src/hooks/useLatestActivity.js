'use client'

import { useInfiniteQuery } from '@tanstack/react-query'
import { registry, registryEnabled } from '@/config/registry'
import { site } from '@/config/site'

const { path, refreshMs } = site.activity

const fetchActivity = async ({ pageParam, signal }) => {
  const response = await fetch(pageParam ? `${path}?${new URLSearchParams({ cursor: pageParam })}` : path, { signal })
  if (!response.ok) throw new Error(`Latest activity: ${response.status}`)
  return response.json()
}

/**
 * What happened to names lately, asked for again while the page stays open. `total` counts every
 * row the registry's history makes, `readAt` is when it was read.
 */
export default function useLatestActivity() {
  const query = useInfiniteQuery({
    queryKey: ['activity', 'pages', registry.address],
    queryFn: fetchActivity,
    initialPageParam: null,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    enabled: registryEnabled,
    staleTime: refreshMs,
    refetchInterval: refreshMs,
  })

  return {
    rows: query.data?.pages.flatMap((page) => page.rows) ?? [],
    total: query.data?.pages[0]?.total ?? 0,
    names: query.data?.pages[0]?.names ?? 0,
    currency: query.data?.pages[0]?.currency ?? null,
    readAt: query.dataUpdatedAt,
    isPending: registryEnabled && query.isPending,
    hasNextPage: query.hasNextPage,
    fetchNextPage: query.fetchNextPage,
    isFetching: query.isFetching,
    isFetchingNextPage: query.isFetchingNextPage,
    isFetchNextPageError: query.isFetchNextPageError,
  }
}
