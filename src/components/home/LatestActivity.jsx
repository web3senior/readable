'use client'

import { useId } from 'react'
import clsx from 'clsx'
import Link from 'next/link'
import { Rise } from 'cube-motion/react'
import {
  AddressBookIcon,
  ArrowBendUpRightIcon,
  ArrowsClockwiseIcon,
  ArrowsLeftRightIcon,
  CoinsIcon,
  GiftIcon,
  MagnifyingGlassIcon,
  PencilSimpleIcon,
  PlusIcon,
  ShoppingCartSimpleIcon,
  StarIcon,
  UserMinusIcon,
} from '@phosphor-icons/react'
import Button from '@/components/ui/Button'
import Identicon from '@/components/ui/Identicon'
import Shimmer from '@/components/ui/Shimmer'
import { explorerFor } from '@/config/chains'
import { registry } from '@/config/registry'
import { site } from '@/config/site'
import useLatestActivity from '@/hooks/useLatestActivity'
import { focusSearch } from '@/lib/focusSearch'
import { formatAgo, formatAmount, formatCount, truncateAddress } from '@/lib/format'
import styles from './LatestActivity.module.scss'

const { title, loading, shown, columns, kinds, next } = site.activity

const ICONS = {
  bought: ShoppingCartSimpleIcon,
  granted: GiftIcon,
  renewed: ArrowsClockwiseIcon,
  transferred: ArrowsLeftRightIcon,
  target: ArrowBendUpRightIcon,
  records: AddressBookIcon,
  addresses: CoinsIcon,
  primary: StarIcon,
  editor: PencilSimpleIcon,
  editorRemoved: UserMinusIcon,
}

// How many rows stand in while the first reading is on its way
const SKELETONS = 3

// A purchase is what the table is there to show, so its kind is set in the accent
const LEADS = new Set(['bought', 'renewed'])

function Row({ row, currency, readAt, explorer }) {
  const Icon = ICONS[row.kind]
  const wallet = truncateAddress(row.wallet)
  const time = (
    <time dateTime={new Date(row.at).toISOString()} title={new Date(row.at).toLocaleString()}>
      {formatAgo(row.at, readAt)}
    </time>
  )

  return (
    <tr className={styles.activity__row}>
      <td className={styles.activity__cell}>
        <Link className={styles.activity__name} href={row.path}>
          {row.name}
        </Link>
      </td>
      <td className={styles.activity__cell}>
        <span className={clsx(styles.activity__kind, LEADS.has(row.kind) && styles['activity__kind--lead'])}>
          {Icon && <Icon size={14} weight="bold" aria-hidden="true" />}
          {kinds[row.kind]}
        </span>
      </td>
      <td className={clsx(styles.activity__cell, styles['activity__cell--wallet'])}>
        <span className={styles.activity__wallet}>
          <Identicon address={row.wallet} size="sm" />
          {explorer ? (
            <a className={styles.activity__link} href={`${explorer}/address/${row.wallet}`} target="_blank" rel="noopener noreferrer">
              {wallet}
            </a>
          ) : (
            wallet
          )}
        </span>
      </td>
      <td className={clsx(styles.activity__cell, styles['activity__cell--end'], styles['activity__cell--paid'])}>
        {row.paid !== null && currency && formatAmount(row.paid, currency)}
      </td>
      <td className={clsx(styles.activity__cell, styles['activity__cell--end'], styles['activity__cell--time'])}>
        {explorer ? (
          <a className={styles.activity__link} href={`${explorer}/tx/${row.hash}`} target="_blank" rel="noopener noreferrer">
            {time}
          </a>
        ) : (
          time
        )}
      </td>
    </tr>
  )
}

function Head() {
  return (
    <thead>
      <tr>
        <th scope="col" className={styles.activity__heading}>
          {columns.name}
        </th>
        <th scope="col" className={styles.activity__heading}>
          {columns.kind}
        </th>
        <th scope="col" className={clsx(styles.activity__heading, styles['activity__cell--wallet'])}>
          {columns.wallet}
        </th>
        <th scope="col" className={clsx(styles.activity__heading, styles['activity__cell--end'], styles['activity__cell--paid'])}>
          {columns.paid}
        </th>
        <th scope="col" className={clsx(styles.activity__heading, styles['activity__cell--end'])}>
          {columns.at}
        </th>
      </tr>
    </thead>
  )
}

/**
 * What happened to names lately, a row each: the name, what happened, the wallet, what was paid
 * and when. Its title says how many of how many it shows; under it, an invitation that is the
 * visitor's to take up. Absent until the registry has a name.
 */
export default function LatestActivity({ className }) {
  const titleId = useId()
  const { rows, total, currency, readAt, isPending } = useLatestActivity()
  const explorer = explorerFor(registry.chainId)

  if (!isPending && rows.length === 0) return null

  const count = (total > rows.length ? shown.more : shown.all).replace('{shown}', formatCount(rows.length)).replace('{total}', formatCount(total))

  return (
    <section className={clsx(styles.activity, className)} aria-labelledby={titleId}>
      <div className={styles.activity__head}>
        <h2 id={titleId} className={styles.activity__headline}>
          {title}
        </h2>
        {!isPending && <span className={styles.activity__count}>{count}</span>}
      </div>

      <div className={styles.activity__frame}>
        <div className={styles.activity__scroll}>
          <table className={styles.activity__table}>
            <Head />
            {isPending ? (
              <tbody role="status" aria-label={loading}>
                {Array.from({ length: SKELETONS }, (_, index) => (
                  <tr key={index} className={styles.activity__row}>
                    <td className={styles.activity__cell} colSpan={5}>
                      <Shimmer className={styles.activity__skeleton} label={loading} />
                    </td>
                  </tr>
                ))}
              </tbody>
            ) : (
              <Rise as="tbody" targets="children">
                {rows.map((row) => (
                  <Row key={row.id} row={row} currency={currency} readAt={readAt} explorer={explorer} />
                ))}
              </Rise>
            )}
          </table>
        </div>

        <div className={styles.activity__next}>
          <span className={styles.activity__slot} aria-hidden="true">
            <PlusIcon size={14} weight="bold" />
          </span>
          <p className={styles.activity__invite}>
            <span className={styles.activity__title}>{next.title}</span>
            <span className={styles.activity__note}>{next.note}</span>
          </p>
          <Button className={styles.activity__action} size="sm" icon={<MagnifyingGlassIcon size={16} weight="bold" aria-hidden="true" />} onClick={focusSearch}>
            {next.action}
          </Button>
        </div>
      </div>
    </section>
  )
}
