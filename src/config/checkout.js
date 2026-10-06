import { lukso } from 'viem/chains'

/**
 * Buying a name with LYX: the buyer pays on LUKSO, the server's checkout wallet then registers the
 * name for them on the registry's chain with `registerFor`, paying its price in ETH. No bridge: the
 * LYX goes to the owner's own address on LUKSO, the ETH comes from the checkout wallet. Shared by
 * the browser and the routes.
 */

const MINUTE = 60_000

export const checkout = {
  path: '/api/checkout',
  claimPath: '/api/checkout/claim',
  paymentsPath: '/api/checkout/payments',

  chain: lukso,
  coin: { symbol: 'LYX', decimals: 18 },
  // LUKSO's Blockscout answers a server, and its public RPC turns a busy one away, so every read
  // on LUKSO goes through it: a payment, the transfers inside a smart account's, and whether an
  // address is a contract there
  explorerApi: 'https://explorer.execution.mainnet.lukso.network/api/v2',

  // LYX in ETH, kept for every quote of the next `cacheSeconds`. Older than `staleSeconds`, no quote
  rate: {
    url: 'https://api.coingecko.com/api/v3/simple/price?ids=lukso-token-2&vs_currencies=eth,usd&include_last_updated_at=true',
    id: 'lukso-token-2',
    cacheSeconds: 60,
    staleSeconds: 900,
  },
  // Over the rate, in basis points: the rate moves while a quote stands, and the LYX is sold later
  marginBps: 300n,
  // A quote is rounded up to a hundredth of a LYX
  stepWei: 10n ** 16n,

  // A quote holds this long; a payment made later buys nothing and is refunded
  quoteSeconds: 900,
  // The browser asks again rather than pay a quote with less than this left
  quoteFloorSeconds: 120,
  // A payment is registered within this long of its quote's end, or never: past it, a refund can't
  // race a registration
  claimSeconds: 86_400,
  // LUKSO blocks a payment waits under before the name is bought, `blockSeconds` each
  confirmations: 12,
  blockSeconds: 12,
  // A smart account's transfer the explorer still doesn't show this long after the block is no payment
  traceGraceSeconds: 600,

  // The browser asks how a payment is doing this often, and stops after `pollLimitMs`; what is
  // left finishes on the buyer's next visit, or from /admin
  pollMs: 4000,
  pollLimitMs: 15 * MINUTE,
  // Payments this browser made and hasn't seen finish, kept to finish on a later visit
  pendingKey: 'readable:checkout',
  pendingDays: 2,

  // Requests one visitor makes in a window, per server instance: a brake, not a security boundary
  throttle: {
    quote: { windowMs: MINUTE, max: 20 },
    claim: { windowMs: MINUTE, max: 60 },
    payments: { windowMs: MINUTE, max: 10 },
  },

  // Gas the checkout wallet keeps aside for one registration, over its price
  registerGas: 400_000n,
  // How long the route waits for a registration to land before answering
  receiptTimeoutMs: 60_000,
  // The payments /admin lists, newest first
  listLimit: 50,
}

/**
 * Where a checkout token starts in a payment's data. Four zero bytes first: a Universal Profile
 * takes value with data only when the data opens with an empty selector (LSP17's graffiti), so the
 * owner's address on LUKSO may be a profile. Then "RDBL" and the format's version.
 */
export const CHECKOUT_HEADER = '0x000000005244424c01'
