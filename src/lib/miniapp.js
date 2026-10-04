import { registry } from '@/config/registry'
import { site } from '@/config/site'

/**
 * The site as a Farcaster mini app (which the Base app runs too): the manifest a client reads
 * at /.well-known/farcaster.json, and the card a link to the site shows in a feed.
 */

const { miniApp, nft } = site
const url = (path) => `${site.baseUrl}${path}`

/** The `fc:miniapp` card, and the `fc:frame` one older clients read, for a link to `path`. */
export function miniAppEmbeds(path = '/') {
  const card = (type) => ({
    version: '1',
    imageUrl: url(miniApp.imagePath),
    button: {
      title: miniApp.button,
      action: { type, name: miniApp.name, url: url(path), splashImageUrl: url(miniApp.splashPath), splashBackgroundColor: nft.art.background },
    },
  })
  return { 'fc:miniapp': JSON.stringify(card('launch_miniapp')), 'fc:frame': JSON.stringify(card('launch_frame')) }
}

/**
 * The manifest. Its account association proves the domain belongs to a Farcaster account, so it
 * is signed in Farcaster's developer tools for the production domain and kept in the env.
 */
export function miniAppManifest() {
  const { FARCASTER_HEADER: header, FARCASTER_PAYLOAD: payload, FARCASTER_SIGNATURE: signature } = process.env
  return {
    ...(header && payload && signature ? { accountAssociation: { header, payload, signature } } : {}),
    miniapp: {
      version: '1',
      name: miniApp.name,
      homeUrl: site.baseUrl,
      iconUrl: url(miniApp.iconPath),
      splashImageUrl: url(miniApp.splashPath),
      splashBackgroundColor: nft.art.background,
      subtitle: miniApp.subtitle,
      description: miniApp.description,
      primaryCategory: miniApp.category,
      tags: miniApp.tags,
      tagline: miniApp.subtitle,
      heroImageUrl: url('/opengraph-image'),
      ogTitle: miniApp.name,
      ogDescription: miniApp.description,
      ogImageUrl: url('/opengraph-image'),
      requiredChains: [`eip155:${registry.chainId}`],
      requiredCapabilities: ['wallet.getEthereumProvider'],
    },
  }
}
