import { ImageResponse } from 'next/og'
import { site } from '@/config/site'
import { graphemeLength } from '@/lib/query/text'

/**
 * The picture a shared link shows: the name large on the brand color, as the NFT draws it, with
 * the site's name and tagline. An image can't read CSS variables, so its colors are the NFT's.
 */

const { background, ink, brandOpacity } = site.nft.art

// The name shrinks as it grows, from the width of the card
const sizeFor = (name, width) => {
  const characters = graphemeLength(name)
  if (characters <= 12) return Math.round(width / 10)
  if (characters <= 24) return Math.round(width / 15)
  return Math.round(width / 22)
}

// The mark of src/app/icon.svg, on a 64-unit square
const MARK = { r: 'M22 46V24h7v4.2c1.6-3.1 4.3-4.7 8-4.7v7.1c-5 0-8 1.9-8 6.6V46z', dot: { cx: 44, cy: 42, r: 4.5 } }

/** The app icon as a square PNG of `size`, edge to edge: a store draws its own corners. */
export function iconImage(size) {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', background }}>
        <svg viewBox="0 0 64 64" width={size} height={size}>
          <path d={MARK.r} fill={ink} />
          <circle cx={MARK.dot.cx} cy={MARK.dot.cy} r={MARK.dot.r} fill={ink} />
        </svg>
      </div>
    ),
    { width: size, height: size }
  )
}

/** `name` on a card of `width` by `height`, as a PNG response. Without a name, the site's own card. */
export function cardImage({ name, width, height }) {
  const pad = Math.round(width / 18)
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: pad,
          background,
          color: ink,
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', fontSize: Math.round(width / 34), fontWeight: 700, opacity: brandOpacity }}>{site.name}</div>
        <div style={{ display: 'flex', fontSize: sizeFor(name ?? site.name, width), fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
          {name ?? site.tagline}
        </div>
        <div style={{ display: 'flex', fontSize: Math.round(width / 40), opacity: brandOpacity }}>{name ? site.tagline : site.subtitle}</div>
      </div>
    ),
    { width, height }
  )
}
