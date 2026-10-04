import { KIND } from '@/config/namespaces'
import { keypadNumber } from '@/lib/query/keypad'
import { compactNumber, looksLikeNumber } from '@/lib/query/numbers'
import { validateLabel } from '@/lib/query/rules'
import { normalizeText } from '@/lib/query/text'

const candidateFor = (namespace, raw) => {
  const result = validateLabel(raw, namespace)
  return {
    key: `${namespace.id}:${result.valid ? result.label : raw}`,
    namespace,
    raw,
    ...result,
    // An invalid label still needs a title on its card
    name: result.valid ? result.name : `${raw}${namespace.suffix ?? ''}`,
  }
}

const ofKind = (namespaces, kind) => namespaces.filter((namespace) => namespace.kind === kind)

// The number a word dials on a phone keypad, in each number namespace it fits
const keypadCandidates = (input, namespaces) =>
  ofKind(namespaces, KIND.NUMBER)
    .map((namespace) => {
      const digits = keypadNumber(input, namespace)
      return digits ? { ...candidateFor(namespace, digits), keypad: { word: input.toUpperCase() } } : null
    })
    .filter((candidate) => candidate?.valid)

/**
 * Turns what someone typed into one candidate per namespace it could belong to.
 *
 * An explicit extension (a namespace `suffix`) targets that namespace alone. Otherwise the shape of the input
 * decides: numbers try number namespaces (and name namespaces, where digits are valid labels),
 * and everything else tries name namespaces. A namespace whose shape matches keeps its invalid
 * candidate, so "ab" still explains the length rule; one that merely might accept the input is
 * dropped when it doesn’t. With `keypad`, a word is also the number it dials on a phone keypad,
 * after the names it could be, or before them when none can be registered as it is.
 *
 * @returns {{ input: string, candidates: object[], unknownSuffix: string | null }}
 */
export function parseQuery(raw, namespaces, { keypad = false } = {}) {
  const input = normalizeText(raw)
  if (!input) return { input, candidates: [], unknownSuffix: null }

  const lower = input.toLowerCase()
  const bySuffix = namespaces.find(
    (namespace) => namespace.suffix && lower.endsWith(namespace.suffix) && lower.length > namespace.suffix.length
  )
  if (bySuffix) {
    return { input, candidates: [candidateFor(bySuffix, input.slice(0, -bySuffix.suffix.length))], unknownSuffix: null }
  }

  if (looksLikeNumber(input)) {
    const numbers = ofKind(namespaces, KIND.NUMBER).map((namespace) => candidateFor(namespace, input))
    // A leading + can only mean a number
    if (compactNumber(input).startsWith('+')) return { input, candidates: numbers, unknownSuffix: null }
    const names = ofKind(namespaces, KIND.NAME)
      .map((namespace) => candidateFor(namespace, compactNumber(input)))
      .filter((candidate) => candidate.valid)
    return { input, candidates: [...numbers, ...names], unknownSuffix: null }
  }

  const dot = input.lastIndexOf('.')
  if (dot > 0 && dot < input.length - 1) {
    return { input, candidates: [], unknownSuffix: input.slice(dot) }
  }

  const names = ofKind(namespaces, KIND.NAME).map((namespace) => candidateFor(namespace, input))
  const dialed = keypad ? keypadCandidates(input, namespaces) : []
  // The number leads when no extension takes the word as it is
  const ordered = names.some((candidate) => candidate.valid) ? [...names, ...dialed] : [...dialed, ...names]
  return { input, candidates: ordered, unknownSuffix: null }
}
