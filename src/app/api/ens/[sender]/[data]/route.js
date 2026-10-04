import { isAddress, isHex } from 'viem'
import { registryEnabled } from '@/config/registry'
import { GatewayError, answer } from '@/lib/ens'

// GET /api/ens/{sender}/{data}.json, the URL template the resolver contract names (EIP-3668)
const OPEN = { 'Access-Control-Allow-Origin': '*' }

export async function GET(_request, { params }) {
  const { sender, data: raw } = await params
  const data = raw.replace(/\.json$/, '')
  if (!registryEnabled) return Response.json({ message: 'No registry is configured yet' }, { status: 503, headers: OPEN })
  if (!isAddress(sender) || !isHex(data)) return Response.json({ message: 'Malformed request' }, { status: 400, headers: OPEN })
  try {
    return Response.json({ data: await answer(sender, data) }, { headers: { ...OPEN, 'Cache-Control': 'public, max-age=60' } })
  } catch (error) {
    const status = error instanceof GatewayError ? error.status : 502
    if (!(error instanceof GatewayError)) console.error('ENS_GATEWAY_FAILED:', error?.shortMessage ?? error?.message)
    return Response.json({ message: error instanceof GatewayError ? error.message : 'The registry could not be read' }, { status, headers: OPEN })
  }
}
