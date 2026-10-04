import { site } from '@/config/site'
import { cardImage } from '@/lib/card'
import { nameFromSlug } from '@/lib/namespaces'

export const alt = `A name on ${site.name}`
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

// Drawn from the path alone, so a link preview never waits for the chain
export default async function Image({ params }) {
  return cardImage({ name: nameFromSlug((await params).name), ...size })
}
