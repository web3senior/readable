import { site } from '@/config/site'
import { readEthUsd } from '@/lib/ethUsd'

// Dollars for one ETH, for the value shown beside a price
export async function GET() {
  try {
    return Response.json(await readEthUsd(), { headers: { 'Cache-Control': `public, max-age=${site.usd.cacheSeconds}` } })
  } catch {
    return Response.json({ usd: null, error: 'The ETH price could not be read' }, { status: 502 })
  }
}
