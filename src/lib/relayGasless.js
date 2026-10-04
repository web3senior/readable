'use client'

/**
 * The gasless road to the registry. Instead of sending a transaction, the wallet signs a request
 * and the relayer behind /api/relay sends it through the forwarder the registry trusts, paying
 * the network fee. Only a holder's changes to a name travel this way (config/gasless.js): a
 * purchase brings its price in ETH, which a signed request can't carry.
 */

import { concat, encodeFunctionData, getContractError } from 'viem'
import { getBytecode, getPublicClient, signTypedData } from 'wagmi/actions'
import forwarderAbi from '@/abis/Forwarder.json'
import { FORWARD_REQUEST_TYPES, gasless, sponsoredPolicy } from '@/config/gasless'
import { registry } from '@/config/registry'
import { config } from '@/config/wagmi'

const SECOND = 1000
const onRegistryChain = { chainId: registry.chainId }

// An EIP-7702 account is still a key that signs, whatever code it points at
const EIP7702_DESIGNATOR = '0xef0100'
const isContractAccount = (code) => Boolean(code) && code !== '0x' && !code.toLowerCase().startsWith(EIP7702_DESIGNATOR)

/** The relayer can't take this one; the wallet sends it another way. */
export class RelayUnavailable extends Error {}

/** The relayer's refusal, worded for whoever is signing. */
export class RelayRefused extends Error {
  constructor(reason) {
    super(reason)
    this.shortMessage = reason
  }
}

const deadline = () => BigInt(Math.floor(Date.now() / SECOND) + gasless.deadlineSeconds)

let status = { at: 0, value: null }

async function readStatus() {
  if (status.value && Date.now() - status.at < gasless.statusTtlMs) return status.value
  const response = await fetch(gasless.path)
  const value = response.ok ? await response.json() : { enabled: false }
  status = { at: Date.now(), value }
  return value
}

/**
 * The forwarder `account` can sign a request for, or null when its calls go out another way:
 * the relayer is off or out of funds, or the account is a contract, which signs no typed data
 * the forwarder can check.
 */
export async function relayFor(account) {
  if (!registry.address || !account) return null
  const relay = await readStatus().catch(() => null)
  if (!relay?.enabled) return null
  const code = await getBytecode(config, { ...onRegistryChain, address: account }).catch(() => null)
  return isContractAccount(code) ? null : relay.forwarder
}

/**
 * Signs `functionName(...args)` on the registry as a request of `account` and hands it to the
 * relayer. Resolves with the hash of the relayer's transaction.
 */
export async function relayCall({ account, forwarder, functionName, args }) {
  if (!sponsoredPolicy(functionName)) throw new RelayUnavailable(`${functionName} is not relayed`)

  const reader = getPublicClient(config, onRegistryChain)
  const data = encodeFunctionData({ abi: registry.abi, functionName, args })

  // Estimated as the registry will see it: the forwarder calls, the account ends the data.
  // A call the registry would refuse stops here, before the wallet is asked to sign it
  const estimate = await reader.estimateGas({ account: forwarder.address, to: registry.address, data: concat([data, account]) }).catch((error) => {
    throw getContractError(error, { abi: registry.abi, address: registry.address, functionName, args, sender: account })
  })
  const { percent, flat } = gasless.gasMargin
  const padded = estimate + (estimate * percent) / 100n + flat
  if (padded > gasless.maxGas) throw new RelayUnavailable('This call needs more gas than the relayer pays')

  const nonce = await reader.readContract({ address: forwarder.address, abi: forwarderAbi, functionName: 'nonces', args: [account] })
  const request = { from: account, to: registry.address, value: 0n, gas: padded, nonce, deadline: Number(deadline()), data }
  const signature = await signTypedData(config, {
    account,
    domain: { name: forwarder.name, version: forwarder.version, chainId: registry.chainId, verifyingContract: forwarder.address },
    types: FORWARD_REQUEST_TYPES,
    primaryType: 'ForwardRequest',
    message: request,
  })

  const response = await fetch(gasless.path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ request, signature }, (key, value) => (typeof value === 'bigint' ? value.toString() : value)),
  })
  const payload = await response.json().catch(() => ({}))
  if (response.ok && payload.hash) return payload.hash

  // A relayer that can't or won't is no reason to lose the change
  const unavailable = response.status === 403 || response.status === 429 || response.status >= 500
  if (unavailable) {
    status = { at: 0, value: null }
    throw new RelayUnavailable(payload.error)
  }
  throw new RelayRefused(payload.error ?? 'The relayer refused this request')
}
