import { decodeFunctionData, getAddress, isAddressEqual, zeroAddress } from 'viem'
import forwarderAbi from '@/abis/Forwarder.json'
import { registry, registryEnabled } from '@/config/registry'
import { site } from '@/config/site'
import { readEvents, readPaymentsInside } from '@/lib/events'
import { displayName, namePath, toNamespace } from '@/lib/namespaces'
import { publicClient, readRegistry } from '@/lib/registry'

const { limit, cacheSeconds } = site.activity

// What a name went through, in the order that wins when one transaction did several things to it:
// a registration also mints, and a transfer also re-points the name and drops a primary name
const EVENTS = ['NameRegistered', 'NameRenewed', 'Transfer', 'EditorChanged', 'TargetChanged', 'TextChanged', 'AddressChanged', 'PrimaryNameChanged']
const rank = (event) => EVENTS.indexOf(event.eventName)

// A mint comes with its registration and a burn with the next one; a primary name dropped is
// told by the transfer that dropped it
const counts = (event) =>
  event.eventName === 'Transfer'
    ? !isAddressEqual(event.from, zeroAddress) && !isAddressEqual(event.to, zeroAddress)
    : event.eventName !== 'PrimaryNameChanged' || event.tokenId !== 0n

/** One entry for each name a transaction touched, the most telling of its events, newest first. */
function group(events) {
  const entries = new Map()
  for (const event of events) {
    if (!counts(event)) continue
    const key = `${event.hash}:${event.tokenId}`
    const kept = entries.get(key)
    if (!kept || rank(event) < rank(kept)) entries.set(key, event)
  }
  return [...entries.values()]
}

/**
 * Who sent a change: the caller when it called the registry, the signer when the relayer
 * brought it through the forwarder, and null from inside a smart account, whose call can't be
 * read from the transaction.
 */
function senderOf(transaction) {
  if (!transaction.to) return null
  if (isAddressEqual(transaction.to, registry.address)) return transaction.from
  try {
    const { functionName, args } = decodeFunctionData({ abi: forwarderAbi, data: transaction.input })
    const requests = functionName === 'execute' ? [args[0]] : functionName === 'executeBatch' ? args[0] : []
    return requests.find((request) => isAddressEqual(request.to, registry.address))?.from ?? null
  } catch {
    return null
  }
}

const PURCHASES = new Set(['NameRegistered', 'NameRenewed'])

const callsRegistry = (transaction) => Boolean(transaction.to) && isAddressEqual(transaction.to, registry.address)

const isGrant = (transaction) => {
  try {
    return callsRegistry(transaction) && decodeFunctionData({ abi: registry.abi, data: transaction.input }).functionName === 'adminRegister'
  } catch {
    return false
  }
}

/**
 * What a registration or renewal paid: the ETH sent with the call, or, from inside a smart
 * account, whose transaction carries no value, what the explorer saw reach the registry. Several
 * purchases in one transaction take its payments in the order they ran. Null when that can't
 * be told.
 */
async function paidFor(event, transaction, events, paymentsInside) {
  if (callsRegistry(transaction)) return transaction.value
  const purchases = events.filter((each) => each.hash === event.hash && PURCHASES.has(each.eventName)).sort((a, b) => a.index - b.index)
  const payments = await paymentsInside().catch(() => [])
  return payments.length === purchases.length ? payments[purchases.indexOf(event)] : null
}

/** The kind of an entry as `site.activity.kinds` names it, the wallet it shows and what was paid. */
async function describe(event, transaction, holder, paid) {
  switch (event.eventName) {
    case 'NameRegistered':
      if (isGrant(transaction)) return { kind: 'granted', wallet: event.owner, paid: null }
      return { kind: 'bought', wallet: event.owner, paid: await paid() }
    case 'NameRenewed':
      return { kind: 'renewed', wallet: senderOf(transaction) ?? (await holder()), paid: await paid() }
    case 'Transfer':
      return { kind: 'transferred', wallet: event.to, paid: null }
    case 'PrimaryNameChanged':
      return { kind: 'primary', wallet: event.account, paid: null }
    case 'EditorChanged':
      return { kind: isAddressEqual(event.editor, zeroAddress) ? 'editorRemoved' : 'editor', wallet: senderOf(transaction) ?? (await holder()), paid: null }
    default: {
      const kind = { TargetChanged: 'target', TextChanged: 'records', AddressChanged: 'addresses' }[event.eventName]
      return { kind, wallet: senderOf(transaction) ?? (await holder()), paid: null }
    }
  }
}

const read = (functionName, args) => publicClient().readContract({ address: registry.address, abi: registry.abi, functionName, args })

async function loadActivity() {
  const [events, { namespaces, currency }] = await Promise.all([readEvents(EVENTS), readRegistry()])
  const grouped = group(events)
  const entries = grouped.slice(0, limit)

  // One reading of each transaction and each name, however many entries share it
  const once = (cache, key, load) => cache.get(key) ?? cache.set(key, load()).get(key)
  const transactions = new Map()
  const records = new Map()
  const blocks = new Map()
  const insides = new Map()

  const rows = await Promise.all(
    entries.map(async (event) => {
      const [transaction, record] = await Promise.all([
        once(transactions, event.hash, () => publicClient().getTransaction({ hash: event.hash })),
        event.eventName === 'NameRegistered'
          ? { namespaceId: event.namespaceId, label: event.label }
          : once(records, event.tokenId, () => read('recordOf', [event.tokenId])),
      ])
      const source = namespaces.find((namespace) => namespace.id === record.namespaceId)
      if (!source) return null
      const namespace = toNamespace(source, { chainId: registry.chainId })
      // The holder now, for a change whose sender can't be read: almost always the one who made it
      const holder = () => read('ownerOf', [event.tokenId])
      const paid = () => paidFor(event, transaction, events, () => once(insides, event.hash, () => readPaymentsInside(event.hash)))
      const { kind, wallet, paid: amount } = await describe(event, transaction, holder, paid)
      const at = event.at ?? Number((await once(blocks, event.block, () => publicClient().getBlock({ blockNumber: event.block }))).timestamp) * 1000
      return {
        id: `${event.hash}:${event.tokenId}`,
        kind,
        name: displayName(namespace, record.label),
        path: namePath(namespace, record.label),
        wallet: getAddress(wallet),
        paid: amount === null ? null : String(amount),
        hash: event.hash,
        at,
      }
    })
  )

  return { rows: rows.filter(Boolean), total: grouped.length, currency: { symbol: currency.symbol, decimals: currency.decimals } }
}

let kept = null

/**
 * What happened to names lately, newest first: bought, granted, renewed, transferred, and each
 * change a holder or its editor made. One reading serves every visitor for `cacheSeconds`.
 */
export function readActivity() {
  if (!registryEnabled) return Promise.resolve({ rows: [], total: 0, currency: null })
  if (!kept || Date.now() >= kept.until) {
    const reading = loadActivity()
    kept = { reading, until: Date.now() + cacheSeconds * 1000 }
    // A failed reading is not kept, so the next visitor tries again
    reading.catch(() => {
      if (kept?.reading === reading) kept = null
    })
  }
  return kept.reading
}
