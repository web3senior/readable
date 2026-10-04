import { KIND, KIND_BY_INDEX, kindDefaults } from '@/config/namespaces'
import { site } from '@/config/site'
import { priceFromOf } from '@/lib/pricing'
import { formatNumber } from '@/lib/query/numbers'

const fill = (value, name) => (typeof value === 'string' ? value.replaceAll('{name}', name) : value)

// Metadata is owner-written JSON; anything unreadable falls back to the kind's defaults
const parseMetadata = (metadata) => {
  if (!metadata) return {}
  try {
    const parsed = JSON.parse(metadata)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

/**
 * One namespace in the shape the app searches with, built from a preview entry or from the
 * registry's `getNamespaces()` (numeric kind, bigint id, metadata JSON).
 */
export function toNamespace(source, { chainId, currency } = {}) {
  const kind = typeof source.kind === 'number' ? KIND_BY_INDEX[source.kind] : source.kind
  const { name } = source
  const defaults = kindDefaults[kind] ?? {}
  const meta = parseMetadata(source.metadata)
  const about = meta.about ?? defaults.about
  const checkDigitFrom = Number(source.checkDigitFrom ?? 0)
  const live = typeof source.id === 'bigint'

  return {
    id: String(source.id),
    onchainId: live ? source.id : null,
    kind,
    name,
    label: fill(meta.label ?? defaults.label, name),
    title: fill(meta.title ?? defaults.title, name),
    noun: defaults.noun,
    examples: (defaults.examples ?? []).map((example) => fill(example, name)),
    exampleLengths: defaults.exampleLengths ?? [],
    suffix: kind === KIND.NAME ? `.${name}` : undefined,
    prefix: kind === KIND.NUMBER ? `+${name}` : undefined,
    chainId: source.chainId ?? chainId,
    provider: source.provider ?? 'readable',
    paused: Boolean(source.paused),
    rules: {
      minLength: Number(source.minLength),
      priceFrom: priceFromOf(source),
      maxLength: Number(source.maxLength),
      checkDigit: checkDigitFrom ? { algorithm: 'luhn', fromLength: checkDigitFrom } : null,
    },
    preview: live ? null : { currency: source.currency, prices: source.prices },
    currency: currency ?? null,
    about: about
      ? { title: fill(about.title, name), body: (about.body ?? []).map((paragraph) => fill(paragraph, name)), learnMoreUrl: about.learnMoreUrl }
      : null,
  }
}

/** A stored label as the site writes it: `+0 42421230` or `alice.arc`. */
export const displayName = (namespace, label) =>
  namespace.kind === KIND.NUMBER ? formatNumber(label, namespace) : `${label}${namespace.suffix ?? ''}`

/** The page of a name: `/names/+0-42421230` or `/names/alice.arc`, what the search reads back. */
export const namePath = (namespace, label) => `${site.names.path}/${displayName(namespace, label).replaceAll(' ', '-')}`

/**
 * The name a page's path segment stands for, as the site writes it: `+0-42421230`, and an older
 * link's `+0-4242-1230`, are `+0 42421230`. Read from the path alone, so whatever draws it never
 * waits for the chain.
 */
export const nameFromSlug = (slug) => {
  let name = String(slug ?? '')
  try {
    name = decodeURIComponent(name)
  } catch {}
  if (!name.startsWith('+')) return name
  const [prefix, ...digits] = name.trim().split(/[\s-]+/)
  return digits.length ? `${prefix} ${digits.join('')}` : name
}
