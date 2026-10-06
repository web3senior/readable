import { isHash } from 'viem'
import { checkout } from '@/config/checkout'
import { site } from '@/config/site'
import { CheckoutRefused, claimPayment, toJson } from '@/lib/checkout'
import { countHit, waitFor } from '@/lib/relayer'
import { visitorOf } from '@/lib/visitor'

const { refusals } = site.checkout

/**
 * Finishes a LYX payment by its LUKSO transaction hash: registers its name once LUKSO has
 * confirmed it, and answers where it stands. Safe to ask again and again; the browser polls it.
 */
export async function POST(request) {
  const visitor = visitorOf(request)
  const retryAfter = waitFor('checkout-claim', visitor, checkout.throttle.claim)
  if (retryAfter) return Response.json({ error: refusals.throttled, retryAfter }, { status: 429 })
  countHit('checkout-claim', visitor, checkout.throttle.claim)

  const { hash } = (await request.json().catch(() => null)) ?? {}
  if (!isHash(hash ?? '')) return Response.json({ error: refusals.malformed }, { status: 400 })
  try {
    return Response.json(toJson(await claimPayment(hash)))
  } catch (error) {
    if (error instanceof CheckoutRefused) return Response.json({ error: error.message }, { status: error.status })
    console.error('CHECKOUT_CLAIM_FAILED:', hash, error?.shortMessage ?? error?.message)
    return Response.json({ error: refusals.unreachable }, { status: 502 })
  }
}
