import { registryEnabled } from '@/config/registry'
import { handleMessage } from '@/lib/mcp'

// MCP over Streamable HTTP, stateless: each POST carries JSON-RPC and is answered in JSON. There
// is no event stream to open with GET, and no session to end with DELETE

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept, Mcp-Protocol-Version, Mcp-Session-Id, Authorization',
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS })
}

export function GET() {
  return new Response('This MCP server answers POST requests only.', { status: 405, headers: { ...CORS, Allow: 'POST, OPTIONS' } })
}

export async function POST(request) {
  if (!registryEnabled) return Response.json({ jsonrpc: '2.0', id: null, error: { code: -32603, message: 'No registry is configured yet' } }, { status: 503, headers: CORS })

  const body = await request.json().catch(() => undefined)
  if (body === undefined) return Response.json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }, { status: 400, headers: CORS })

  // Older clients may send a batch
  const messages = Array.isArray(body) ? body : [body]
  const answers = (await Promise.all(messages.map(handleMessage))).filter(Boolean)
  // Notifications and responses alone are accepted with no body
  if (answers.length === 0) return new Response(null, { status: 202, headers: CORS })
  return Response.json(Array.isArray(body) ? answers : answers[0], { headers: CORS })
}
