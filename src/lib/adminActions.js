'use client'

import { toast } from '@/components/NextToast'
import { sponsoredPolicy } from '@/config/gasless'
import { paymentError, sendNameChange, sendRegistryCall, waitForPayment } from '@/lib/registryActions'

/** A problem with what was typed, shown as is; anything else is a wallet or chain error. */
export class FormError extends Error {}

export const actionError = (error) => (error instanceof FormError ? error.message : paymentError(error))

/**
 * Sends one call on the registry and resolves once it is signed, with `{ hash }` or, for a smart
 * wallet's sponsored change, `{ callsId }`: an owner's setting from its wallet, or a holder's
 * change to its own name, which costs the holder no fee when the relayer or paymaster can take it.
 */
export const sendAdmin = async (functionName, args = []) =>
  sponsoredPolicy(functionName) ? sendNameChange({ functionName, args }) : { hash: await sendRegistryCall({ functionName, args }) }

/**
 * Carries a signed call to its verdict in a toast that outlives the dialog that raised it.
 * Resolves true once it is mined successfully.
 */
export async function trackAdmin(sent, { pending, done }) {
  const progress = toast(`${pending}…`, 'loading')
  const report = (message, type) => {
    if (!progress.update(message, type)) toast(message, type)
  }
  try {
    const receipt = await waitForPayment(typeof sent === 'string' ? { hash: sent } : sent)
    const success = receipt.status === 'success'
    report(success ? done : `${pending} failed onchain`, success ? 'success' : 'error')
    return success
  } catch (error) {
    report(error?.shortMessage ?? `${pending} failed`, 'error')
    return false
  }
}
