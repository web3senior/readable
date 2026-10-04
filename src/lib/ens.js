import { bytesToString, decodeFunctionData, encodeAbiParameters, encodePacked, hexToBytes, isAddressEqual, keccak256, parseAbi, toFunctionSelector, zeroAddress } from 'viem'
import { sign } from 'viem/accounts'
import { ens } from '@/config/ens'
import { records } from '@/config/records'
import { registry } from '@/config/registry'
import { toNamespace } from '@/lib/namespaces'
import { parseQuery } from '@/lib/query/parse'
import { parseRecords, readField } from '@/lib/records'
import { publicClient, readRegistry } from '@/lib/registry'

/**
 * The CCIP-Read gateway behind ENS (EIP-3668, ENSIP-10). A resolver contract on Ethereum, ENS's
 * own OffchainResolver, reverts every question with a pointer here. The answer is read from the
 * registry and signed the way that contract checks it:
 *   keccak256(0x1900 ‖ resolver ‖ expires ‖ keccak256(request) ‖ keccak256(result))
 * Server-only, since it signs.
 */

export class GatewayError extends Error {
  constructor(message, status = 400) {
    super(message)
    this.status = status
  }
}

const gatewayAbi = parseAbi(['function resolve(bytes name, bytes data) view returns (bytes result, uint64 expires, bytes sig)'])

// What a resolver is asked, by selector
const ADDR = toFunctionSelector('addr(bytes32)')
const ADDR_COIN = toFunctionSelector('addr(bytes32,uint256)')
const TEXT = toFunctionSelector('text(bytes32,string)')
const CONTENTHASH = toFunctionSelector('contenthash(bytes32)')
const MULTICALL = toFunctionSelector('multicall(bytes[])')
const QUERIES = new Set([ADDR, ADDR_COIN, TEXT, CONTENTHASH, MULTICALL])
const queryAbi = parseAbi([
  'function addr(bytes32 node) view returns (address)',
  'function addr(bytes32 node, uint256 coinType) view returns (bytes)',
  'function text(bytes32 node, string key) view returns (string)',
  'function contenthash(bytes32 node) view returns (bytes)',
  'function multicall(bytes[] data) returns (bytes[])',
])

const ETH_COIN_TYPE = 60n
// ENSIP-11: an EVM chain's coin type is 0x80000000 | its chain id, and the gateway answers any of
// them with the wallet the name points to
const EVM_FLAG = 0x80000000n

const read = (functionName, args) => publicClient().readContract({ address: registry.address, abi: registry.abi, functionName, args })

/** The labels of a DNS-encoded name: `\x044242\x08readable\x03eth\x00` is ['4242', 'readable', 'eth']. */
export function dnsLabels(hex) {
  const bytes = hexToBytes(hex)
  const labels = []
  for (let at = 0; at < bytes.length && bytes[at] !== 0; ) {
    const length = bytes[at]
    labels.push(bytesToString(bytes.slice(at + 1, at + 1 + length)))
    at += length + 1
  }
  return labels
}

/** The Readable name under the parent, as the site would search it, or null for the parent itself. */
export function readableName(labels) {
  const parent = ens.parent.toLowerCase().split('.')
  const tail = labels.slice(-parent.length).map((label) => label.toLowerCase())
  if (labels.length < parent.length || tail.join('.') !== parent.join('.')) throw new GatewayError(`Not a name under ${ens.parent}`, 404)
  const inner = labels.slice(0, -parent.length)
  return inner.length ? inner.join('.') : null
}

// The registry's token for a name, and whether its term still runs; null for no name at all
async function locate(nameText) {
  if (!nameText) return null
  const { namespaces } = await readRegistry()
  const live = namespaces.map((source) => toNamespace(source, { chainId: registry.chainId }))
  const candidate = parseQuery(nameText, live).candidates.find((found) => found.valid)
  if (!candidate) return null
  const tokenId = await read('tokenIdOf', [candidate.namespace.onchainId, candidate.label])
  const record = await read('recordOf', [tokenId])
  if (record.namespaceId === 0n || Number(record.expiresAt) * 1000 <= Date.now()) return null
  return { tokenId }
}

const encode = (type, value) => encodeAbiParameters([{ type }], [value])

async function target(found) {
  if (!found) return zeroAddress
  return read('resolve', [found.tokenId])
}

// One resolver question, answered as the resolver function would answer it
async function answerQuery(found, data) {
  const selector = data.slice(0, 10)
  if (!QUERIES.has(selector)) throw new GatewayError('This resolver answers addr, text and contenthash only', 404)
  const { args } = decodeFunctionData({ abi: queryAbi, data })

  switch (selector) {
    case MULTICALL:
      return encode('bytes[]', await Promise.all(args[0].map((call) => answerQuery(found, call))))
    case ADDR:
      return encode('address', await target(found))
    case ADDR_COIN: {
      const coinType = args[1]
      if (coinType === ETH_COIN_TYPE || (coinType & EVM_FLAG) !== 0n) {
        const wallet = await target(found)
        return encode('bytes', isAddressEqual(wallet, zeroAddress) ? '0x' : wallet)
      }
      return encode('bytes', found ? await read('addr', [found.tokenId, coinType]) : '0x')
    }
    case TEXT: {
      const path = ens.texts[args[1]]
      if (!found || !path) return encode('string', '')
      return encode('string', readField(parseRecords(await read('text', [found.tokenId, records.key])), path))
    }
    default:
      // A Readable name stores no content hash
      return encode('bytes', '0x')
  }
}

/**
 * The gateway's answer to `callData` (an encoded `resolve(name, data)`) sent by the resolver at
 * `sender`: the result, when it expires, and the gateway's signature over both.
 */
export async function answer(sender, callData) {
  const key = process.env.ENS_GATEWAY_PRIVATE_KEY?.trim()
  if (!key) throw new GatewayError('The ENS gateway is not set up', 503)
  if (ens.resolver && !isAddressEqual(sender, ens.resolver)) throw new GatewayError('Questions are taken from Readable’s resolver only', 403)

  let name, data
  try {
    ;({ args: [name, data] } = decodeFunctionData({ abi: gatewayAbi, data: callData }))
  } catch {
    throw new GatewayError('Not a resolve(bytes,bytes) request')
  }
  const found = await locate(readableName(dnsLabels(name)))
  const result = await answerQuery(found, data)
  const expires = BigInt(Math.floor(Date.now() / 1000) + ens.ttlSeconds)
  const hash = keccak256(encodePacked(['bytes2', 'address', 'uint64', 'bytes32', 'bytes32'], ['0x1900', sender, expires, keccak256(callData), keccak256(result)]))
  const signature = await sign({ hash, privateKey: key.startsWith('0x') ? key : `0x${key}`, to: 'hex' })
  return encodeAbiParameters([{ type: 'bytes' }, { type: 'uint64' }, { type: 'bytes' }], [result, expires, signature])
}
