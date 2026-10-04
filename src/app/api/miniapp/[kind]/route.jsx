import { cardImage, iconImage } from '@/lib/card'

// The pictures a mini app client shows: the card in a feed (3:2), the icon and the splash
const DRAW = {
  embed: () => cardImage({ width: 1200, height: 800 }),
  icon: () => iconImage(1024),
  splash: () => iconImage(200),
}

export async function GET(_request, { params }) {
  const draw = DRAW[(await params).kind]
  return draw ? draw() : new Response('Not found', { status: 404 })
}
