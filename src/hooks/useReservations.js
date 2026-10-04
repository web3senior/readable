'use client'

import { useQuery } from '@tanstack/react-query'
import { registry, registryEnabled } from '@/config/registry'
import { readReservations } from '@/lib/reservations'

/** The labels each namespace holds reserved, by namespace id. Refreshed with the admin view. */
export default function useReservations() {
  const query = useQuery({
    // Under the 'registry' prefix, so the admin's refresh after a reservation reads them again
    queryKey: ['registry', 'reserved', registry.address],
    queryFn: readReservations,
    enabled: registryEnabled,
  })

  return { data: query.data, isPending: registryEnabled && query.isPending, isError: query.isError }
}
