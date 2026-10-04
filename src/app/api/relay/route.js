import { concat, decodeFunctionData, formatEther, isAddress, isAddressEqual, isHex, recoverTypedDataAddress } from 'viem'
import forwarderAbi from '@/abis/Forwarder.json'
import { FORWARD_REQUEST_TYPES, gasless, sponsoredPolicy } from '@/config/gasless'
import { registry } from '@/config/registry'
import { countHit, enqueueSend, relayer, waitFor } from '@/lib/relayer'
import { revertReason } from '@/lib/revert'

// The relayer's key pays for everything that lands here, so a request may only name the
// registry, and on it only a holder's or its editor's changes to a name, the functions config/gasless.js lists. A forwarder runs whatever
// its request names, so this check is the whole defence.

const SECOND = 1000
const FORWARDER_TTL_MS = 300_000
const abis = [...registry.abi, ...forwarderAbi]

const refuse = (status, error, extra = {}) => Response.json({ error, ...extra }, { status })

// --- The forwarder the registry trusts ---

// Read from the registry, never taken from the request: the owner can replace it, and a request
// naming its own would point the relayer at any contract
let forwarderCache = { at: 0, value: null }

async function readForwarder(reader) {
  if (forwarderCache.value && Date.now() - forwarderCache.at < FORWARDER_TTL_MS) return forwarderCache.value
  const read = (functionName, args) => reader.readContract({ address: registry.address, abi: registry.abi, functionName, args })
  const address = await read('trustedForwarder')
  // The getter names the forwarder of the deployment for good, even after the owner replaced
  // it. A forwarder the registry stopped trusting would refuse every request, so gasless is off
  if (!(await read('isTrustedForwarder', [address]))) throw new Error('The registry trusts another forwarder than the one it names')
  // Each deployment signs under its own name, so the name is the forwarder's to tell
  const [, name, version] = await reader.readContract({ address, abi: forwarderAbi, functionName: 'eip712Domain' })
  forwarderCache = { at: Date.now(), value: { address, name, version } }
  return forwarderCache.value
}

// --- Status ---

let statusCache = { at: 0, value: null }

async function readStatus() {
  const signer = relayer()
  if (!signer) return { enabled: false }
  if (statusCache.value && Date.now() - statusCache.at < gasless.statusTtlMs) return statusCache.value

  const [forwarder, balance, gasPrice] = await Promise.all([
    readForwarder(signer.reader),
    signer.reader.getBalance({ address: signer.account.address }),
    signer.reader.getGasPrice(),
  ])
  const value = {
    // An empty tank turns a change back into an ordinary transaction, it never blocks one
    enabled: balance >= gasPrice * (gasless.maxGas + gasless.overheadGas) * gasless.minSends,
    forwarder,
    chainId: registry.chainId,
    // Public from the relayer's first transaction, and what the owner tops up
    relayer: signer.account.address,
    balance: formatEther(balance),
  }
  statusCache = { at: Date.now(), value }
  return value
}

/** Whether the relayer can pay right now, and the forwarder a request is signed for. */
export async function GET() {
  try {
    return Response.json(await readStatus())
  } catch (error) {
    console.error('RELAY_STATUS_FAILED:', error?.shortMessage ?? error?.message)
    return Response.json({ enabled: false })
  }
}

// --- Relay ---

const parse = (body) => {
  const { request, signature } = body ?? {}
  if (!request || !isHex(signature)) return null
  if (!isAddress(request.from) || !isAddress(request.to) || !isHex(request.data)) return null
  try {
    return {
      from: request.from,
      to: request.to,
      value: BigInt(request.value ?? 0),
      gas: BigInt(request.gas),
      nonce: BigInt(request.nonce),
      deadline: Number(request.deadline),
      data: request.data,
      signature,
    }
  } catch {
    return null
  }
}

// The registry function a request calls, or null when its data is not a call the registry has
const callOf = (data) => {
  try {
    return decodeFunctionData({ abi: registry.abi, data })
  } catch {
    return null
  }
}

/** Sends a signed request through the forwarder, from the relayer's wallet. */
export async function POST(incoming) {
  const signer = relayer()
  if (!signer) return refuse(503, 'The relayer is not set up.')

  const request = parse(await incoming.json().catch(() => null))
  if (!request) return refuse(400, 'The request is malformed.')

  // Spend gates, all of them local and ahead of any work that could cost gas
  const call = isAddressEqual(request.to, registry.address) ? callOf(request.data) : null
  const policy = call && sponsoredPolicy(call.functionName)
  if (!policy) {
    console.error('RELAY_TARGET_REJECTED:', request.to, request.data.slice(0, 10))
    return refuse(403, 'The relayer does not pay for this call.')
  }
  if (request.value !== 0n) return refuse(400, 'A relayed call cannot carry value.')
  if (request.gas <= 0n || request.gas > gasless.maxGas) return refuse(400, 'The gas asked for is outside what the relayer pays.')
  if (!Number.isInteger(request.deadline) || request.deadline * SECOND <= Date.now()) return refuse(400, 'The request has expired. Sign it again.')

  const retryAfter = waitFor(call.functionName, request.from, policy)
  if (retryAfter) return refuse(429, 'Too many requests from this wallet for now.', { retryAfter })

  try {
    const { reader, wallet, account } = signer
    const forwarder = await readForwarder(reader)
    const { signature, nonce, ...message } = request

    const signedBy = await recoverTypedDataAddress({
      domain: { name: forwarder.name, version: forwarder.version, chainId: registry.chainId, verifyingContract: forwarder.address },
      types: FORWARD_REQUEST_TYPES,
      primaryType: 'ForwardRequest',
      message: { ...message, nonce },
      signature,
    }).catch(() => null)
    if (!signedBy || !isAddressEqual(signedBy, request.from)) return refuse(400, 'The signature does not match the wallet.')

    // Lower is a replay; higher can't be simulated, so it can't be paid for
    const current = await reader.readContract({ address: forwarder.address, abi: forwarderAbi, functionName: 'nonces', args: [request.from] })
    if (nonce !== current) return refuse(409, 'The request is out of date. Sign it again.', { nonce: current.toString() })

    // Run as the registry will see it, the account at the end of the data. The forwarder
    // reports every failure as FailedCall, so this is where the reason is still readable
    try {
      await reader.call({ account: forwarder.address, to: registry.address, data: concat([request.data, request.from]), gas: request.gas })
    } catch (error) {
      return refuse(400, revertReason(error, abis) ?? 'The registry refused this request.')
    }

    const gas = request.gas + request.gas / 32n + gasless.overheadGas
    const simulation = await reader.simulateContract({
      account,
      address: forwarder.address,
      abi: forwarderAbi,
      functionName: 'execute',
      args: [{ ...message, signature }],
      gas,
    })

    // Counted once the request goes out, so a refused one never starts a wait
    countHit(call.functionName, request.from, policy)
    const hash = await enqueueSend(() => wallet.writeContract(simulation.request))
    statusCache = { at: 0, value: null }
    return Response.json({ hash })
  } catch (error) {
    const reason = revertReason(error, abis) ?? error?.shortMessage ?? 'The relayer could not send this request.'
    console.error('RELAY_FAILED:', reason)
    return refuse(500, reason)
  }
}
