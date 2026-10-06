'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import EmptyState from '@/components/ui/EmptyState'
import Shimmer from '@/components/ui/Shimmer'
import { toast } from '@/components/NextToast'
import { AddressValue } from '@/components/admin/RegistryPanel'
import { checkout } from '@/config/checkout'
import { registry } from '@/config/registry'
import { site } from '@/config/site'
import { formatAgo, formatAmount, formatBalance, formatDate, formatPrice, formatUsd, truncateAddress } from '@/lib/format'
import { displayName, toNamespace } from '@/lib/namespaces'
import { claimOnce, describePayment, readCheckoutPayments } from '@/lib/payInLyx'
import panel from './RegistryPanel.module.scss'
import styles from './CheckoutPanel.module.scss'

const copy = site.admin.checkout
const { reasons } = site.checkout
const LUKSO_EXPLORER = checkout.chain.blockExplorers.default.url
const STALE_MS = 30_000

const TONES = {
  done: 'success',
  pending: 'neutral',
  ready: 'accent',
  registering: 'accent',
  blocked: 'warning',
  refund: 'danger',
  unpaid: 'danger',
  failed: 'danger',
  foreign: 'warning',
  unknown: 'neutral',
}
// What the owner can push along: a payment ready to register, or one waiting on what may have changed
const CLAIMABLE = new Set(['ready', 'blocked'])

const fill = (template, values) => Object.entries(values).reduce((text, [key, value]) => text.replaceAll(`{${key}}`, value), template)

// What the owner does about a payment, when anything
function noteOf(payment) {
  const amount = formatAmount(payment.paid, checkout.coin)
  if (payment.status === 'refund') return `${reasons[payment.reason] ?? ''}. ${fill(copy.refundNote, { amount, payer: payment.payer })}`
  if (payment.status === 'blocked') return fill(copy.blockedNote, { reason: reasons[payment.reason] ?? '', date: formatDate(payment.until) })
  if (payment.status === 'foreign') return copy.foreignNote
  return null
}

/** Names bought with LYX: where the LYX lands, the wallet that pays for the names, and the latest payments. */
export default function CheckoutPanel({ data }) {
  const [claiming, setClaiming] = useState(null)
  const query = useQuery({ queryKey: ['checkout-payments'], queryFn: readCheckoutPayments, staleTime: STALE_MS, retry: false })

  const namespaces = new Map(data.namespaces.map((source) => [String(source.id), toNamespace(source, { chainId: registry.chainId })]))
  const nameOf = (quote) => {
    const namespace = namespaces.get(String(quote.namespaceId))
    return namespace ? displayName(namespace, quote.label) : quote.label
  }

  const claim = async (payment) => {
    setClaiming(payment.hash)
    try {
      const answer = await claimOnce(payment.hash)
      const { message, type } = describePayment(answer, nameOf(payment.quote))
      toast(message, type === 'loading' ? 'info' : type)
    } catch (error) {
      toast(error.shortMessage ?? site.checkout.refusals.unreachable, 'error')
    } finally {
      setClaiming(null)
      query.refetch()
    }
  }

  const body = () => {
    if (query.isPending) return <Shimmer className={styles.checkout__skeleton} label={copy.loading} />
    if (query.error?.off) return <p className={styles.checkout__note}>{copy.off}</p>
    if (query.isError) return <p className={styles.checkout__note}>{copy.unreadable}</p>

    const { receiver, wallet, balance, rate, payments } = query.data
    const rows = [
      { term: copy.receiver, value: <AddressValue value={receiver} explorer={LUKSO_EXPLORER} /> },
      { term: copy.wallet, value: <AddressValue value={wallet} /> },
      { term: copy.balance, value: formatBalance(balance, data.currency) },
      ...(rate ? [{ term: copy.rate, value: `${formatPrice(rate.eth, data.currency.symbol)}${rate.usd ? ` · ${formatUsd(rate.usd)}` : ''}` }] : []),
    ]

    return (
      <>
        <dl className={panel.registry__rows}>
          {rows.map((row) => (
            <div key={row.term} className={panel.registry__row}>
              <dt className={panel.registry__term}>{row.term}</dt>
              <dd className={panel.registry__value}>{row.value}</dd>
            </div>
          ))}
        </dl>

        <h3 className={styles.checkout__subtitle}>{copy.payments}</h3>
        {payments.length ? (
          <ul className={styles.checkout__payments}>
            {payments.map((payment) => {
              const note = noteOf(payment)
              return (
                <li key={payment.hash} className={styles.checkout__payment}>
                  <div className={styles.checkout__main}>
                    <span className={styles.checkout__name} dir="auto">
                      {payment.quote ? nameOf(payment.quote) : truncateAddress(payment.hash, 10, 6)}
                    </span>
                    <span className={styles.checkout__meta}>
                      {formatAmount(payment.paid, checkout.coin)} ·{' '}
                      {payment.payer && (
                        <>
                          <a href={`${LUKSO_EXPLORER}/address/${payment.payer}`} target="_blank" rel="noopener noreferrer" className={styles.checkout__link}>
                            {truncateAddress(payment.payer)}
                          </a>{' '}
                          ·{' '}
                        </>
                      )}
                      <a href={`${LUKSO_EXPLORER}/tx/${payment.hash}`} target="_blank" rel="noopener noreferrer" className={styles.checkout__link}>
                        {formatAgo(payment.at, Date.now())}
                      </a>
                    </span>
                    {note && <span className={styles.checkout__note}>{note}</span>}
                  </div>
                  <div className={styles.checkout__side}>
                    <Badge tone={TONES[payment.status] ?? 'neutral'}>{copy.statuses[payment.status] ?? payment.status}</Badge>
                    {CLAIMABLE.has(payment.status) && (
                      <Button size="sm" variant="secondary" loading={claiming === payment.hash} disabled={Boolean(claiming)} onClick={() => claim(payment)}>
                        {copy.register}
                      </Button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        ) : (
          <EmptyState>{copy.none}</EmptyState>
        )}
      </>
    )
  }

  return (
    <section className={panel.registry} aria-labelledby="admin-checkout">
      <header className={panel.registry__header}>
        <h2 id="admin-checkout" className={panel.registry__title}>
          {copy.title}
        </h2>
        <Button variant="ghost" size="sm" loading={query.isFetching && !query.isPending} onClick={() => query.refetch()}>
          {copy.refresh}
        </Button>
      </header>
      <p className={styles.checkout__note}>{copy.intro}</p>
      {body()}
    </section>
  )
}
