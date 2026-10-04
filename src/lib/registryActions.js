'use client'

import { encodeFunctionData } from 'viem'
import {
  getCapabilities,
  getConnection,
  sendCalls,
  simulateContract,
  switchChain,
  waitForCallsStatus,
  waitForTransactionReceipt,
  writeContract,
} from 'wagmi/actions'
import { config } from '@/config/wagmi'
import { gasless, sponsoredPolicy } from '@/config/gasless'
import { registry } from '@/config/registry'
import { RelayUnavailable, relayCall, relayFor } from '@/lib/relayGasless'

const onRegistryChain = { chainId: registry.chainId }

export async function ensureRegistryChain() {
  if (getConnection(config).chainId !== registry.chainId) await switchChain(config, onRegistryChain)
}

/**
 * Sends one call on the registry from the connected wallet. It is run first, so a call the
 * registry would refuse is reported with its reason; a wallet asked to sign one can only guess
 * at the gas, and the network then rejects the guess instead.
 */
export async function sendRegistryCall({ functionName, args = [], value }) {
  await ensureRegistryChain()
  const { request } = await simulateContract(config, {
    ...onRegistryChain,
    account: getConnection(config).address,
    address: registry.address,
    abi: registry.abi,
    functionName,
    args,
    value,
  })
  return writeContract(config, request)
}

let paymaster = null
const paymasterEnabled = () =>
  (paymaster ??= fetch(gasless.paymaster.path)
    .then((response) => response.json())
    .then((body) => body.enabled === true)
    .catch(() => false))

// A smart wallet's change, sent as a call (EIP-5792) whose fee the paymaster pays (ERC-7677).
// Null when the wallet takes no paymaster or the site has none
async function sponsoredCall({ account, functionName, args }) {
  const capabilities = await getCapabilities(config, { account, chainId: registry.chainId }).catch(() => null)
  if (capabilities?.paymasterService?.supported !== true || !(await paymasterEnabled())) return null
  const { id } = await sendCalls(config, {
    account,
    chainId: registry.chainId,
    calls: [{ to: registry.address, data: encodeFunctionData({ abi: registry.abi, functionName, args }) }],
    capabilities: { paymasterService: { url: `${window.location.origin}${gasless.paymaster.path}` } },
  })
  return { callsId: id }
}

/**
 * Sends a holder's change to a name (`setTarget`, `setPrimaryName`, `setText`, `setAddrs`) and
 * resolves once it is signed, with `{ hash }` of a transaction or `{ callsId }` of a sponsored
 * call. The holder pays no fee when it can be helped: a key signs a request the relayer sends
 * through the forwarder, a smart wallet's call goes to the paymaster. Otherwise the wallet sends
 * it as an ordinary transaction.
 */
export async function sendNameChange({ functionName, args }) {
  await ensureRegistryChain()
  const account = getConnection(config).address

  if (sponsoredPolicy(functionName)) {
    const forwarder = await relayFor(account)
    if (forwarder) {
      try {
        return { hash: await relayCall({ account, forwarder, functionName, args }) }
      } catch (error) {
        if (!(error instanceof RelayUnavailable)) throw error
      }
    }
    const sponsored = await sponsoredCall({ account, functionName, args }).catch(() => null)
    if (sponsored) return sponsored
  }

  return { hash: await sendRegistryCall({ functionName, args }) }
}

/**
 * Pays for a `register` or `renew` from the connected wallet, the exact price in ETH as the
 * call's value, and resolves once it is signed with `{ hash }` of the transaction.
 */
export async function sendPayment({ action, namespace, label, tokenId, years, pricePerYear }) {
  const total = pricePerYear * BigInt(years)
  const args = action === 'renew' ? [tokenId, BigInt(years)] : [namespace.onchainId, label, BigInt(years)]
  return { hash: await sendRegistryCall({ functionName: action, args, value: total }) }
}

export const waitForReceipt = (hash) => waitForTransactionReceipt(config, { ...onRegistryChain, hash })

/** The verdict of what was sent: a receipt's `status`, 'success' or not. */
export async function waitForPayment(sent) {
  if (sent.hash) return waitForReceipt(sent.hash)
  const result = await waitForCallsStatus(config, { id: sent.callsId })
  return { status: result.status === 'success' ? 'success' : 'reverted' }
}

const MISMATCH = 'The registry didn’t recognise this request. The site and the deployed contract may be different versions.'

// A refusal with no reason at all is what a contract answers to a function it does not have
const unrecognised = (error) => {
  const revert = error?.walk?.((cause) => cause?.name === 'ContractFunctionRevertedError')
  // Nodes word the empty refusal themselves, so that wording is no reason either
  return Boolean(revert) && !revert.data && (!revert.reason || /^execution reverted\.?$/i.test(revert.reason))
}

/** A wallet rejection reads as a choice, not a failure; anything else keeps viem's short message. */
export const paymentError = (error) => {
  const rejected = error?.name === 'UserRejectedRequestError' || /user (rejected|denied)/i.test(error?.message ?? '')
  if (rejected) return 'Request rejected in the wallet'
  if (unrecognised(error)) return MISMATCH
  return error?.shortMessage ?? 'The transaction failed'
}
