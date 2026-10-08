import { site } from '@/config/site'
import { readActivity } from '@/lib/activity'

// What happened to names lately, for the home page table
export async function GET(request) {
  try {
    const activity = await readActivity()
    const cursor = new URL(request.url).searchParams.get('cursor')
    const position = cursor ? activity.rows.findIndex((row) => row.id === cursor) : -1
    if (cursor && position === -1) return Response.json({ error: 'Unknown activity cursor' }, { status: 400 })
    const rows = activity.rows.slice(position + 1, position + 1 + site.activity.pageSize)
    const nextCursor = position + 1 + rows.length < activity.rows.length ? rows.at(-1).id : null
    return Response.json(
      { ...activity, rows, names: new Set(activity.rows.map((row) => row.tokenId)).size, nextCursor },
      { headers: { 'Cache-Control': `public, max-age=${site.activity.cacheSeconds}` } }
    )
  } catch {
    return Response.json({ error: 'The latest activity could not be read' }, { status: 502 })
  }
}
