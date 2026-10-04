'use client'

import { useQuery } from '@tanstack/react-query'
import { gasless } from '@/config/gasless'
import { relayFor } from '@/lib/relayGasless'

/** Whether the relayer would send `account`'s changes to a name, which is what the gasless note promises. */
export default function useGasless(account) {
  const { data } = useQuery({
    queryKey: ['gasless', account],
    queryFn: async () => Boolean(await relayFor(account)),
    enabled: Boolean(account),
    staleTime: gasless.statusTtlMs,
  })
  return data === true
}
