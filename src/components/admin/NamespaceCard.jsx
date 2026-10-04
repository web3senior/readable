'use client'

import { useState } from 'react'
import clsx from 'clsx'
import { zeroAddress } from 'viem'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Shimmer from '@/components/ui/Shimmer'
import { grantManySpec, grantSpec, pauseNamespaceSpec, pricesSpec, reserveSpec, updateRulesSpec } from '@/components/admin/specs'
import { KIND } from '@/config/namespaces'
import { site } from '@/config/site'
import { formatAmount, formatCount, formatPercent, truncateAddress } from '@/lib/format'
import { displayName as fullName } from '@/lib/namespaces'
import { priceFromOf } from '@/lib/pricing'
import styles from './NamespaceCard.module.scss'

const displayName = (kind, name) => (kind === KIND.NAME ? `.${name}` : kind === KIND.NUMBER ? `+${name}` : name)

const copy = site.admin.reserved

/**
 * One namespace as the owner sees it: rules, price curve, reserved labels and the actions that
 * change them. `reserved` is `{ labels, isPending, isError }`.
 */
export default function NamespaceCard({ source, namespace, reserved, canAct, onAction, context }) {
  const { currency } = context
  const [unfolded, setUnfolded] = useState(false)
  const args = { source, namespace, ...context }
  const min = Number(source.minLength)
  const max = Number(source.maxLength)
  const priceFrom = priceFromOf(source)
  const checkDigitFrom = Number(source.checkDigitFrom)
  const manager = source.manager === zeroAddress ? null : source.manager

  // The curve the way the contract reads it: one tier per entry, the last covering every longer label
  const tiers = source.prices.map((price, index, all) => {
    const length = priceFrom + index
    const open = index === all.length - 1 && length < max
    return { key: index, length: open ? `${length}+` : String(length), price: formatAmount(price, currency) }
  })

  const foldable = reserved.labels.length > copy.shown
  const listed = foldable && !unfolded ? reserved.labels.slice(0, copy.shown) : reserved.labels

  const actions = [
    { label: 'Rules', spec: updateRulesSpec },
    { label: 'Prices', spec: pricesSpec },
    { label: 'Reserve', spec: reserveSpec },
    { label: 'Grant', spec: grantSpec },
    { label: 'Grant several', spec: grantManySpec },
    { label: source.paused ? 'Resume' : 'Pause', spec: pauseNamespaceSpec },
  ]

  return (
    <article className={clsx(styles.namespace, source.paused && styles['namespace--paused'])}>
      <header className={styles.namespace__header}>
        <div className={styles.namespace__badges}>
          <Badge tone="accent">{site.admin.kinds[namespace.kind] ?? namespace.kind}</Badge>
          {source.paused && <Badge tone="warning">Paused</Badge>}
        </div>
        <h3 className={styles.namespace__name} dir="auto">
          {displayName(namespace.kind, source.name)}
        </h3>
        <p className={styles.namespace__meta}>
          {namespace.title} · #{String(source.id)}
        </p>
      </header>

      <dl className={styles.namespace__rows}>
        <div className={styles.namespace__row}>
          <dt className={styles.namespace__term}>Length</dt>
          <dd>{min === max ? min : `${min} to ${max}`}</dd>
        </div>
        {namespace.kind === KIND.NUMBER && (
          <div className={styles.namespace__row}>
            <dt className={styles.namespace__term}>Check digit</dt>
            <dd>{checkDigitFrom ? `from ${checkDigitFrom} digits` : 'None'}</dd>
          </div>
        )}
        <div className={styles.namespace__row}>
          <dt className={styles.namespace__term}>Manager</dt>
          <dd className={styles.namespace__mono}>
            {manager ? `${truncateAddress(manager)} · ${formatPercent(Number(source.managerShare) / 100)}` : 'None'}
          </dd>
        </div>
        <div className={styles.namespace__row}>
          <dt className={styles.namespace__term}>{copy.label}</dt>
          <dd>
            {reserved.isPending ? (
              <Shimmer className={styles.namespace__pending} label={copy.loading} />
            ) : reserved.isError ? (
              copy.unreadable
            ) : reserved.labels.length ? (
              formatCount(reserved.labels.length)
            ) : (
              copy.none
            )}
          </dd>
        </div>
      </dl>

      <ul className={styles.namespace__tiers} aria-label="Yearly prices by length">
        {tiers.map((tier) => (
          <li key={tier.key} className={styles.namespace__tier}>
            <span className={styles.namespace__length}>{tier.length}</span>
            <span className={styles.namespace__price}>{tier.price}</span>
          </li>
        ))}
      </ul>

      {listed.length > 0 && (
        <ul className={styles.namespace__reserved} aria-label={copy.label}>
          {listed.map((label) => (
            <li key={label} className={styles.namespace__label} dir="auto">
              {fullName(namespace, label)}
            </li>
          ))}
          {foldable && (
            <li>
              <Button variant="link" size="sm" aria-expanded={unfolded} onClick={() => setUnfolded(!unfolded)}>
                {unfolded ? copy.less : copy.more.replace('{count}', formatCount(reserved.labels.length - copy.shown))}
              </Button>
            </li>
          )}
        </ul>
      )}

      <div className={styles.namespace__actions}>
        {actions.map((action) => (
          <Button key={action.label} variant="secondary" size="sm" disabled={!canAct} onClick={() => onAction(action.spec(args))}>
            {action.label}
          </Button>
        ))}
      </div>
    </article>
  )
}
