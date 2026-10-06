import { checkout } from '@/config/checkout'
import { site } from '@/config/site'
import { CheckoutRefused, checkoutStatus, createQuote, toJson } from '@/lib/checkout'
import { countHit, waitFor } from '@/lib/relayer'
import { visitorOf } from '@/lib/visitor'

const { refusals } = site.checkout

/** Whether names can be bought with LYX now, and where LYX is paid. */
export async function GET() {
  return Response.json(checkoutStatus())
}

/** A quote: the LYX that buys a name for a holder, the data the payment carries, and until when. */
export async function POST(request) {
  const visitor = visitorOf(request)
  const retryAfter = waitFor('checkout-quote', visitor, checkout.throttle.quote)
  if (retryAfter) return Response.json({ error: refusals.throttled, retryAfter }, { status: 429 })
  countHit('checkout-quote', visitor, checkout.throttle.quote)

  const body = await request.json().catch(() => null)
  try {
    return Response.json(toJson(await createQuote(body ?? {})))
  } catch (error) {
    if (error instanceof CheckoutRefused) return Response.json({ error: error.message }, { status: error.status })
    console.error('CHECKOUT_QUOTE_FAILED:', error?.shortMessage ?? error?.message)
    return Response.json({ error: refusals.unreachable }, { status: 502 })
  }
}
