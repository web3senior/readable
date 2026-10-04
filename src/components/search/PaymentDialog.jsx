'use client'

import { forwardRef, useId, useImperativeHandle, useRef, useState } from 'react'
import Link from 'next/link'
import { useQueryClient } from '@tanstack/react-query'
import { MinusIcon, PlusIcon, XIcon } from '@phosphor-icons/react'
import NativeDialog from '@/components/ui/NativeDialog'
import Button from '@/components/ui/Button'
import OnrampLink from '@/components/search/OnrampLink'
import UsdValue from '@/components/search/UsdValue'
import { toast } from '@/components/NextToast'
import { registry } from '@/config/registry'
import { site } from '@/config/site'
import { formatAmount, formatYears } from '@/lib/format'
import { paymentError, sendPayment, waitForPayment } from '@/lib/registryActions'
import styles from './PaymentDialog.module.scss'

const { integrations } = site
const listAnd = new Intl.ListFormat('en', { type: 'conjunction' })
// The apps built to read names and waiting for their launch
const NEXT_APPS = listAnd.format(integrations.items.filter((item) => item.stage === 'next').map((item) => item.name))

const COPY = {
  register: {
    title: 'Register',
    pending: 'Registering',
    note: 'You can renew any time before it expires.',
    done: (name) => `${name} is yours`,
  },
  renew: {
    title: 'Renew',
    pending: 'Renewing',
    note: 'The years are added to the current expiry.',
    done: (name) => `${name} renewed`,
  },
}

/**
 * Pays for a register or renew, the exact price in ETH from the connected wallet. Closes as soon as the wallet signs; the toast carries the
 * transaction to its verdict and outlives the card.
 */
const PaymentDialog = forwardRef(function PaymentDialog({ action, candidate, tokenId, pricePerYear, currency }, ref) {
  const titleId = useId()
  const dialogRef = useRef(null)
  const queryClient = useQueryClient()
  const [years, setYears] = useState(1)
  const [sending, setSending] = useState(false)
  const copy = COPY[action]
  const total = pricePerYear * BigInt(years)

  useImperativeHandle(
    ref,
    () => ({
      open: () => {
        setYears(1)
        dialogRef.current?.open()
      },
      close: () => dialogRef.current?.close(),
    }),
    []
  )

  const report = (progress, message, type) => {
    if (!progress.update(message, type)) toast(message, type)
  }

  const confirm = async () => {
    setSending(true)
    try {
      const sent = await sendPayment({
        action,
        namespace: candidate.namespace,
        label: candidate.label,
        tokenId,
        years,
        pricePerYear,
      })
      dialogRef.current?.close()

      const progress = toast(`${copy.pending} ${candidate.name}…`, 'loading')
      waitForPayment(sent)
        .then((receipt) => {
          const success = receipt.status === 'success'
          report(progress, success ? copy.done(candidate.name) : `${copy.title} failed onchain`, success ? 'success' : 'error')
          queryClient.invalidateQueries({ queryKey: ['lookup', candidate.namespace.id] })
          queryClient.invalidateQueries({ queryKey: ['names'] })
        })
        .catch((error) => report(progress, paymentError(error), 'error'))
    } catch (error) {
      toast(paymentError(error), 'error')
    } finally {
      setSending(false)
    }
  }

  return (
    <NativeDialog ref={dialogRef} lightDismiss className={styles.payment} aria-labelledby={titleId}>
      <header className={styles.payment__header}>
        <h2 id={titleId} className={styles.payment__title}>
          {copy.title}{' '}
          <span className={styles.payment__name} dir="auto">
            {candidate.name}
          </span>
        </h2>
        <Button
          variant="ghost"
          size="sm"
          iconOnly
          aria-label="Close"
          icon={<XIcon size={16} weight="bold" />}
          onClick={() => dialogRef.current?.close()}
        />
      </header>

      <div className={styles.payment__years}>
        <span className={styles.payment__term}>Length</span>
        <div className={styles.payment__stepper}>
          <Button
            variant="secondary"
            size="sm"
            iconOnly
            aria-label="One year less"
            icon={<MinusIcon size={14} weight="bold" />}
            disabled={years <= 1 || sending}
            onClick={() => setYears((value) => value - 1)}
          />
          <output className={styles.payment__count} aria-live="polite">
            {formatYears(years)}
          </output>
          <Button
            variant="secondary"
            size="sm"
            iconOnly
            aria-label="One year more"
            icon={<PlusIcon size={14} weight="bold" />}
            disabled={years >= registry.maxYears || sending}
            onClick={() => setYears((value) => value + 1)}
          />
        </div>
      </div>

      <dl className={styles.payment__panel}>
        <div className={styles.payment__row}>
          <dt className={styles.payment__term}>Per year</dt>
          <dd className={styles.payment__amount}>
            {formatAmount(pricePerYear, currency)}
            <UsdValue wei={pricePerYear} decimals={currency.decimals} className={styles.payment__usd} />
          </dd>
        </div>
        <div className={styles.payment__row}>
          <dt className={styles.payment__term}>Total</dt>
          <dd className={styles.payment__amount}>
            <span className={styles.payment__total}>{formatAmount(total, currency)}</span>
            <UsdValue wei={total} decimals={currency.decimals} className={styles.payment__usd} />
          </dd>
        </div>
      </dl>

      <p className={styles.payment__note}>{copy.note}</p>

      {/* Before a first payment, a plain word on how few apps read names so far */}
      {action === 'register' && (
        <p className={styles.payment__early}>
          <strong>{integrations.early.lead}</strong> {integrations.early.today}
          {NEXT_APPS && ` ${integrations.early.next.replace('{apps}', NEXT_APPS)}`}{' '}
          <Link href={`${site.docs.path}#${integrations.section}`} className={styles.payment__more}>
            {integrations.early.more}
          </Link>
        </p>
      )}

      <Button size="lg" block loading={sending} onClick={confirm}>
        {copy.title}
      </Button>
      {currency && <OnrampLink currency={currency} />}
    </NativeDialog>
  )
})

export default PaymentDialog
