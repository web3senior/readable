import { site } from '@/config/site'
import { readAgents } from '@/lib/agents'

// The names that reach an AI agent, for the directory and for any app. Open to every origin
export async function GET() {
  try {
    return Response.json(await readAgents(), {
      headers: { 'Cache-Control': `public, max-age=${site.agents.cacheSeconds}`, 'Access-Control-Allow-Origin': '*' },
    })
  } catch {
    return Response.json({ error: 'The agents could not be read' }, { status: 502, headers: { 'Access-Control-Allow-Origin': '*' } })
  }
}
