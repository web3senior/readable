'use client'

import { useQuery } from '@tanstack/react-query'
import { registry, registryEnabled } from '@/config/registry'
import { site } from '@/config/site'

const { api, refreshMs } = site.agents

const fetchAgents = async () => {
  const response = await fetch(api)
  if (!response.ok) throw new Error(`Agents: ${response.status}`)
  return response.json()
}

/** The names that reach an AI agent, as the server reads them. */
export default function useAgents() {
  const query = useQuery({ queryKey: ['agents', registry.address], queryFn: fetchAgents, enabled: registryEnabled, staleTime: refreshMs })
  return { agents: query.data?.agents ?? [], isPending: registryEnabled && query.isPending, isError: query.isError, refetch: query.refetch }
}
