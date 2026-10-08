'use client'

import { useEffect, useId, useRef } from 'react'
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

const { title, loading, shown, columns, kinds, next, explanation, roles, unknownWallet, noFee, unknownFee, ago, transaction } = site.activity

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

function Wallet({ address, role, explorer }) {
  return (
    <span className={styles.activity__wallet}>
      <span className={styles.activity__role}>{role}</span>
      {address ? (
        <>
          <Identicon address={address} size="sm" />
          {explorer ? (
            <a className={styles.activity__link} href={`${explorer}/address/${address}`} title={address} target="_blank" rel="noopener noreferrer">
              {truncateAddress(address)}
            </a>
          ) : <span title={address}>{truncateAddress(address)}</span>}
        </>
      ) : unknownWallet}
    </span>
  )
}

function Row({ row, currency, readAt, explorer }) {
  const Icon = ICONS[row.kind]
  const role = row.kind === 'transferred' ? roles.to : row.kind === 'bought' ? roles.registered : row.kind === 'granted' ? roles.granted : roles.by
  const time = (
    <time dateTime={new Date(row.at).toISOString()} title={new Date(row.at).toLocaleString()}>
      {ago.replace('{time}', formatAgo(row.at, readAt))}
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
        <div className={styles.activity__wallets}>
          {row.kind === 'transferred' && <Wallet address={row.from} role={roles.from} explorer={explorer} />}
          <Wallet address={row.wallet} role={role} explorer={explorer} />
        </div>
      </td>
      <td className={clsx(styles.activity__cell, styles['activity__cell--end'], styles['activity__cell--paid'])}>
        {row.paid !== null && currency ? formatAmount(row.paid, currency) : LEADS.has(row.kind) ? unknownFee : noFee}
      </td>
      <td className={clsx(styles.activity__cell, styles['activity__cell--end'], styles['activity__cell--time'])}>
        {explorer ? (
          <a className={styles.activity__link} href={`${explorer}/tx/${row.hash}`} aria-label={`${transaction.replace('{name}', row.name)}: ${ago.replace('{time}', formatAgo(row.at, readAt))}`} target="_blank" rel="noopener noreferrer">
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
 * and when. Its title says how many records it shows; under it, an invitation that is the
 * visitor's to take up. Absent until the registry has a name.
 */
export default function LatestActivity({ className }) {
  const titleId = useId()
  const { rows, total, names, currency, readAt, isPending, hasNextPage, fetchNextPage, isFetching, isFetchingNextPage, isFetchNextPageError } = useLatestActivity()
  const scrollRef = useRef(null)
  const moreRef = useRef(null)
  const explorer = explorerFor(registry.chainId)

  useEffect(() => {
    if (!hasNextPage || isFetching || isFetchNextPageError || !moreRef.current) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) fetchNextPage()
      },
      { root: scrollRef.current }
    )
    observer.observe(moreRef.current)
    return () => observer.disconnect()
  }, [hasNextPage, isFetching, isFetchNextPageError, fetchNextPage])

  if (!isPending && rows.length === 0) return null

  const count = shown.replace('{shown}', formatCount(rows.length)).replace('{total}', formatCount(total)).replace('{names}', formatCount(names))

  return (
    <section className={clsx(styles.activity, className)} aria-labelledby={titleId}>
      <div className={styles.activity__head}>
        <h2 id={titleId} className={styles.activity__headline}>
          {title}
        </h2>
        {!isPending && <span className={styles.activity__count}>{count}</span>}
        <p className={styles.activity__explanation}>{explanation}</p>
      </div>

      <div className={styles.activity__frame}>
        <div ref={scrollRef} className={styles.activity__scroll}>
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
          {hasNextPage && (
            <div ref={moreRef} className={styles.activity__more}>
              <Button
                variant="ghost"
                size="sm"
                loading={isFetchingNextPage}
                disabled={isFetching}
                onClick={() => fetchNextPage()}
              >
                {isFetchingNextPage ? site.activity.loadingMore : isFetchNextPageError ? site.activity.retryMore : site.activity.loadMore}
              </Button>
            </div>
          )}
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
