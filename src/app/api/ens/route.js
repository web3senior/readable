import { isAddress, isHex } from 'viem'
import { registryEnabled } from '@/config/registry'
import { GatewayError, answer } from '@/lib/ens'

// POST /api/ens with { sender, data }: how a CCIP-Read client asks when the URL names no {data}
const OPEN = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type' }

export function OPTIONS() {
  return new Response(null, { status: 204, headers: { ...OPEN, 'Access-Control-Allow-Methods': 'POST, OPTIONS' } })
}

export async function POST(request) {
  const { sender, data } = (await request.json().catch(() => null)) ?? {}
  if (!registryEnabled) return Response.json({ message: 'No registry is configured yet' }, { status: 503, headers: OPEN })
  if (!isAddress(sender ?? '') || !isHex(data ?? '')) return Response.json({ message: 'Malformed request' }, { status: 400, headers: OPEN })
  try {
    return Response.json({ data: await answer(sender, data) }, { headers: OPEN })
  } catch (error) {
    const status = error instanceof GatewayError ? error.status : 502
    if (!(error instanceof GatewayError)) console.error('ENS_GATEWAY_FAILED:', error?.shortMessage ?? error?.message)
    return Response.json({ message: error instanceof GatewayError ? error.message : 'The registry could not be read' }, { status, headers: OPEN })
  }
}
