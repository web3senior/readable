'use client'

import Spec from '@/components/docs/Spec'
import Shimmer from '@/components/ui/Shimmer'
import { KIND } from '@/config/namespaces'
import { site } from '@/config/site'
import useDocsFacts from '@/hooks/useDocsFacts'
import { extensionsOf, stage } from '@/lib/docs'
import { formatDays } from '@/lib/format'
import styles from './LiveFacts.module.scss'

/**
 * The parts of the docs the registry decides. Each shows a skeleton or the launch value while
 * the browser reads the registry, so the page around them is there at once.
 */

const LOCALE = 'en'
const { loading } = site.docs

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
