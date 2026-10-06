/**
 * The LYX checkout, server side. A quote names the name, its holder, its price in ETH, the LYX
 * that buys it and until when; it is signed, and the buyer's payment carries it as its data, so a
 * payment says by itself what it is for and anyone holding its hash can finish it. Once LUKSO has
 * confirmed the payment, the checkout wallet registers the name for the holder with `registerFor`.
 *
 * Nothing is stored: the chains are the record. A name the holder already has makes a claim
 * finished, and a quote buys only the name it names, so a payment claimed twice buys once. Refunds
 * are the owner's, from /admin: sent here, two claims at once could each send one.
 *
 * Server-only, since it reads the checkout wallet's key.
 */

import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import {
  concat,
  createPublicClient,
  createWalletClient,
  decodeAbiParameters,
  encodeAbiParameters,
  getAddress,
  hexToBytes,
  http,
  isAddress,
  isAddressEqual,
  parseEther,
  zeroAddress,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { CHECKOUT_HEADER, checkout } from '@/config/checkout'
import { chainById, chainNameFor, rpcUrlFor } from '@/config/chains'
import { VALIDITY, registry } from '@/config/registry'
import { site } from '@/config/site'
import { sendQueue } from '@/lib/relayer'
import { revertReason } from '@/lib/revert'

const SECOND = 1000
const BPS = 10_000n
const WEI = 10n ** 18n
const { refusals, reasons } = site.checkout

const chain = chainById(registry.chainId)
// A private endpoint when there is one: public ones limit a server's address sooner than a visitor's
const transport = () => http(process.env.CHECKOUT_RPC || process.env.RELAYER_RPC || rpcUrlFor(registry.chainId))

const sameAddress = (a, b) => Boolean(a && b) && isAddress(a) && isAddress(b) && isAddressEqual(a, b)

/** A refusal worded for the buyer, with the status the route answers it with. */
export class CheckoutRefused extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

// --- Setup ---

let cached = null

/**
 * The checkout wallet, which pays for names on the registry's chain, and the address LYX is paid to
 * on LUKSO, or null while either is unset. No key for LUKSO is ever here: the LYX goes straight to
 * the owner's own address.
 */
export const checkoutSetup = () => {
  if (cached) return cached
  const key = process.env.CHECKOUT_PRIVATE_KEY?.trim()
  const receiver = process.env.CHECKOUT_LYX_RECEIVER?.trim()
  if (!key || !receiver || !registry.address) return null
  if (!isAddress(receiver)) {
    console.error('CHECKOUT_RECEIVER_INVALID')
    return null
  }
  try {
    const account = privateKeyToAccount(key.startsWith('0x') ? key : `0x${key}`)
    cached = {
      account,
      receiver: getAddress(receiver),
      // Quotes are signed with a secret derived from the key, so there is no second value to keep
      secret: createHash('sha256').update(`readable-checkout-quote:${key}`).digest(),
      reader: createPublicClient({ chain, transport: transport() }),
      wallet: createWalletClient({ account, chain, transport: transport() }),
    }
    return cached
  } catch {
    console.error('CHECKOUT_KEY_INVALID')
    return null
  }
}

// --- The LYX rate ---

async function loadRate() {
  const response = await fetch(checkout.rate.url, { headers: { accept: 'application/json' }, cache: 'no-store' })
  if (!response.ok) throw new Error(`The LYX price answered ${response.status}`)
  const entry = (await response.json())?.[checkout.rate.id]
  const at = Number(entry?.last_updated_at) * SECOND
  // A rate that stopped moving, or makes no sense, prices nothing
  if (!(entry?.eth > 0) || !(Date.now() - at <= checkout.rate.staleSeconds * SECOND)) throw new Error('The LYX price is out of date')
  return { eth: entry.eth, usd: entry.usd > 0 ? entry.usd : null, at }
}

let kept = null

/** `{ eth, usd, at }`: what one LYX is worth in ETH and dollars, and when that was so. */
export function readLyxRate() {
  if (!kept || Date.now() >= kept.until) {
    const reading = loadRate()
    kept = { reading, until: Date.now() + checkout.rate.cacheSeconds * SECOND }
    // A failed reading is not kept, so the next quote tries again
    reading.catch(() => {
      if (kept?.reading === reading) kept = null
    })
  }
  return kept.reading
}

/** The LYX that pays `price` wei of ETH at `rate` ETH a LYX, with the margin, rounded up to the step. */
export const lyxFor = (price, rate) => {
  const rateWei = parseEther(rate.toFixed(18))
  if (rateWei <= 0n) throw new Error('The LYX price is out of range')
  const raw = (price * WEI * (BPS + checkout.marginBps) + rateWei * BPS - 1n) / (rateWei * BPS)
  const { stepWei } = checkout
  return ((raw + stepWei - 1n) / stepWei) * stepWei
}

// --- Quotes ---

const QUOTE = [
  { name: 'namespaceId', type: 'uint256' },
  { name: 'label', type: 'string' },
  { name: 'to', type: 'address' },
  { name: 'years', type: 'uint256' },
  // In wei of ETH: the most the checkout wallet pays for the name
  { name: 'price', type: 'uint256' },
  // In wei of LYX: what the buyer pays
  { name: 'amount', type: 'uint256' },
  { name: 'expiresAt', type: 'uint256' },
]
const TOKEN = [...QUOTE, { name: 'mac', type: 'bytes32' }]
// Signed over the deployment too, so a quote made for another registry or receiver buys nothing here
const SIGNED = [...QUOTE, { type: 'address' }, { type: 'address' }, { type: 'uint256' }]

const valuesOf = (quote) => QUOTE.map(({ name }) => quote[name])

const macOf = (setup, quote) => {
  const message = encodeAbiParameters(SIGNED, [...valuesOf(quote), registry.address, setup.receiver, BigInt(registry.chainId)])
  return `0x${createHmac('sha256', setup.secret).update(hexToBytes(message)).digest('hex')}`
}

/** The data a payment carries: the header, then the quote and its signature. */
const encodeQuote = (setup, quote) => concat([CHECKOUT_HEADER, encodeAbiParameters(TOKEN, [...valuesOf(quote), macOf(setup, quote)])])

const HEADER = CHECKOUT_HEADER.slice(2).toLowerCase()

/**
 * The quote a payment's data carries, or null when it carries none this checkout signed. A wallet
 * may wrap the data in its own call (a Universal Profile's `execute`, its key manager's), which
 * keeps the bytes whole, so the token is found wherever it starts on a byte.
 */
export function quoteIn(setup, input) {
  const hex = typeof input === 'string' ? input.toLowerCase().replace(/^0x/, '') : ''
  for (let at = hex.indexOf(HEADER); at !== -1; at = hex.indexOf(HEADER, at + 1)) {
    if (at % 2) continue
    try {
      const values = decodeAbiParameters(TOKEN, `0x${hex.slice(at + HEADER.length)}`)
      const quote = Object.fromEntries(QUOTE.map(({ name }, index) => [name, values[index]]))
      const expected = Buffer.from(macOf(setup, quote).slice(2), 'hex')
      if (timingSafeEqual(expected, Buffer.from(values[QUOTE.length].slice(2), 'hex'))) return quote
    } catch {
      // Not a token after all; look further on
    }
  }
  return null
}

// --- The registry ---

const lookup = (setup, quote) =>
  setup.reader.readContract({ address: registry.address, abi: registry.abi, functionName: 'lookup', args: [quote.namespaceId, quote.label] })

// Why a name that isn't free can't be bought: held by someone, or what the registry says of its label
const unavailableReason = (info) => (info.owner !== zeroAddress ? 'taken' : (VALIDITY[Number(info.validity)]?.status ?? 'invalid'))

// --- LUKSO, through its explorer ---

// CHECKOUT_LUKSO_EXPLORER points at a stand-in, for a test against a local fork of LUKSO
const explorerApi = () => process.env.CHECKOUT_LUKSO_EXPLORER || checkout.explorerApi

async function explorer(path) {
  const response = await fetch(`${explorerApi()}${path}`, { headers: { accept: 'application/json' }, cache: 'no-store' })
  if (response.status === 404) return null
  if (!response.ok) throw new Error(`LUKSO’s explorer answered ${response.status}`)
  return response.json()
}

/** Whether `address` holds code on LUKSO: a Universal Profile does, and exists there alone. */
const isContractOnLukso = async (address) => (await explorer(`/addresses/${address}`))?.is_contract === true

// A smart account's payment is a call inside its transaction, which the explorer traces: what it
// sent the receiver, and from where
async function transfersInside(setup, hash) {
  const items = (await explorer(`/transactions/${hash}/internal-transactions`))?.items ?? []
  const transfers = items.filter(
    (item) => item.type === 'call' && item.success !== false && sameAddress(item.to?.hash, setup.receiver) && BigInt(item.value ?? 0) > 0n
  )
  return {
    payer: transfers[0] ? getAddress(transfers[0].from.hash) : null,
    paid: transfers.reduce((sum, item) => sum + BigInt(item.value), 0n),
  }
}

/**
 * A payment as LUKSO's explorer shows it: `state` 'pending', 'failed' or 'mined', and once mined
 * who paid the receiver how much, when, with which data and under how many blocks. Null while the
 * explorer doesn't know the transaction.
 */
async function readPayment(setup, hash) {
  const tx = await explorer(`/transactions/${hash}`)
  if (!tx) return null
  const payment = {
    hash,
    input: tx.raw_input,
    at: tx.timestamp ? Date.parse(tx.timestamp) : null,
    confirmations: Number(tx.confirmations ?? 0),
  }
  if (tx.status == null || tx.block_number == null) return { ...payment, state: 'pending' }
  if (tx.status !== 'ok') return { ...payment, state: 'failed' }
  // A wallet's own transfer pays the receiver with the transaction itself
  if (sameAddress(tx.to?.hash, setup.receiver)) return { ...payment, state: 'mined', payer: getAddress(tx.from.hash), paid: BigInt(tx.value ?? 0) }
  return { ...payment, state: 'mined', ...(await transfersInside(setup, hash)) }
}

// --- What a payment is owed ---

/**
 * Where a payment stands, from what LUKSO and the registry say now. `status`:
 *   pending   LUKSO hasn't confirmed it deep enough (`confirmations` of `needed`)
 *   ready     paid in full and in time, the name is free: it can be registered
 *   done      the name is the holder's
 *   blocked   paid in full and in time, but the registry won't sell the name now (`reason`): tried
 *             again until `until`, after which it is a refund
 *   refund    it will never buy the name (`reason`): the owner sends `paid` back to `payer`
 *   unpaid    nothing it sent reached the receiver
 *   failed    the transaction itself failed on LUKSO
 */
function verdictOf({ quote, payment, info, now = Date.now() }) {
  const until = (Number(quote.expiresAt) + checkout.claimSeconds) * SECOND
  const base = { hash: payment.hash, payer: payment.payer ?? null, paid: payment.paid ?? 0n, at: payment.at, until }
  if (payment.state === 'pending') return { ...base, status: 'pending', confirmations: 0, needed: checkout.confirmations }
  if (payment.state === 'failed') return { ...base, status: 'failed' }
  // A name its holder has is the end of it, however the rest reads
  if (sameAddress(info.owner, quote.to)) return { ...base, status: 'done' }
  if (!payment.paid) {
    // The explorer traces a smart account's transfer a little after its block
    const tracing = payment.at && now - payment.at < checkout.traceGraceSeconds * SECOND
    return tracing ? { ...base, status: 'pending', confirmations: payment.confirmations, needed: checkout.confirmations } : { ...base, status: 'unpaid' }
  }
  if (payment.paid < quote.amount) return { ...base, status: 'refund', reason: 'short' }
  if (payment.at > Number(quote.expiresAt) * SECOND) return { ...base, status: 'refund', reason: 'late' }
  if (payment.confirmations < checkout.confirmations) {
    return { ...base, status: 'pending', confirmations: payment.confirmations, needed: checkout.confirmations }
  }
  if (now > until) return { ...base, status: 'refund', reason: 'closed' }
  if (!info.available) {
    // A name someone else holds stays theirs a year at least, longer than any claim waits
    const reason = unavailableReason(info)
    return { ...base, status: reason === 'taken' ? 'refund' : 'blocked', reason }
  }
  if (info.pricePerYear * quote.years > quote.price) return { ...base, status: 'blocked', reason: 'price' }
  return { ...base, status: 'ready' }
}

// What the checkout wallet holds, and what gas costs now
const readFunds = async (setup) => {
  const [balance, gasPrice] = await Promise.all([setup.reader.getBalance({ address: setup.account.address }), setup.reader.getGasPrice()])
  return { balance, gasPrice }
}

// Whether those funds buy a name of `price`, with the gas to register it
const covers = ({ balance, gasPrice }, price) => balance >= price + gasPrice * checkout.registerGas

// The checkout wallet's sends, one after another on its nonce
const enqueue = sendQueue()

async function register(setup, quote, payment) {
  return enqueue(async () => {
    // Read again in the queue: a claim just before this one may have bought it
    const info = await lookup(setup, quote)
    const verdict = verdictOf({ quote, payment, info })
    if (verdict.status !== 'ready') return verdict

    const price = info.pricePerYear * quote.years
    if (!covers(await readFunds(setup), price)) {
      console.error('CHECKOUT_WALLET_EMPTY:', setup.account.address)
      return { ...verdict, status: 'blocked', reason: 'empty' }
    }

    let hash
    try {
      const { request } = await setup.reader.simulateContract({
        account: setup.account,
        address: registry.address,
        abi: registry.abi,
        functionName: 'registerFor',
        args: [quote.namespaceId, quote.label, quote.to, quote.years],
        value: price,
      })
      hash = await setup.wallet.writeContract(request)
    } catch (error) {
      console.error('CHECKOUT_REGISTER_REFUSED:', revertReason(error, registry.abi) ?? error?.shortMessage)
      return { ...verdict, status: 'blocked', reason: 'refused' }
    }
    try {
      const receipt = await setup.reader.waitForTransactionReceipt({ hash, timeout: checkout.receiptTimeoutMs })
      if (receipt.status === 'success') return { ...verdict, status: 'done', registration: hash }
      return { ...verdict, status: 'blocked', reason: 'refused', registration: hash }
    } catch {
      // Sent and not yet seen: the next claim finds the name the holder's
      return { ...verdict, status: 'registering', registration: hash }
    }
  })
}

// --- What the routes call ---

/** Whether the checkout takes LYX now, and where it is paid. */
export function checkoutStatus() {
  const setup = checkoutSetup()
  if (!setup) return { enabled: false }
  return { enabled: true, chainId: checkout.chain.id, receiver: setup.receiver, wallet: setup.account.address }
}

const MAX_LABEL = 256

/**
 * A signed quote for `years` of `label` under `namespaceId`, registered to `to`: the LYX to pay,
 * where, with which data, and until when. Refuses a name that isn't free and a holder that can't
 * hold a name on the registry's chain.
 */
export async function createQuote({ namespaceId, label, to, years }) {
  const setup = checkoutSetup()
  if (!setup) throw new CheckoutRefused(503, refusals.off)

  const yearCount = Number(years)
  if (!Number.isInteger(yearCount) || yearCount < 1 || yearCount > registry.maxYears) throw new CheckoutRefused(400, refusals.years)
  if (typeof label !== 'string' || !label || label.length > MAX_LABEL) throw new CheckoutRefused(400, refusals.name)
  let id
  try {
    id = BigInt(namespaceId)
  } catch {
    throw new CheckoutRefused(400, refusals.name)
  }
  if (!isAddress(to ?? '') || isAddressEqual(to, zeroAddress) || isAddressEqual(to, registry.address)) throw new CheckoutRefused(400, refusals.holder)
  const holder = getAddress(to)

  const quote = { namespaceId: id, label, to: holder, years: BigInt(yearCount) }
  const [info, holderCode, rate, funds] = await Promise.all([
    lookup(setup, quote),
    setup.reader.getCode({ address: holder }),
    readLyxRate().catch(() => null),
    readFunds(setup),
  ])
  if (!info.available) throw new CheckoutRefused(409, reasons[unavailableReason(info)])
  if (!rate) throw new CheckoutRefused(503, refusals.rate)
  // A Universal Profile lives on LUKSO alone: on the registry's chain its address answers to no one
  if (!holderCode && (await isContractOnLukso(holder))) throw new CheckoutRefused(400, refusals.profile.replace('{chain}', chainNameFor(registry.chainId)))

  quote.price = info.pricePerYear * quote.years
  if (quote.price === 0n) throw new CheckoutRefused(400, refusals.free)
  // Never take LYX for a name the checkout wallet can't buy: the payment would wait, then be refunded.
  // Quotes standing at once can still add up past it; those wait for the owner to top it up
  if (!covers(funds, quote.price)) {
    console.error('CHECKOUT_WALLET_SHORT:', setup.account.address)
    throw new CheckoutRefused(503, refusals.funds)
  }
  quote.amount = lyxFor(quote.price, rate.eth)
  quote.expiresAt = BigInt(Math.floor(Date.now() / SECOND) + checkout.quoteSeconds)

  return {
    to: setup.receiver,
    chainId: checkout.chain.id,
    data: encodeQuote(setup, quote),
    amount: quote.amount,
    price: quote.price,
    expiresAt: Number(quote.expiresAt) * SECOND,
    usd: rate.usd === null ? null : (Number(quote.amount) / 1e18) * rate.usd,
  }
}

/**
 * Finishes the payment `hash`: registers its name once LUKSO has confirmed it, and answers where
 * it stands. Anyone may ask, as often as they like: a name is bought once, for the holder its
 * quote names.
 */
export async function claimPayment(hash) {
  const setup = checkoutSetup()
  if (!setup) throw new CheckoutRefused(503, refusals.off)

  const payment = await readPayment(setup, hash)
  // Not on the explorer yet: a payment just sent takes a block or two to show
  if (!payment) return { hash, status: 'pending', confirmations: 0, needed: checkout.confirmations }
  const quote = quoteIn(setup, payment.input)
  if (!quote) return { hash, status: 'foreign' }

  const verdict = verdictOf({ quote, payment, info: await lookup(setup, quote) })
  const answer = verdict.status === 'ready' ? await register(setup, quote, payment) : verdict
  return { ...answer, quote: publicQuote(quote) }
}

// What a page shows of a quote
const publicQuote = (quote) => ({
  namespaceId: quote.namespaceId,
  label: quote.label,
  to: quote.to,
  years: Number(quote.years),
  amount: quote.amount,
  expiresAt: Number(quote.expiresAt) * SECOND,
})

// The direct payments and the smart accounts' ones the explorer lists for the receiver, by transaction
async function receivedPayments(setup) {
  const [direct, inner] = await Promise.all([
    explorer(`/addresses/${setup.receiver}/transactions?filter=to`),
    explorer(`/addresses/${setup.receiver}/internal-transactions?filter=to`),
  ])
  const byHash = new Map()
  for (const tx of direct?.items ?? []) {
    if (BigInt(tx.value ?? 0) === 0n) continue
    byHash.set(tx.hash, {
      hash: tx.hash,
      input: tx.raw_input,
      at: Date.parse(tx.timestamp),
      confirmations: Number(tx.confirmations ?? 0),
      state: tx.status === 'ok' ? 'mined' : tx.status == null ? 'pending' : 'failed',
      payer: getAddress(tx.from.hash),
      paid: BigInt(tx.value),
    })
  }
  const insideHashes = [...new Set((inner?.items ?? []).filter((item) => item.success !== false).map((item) => item.transaction_hash))]
  const inside = await Promise.all(insideHashes.filter((hash) => !byHash.has(hash)).map((hash) => readPayment(setup, hash).catch(() => null)))
  for (const payment of inside) if (payment) byHash.set(payment.hash, payment)
  return [...byHash.values()].sort((a, b) => (b.at ?? 0) - (a.at ?? 0)).slice(0, checkout.listLimit)
}

/**
 * The latest LYX the receiver took, each with where it stands: for the owner, who registers what
 * is ready and refunds what never will be. A payment that carries no quote is listed as
 * 'foreign', with what it sent.
 */
export async function listPayments() {
  const setup = checkoutSetup()
  if (!setup) throw new CheckoutRefused(503, refusals.off)

  const payments = (await receivedPayments(setup)).map((payment) => ({ payment, quote: quoteIn(setup, payment.input) }))
  const quoted = payments.filter(({ quote }) => quote)
  const infos = await setup.reader.multicall({
    contracts: quoted.map(({ quote }) => ({
      address: registry.address,
      abi: registry.abi,
      functionName: 'lookup',
      args: [quote.namespaceId, quote.label],
    })),
  })
  const infoOf = new Map(quoted.map(({ payment }, index) => [payment.hash, infos[index]]))

  const [balance, rate] = await Promise.all([setup.reader.getBalance({ address: setup.account.address }), readLyxRate().catch(() => null)])
  return {
    receiver: setup.receiver,
    wallet: setup.account.address,
    balance,
    rate,
    payments: payments.map(({ payment, quote }) => {
      const base = { hash: payment.hash, payer: payment.payer ?? null, paid: payment.paid ?? 0n, at: payment.at }
      if (!quote) return { ...base, status: 'foreign' }
      const info = infoOf.get(payment.hash)
      const verdict = info?.status === 'success' ? verdictOf({ quote, payment, info: info.result }) : { ...base, status: 'unknown' }
      return { ...verdict, quote: publicQuote(quote) }
    }),
  }
}

/** A JSON body for an answer that holds bigints: they travel as decimal strings. */
export const toJson = (value) => JSON.parse(JSON.stringify(value, (_, item) => (typeof item === 'bigint' ? item.toString() : item)))
