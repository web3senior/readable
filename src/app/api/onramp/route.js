import { generateJwt } from '@coinbase/cdp-sdk/auth'
import { getAddress, isAddress } from 'viem'
import { onrampNetworkFor } from '@/config/chains'
import { registry } from '@/config/registry'
import { readRegistry } from '@/lib/registry'

// Coinbase's onramp sells coins by card and sends them to the wallet named here. A session is
// started with a single-use token that only a server holding a CDP key can ask for, so the key
// never reaches the browser. It can only send coins to the address the visitor gives, so it
// needs no guard beyond that.

const TOKEN_HOST = 'api.developer.coinbase.com'
const TOKEN_PATH = '/onramp/v1/token'
const BUY_URL = 'https://pay.coinbase.com/buy/select-asset'

// An EC key pasted into an env file often carries its line breaks as \n
const secret = () => process.env.CDP_API_KEY_SECRET?.replace(/\\n/g, '\n').trim()

const network = onrampNetworkFor(registry.chainId)
const enabled = () => Boolean(network && process.env.CDP_API_KEY_ID && secret())

/** Whether this site can sell coins by card on the registry's chain. */
export function GET() {
  return Response.json({ enabled: enabled() })
}

/** A link that opens Coinbase's onramp, set to send the payment token to `address`. */
export async function POST(request) {
  if (!enabled()) return Response.json({ error: 'Buying by card is not set up.' }, { status: 503 })
  const { address } = (await request.json().catch(() => null)) ?? {}
  if (!isAddress(address ?? '')) return Response.json({ error: 'That is not an address.' }, { status: 400 })

  try {
    const { currency } = await readRegistry()
    const asset = currency.symbol
    const jwt = await generateJwt({
      apiKeyId: process.env.CDP_API_KEY_ID,
      apiKeySecret: secret(),
      requestMethod: 'POST',
      requestHost: TOKEN_HOST,
      requestPath: TOKEN_PATH,
    })
    const response = await fetch(`https://${TOKEN_HOST}${TOKEN_PATH}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ addresses: [{ address: getAddress(address), blockchains: [network] }], assets: [asset] }),
      cache: 'no-store',
    })
    const body = await response.json().catch(() => ({}))
    if (!response.ok || !body.token) {
      console.error('ONRAMP_TOKEN_FAILED:', response.status, body?.message ?? body?.error)
      return Response.json({ error: 'Coinbase did not start a session.' }, { status: 502 })
    }
    const url = new URL(BUY_URL)
    url.search = new URLSearchParams({ sessionToken: body.token, defaultNetwork: network, defaultAsset: asset }).toString()
    return Response.json({ url: url.href })
  } catch (error) {
    console.error('ONRAMP_FAILED:', error?.message)
    return Response.json({ error: 'Coinbase could not be reached.' }, { status: 502 })
  }
}
