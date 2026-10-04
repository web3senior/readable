import { miniAppManifest } from '@/lib/miniapp'

// Served at /.well-known/farcaster.json (a rewrite in next.config.mjs), where Farcaster and the
// Base app look for it
export function GET() {
  return Response.json(miniAppManifest(), { headers: { 'Cache-Control': 'public, max-age=300', 'Access-Control-Allow-Origin': '*' } })
}
