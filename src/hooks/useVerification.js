'use client'

import { useQuery } from '@tanstack/react-query'
import { site } from '@/config/site'

/**
 * Which of a name's linked accounts are proven, by network id (`{ x: true }`), as the site's
 * check reads them. Asked only when the records link a proof; `stored` is the records text, so
 * a saved change asks again.
 */
export default function useVerification(name, stored, enabled) {
  const { data } = useQuery({
    queryKey: ['verify', name, stored],
    queryFn: async () => {
      const response = await fetch(`${site.verify.path}/${encodeURIComponent(name)}`)
      if (!response.ok) return {}
      return (await response.json()).verified ?? {}
    },
    enabled: Boolean(name) && enabled,
    staleTime: site.verify.cacheSeconds * 1000,
  })
  return data ?? {}
}
