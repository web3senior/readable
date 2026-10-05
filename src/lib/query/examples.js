import { site } from '@/config/site'
import { formatNumber, randomNumber } from '@/lib/query/numbers'
import { parseQuery } from '@/lib/query/parse'

const listOr = new Intl.ListFormat('en', { type: 'disjunction' })

const passes = (example, namespace) => parseQuery(example, [namespace]).candidates.some((candidate) => candidate.valid)

// One draw of each for each page load: the examples hold still while the page is open and change
// on the next visit
const drawn = new Map()
const once = (key, draw) => (drawn.has(key) ? drawn.get(key) : drawn.set(key, draw()).get(key))

const randomBetween = (from, to) => from + Math.floor(Math.random() * (to - from + 1))

// The configured lengths, a range ([8, 11]) as one length drawn in it, kept within the lengths the
// namespace sells
const lengthsFor = ({ id, exampleLengths, rules }) => [
  ...new Set(
    exampleLengths
      .map((entry) => (Array.isArray(entry) ? once(`${id}:${entry}`, () => randomBetween(...entry)) : entry))
      .map((length) => Math.min(Math.max(length, rules.minLength || length), rules.maxLength || length))
  ),
]

const drawNumber = (namespace, length) => once(`${namespace.id}:${length}`, () => formatNumber(randomNumber(length, namespace), namespace))

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
