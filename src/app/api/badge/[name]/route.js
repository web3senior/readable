import { site } from '@/config/site'
import { nameFromSlug } from '@/lib/namespaces'
import { escapeXml } from '@/lib/nft'
import { graphemeLength } from '@/lib/query/text'

const { badge } = site
// Each half of the badge is as wide as its text, measured the way a badge service does: an
// average width per character, fixed in the drawing by textLength so every font fits it
const CHARACTER_WIDTH = 0.6
const PAD = 10
// A name as long as the registry allows, with room for its prefix and spaces
const MAX_LENGTH = 80

const widthOf = (text) => Math.ceil(graphemeLength(text) * badge.fontSize * CHARACTER_WIDTH)

// GET /api/badge/+0-4242: "Pay me at +0 4242", to put on a site or in a README, linked by whoever
// embeds it to the name's page. Drawn from the path alone, so it never waits for the chain
export async function GET(_request, { params }) {
  const name = nameFromSlug((await params).name).trim()
  if (!name || name.length > MAX_LENGTH) return new Response('Not found', { status: 404 })

  const labelWidth = widthOf(badge.label) + PAD * 2
  const nameWidth = widthOf(name) + PAD * 2
  const width = labelWidth + nameWidth
  const { height } = badge
  const baseline = Math.round(height / 2 + badge.fontSize * 0.35)
  const text = (x, value, length, weight, ink) =>
    `<text x="${x}" y="${baseline}" text-anchor="middle" font-family="${badge.font}" font-size="${badge.fontSize}" font-weight="${weight}" fill="${ink}" textLength="${length}" lengthAdjust="spacingAndGlyphs">${escapeXml(value)}</text>`

  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXml(`${badge.label} ${name}`)}">`,
    `<title>${escapeXml(`${badge.label} ${name}`)}</title>`,
    `<clipPath id="r"><rect width="${width}" height="${height}" rx="${height / 4}"/></clipPath>`,
    '<g clip-path="url(#r)">',
    `<rect width="${labelWidth}" height="${height}" fill="${badge.labelBackground}"/>`,
    `<rect x="${labelWidth}" width="${nameWidth}" height="${height}" fill="${badge.background}"/>`,
    '</g>',
    text(labelWidth / 2, badge.label, widthOf(badge.label), 400, badge.labelInk),
    text(labelWidth + nameWidth / 2, name, widthOf(name), 700, badge.ink),
    '</svg>',
  ].join('')

  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': `public, max-age=${badge.cacheSeconds}`,
      'Access-Control-Allow-Origin': '*',
    },
  })
}
