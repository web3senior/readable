'use client'

import { useId, useMemo } from 'react'
import Link from 'next/link'
import { XIcon } from '@phosphor-icons/react'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Shimmer from '@/components/ui/Shimmer'
import ReminderButton from '@/components/names/ReminderButton'
import { site } from '@/config/site'
import useGracePeriod from '@/hooks/useGracePeriod'
import useNameLookup from '@/hooks/useNameLookup'
import useNamespaces from '@/hooks/useNamespaces'
import useWatchlist from '@/hooks/useWatchlist'
import { formatDate } from '@/lib/format'
import { namePath } from '@/lib/namespaces'
import { parseQuery } from '@/lib/query/parse'
import { searchPath } from '@/lib/searchLink'
import styles from './Watchlist.module.scss'

const { watch: copy } = site

function Item({ candidate, grace, onRemove }) {
  const { data, isPending } = useNameLookup(candidate)
  const path = namePath(candidate.namespace, candidate.label)
  const releasedAt = data?.status === 'taken' ? data.expiresAt + grace : null

  let status
  if (isPending) status = <Shimmer className={styles.watch__skeleton} label="Checking" />
  else if (data?.status === 'available')
    status = (
      <>
        <Badge tone="success">{copy.available}</Badge>
        <Button size="sm" href={searchPath(candidate.name)}>
          Register
        </Button>
      </>
    )
  else if (releasedAt)
    status = (
      <>
        <span className={styles.watch__date}>{copy.released.replace('{date}', formatDate(releasedAt))}</span>
        <ReminderButton name={candidate.name} path={path} releasedAt={releasedAt} variant="ghost" />
      </>
    )

  return (
    <li className={styles.watch__item}>
      <Link className={styles.watch__name} href={path} dir="auto">
        {candidate.name}
      </Link>
      <div className={styles.watch__status}>{status}</div>
      <Button variant="ghost" size="sm" iconOnly aria-label={`${copy.unwatch}: ${candidate.name}`} icon={<XIcon size={14} />} onClick={onRemove} />
    </li>
  )
}

/** The names this browser watches, each with the day it returns to the public unless renewed. */
export default function Watchlist() {
  const titleId = useId()
  const { names, unwatch } = useWatchlist()
  const { namespaces } = useNamespaces()
  const grace = useGracePeriod()
  const candidates = useMemo(
    () =>
      names
        .map((name) => ({ name, candidate: parseQuery(name, namespaces).candidates.find((found) => found.valid) }))
        .filter(({ candidate }) => candidate),
    [names, namespaces]
  )
  if (candidates.length === 0) return null

  return (
    <section className={styles.watch} aria-labelledby={titleId}>
      <header className={styles.watch__header}>
        <h2 id={titleId} className={styles.watch__title}>
          {copy.title}
        </h2>
        <p className={styles.watch__intro}>{copy.intro}</p>
      </header>
      <ul className={styles.watch__list}>
        {candidates.map(({ name, candidate }) => (
          <Item key={name} candidate={candidate} grace={grace} onRemove={() => unwatch(name)} />
        ))}
      </ul>
    </section>
  )
}
