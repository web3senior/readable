'use client'

import { useQuery } from '@tanstack/react-query'
import { isAddress } from 'viem'
import { site } from '@/config/site'

/**
 * The name and picture the LUKSO Universal Profile at `address` publishes, `{ address, name,
 * image }`, as the site reads it; null until it answers, and for an address with no profile.
 */
export default function useUniversalProfile(address) {
  const { data } = useQuery({
    queryKey: ['universal-profile', address],
    queryFn: async () => {
      const response = await fetch(`${site.universalProfile.path}/${address}`)
      return response.ok ? response.json() : null
    },
    enabled: isAddress(String(address ?? '')),
    staleTime: site.universalProfile.cacheSeconds * 1000,
  })
  return data ?? null
}
