import { createPublicClient, getAddress as checksum, hexToBytes, http, zeroAddress } from 'viem'
import { btc, sol } from '@ensdomains/address-encoder/coins'
import { ETH_COIN_TYPE, KIND, RECORDS_KEY, abi, chains, registries } from './registry.js'

// Coins known by name. Any other chain: pass its coder from @ensdomains/address-encoder/coins
const COINS = { btc, sol }

// Separators people type inside phone numbers; \s takes the no-break space too
const SEPARATORS = /[\s\-().]/g
/** `+0 42421230` from `+0 4242 1230`, as the site writes numbers. A name is left as it is. */
export function formatName(name) {
  const match = /^\+(\d+)[\s-]+([\d\s-]+)$/.exec(String(name ?? '').trim())
  return match ? `+${match[1]} ${match[2].replace(SEPARATORS, '')}` : String(name ?? '')
}

const display = (namespace, label) =>
  namespace.kind === KIND.NUMBER ? formatName(`+${namespace.name} ${label}`) : `${label}.${namespace.name}`

/**
 * The namespace a typed name belongs to, and its label as the registry is asked for it:
 * `+0 4242 1230`, `0 4242 1230` and `42421230` are the number `42421230`, `Alice.arc` is
 * `alice` under `.arc`.
 */
function locateIn(namespaces, name) {
  const text = String(name ?? '').normalize('NFC').trim()

  const dot = text.lastIndexOf('.')
  if (dot > 0 && dot < text.length - 1) {
    const extension = text.slice(dot + 1).toLowerCase()
    const namespace = namespaces.find((candidate) => candidate.kind === KIND.NAME && candidate.name === extension)
    return namespace ? { namespace, label: text.slice(0, dot).toLowerCase() } : null
  }

  const compact = text.replace(SEPARATORS, '')
  if (!/^\+?\d+$/.test(compact)) return null
  const numbers = namespaces.filter((candidate) => candidate.kind === KIND.NUMBER)
  const explicit = compact.startsWith('+')
  const digits = explicit ? compact.slice(1) : compact

  // The longest prefix that fits, so +01 2345 is never read as +0 followed by 12345. Without
  // the plus only a prefix that starts with 0 is read: a number never starts with 0, so that
  // zero can only be the prefix
  const namespace = numbers
    .filter((candidate) => (explicit || candidate.name.startsWith('0')) && digits.startsWith(candidate.name) && digits.length > candidate.name.length)
    .sort((a, b) => b.name.length - a.name.length)[0]
  if (namespace) return { namespace, label: digits.slice(namespace.name.length) }
  return !explicit && numbers.length ? { namespace: numbers[0], label: compact } : null
}

/** A coin as `'btc'`, `'sol'`, `'eth'`, a coin type, or a coder from @ensdomains/address-encoder. */
function coinOf(coin) {
  if (coin && typeof coin === 'object' && typeof coin.coinType === 'number') return { coinType: coin.coinType, coder: coin }
  if (typeof coin === 'string') {
    const key = coin.toLowerCase()
    if (key === 'eth' || key === 'evm') return { coinType: ETH_COIN_TYPE }
    if (COINS[key]) return { coinType: COINS[key].coinType, coder: COINS[key] }
  }
  if (typeof coin === 'number' || typeof coin === 'bigint') {
    const coinType = Number(coin)
    return { coinType, coder: Object.values(COINS).find((coder) => coder.coinType === coinType) }
  }
  throw new TypeError(`Unknown coin ${String(coin)}: pass a coin type or a coder from @ensdomains/address-encoder/coins`)
}

const parseRecords = (text) => {
  if (!text) return {}
  try {
    const parsed = JSON.parse(text)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

/**
 * A reader of the Readable registry.
 *
 *   const readable = createReadable({ chain: baseSepolia })
 *   await readable.resolve('+0 42421230')        // '0x…', or null when it reaches nobody
 *   await readable.getAddress('+0 4242', 'btc')  // 'bc1q…'
 *   await readable.getRecords('+0 4242')         // { name, job, social: { x }, … }
 *   await readable.getName('0x…')                // '+0 42421230'
 *   await readable.getProfile('+0 4242')         // everything above in one answer
 *   await readable.getAgent('+0 247')            // { endpoint, erc8004, payment }, or null
 *
 * @param {object} [options]
 * @param {object|number} [options.chain] A viem chain or its id. Base by default.
 * @param {string} [options.registry] The registry's address, for a chain the SDK doesn't know.
 * @param {string} [options.rpc] An RPC URL. The chain's public one by default.
 * @param {object} [options.client] A viem public client to read through, in place of `rpc`.
 * @param {number} [options.cacheMs] How long the list of namespaces is kept. Five minutes by default.
 */
export function createReadable({ chain = 8453, registry, rpc, client, cacheMs = 5 * 60_000 } = {}) {
  const viemChain = typeof chain === 'object' ? chain : chains[chain]
  if (!viemChain) throw new Error(`Unknown chain ${String(chain)}: pass a viem chain`)
  const address = registry ?? registries[viemChain.id]
  if (!address) throw new Error(`Readable has no registry on ${viemChain.name} yet: pass { registry }`)

  // Reads made together go out as one multicall
  const reader = client ?? createPublicClient({ chain: viemChain, transport: http(rpc), batch: { multicall: true } })
  const read = (functionName, args) => reader.readContract({ address, abi, functionName, args })

  let namespaces = null
  let loadedAt = 0
  const loadNamespaces = () => {
    if (!namespaces || Date.now() - loadedAt > cacheMs) {
      loadedAt = Date.now()
      namespaces = read('getNamespaces').catch((error) => {
        namespaces = null
        throw error
      })
    }
    return namespaces
  }

  /** The token id of a name, and where it belongs; null for a name that can't exist. */
  async function locate(name) {
    const found = locateIn(await loadNamespaces(), name)
    if (!found) return null
    // The registry refuses a label its namespace never allows
    const tokenId = await read('tokenIdOf', [found.namespace.id, found.label]).catch(() => null)
    return tokenId === null ? null : { ...found, tokenId }
  }

  /** The wallet a name reaches, or null: never registered, expired, or pointed at nobody. */
  async function resolve(name) {
    const found = await locate(name)
    if (!found) return null
    const target = await read('resolve', [found.tokenId])
    return target === zeroAddress ? null : target
  }

  /**
   * The name's address on a chain. `'eth'` (or coin type 60) is the wallet it points to, which
   * most EVM chains use; any other coin is what the holder set for that chain. A coin with no
   * coder comes back as the stored bytes.
   */
  async function getAddress(name, coin = 'eth') {
    const { coinType, coder } = coinOf(coin)
    if (coinType === ETH_COIN_TYPE) return resolve(name)
    const found = await locate(name)
    if (!found) return null
    const bytes = await read('addr', [found.tokenId, BigInt(coinType)])
    if (bytes === '0x') return null
    if (!coder) return bytes
    try {
      return coder.encode(hexToBytes(bytes))
    } catch {
      return null
    }
  }

  /** The name's records document, `{}` when it has none, or null when the name isn't live. */
  async function getRecords(name) {
    const found = await locate(name)
    if (!found) return null
    const [record, text] = await Promise.all([read('recordOf', [found.tokenId]), read('text', [found.tokenId, RECORDS_KEY])])
    if (record.namespaceId === 0n || Number(record.expiresAt) * 1000 <= Date.now()) return null
    return parseRecords(text)
  }

  /** The primary name a wallet chose, written as the site writes it, or null. */
  async function getName(account) {
    const [tokenId, name] = await read('primaryNameOf', [checksum(account)])
    return tokenId === 0n ? null : formatName(name)
  }

  /**
   * Everything about a live name in one answer, or null when it was never registered or has
   * expired. `addresses` holds every coin the SDK knows by name.
   */
  async function getProfile(name) {
    const found = await locate(name)
    if (!found) return null
    const { tokenId, namespace } = found
    const [record, owner, target, text, ...coinBytes] = await Promise.all([
      read('recordOf', [tokenId]),
      // A name never registered has no holder, and the registry says so by reverting
      read('ownerOf', [tokenId]).catch(() => null),
      read('resolve', [tokenId]),
      read('text', [tokenId, RECORDS_KEY]),
      ...Object.values(COINS).map((coder) => read('addr', [tokenId, BigInt(coder.coinType)])),
    ])
    if (record.namespaceId === 0n || Number(record.expiresAt) * 1000 <= Date.now()) return null

    const addresses = Object.fromEntries(
      Object.entries(COINS).map(([symbol, coder], index) => {
        const bytes = coinBytes[index]
        if (bytes === '0x') return [symbol, null]
        try {
          return [symbol, coder.encode(hexToBytes(bytes))]
        } catch {
          return [symbol, null]
        }
      })
    )
    return {
      name: display(namespace, record.label),
      tokenId: tokenId.toString(),
      owner,
      address: target === zeroAddress ? null : target,
      expiresAt: Number(record.expiresAt),
      addresses,
      records: parseRecords(text),
    }
  }

  /**
   * The AI agent a name reaches, from its records: where it answers (`endpoint`), its ERC-8004
   * id, and where it is paid, which is the name's wallet unless the records name another. Null
   * when the name isn't live or names no agent.
   */
  async function getAgent(name) {
    const profile = await getProfile(name)
    const agent = profile?.records?.agent
    if (!agent || typeof agent !== 'object' || (!agent.endpoint && !agent.erc8004)) return null
    const text = (value) => (typeof value === 'string' && value ? value : null)
    return {
      name: profile.name,
      endpoint: text(agent.endpoint),
      erc8004: text(agent.erc8004),
      payment: text(agent.payment) ?? profile.address,
      address: profile.address,
    }
  }

  return { registry: address, chain: viemChain, resolve, getAddress, getRecords, getName, getProfile, getAgent }
}
