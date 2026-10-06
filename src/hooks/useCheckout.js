'use client'

import { useQuery } from '@tanstack/react-query'
import { readCheckoutStatus } from '@/lib/payInLyx'

const STATUS_STALE_MS = 300_000

/** Whether names can be bought with LYX here. */
export default function useCheckout() {
  const { data } = useQuery({ queryKey: ['checkout'], queryFn: readCheckoutStatus, staleTime: STATUS_STALE_MS })
  return data?.enabled === true
}
