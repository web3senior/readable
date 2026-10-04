import { site } from '@/config/site'
import { cardImage } from '@/lib/card'

export const alt = site.tagline
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

// The site's own card, for every page without one of its own
export default function Image() {
  return cardImage(size)
}
