import { zeroAddress } from 'viem'
import { records } from '@/config/records'
import { registry, registryEnabled } from '@/config/registry'
import { site } from '@/config/site'
import { readEvents } from '@/lib/events'
import { displayName, namePath, toNamespace } from '@/lib/namespaces'
import { parseRecords, photoUrl, readField } from '@/lib/records'
import { publicClient, readRegistry } from '@/lib/registry'

const { cacheSeconds } = site.agents

/**
 * Every live name whose records reach an AI agent: an endpoint or an ERC-8004 id. Found through
 * the registry's TextChanged events, so a name appears once its records are saved, and read
 * back from the registry, so a transfer or an expiry takes it off.
 */
async function loadAgents() {
  const [changes, { namespaces }] = await Promise.all([readEvents('TextChanged', { all: true }), readRegistry()])
  const tokenIds = [...new Set(changes.filter((change) => change.key === records.key).map((change) => change.tokenId))]
  if (tokenIds.length === 0) return { agents: [] }

  const reads = tokenIds.flatMap((tokenId) => [
    { functionName: 'recordOf', args: [tokenId] },
    { functionName: 'text', args: [tokenId, records.key] },
    { functionName: 'resolve', args: [tokenId] },
  ])
  const results = await publicClient().multicall({
    contracts: reads.map((read) => ({ address: registry.address, abi: registry.abi, ...read })),
    allowFailure: true,
  })

  const now = Date.now()
  const agents = tokenIds
    .map((tokenId, index) => {
      const [record, text, target] = results.slice(index * 3, index * 3 + 3).map((result) => (result.status === 'success' ? result.result : null))
      if (!record || Number(record.expiresAt) * 1000 <= now) return null
      const document = parseRecords(text)
      const endpoint = readField(document, 'agent.endpoint')
      const erc8004 = readField(document, 'agent.erc8004')
      if (!endpoint && !erc8004) return null
      const source = namespaces.find((namespace) => namespace.id === record.namespaceId)
      if (!source) return null
      const namespace = toNamespace(source, { chainId: registry.chainId })
      const wallet = target && target !== zeroAddress ? target : null
      return {
        tokenId: String(tokenId),
        name: displayName(namespace, record.label),
        path: namePath(namespace, record.label),
        title: readField(document, 'name') || null,
        about: readField(document, 'about') || null,
        avatar: photoUrl(readField(document, 'avatar')),
        endpoint: endpoint || null,
        erc8004: erc8004 || null,
        // Where the agent is paid: its own payment address, or the wallet the name points to
        payment: readField(document, 'agent.payment') || wallet,
      }
    })
    .filter(Boolean)

  return { agents }
}

let kept = null

/** The agent directory. One reading serves every visitor for `site.agents.cacheSeconds`. */
export function readAgents() {
  if (!registryEnabled) return Promise.resolve({ agents: [] })
  if (!kept || Date.now() >= kept.until) {
    const reading = loadAgents()
    kept = { reading, until: Date.now() + cacheSeconds * 1000 }
    // A failed reading is not kept, so the next visitor tries again
    reading.catch(() => {
      if (kept?.reading === reading) kept = null
    })
  }
  return kept.reading
}
