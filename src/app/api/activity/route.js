import { site } from '@/config/site'
import { readActivity } from '@/lib/activity'

// What happened to names lately, for the home page table
export async function GET() {
  try {
    return Response.json(await readActivity(), { headers: { 'Cache-Control': `public, max-age=${site.activity.cacheSeconds}` } })
  } catch {
    return Response.json({ error: 'The latest activity could not be read' }, { status: 502 })
  }
}
