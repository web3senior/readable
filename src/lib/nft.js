import { KIND } from '@/config/namespaces'
import { registry, registryEnabled } from '@/config/registry'
import { site } from '@/config/site'
import { displayName, toNamespace } from '@/lib/namespaces'
import { graphemeLength } from '@/lib/query/text'
import { readToken } from '@/lib/registry'
import { searchLink } from '@/lib/searchLink'

const { nft } = site
// A uint256 has at most 78 decimal digits
const TOKEN_ID = /^\d{1,78}$/

const XML_ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }
export const escapeXml = (value) => value.replace(/[&<>"']/g, (char) => XML_ENTITIES[char])

/** Open to every origin, since wallets and marketplaces read this from their own pages. */
export const nftHeaders = (contentType) => ({
  'Content-Type': contentType,
  'Cache-Control': `public, max-age=${nft.cacheSeconds}`,
  'Access-Control-Allow-Origin': '*',
})

export const notFound = () => new Response('Not found', { status: 404 })

export const tokenPath = (tokenId) => `${site.baseUrl}${nft.path}/${tokenId}`

/** The name behind a token id from the URL, or null when it isn't one the registry holds. */
export async function readNft(param) {
  if (!registryEnabled || !TOKEN_ID.test(param)) return null
  const tokenId = BigInt(param)
  const token = await readToken(tokenId).catch(() => null)
  if (!token?.source) return null

  const namespace = toNamespace(token.source, { chainId: registry.chainId })
  return { tokenId, namespace, name: displayName(namespace, token.record.label), length: token.length, record: token.record }
}

/** The ERC-721 metadata document wallets and marketplaces read. */
export const nftMetadata = ({ tokenId, namespace, name, length, record }) => ({
  name,
  description: nft.description.replaceAll('{name}', name),
  image: `${tokenPath(tokenId)}/image`,
  external_url: searchLink(name),
  attributes: [
    { trait_type: nft.traits.kind, value: nft.kinds[namespace.kind === KIND.NUMBER ? 'number' : 'name'] },
    { trait_type: nft.traits.length, display_type: 'number', value: length },
    { trait_type: nft.traits.registered, display_type: 'date', value: Number(record.registeredAt) },
    { trait_type: nft.traits.expires, display_type: 'date', value: Number(record.expiresAt) },
  ],
})

/** The name on the brand color, with the site's name beneath it. */
export function nftImage({ name }) {
  const { size, radius, background, ink, font, weight, brandSize, brandOpacity, steps } = nft.art
  const characters = graphemeLength(name)
  const fontSize = steps.find((step) => characters <= step.length).size
  const center = size / 2

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">`,
    `<rect width="${size}" height="${size}" rx="${radius}" fill="${background}"/>`,
    `<text x="${center}" y="${center}" dominant-baseline="central" text-anchor="middle" font-family="${font}" font-weight="${weight}" font-size="${fontSize}" fill="${ink}">${escapeXml(name)}</text>`,
    `<text x="${center}" y="${size - radius}" text-anchor="middle" font-family="${font}" font-size="${brandSize}" fill="${ink}" fill-opacity="${brandOpacity}">${escapeXml(site.name)}</text>`,
    '</svg>',
  ].join('')
}
