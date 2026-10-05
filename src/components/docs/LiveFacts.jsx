'use client'

import CodeBlock from '@/components/docs/CodeBlock'
import { checkDigitSample } from '@/components/docs/samples'
import Spec from '@/components/docs/Spec'
import Shimmer from '@/components/ui/Shimmer'
import { KIND } from '@/config/namespaces'
import { site } from '@/config/site'
import useDocsFacts from '@/hooks/useDocsFacts'
import { extensionsOf, numbersOf, stage } from '@/lib/docs'
import { formatCount, formatDays } from '@/lib/format'
import { formatNumber, luhnCheckDigit } from '@/lib/query/numbers'
import styles from './LiveFacts.module.scss'

/**
 * The parts of the docs the registry decides. Each shows a skeleton or the launch value while
 * the browser reads the registry, so the page around them is there at once.
 */

const LOCALE = 'en'
const { loading, examples } = site.docs

const checkDigitFromOf = (numbers) => numbers.rules.checkDigit?.fromLength ?? 0
const isChecked = (numbers, length) => checkDigitFromOf(numbers) > 0 && length >= checkDigitFromOf(numbers)

// How many numbers have `length` digits: none starts with 0, and a check digit leaves one in ten
const countOf = (numbers, length) => (9 * 10 ** (length - 1)) / (isChecked(numbers, length) ? 10 : 1)

// The shortest number sold, cut from the docs' example and ended in its check digit where one is due
const shortestOf = (numbers) => {
  const { minLength } = numbers.rules
  const seed = examples.long.padEnd(minLength, examples.long)
  if (!isChecked(numbers, minLength)) return seed.slice(0, minLength)
  const payload = seed.slice(0, minLength - 1)
  return `${payload}${luhnCheckDigit(payload)}`
}

/** What a number is: its length, its check digit, how it is stored and the shortest one sold. */
export function NumberRules() {
  const { facts, isPending } = useDocsFacts()
  if (isPending) return <Shimmer className={styles.live__rules} label={loading} />

  const numbers = numbersOf(facts)
  const { minLength, maxLength } = numbers.rules
  const checkDigitFrom = checkDigitFromOf(numbers)

  return (
    <Spec
      rows={[
        ['Length', `${minLength} to ${maxLength} digits`],
        ['Check digit', checkDigitFrom ? `The last digit, in numbers of ${checkDigitFrom} digits and longer` : 'None'],
        ['Stored as', <code key="stored">{examples.long}</code>],
        ['Shortest', formatNumber(shortestOf(numbers), numbers)],
      ]}
    />
  )
}

/** The items of the numbers' list that follow from the rules: how rare short ones are, and the check digit. */
export function NumberNotes() {
  const { facts, isPending } = useDocsFacts()
  if (isPending) {
    return (
      <li>
        <Shimmer className={styles.live__line} label={loading} />
      </li>
    )
  }

  const numbers = numbersOf(facts)
  const { minLength } = numbers.rules
  const checkDigitFrom = checkDigitFromOf(numbers)

  return (
    <>
      <li>
        <strong>Short numbers are the rare ones.</strong> Only {formatCount(countOf(numbers, minLength), LOCALE)} numbers have{' '}
        {minLength} digits, and they are priced to match. Long numbers cost very little.
      </li>
      {checkDigitFrom > 0 && (
        <li>
          <strong>Long numbers check themselves.</strong> From {checkDigitFrom} digits, the last digit is worked out from the others,
          so one mistyped digit fails instead of reaching a stranger. See <a href="#check-digit">the check digit</a>.
        </li>
      )}
    </>
  )
}

/** How the check digit works, from the length the registry starts it at, or that there is none. */
export function CheckDigit({ textClassName }) {
  const { facts, isPending } = useDocsFacts()
  if (isPending) return <Shimmer className={styles.live__table} label={loading} />

  const checkDigitFrom = checkDigitFromOf(numbersOf(facts))
  if (!checkDigitFrom) return <p className={textClassName}>The registry’s numbers carry no check digit.</p>

  return (
    <>
      <p className={textClassName}>
        Numbers of {checkDigitFrom} digits and longer end in a check digit, worked out from the digits before it by the Luhn formula
        that payment cards use. You choose all the digits but the last.
      </p>
      <p className={textClassName}>
        Of the ten numbers that differ only in their last digit, one is valid. A single mistyped digit, and most swaps of two
        neighbours, give a number that can’t exist, so the mistake is caught before anything is sent.
      </p>
      <CodeBlock language="JavaScript" code={checkDigitSample({ checkDigitFrom })} />
      <p className={textClassName}>
        The registry runs the same check: <code>lookup</code> answers a wrong check digit with the validity{' '}
        <code>InvalidCheckDigit</code> (6), and <code>register</code> refuses it. Check in your app first, and the reader learns about
        the typo without a call.
      </p>
    </>
  )
}

/** "2": the fewest digits a number has. */
export function ShortestLength() {
  const { facts } = useDocsFacts()
  return numbersOf(facts).rules.minLength
}

const unitOf = (namespace) => (namespace.kind === KIND.NUMBER ? 'digits' : 'characters')

const priceRows = (namespace) =>
  namespace.tiers.map((tier) => [`${tier.length} ${unitOf(namespace)}${tier.andLonger ? ' and longer' : ''}`, `${tier.price} a year`])

/** Each namespace's yearly prices by length, and whether they are the registry's or the launch ones. */
export function Prices() {
  const { facts, isPending } = useDocsFacts()
  if (isPending) return <Shimmer className={styles.live__table} label={loading} />

  return (
    <>
      {facts.namespaces
        .filter((namespace) => namespace.tiers.length)
        .map((namespace) => (
          <Spec key={namespace.id} caption={namespace.title} rows={priceRows(namespace)} />
        ))}
      <p className={styles.live__note}>
        {facts.live ? 'These are the prices the registry charges now.' : 'These are the launch prices the site previews.'}
        {stage !== 'live' && ' They are not final before the launch.'} The price of one name is on its card when you search for it.
      </p>
    </>
  )
}

/** The extensions the registry holds, or that it holds none yet. */
export function Extensions() {
  const { facts, isPending } = useDocsFacts()
  if (isPending) return <Shimmer className={styles.live__row} label={loading} />

  const extensions = extensionsOf(facts)
  if (!extensions.length) return <p className={styles.live__note}>The registry holds no extension yet. Numbers launch first.</p>

  return (
    <Spec
      caption="Extensions the registry holds"
      rows={extensions.map((namespace) => [
        namespace.suffix,
        `${namespace.rules.minLength} to ${namespace.rules.maxLength} characters${namespace.paused ? ', paused' : ''}`,
      ])}
    />
  )
}

/** "30 days": how long a name stays its holder's after its term. */
export function GracePeriod() {
  const { facts } = useDocsFacts()
  return formatDays(facts.gracePeriodDays, LOCALE)
}
