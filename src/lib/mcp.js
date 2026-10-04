import { getAddress, isAddress } from 'viem'
import { chainNameFor } from '@/config/chains'
import { registry } from '@/config/registry'
import { site } from '@/config/site'
import { readAgents } from '@/lib/agents'
import { readable } from '@/lib/api'
import { formatAmount } from '@/lib/format'
import { displayName, namePath, toNamespace } from '@/lib/namespaces'
import { lookupCandidate } from '@/lib/providers'
import { findName } from '@/lib/query/parse'
import { readRegistry } from '@/lib/registry'
import { searchLink } from '@/lib/searchLink'

/**
 * The MCP server: tools an AI agent calls to resolve a Readable name, find a wallet's name,
 * check a name before buying it, and dial another agent by its number. Stateless JSON-RPC over
 * HTTP (MCP's Streamable HTTP transport, answering in JSON), so it runs on any server instance.
 */

// The newest first; a client asking for another of these gets it back
const PROTOCOL_VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05']

const link = (path) => `${site.baseUrl}${path}`

// Said beside an answer whose address is the name's agent wallet (ERC-6551), which exists on the
// registry's chain alone: anywhere else nobody controls that address
const agentWalletNote = () => ({
  note: `address is the name’s agent wallet, which exists on ${chainNameFor(registry.chainId)} only. Send to it there, never on another chain.`,
})
const nameInput = { type: 'object', properties: { name: { type: 'string', description: 'A number like +0 42421230 (spaces and dashes optional) or a name like alice.arc' } }, required: ['name'] }

class ToolError extends Error {}

const requireName = ({ name } = {}) => {
  if (typeof name !== 'string' || !name.trim()) throw new ToolError('Give a name, such as +0 4242')
  return name.trim()
}

// The registry's namespaces, and the one candidate a typed name stands for there
async function candidateOf(name) {
  const { namespaces, currency } = await readRegistry()
  const live = namespaces.map((source) => toNamespace(source, { chainId: registry.chainId, currency }))
  const candidate = findName(name, live)
  if (!candidate) throw new ToolError(`${name} isn’t a name the registry can hold`)
  return { candidate, currency }
}

const TOOLS = [
  {
    name: 'resolve_name',
    title: 'Resolve a name',
    description:
      'Looks up a Readable name (an onchain number such as +0 42421230, or a username) and returns the wallet it reaches on Base and most EVM chains, its Bitcoin and Solana addresses, its holder, its expiry and its public records (contact card, social handles, AI agent). Read it again right before sending money: names can change hands.',
    inputSchema: nameInput,
    run: async (args) => {
      const name = requireName(args)
      const profile = await readable().getProfile(name)
      if (!profile) return { name, found: false, note: 'Not registered, expired, or not a valid name. Nothing should be sent to it.' }
      return {
        found: true,
        ...profile,
        ...(profile.agentWallet && agentWalletNote()),
        page: link(`${site.names.path}/${profile.name.replaceAll(' ', '-')}`),
      }
    },
  },
  {
    name: 'lookup_address',
    title: 'Name of a wallet',
    description: 'Returns the primary Readable name a wallet address chose for itself, or null when it chose none.',
    inputSchema: { type: 'object', properties: { address: { type: 'string', description: 'A 0x… wallet address' } }, required: ['address'] },
    run: async ({ address } = {}) => {
      if (!isAddress(address ?? '')) throw new ToolError('Give a 0x… address')
      return { address: getAddress(address), name: await readable().getName(address) }
    },
  },
  {
    name: 'check_name',
    title: 'Check a name',
    description:
      'Says whether a Readable name can be registered, what it costs a year and on which chain, or who holds it and until when. Registration itself happens on the name’s page with the buyer’s own wallet.',
    inputSchema: nameInput,
    run: async (args) => {
      const name = requireName(args)
      const { candidate, currency } = await candidateOf(name)
      const answer = await lookupCandidate(candidate)
      const base = { name: candidate.name, chain: chainNameFor(registry.chainId), status: answer.status }
      if (answer.status === 'available') return { ...base, pricePerYear: formatAmount(answer.pricePerYear, currency), register: searchLink(candidate.name) }
      if (answer.status === 'taken')
        return { ...base, holder: answer.owner, wallet: answer.target, expiresAt: new Date(answer.expiresAt).toISOString(), expired: answer.expired, page: link(namePath(candidate.namespace, candidate.label)) }
      return { ...base, reason: answer.reason ?? null }
    },
  },
  {
    name: 'dial_agent',
    title: 'Dial an agent',
    description:
      'Finds the AI agent behind a Readable name: the endpoint where it answers, its ERC-8004 id and the address where it is paid. Null fields mean the holder left them empty.',
    inputSchema: nameInput,
    run: async (args) => {
      const name = requireName(args)
      const agent = await readable().getAgent(name)
      if (!agent) return { name, found: false, note: 'This name reaches no AI agent.' }
      return { found: true, ...agent, ...(agent.agentWallet && agentWalletNote()) }
    },
  },
  {
    name: 'list_agents',
    title: 'List agents',
    description: 'Lists the AI agents that have a Readable name, newest first, with their endpoints and payment addresses.',
    inputSchema: { type: 'object', properties: {} },
    run: async () => {
      const { agents } = await readAgents()
      return { agents: agents.map(({ path, ...agent }) => ({ ...agent, page: link(path) })) }
    },
  },
  {
    name: 'payment_details',
    title: 'How to pay a name',
    description:
      'Returns what a wallet needs to pay a Readable name right now: the chain, the coin it is paid in (ETH on Base) and the recipient address the name points to. Call it immediately before sending.',
    inputSchema: nameInput,
    run: async (args) => {
      const name = requireName(args)
      const { candidate, currency } = await candidateOf(name)
      const to = await readable().resolve(name)
      if (!to) return { name: candidate.name, payable: false, note: 'This name reaches nobody now. Do not send anything.' }
      return {
        name: displayName(candidate.namespace, candidate.label),
        payable: true,
        chainId: registry.chainId,
        chain: chainNameFor(registry.chainId),
        to,
        token: { native: true, symbol: currency.symbol, decimals: currency.decimals },
        page: link(namePath(candidate.namespace, candidate.label)),
      }
    },
  },
]

const result = (id, value) => ({ jsonrpc: '2.0', id, result: value })
const failure = (id, code, message) => ({ jsonrpc: '2.0', id: id ?? null, error: { code, message } })

async function callTool({ name, arguments: args } = {}) {
  const tool = TOOLS.find((candidate) => candidate.name === name)
  if (!tool) return null
  try {
    const output = await tool.run(args ?? {})
    return { content: [{ type: 'text', text: JSON.stringify(output, null, 2) }], structuredContent: output, isError: false }
  } catch (error) {
    const message = error instanceof ToolError ? error.message : 'The registry could not be read. Try again.'
    if (!(error instanceof ToolError)) console.error('MCP_TOOL_FAILED:', name, error?.shortMessage ?? error?.message)
    return { content: [{ type: 'text', text: message }], isError: true }
  }
}

/** The answer to one JSON-RPC message, or null for a notification, which gets none. */
export async function handleMessage(message) {
  if (!message || message.jsonrpc !== '2.0' || typeof message.method !== 'string') return failure(message?.id, -32600, 'Invalid request')
  const { id, method, params } = message
  if (id === undefined || id === null) return null

  switch (method) {
    case 'initialize': {
      const asked = params?.protocolVersion
      return result(id, {
        protocolVersion: PROTOCOL_VERSIONS.includes(asked) ? asked : PROTOCOL_VERSIONS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: site.mcp.name, title: site.mcp.title, version: site.mcp.version },
        instructions: `Readable names are onchain numbers (+0 42421230) and usernames on ${chainNameFor(registry.chainId)}. Resolve a name right before sending to it, and never send to a name that resolves to nobody.`,
      })
    }
    case 'ping':
      return result(id, {})
    case 'tools/list':
      return result(id, { tools: TOOLS.map(({ name, title, description, inputSchema }) => ({ name, title, description, inputSchema })) })
    case 'tools/call': {
      const called = await callTool(params)
      return called ? result(id, called) : failure(id, -32602, `Unknown tool: ${params?.name}`)
    }
    default:
      return failure(id, -32601, `Method not found: ${method}`)
  }
}
