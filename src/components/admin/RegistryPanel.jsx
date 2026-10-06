'use client'

import { isAddressEqual, zeroAddress } from 'viem'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import CopyButton from '@/components/ui/CopyButton'
import {
  DAY,
  acceptOwnershipSpec,
  baseURISpec,
  forwarderSpec,
  gracePeriodSpec,
  nameRulesSpec,
  registryPauseSpec,
  transferOwnershipSpec,
  treasurySpec,
  withdrawSpec,
} from '@/components/admin/specs'
import { chainNameFor, explorerFor } from '@/config/chains'
import { registry } from '@/config/registry'
import { formatBalance, formatDays, truncateAddress } from '@/lib/format'
import styles from './RegistryPanel.module.scss'

/** A truncated address with its copy button, linked to the explorer when the chain has one. */
export function AddressValue({ value, explorer = explorerFor(registry.chainId) }) {
  const text = <span className={styles.registry__address}>{truncateAddress(value, 8, 6)}</span>
  return (
    <span className={styles.registry__inline}>
      {explorer ? (
        <a href={`${explorer}/address/${value}`} target="_blank" rel="noopener noreferrer" className={styles.registry__link}>
          {text}
        </a>
      ) : (
        text
      )}
      <CopyButton value={value} title="Copy address" />
    </span>
  )
}

/** Registry-wide state and the owner actions that change it. */
export default function RegistryPanel({ data, canAct, onAction, context }) {
  const { currency } = data
  const args = { data, ...context }

  const rows = [
    { term: 'Contract', value: <AddressValue value={registry.address} /> },
    { term: 'Chain', value: chainNameFor(registry.chainId) },
    { term: 'Version', value: data.version },
    { term: 'Owner', value: <AddressValue value={data.owner} /> },
    ...(data.pendingOwner
      ? [
          {
            term: 'Offered to',
            value: <AddressValue value={data.pendingOwner} />,
            // The second step is the offered wallet's, which is not the owner
            action: { label: 'Accept', spec: acceptOwnershipSpec, ready: Boolean(context.account && isAddressEqual(context.account, data.pendingOwner)) },
          },
        ]
      : []),
    {
      term: 'Status',
      value: <Badge tone={data.paused ? 'warning' : 'success'}>{data.paused ? 'Paused' : 'Live'}</Badge>,
      action: { label: data.paused ? 'Resume' : 'Pause', spec: registryPauseSpec },
    },
    { term: 'Payment', value: currency.symbol },
    { term: 'Balance', value: formatBalance(data.balance, currency), action: { label: 'Withdraw', spec: withdrawSpec } },
    {
      term: 'Treasury',
      value: data.treasury ? <AddressValue value={data.treasury} /> : 'None',
      action: { label: 'Change', spec: treasurySpec },
    },
    {
      term: 'NFT data link',
      value: data.baseURI ? <span className={styles.registry__code}>{data.baseURI}</span> : 'None',
      action: { label: 'Change', spec: baseURISpec },
    },
    { term: 'Grace period', value: formatDays(Math.round(data.gracePeriod / DAY)), action: { label: 'Change', spec: gracePeriodSpec } },
    {
      term: 'Name rules',
      value: data.nameRules ? (
        <span className={styles.registry__inline}>
          {data.nameRules.version} <AddressValue value={data.nameRules.address} />
        </span>
      ) : (
        'None'
      ),
      action: { label: 'Change', spec: nameRulesSpec },
    },
    {
      term: 'Trusted forwarder',
      value: data.forwarder === zeroAddress ? 'None' : <AddressValue value={data.forwarder} />,
      action: { label: 'Change', spec: forwarderSpec },
    },
  ]

  return (
    <section className={styles.registry} aria-labelledby="admin-registry">
      <header className={styles.registry__header}>
        <h2 id="admin-registry" className={styles.registry__title}>
          Registry
        </h2>
        <Button variant="secondary" size="sm" disabled={!canAct} onClick={() => onAction(transferOwnershipSpec(args))}>
          Transfer ownership
        </Button>
      </header>

      <dl className={styles.registry__rows}>
        {rows.map((row) => (
          <div key={row.term} className={styles.registry__row}>
            <dt className={styles.registry__term}>{row.term}</dt>
            <dd className={styles.registry__value}>{row.value}</dd>
            {row.action && (
              <Button
                variant="ghost"
                size="sm"
                className={styles.registry__action}
                disabled={!(row.action.ready ?? canAct)}
                onClick={() => onAction(row.action.spec(args))}
              >
                {row.action.label}
              </Button>
            )}
          </div>
        ))}
      </dl>
    </section>
  )
}
