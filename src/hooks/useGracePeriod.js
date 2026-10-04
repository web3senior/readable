'use client'

import { useQuery } from '@tanstack/react-query'
import { registry, registryEnabled } from '@/config/registry'
import { readGracePeriod } from '@/lib/registry'

const DAY = 86_400_000
const STALE_MS = 600_000

/** The registry's grace period in milliseconds; its starting value until the registry answers. */
export default function useGracePeriod() {
  const { data } = useQuery({
    queryKey: ['gracePeriod', registry.address],
    queryFn: readGracePeriod,
    enabled: registryEnabled,
    staleTime: STALE_MS,
  })
  return data ?? registry.gracePeriodDays * DAY
}
