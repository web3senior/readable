'use client'

/**
 * Paying a name: ETH sent to the wallet the name points to at the moment of sending, as an
 * ordinary transfer from the payer's wallet.
 */

import { getBalance, getConnection, sendTransaction } from 'wagmi/actions'
import { registry } from '@/config/registry'
import { config } from '@/config/wagmi'
import { site } from '@/config/site'
import { readTarget } from '@/lib/registry'
import { ensureRegistryChain } from '@/lib/registryActions'

const onRegistryChain = { chainId: registry.chainId }
const fill = (template, values) => Object.entries(values).reduce((text, [key, value]) => text.replaceAll(`{${key}}`, value), template)

/** A refusal worded for the payer, shown as it is. */
export class PayRefused extends Error {
  constructor(reason) {
    super(reason)
    this.shortMessage = reason
  }
}

/**
 * Sends `amount` wei to the wallet `candidate` reaches, from the connected wallet. Resolves with
 * the transaction hash and the address paid once it is signed.
 */
export async function payName({ candidate, amount, currency }) {
  await ensureRegistryChain()
  const account = getConnection(config).address
  // Looked up again now: the name may have changed hands or run out since the page was read
  const to = await readTarget(candidate.namespace.onchainId, candidate.label)
  if (!to) throw new PayRefused(fill(site.pay.nobody, { name: candidate.name }))

  const { value: balance } = await getBalance(config, { ...onRegistryChain, address: account })
  if (balance < amount) throw new PayRefused(fill(site.pay.short, { symbol: currency.symbol }))

  const hash = await sendTransaction(config, { ...onRegistryChain, to, value: amount })
  return { hash, to }
}
