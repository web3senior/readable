import { site } from '@/config/site'
import { formatNumber, randomNumber } from '@/lib/query/numbers'
import { parseQuery } from '@/lib/query/parse'

const listOr = new Intl.ListFormat('en', { type: 'disjunction' })

const passes = (example, namespace) => parseQuery(example, [namespace]).candidates.some((candidate) => candidate.valid)

// The configured lengths, kept within the lengths the namespace sells
const lengthsFor = ({ exampleLengths, rules }) => [
  ...new Set(exampleLengths.map((length) => Math.min(Math.max(length, rules.minLength || length), rules.maxLength || length))),
]

// One draw per namespace and length for each page load: the examples hold still while the page
// is open and change on the next visit
const drawn = new Map()
const drawNumber = (namespace, length) => {
  const key = `${namespace.id}:${length}`
  if (!drawn.has(key)) drawn.set(key, formatNumber(randomNumber(length, namespace), namespace))
  return drawn.get(key)
}

/**
 * Example queries for the namespaces the registry holds: random numbers of each namespace's
 * `exampleLengths`, then its `examples`, dropping any its rules would refuse. Every namespace
 * gives its first example before any gives its second. With `draw` false a random number is
 * null, for a render that has to match the server's.
 */
export function examplesFor(namespaces, { draw = true, limit = site.search.exampleLimit } = {}) {
  const lists = namespaces.map((namespace) => [
    ...lengthsFor(namespace).map((length) => (draw ? drawNumber(namespace, length) : null)),
    ...namespace.examples.filter((example) => passes(example, namespace)),
  ])
  const rounds = Math.max(0, ...lists.map((list) => list.length))
  const picked = []
  for (let round = 0; round < rounds; round++) {
    for (const list of lists) {
      if (round < list.length) picked.push(list[round])
    }
  }
  return picked.slice(0, limit)
}

/** "Number", then "Number or username" once the registry holds an extension. */
export function placeholderFor(namespaces) {
  const nouns = [...new Set(namespaces.map((namespace) => namespace.noun).filter(Boolean))]
  if (!nouns.length) return site.search.placeholder
  const text = listOr.format(nouns)
  return text.charAt(0).toUpperCase() + text.slice(1)
}
