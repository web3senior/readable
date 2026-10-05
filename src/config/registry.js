import abi from '@/abis/Readable.json'
import { home } from '@/config/chains'

export const registry = {
  address: process.env.NEXT_PUBLIC_READABLE_ADDRESS || null,
  chainId: home.id,
  // The block it was deployed in, where reading its events from the chain starts
  fromBlock: BigInt(process.env.NEXT_PUBLIC_READABLE_FROM_BLOCK || 0),
  abi,
  // Mirrors Readable.MAX_YEARS
  maxYears: 10,
  // Mirrors Readable.MIN_GRACE_PERIOD and MAX_GRACE_PERIOD, in days
  gracePeriod: { min: 30, max: 365 },
  // What the registry starts with, until its own `gracePeriod` is read
  gracePeriodDays: 30,
  // The ERC-721 name and symbol the contract is deployed with
  token: { name: 'Readable', symbol: 'READ' },
}

export const registryEnabled = Boolean(registry.address)

// Same order as IReadable.Validity; `status` picks the card, `reason` explains it
export const VALIDITY = [
  { status: 'available', reason: null },
  { status: 'invalid', reason: 'This namespace isn’t on the registry' },
  { status: 'paused', reason: 'Registration is paused for this namespace' },
  { status: 'invalid', reason: 'Contains characters the registry doesn’t allow' },
  { status: 'invalid', reason: 'Too short for this namespace' },
  { status: 'invalid', reason: 'Too long for this namespace' },
  { status: 'invalid', reason: 'The check digit doesn’t match. A digit may be mistyped.' },
  { status: 'reserved', reason: 'This one is reserved' },
]
