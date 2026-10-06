import { checkout } from '@/config/checkout'
import { site } from '@/config/site'
import { CheckoutRefused, listPayments, toJson } from '@/lib/checkout'
import { countHit, waitFor } from '@/lib/relayer'
import { visitorOf } from '@/lib/visitor'

const { refusals } = site.checkout

/** The latest LYX payments and where each stands, for the owner on /admin. Public, like the chains it reads. */
export async function GET(request) {
  const visitor = visitorOf(request)
  const retryAfter = waitFor('checkout-payments', visitor, checkout.throttle.payments)
  if (retryAfter) return Response.json({ error: refusals.throttled, retryAfter }, { status: 429 })
  countHit('checkout-payments', visitor, checkout.throttle.payments)

  try {
    return Response.json(toJson(await listPayments()))
  } catch (error) {
    if (error instanceof CheckoutRefused) return Response.json({ error: error.message }, { status: error.status })
    console.error('CHECKOUT_PAYMENTS_FAILED:', error?.shortMessage ?? error?.message)
    return Response.json({ error: refusals.unreachable }, { status: 502 })
  }
}
