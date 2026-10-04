import { createPublicClient, http, zeroAddress } from 'viem'
import rulesAbi from '@/abis/NameRules.json'
import { addresses } from '@/config/addresses'
import { chainById, rpcUrlFor } from '@/config/chains'
import { records } from '@/config/records'
import { registry } from '@/config/registry'
import { priceForLength, priceFromOf } from '@/lib/pricing'

let client = null
export const publicClient = () =>
  (client ??= createPublicClient({ chain: chainById(registry.chainId), transport: http(rpcUrlFor(registry.chainId)) }))

const read = (functionName, args) => publicClient().readContract({ address: registry.address, abi: registry.abi, functionName, args })

/** What names are paid in: the chain's native coin, ETH on Base. */
export const currencyOf = () => {
  const { symbol, decimals } = chainById(registry.chainId).nativeCurrency
  return { symbol, decimals }
}

export async function readRegistry() {
  return { namespaces: await read('getNamespaces'), currency: currencyOf() }
}

/** How long a name stays its holder's to renew once its term ends, in milliseconds. */
export const readGracePeriod = async () => Number(await read('gracePeriod')) * 1000

/** What the docs quote: each namespace with its prices and the grace period. */
export async function readRegistryTerms() {
  const [{ namespaces, currency }, gracePeriod] = await Promise.all([readRegistry(), read('gracePeriod')])
  const prices = await Promise.all(namespaces.map((namespace) => read('getPrices', [namespace.id])))
  return {
    currency,
    gracePeriod: Number(gracePeriod),
    namespaces: namespaces.map((namespace, index) => ({ ...namespace, prices: prices[index] })),
  }
}

/** The wallet a name reaches right now, or null: never registered, expired, or pointed nowhere. */
export async function readTarget(namespaceId, label) {
  const tokenId = await read('tokenIdOf', [namespaceId, label])
  const target = await read('resolve', [tokenId])
  return target === zeroAddress ? null : target
}

/** One name's live state, with the holder's primary name when they have set one. */
export async function readName(namespaceId, label) {
  const info = await read('lookup', [namespaceId, label])
  const owner = info.owner === zeroAddress ? null : info.owner
  // A missing primary name must not fail the card
  const primary = owner ? await read('primaryNameOf', [owner]).catch(() => null) : null
  return { ...info, owner, ownerName: primary?.[1] || null }
}

/**
 * The names `account` holds, each with where it points, its records, its addresses on other
 * chains (coin type to stored bytes) and what a renewal costs.
 */
export async function readNames(account) {
  const [tokenIds, [primaryId], { namespaces, currency }] = await Promise.all([
    read('namesOf', [account]),
    read('primaryNameOf', [account]),
    readRegistry(),
  ])
  const names = await Promise.all(tokenIds.map((tokenId) => readHeld(tokenId, namespaces, primaryId)))
  return { names, currency }
}

// A registered name as My names and its page show it
async function readHeld(tokenId, namespaces, primaryId) {
  const [record, stored, coinAddresses] = await Promise.all([
    read('recordOf', [tokenId]),
    read('text', [tokenId, records.key]),
    Promise.all(addresses.chains.map(({ coin }) => read('addr', [tokenId, BigInt(coin.coinType)]))),
  ])
  const source = namespaces.find((namespace) => namespace.id === record.namespaceId)
  // Priced as the registry prices a renewal: by the length the name was registered with,
  // whatever the name rules have become since
  const prices = await read('getPrices', [record.namespaceId])
  return {
    tokenId,
    source,
    label: record.label,
    target: record.target,
    expiresAt: Number(record.expiresAt) * 1000,
    pricePerYear: source ? priceForLength(prices, priceFromOf(source), Number(record.length)) : null,
    stored,
    addresses: Object.fromEntries(addresses.chains.map(({ coin }, index) => [coin.coinType, coinAddresses[index]])),
    primary: tokenId === primaryId,
  }
}

/**
 * One name by its namespace and label, as its page shows it: everything My names reads, its
 * holder and its editor. Null when the registry never held it; a name that expired is still answered.
 */
export async function readNamePage(namespaceId, label) {
  const tokenId = await read('tokenIdOf', [namespaceId, label])
  const [record, { namespaces, currency }] = await Promise.all([read('recordOf', [tokenId]), readRegistry()])
  if (record.namespaceId === 0n) return null
  const [owner, editor] = await Promise.all([
    read('ownerOf', [tokenId]),
    // A registry deployed before editors answers with none
    read('editorOf', [tokenId]).catch(() => zeroAddress),
  ])
  const [primaryId] = await read('primaryNameOf', [owner])
  return { name: { ...(await readHeld(tokenId, namespaces, primaryId)), owner, editor }, currency }
}

/** One registered name by its token id, or null when the registry never held it. */
export async function readToken(tokenId) {
  const record = await read('recordOf', [tokenId])
  if (record.namespaceId === 0n) return null
  const namespaces = await read('getNamespaces')
  const source = namespaces.find((namespace) => namespace.id === record.namespaceId)
  return { record, source, length: Number(record.length) }
}

// The rules the registry asks about a name, with the version they tell. Null while none are set
async function readNameRules() {
  const address = await read('nameRules')
  if (address === zeroAddress) return null
  const version = await publicClient()
    .readContract({ address, abi: rulesAbi, functionName: 'version' })
    .catch(() => null)
  return { address, version }
}

/** Everything the admin page shows: ownership, pause state, settings, balance and each namespace's curve. */
export async function readRegistryAdmin() {
  const [owner, pendingOwner, paused, gracePeriod, forwarder, treasury, baseURI, version, nameRules, { namespaces, currency }] = await Promise.all([
    read('owner'),
    read('pendingOwner'),
    read('paused'),
    read('gracePeriod'),
    read('trustedForwarder'),
    read('treasury'),
    read('baseURI'),
    read('version'),
    readNameRules(),
    readRegistry(),
  ])
  const [prices, balance] = await Promise.all([
    Promise.all(namespaces.map((namespace) => read('getPrices', [namespace.id]))),
    publicClient().getBalance({ address: registry.address }),
  ])
  return {
    owner,
    pendingOwner: pendingOwner === zeroAddress ? null : pendingOwner,
    paused,
    gracePeriod: Number(gracePeriod),
    forwarder,
    treasury: treasury === zeroAddress ? null : treasury,
    baseURI,
    version,
    nameRules,
    currency,
    balance,
    namespaces: namespaces.map((namespace, index) => ({ ...namespace, prices: prices[index] })),
  }
}
