import { decodeAbiParameters, decodeFunctionData, hexToBigInt, isAddressEqual, parseAbi, size, sliceHex } from 'viem'
import { gasless, sponsoredPolicy } from '@/config/gasless'
import { registry } from '@/config/registry'
import { countHit, waitFor } from '@/lib/relayer'

// The paymaster pays a smart wallet's fee, and the paymaster service bills this site for it, so
// the wallet's call is opened before it is passed on: every call must be a holder's change to a
// name on the registry, the functions config/gasless.js lists, carrying no value. The service's
// own allowlist is the second lock. PAYMASTER_URL is the service's ERC-7677 endpoint (Coinbase Developer Platform's, for one).

const policy = gasless.paymaster
const CHANGES_ONLY = 'The paymaster pays for changes to a name only'
const METHODS = new Set(['pm_getPaymasterStubData', 'pm_getPaymasterData'])

// The ways smart accounts encode the calls they make
const accountAbi = parseAbi([
  'function execute(address target, uint256 value, bytes data)',
  'function executeBatch((address target, uint256 value, bytes data)[] calls)',
  'function execute(bytes32 mode, bytes executionCalldata)',
])
// ERC-7579's call types: one call, or a batch
const SINGLE = '0x00'
const BATCH = '0x01'

// A wallet asks from its own origin (a smart wallet's keys page), so any origin may
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' }

const rpcError = (id, message, code = -32602) => Response.json({ jsonrpc: '2.0', id: id ?? null, error: { code, message } }, { headers: CORS })

/** The calls in a smart account's userOp, or null for an encoding it doesn't know. */
function callsOf(callData) {
  let decoded
  try {
    decoded = decodeFunctionData({ abi: accountAbi, data: callData })
  } catch {
    return null
  }
  const { functionName, args } = decoded
  if (functionName === 'executeBatch') return args[0].map(({ target, value, data }) => ({ to: target, value, data }))
  if (args.length === 3) return [{ to: args[0], value: args[1], data: args[2] }]

  // ERC-7579: the mode's first byte says how the calls are packed
  const [mode, packed] = args
  const callType = sliceHex(mode, 0, 1)
  if (callType === SINGLE && size(packed) >= 52) return [{ to: sliceHex(packed, 0, 20), value: hexToBigInt(sliceHex(packed, 20, 52)), data: size(packed) > 52 ? sliceHex(packed, 52) : '0x' }]
  if (callType === BATCH) {
    const [calls] = decodeAbiParameters([{ type: 'tuple[]', components: [{ type: 'address', name: 'to' }, { type: 'uint256', name: 'value' }, { type: 'bytes', name: 'data' }] }], packed)
    return calls
  }
  return null
}

// Why the calls can't be sponsored, or null when each is a change to a name on the registry
function refusal(calls) {
  if (!calls?.length) return CHANGES_ONLY
  for (const call of calls) {
    if (call.value !== 0n) return 'A sponsored call cannot carry value'
    if (!isAddressEqual(call.to, registry.address)) return CHANGES_ONLY
    if (!sponsoredPolicy(decodeFunctionData({ abi: registry.abi, data: call.data }).functionName)) return CHANGES_ONLY
  }
  return null
}

/** Whether a paymaster is set up, which is what the browser asks before offering it. */
export function GET() {
  return Response.json({ enabled: Boolean(process.env.PAYMASTER_URL && registry.address) }, { headers: CORS })
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS })
}

/** ERC-7677: the wallet asks for paymaster data for its userOp; a change to a name is passed on. */
export async function POST(request) {
  const upstream = process.env.PAYMASTER_URL
  const body = await request.json().catch(() => null)
  if (!upstream || !registry.address) return rpcError(body?.id, 'The paymaster is not set up', -32603)
  if (!body || !METHODS.has(body.method) || !Array.isArray(body.params)) return rpcError(body?.id, 'Unsupported request', -32601)

  const [userOp, , chainId] = body.params
  if (Number(chainId) !== registry.chainId) return rpcError(body.id, 'The paymaster pays on the registry’s chain only')
  if (!userOp?.sender || !userOp?.callData) return rpcError(body.id, 'The userOp is incomplete')

  try {
    const reason = refusal(callsOf(userOp.callData))
    if (reason) return rpcError(body.id, reason)
  } catch {
    return rpcError(body.id, CHANGES_ONLY)
  }

  // The stub is asked for while the wallet estimates, so only the final request is counted
  const final = body.method === 'pm_getPaymasterData'
  if (final && waitFor('paymaster', userOp.sender, policy)) return rpcError(body.id, 'Too many sponsored changes from this wallet for now', -32005)

  try {
    const response = await fetch(upstream, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), cache: 'no-store' })
    const answer = await response.json()
    if (final && !answer.error) countHit('paymaster', userOp.sender, policy)
    return Response.json(answer, { headers: CORS })
  } catch (error) {
    console.error('PAYMASTER_FAILED:', error?.message)
    return rpcError(body.id, 'The paymaster could not be reached', -32603)
  }
}
