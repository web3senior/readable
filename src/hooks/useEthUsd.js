'use client'

import { useQuery } from '@tanstack/react-query'
import { site } from '@/config/site'

/** Dollars for one ETH, or null until it is read or when it can't be. */
export default function useEthUsd() {
  const { data } = useQuery({
    queryKey: ['eth-usd'],
    queryFn: async () => (await (await fetch(site.usd.path)).json()).usd ?? null,
    staleTime: site.usd.cacheSeconds * 1000,
    refetchInterval: site.usd.cacheSeconds * 1000,
  })
  return typeof data === 'number' ? data : null
}
