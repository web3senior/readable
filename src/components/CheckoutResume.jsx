'use client'

import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { followPayment, pendingPayments } from '@/lib/payInLyx'

/** Finishes the LYX payments this browser made and didn't see finish, on the next visit. */
export default function CheckoutResume() {
  const queryClient = useQueryClient()

  useEffect(() => {
    for (const payment of pendingPayments()) {
      followPayment(payment, { onDone: () => queryClient.invalidateQueries({ queryKey: ['names'] }) })
    }
  }, [queryClient])

  return null
}
