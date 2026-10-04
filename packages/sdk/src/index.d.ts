import type { Address, Chain, Hex, PublicClient } from 'viem'

/** A coder from @ensdomains/address-encoder/coins. */
export interface CoinCoder {
  coinType: number
  encode: (bytes: Uint8Array) => string
  decode: (text: string) => Uint8Array
}

/** `'eth'` (the wallet a name points to), `'btc'`, `'sol'`, a SLIP-44 coin type, or a coder. */
export type Coin = 'eth' | 'evm' | 'btc' | 'sol' | number | bigint | CoinCoder

/** A name's records document. Every field is optional, and other apps may add their own. */
export interface Records {
  v?: number
  avatar?: string
  name?: string
  job?: string
  about?: string
  email?: string
  url?: string
  location?: string
  birthday?: string
  /** `up` is a LUKSO Universal Profile's address, as its holder wrote it. */
  social?: { x?: string; telegram?: string; github?: string; hup?: string; up?: string; [network: string]: string | undefined }
  agent?: { endpoint?: string; erc8004?: string; payment?: string }
  proofs?: { [network: string]: string | undefined }
  [key: string]: unknown
}

export interface Profile {
  /** The name as the site writes it: `+0 42421230` or `alice.arc`. */
  name: string
  tokenId: string
  owner: Address | null
  /** The wallet the name reaches, which most EVM chains use. */
  address: Address | null
  /** When the name's term ends, in seconds. */
  expiresAt: number
  addresses: { btc: string | null; sol: string | null }
  records: Records
}

export interface Agent {
  name: string
  endpoint: string | null
  erc8004: string | null
  /** Where the agent is paid: its own payment address, or the name's wallet. */
  payment: Address | null
  address: Address | null
}

export interface ReadableOptions {
  /** A viem chain or its id. Base by default. */
  chain?: Chain | number
  /** The registry's address, for a chain the SDK doesn't know. */
  registry?: Address
  /** An RPC URL. The chain's public one by default. */
  rpc?: string
  /** A viem public client to read through, in place of `rpc`. */
  client?: PublicClient
  /** How long the list of namespaces is kept, in milliseconds. Five minutes by default. */
  cacheMs?: number
}

export interface Readable {
  registry: Address
  chain: Chain
  /** The wallet a name reaches, or null: never registered, expired, or pointed at nobody. */
  resolve(name: string): Promise<Address | null>
  /** The name's address on a chain, or null. A coin with no coder comes back as the stored bytes. */
  getAddress(name: string, coin?: Coin): Promise<string | Hex | null>
  /** The name's records, `{}` when it has none, or null when the name isn't live. */
  getRecords(name: string): Promise<Records | null>
  /** The primary name a wallet chose, written as the site writes it, or null. */
  getName(account: Address): Promise<string | null>
  /** Everything about a live name in one answer, or null. */
  getProfile(name: string): Promise<Profile | null>
  /** The AI agent a name reaches, or null when it isn't live or names no agent. */
  getAgent(name: string): Promise<Agent | null>
}

export function createReadable(options?: ReadableOptions): Readable

/** `+0 42421230` from `+0 4242 1230`, as the site writes numbers. A name is left as it is. */
export function formatName(name: string): string
