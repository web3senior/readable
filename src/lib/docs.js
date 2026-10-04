import { home } from '@/config/chains'
import { KIND, previewNamespaces } from '@/config/namespaces'
import { registry, registryEnabled } from '@/config/registry'
import { formatAmount, formatPrice } from '@/lib/format'
import { toNamespace } from '@/lib/namespaces'

const DAY_SECONDS = 86_400
// The page is written in English, so its prices are too
const LOCALE = 'en'

const stageOf = () => {
  if (!registryEnabled) return 'preview'
  return home.testnet ? 'testnet' : 'live'
}

/** How far along the registry is: previewed, rehearsed on a test network, or live. */
export const stage = stageOf()

/**
 * A namespace's price list as rows: one per length, the last standing for every longer label
 * when the namespace allows longer ones.
 */
const tiersOf = ({ rules }, prices, format) =>
  prices
    .map((price, index) => ({ length: rules.priceFrom + index, price: format(price) }))
    .filter((tier) => tier.length >= rules.minLength && tier.length <= rules.maxLength)
    .map((tier, index, tiers) => ({ ...tier, andLonger: index === tiers.length - 1 && tier.length < rules.maxLength }))

/** The number namespace the page writes its numbers in: the one the registry launches with. */
export const launchNumbers = toNamespace(previewNamespaces.find((source) => source.kind === KIND.NUMBER))

/** What the site previews before a registry is configured, and what stands in until one answers. */
export const launchFacts = {
  live: false,
  gracePeriodDays: registry.gracePeriodDays,
  namespaces: previewNamespaces.map((source) => {
    const namespace = toNamespace(source)
    return { ...namespace, tiers: tiersOf(namespace, source.prices, (price) => formatPrice(price, source.currency, LOCALE)) }
  }),
}

/** The same facts as the registry states them, from `readRegistryTerms`. */
export const registryFacts = ({ namespaces, currency, gracePeriod }) => ({
  live: true,
  gracePeriodDays: Math.round(gracePeriod / DAY_SECONDS),
  namespaces: namespaces
    .map((source) => {
      const namespace = toNamespace(source, { chainId: registry.chainId, currency })
      return { ...namespace, tiers: tiersOf(namespace, source.prices, (price) => formatAmount(price, currency, LOCALE)) }
    })
    // A registry of another version can hold a kind this site has no words for
    .filter((namespace) => namespace.kind),
})

export const extensionsOf = (facts) => facts.namespaces.filter((namespace) => namespace.kind === KIND.NAME)
