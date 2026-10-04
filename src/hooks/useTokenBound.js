'use client'

import { useQuery } from '@tanstack/react-query'
import { readTokenBound } from '@/lib/tokenBound'

/**
 * Whether a name's own wallet is created and what it holds. Under the 'names' prefix, so a
 * change saved on the name's page refreshes it too.
 */
export default function useTokenBound(account) {
  const query = useQuery({
    queryKey: ['names', 'token-bound', account],
    queryFn: () => readTokenBound(account),
    enabled: Boolean(account),
  })
  return { data: query.data, isPending: Boolean(account) && query.isPending, isError: query.isError }
}
