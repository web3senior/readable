'use client'

/**
 * Paying for a name in LYX, the browser's half: a quote from the server, the payment from the
 * connected wallet on LUKSO, then asking the server to finish it until it has. A payment this
 * browser made and hasn't seen finish is kept, to finish on a later visit.
 */

import { getBalance, getConnection, sendTransaction, switchChain } from 'wagmi/actions'
import { toast } from '@/components/NextToast'
import { checkout } from '@/config/checkout'
import { site } from '@/config/site'
import { config } from '@/config/wagmi'
import { formatAmount, formatDate } from '@/lib/format'

const copy = site.checkout
const DAY = 86_400_000
const onLukso = { chainId: checkout.chain.id }

const fill = (template, values) => Object.entries(values).reduce((text, [key, value]) => text.replaceAll(`{${key}}`, value), template)

/** A refusal worded for the buyer, shown as it is. */
export class CheckoutError extends Error {
  constructor(message) {
    super(message)
    this.shortMessage = message
  }
}

async function post(path, body) {
  const response = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  const answer = await response.json().catch(() => ({}))
  if (!response.ok) throw new CheckoutError(answer.error ?? copy.refusals.unreachable)
  return answer
}

/** `{ enabled }`: whether the site takes LYX for names now. */
export const readCheckoutStatus = () =>
  fetch(checkout.path)
    .then((response) => response.json())
    .catch(() => ({ enabled: false }))

/** A quote for `years` of `label` under `namespace`, registered to `holder`. */
export const requestQuote = ({ namespace, label, holder, years }) =>
  post(checkout.path, { namespaceId: String(namespace.onchainId), label, to: holder, years })

/** Whether `quote` still has time to be paid without asking for a new one. */
export const quoteFresh = (quote) => Boolean(quote) && quote.expiresAt - Date.now() > checkout.quoteFloorSeconds * 1000

/** The latest LYX payments and where each stands, for /admin. A refusal with `off` means the checkout is off. */
export async function readCheckoutPayments() {
  const response = await fetch(checkout.paymentsPath)
  const answer = await response.json().catch(() => ({}))
  if (!response.ok) throw Object.assign(new CheckoutError(answer.error ?? copy.refusals.unreachable), { off: response.status === 503 })
  return answer
}

/** Asks the server once to finish the payment `hash`, and resolves with where it stands. */
export const claimOnce = (hash) => post(checkout.claimPath, { hash })

/** Pays `quote` from the connected wallet on LUKSO, and resolves with the transaction hash once it is signed. */
export async function payQuote(quote) {
  if (getConnection(config).chainId !== checkout.chain.id) await switchChain(config, onLukso)
  const account = getConnection(config).address
  const value = BigInt(quote.amount)
  const { value: balance } = await getBalance(config, { ...onLukso, address: account })
  if (balance < value) throw new CheckoutError(copy.short)
  return sendTransaction(config, { ...onLukso, to: quote.to, value, data: quote.data })
}

// --- Payments this browser waits on ---

const readPending = () => {
  try {
    const list = JSON.parse(localStorage.getItem(checkout.pendingKey) ?? '[]')
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

const writePending = (list) => {
  try {
    localStorage.setItem(checkout.pendingKey, JSON.stringify(list))
  } catch {
    // Storage can be blocked; the payment still finishes from /admin
  }
}

// Kept from the first time it is seen, so a payment never finished ages out after `pendingDays`
const remember = (entry) => {
  const list = readPending()
  if (!list.some((item) => item.hash === entry.hash)) writePending([...list, entry])
}
const forget = (hash) => writePending(readPending().filter((item) => item.hash !== hash))

/** Payments made here that haven't been seen to finish, not older than `pendingDays`. */
export const pendingPayments = () => readPending().filter((item) => Date.now() - item.at < checkout.pendingDays * DAY)

// --- Following a payment ---

// Where a payment ends, for this browser: it bought the name or never will
const SETTLED = new Set(['done', 'refund', 'unpaid', 'failed', 'foreign'])
// Where the browser stops asking: settled, or waiting on something it can't hurry
const STOPPED = new Set([...SETTLED, 'blocked'])

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// Payments followed on this page now, so one is never followed twice at once
const following = new Set()

/** What a toast says of an answer about the payment for `name`: `{ message, type }`. */
export function describePayment(answer, name) {
  const reason = copy.reasons[answer.reason] ?? copy.reasons.refused
  switch (answer.status) {
    case 'done':
      return { message: fill(copy.progress.done, { name }), type: 'success' }
    case 'refund':
      return { message: fill(copy.refund, { reason, name }), type: 'error' }
    case 'blocked':
      return { message: fill(copy.blocked, { reason, name, date: formatDate(answer.until) }), type: 'warning' }
    case 'unpaid':
    case 'foreign':
      return { message: copy.unpaid, type: 'error' }
    case 'failed':
      return { message: copy.failed, type: 'error' }
    case 'pending':
      return {
        message: fill(copy.progress.pending, { name, count: Math.min(answer.confirmations ?? 0, answer.needed), needed: answer.needed }),
        type: 'loading',
      }
    default:
      return { message: fill(copy.progress.registering, { name }), type: 'loading' }
  }
}

/**
 * Follows the payment `hash` for `name` in a toast until it settles, asking the server to finish
 * it. Resolves with the last answer; `onDone` hears of a name registered.
 */
export async function followPayment({ hash, name, amount }, { onDone } = {}) {
  if (following.has(hash)) return null
  following.add(hash)
  remember({ hash, name, at: Date.now() })
  const opening = amount ? fill(copy.progress.sending, { name, amount: formatAmount(amount, checkout.coin) }) : fill(copy.progress.registering, { name })
  const progress = toast(opening, 'loading')
  const report = ({ message, type }) => {
    if (!progress.update(message, type)) toast(message, type)
  }

  const started = Date.now()
  let answer = null
  while (Date.now() - started < checkout.pollLimitMs) {
    try {
      answer = await post(checkout.claimPath, { hash })
      if (STOPPED.has(answer.status)) break
      report(describePayment(answer, name))
    } catch {
      // A hiccup on the way: the next round asks again
    }
    await sleep(checkout.pollMs)
  }

  if (answer && STOPPED.has(answer.status)) {
    report(describePayment(answer, name))
    if (SETTLED.has(answer.status)) forget(hash)
    if (answer.status === 'done') onDone?.()
  } else {
    report({ message: fill(copy.progress.slow, { name }), type: 'info' })
  }
  following.delete(hash)
  return answer
}
