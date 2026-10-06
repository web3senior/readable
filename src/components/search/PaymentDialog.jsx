'use client'

import { forwardRef, useId, useImperativeHandle, useRef, useState } from 'react'
import Link from 'next/link'
import clsx from 'clsx'
import { isAddress } from 'viem'
import { useConnection } from 'wagmi'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { MinusIcon, PlusIcon, XIcon } from '@phosphor-icons/react'
import NativeDialog from '@/components/ui/NativeDialog'
import Button from '@/components/ui/Button'
import Field from '@/components/ui/Field'
import Shimmer from '@/components/ui/Shimmer'
import OnrampLink from '@/components/search/OnrampLink'
import UsdValue from '@/components/search/UsdValue'
import { toast } from '@/components/NextToast'
import { chainNameFor } from '@/config/chains'
import { checkout } from '@/config/checkout'
import { registry } from '@/config/registry'
import { site } from '@/config/site'
import useCheckout from '@/hooks/useCheckout'
import useDebouncedValue from '@/hooks/useDebouncedValue'
import { formatAmount, formatUsd, formatYears } from '@/lib/format'
import { followPayment, payQuote, quoteFresh, requestQuote } from '@/lib/payInLyx'
import { paymentError, sendPayment, waitForPayment } from '@/lib/registryActions'
import styles from './PaymentDialog.module.scss'

const { integrations, checkout: lyx } = site
const listAnd = new Intl.ListFormat('en', { type: 'conjunction' })
// The apps built to read names and waiting for their launch
const NEXT_APPS = listAnd.format(integrations.items.filter((item) => item.stage === 'next').map((item) => item.name))

const COINS = ['eth', 'lyx']
const HOLDER_DEBOUNCE_MS = 400
const SECOND = 1000
const MINUTE = 60

const fill = (template, values) => Object.entries(values).reduce((text, [key, value]) => text.replaceAll(`{${key}}`, value), template)
const CHAIN = chainNameFor(registry.chainId)
const LYX_NOTE = fill(lyx.note, { minutes: Math.ceil((checkout.confirmations * checkout.blockSeconds) / MINUTE), chain: CHAIN })
const LYX_HELD = fill(lyx.held, { minutes: checkout.quoteSeconds / MINUTE })

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
 * Pays for a register or renew, the exact price in ETH from the connected wallet, or a
 * registration in LYX on LUKSO when the site takes it. Closes as soon as the wallet signs; the
 * toast carries the payment to its verdict and outlives the card. `onDone` hears of a payment
 * confirmed onchain.
 */
const PaymentDialog = forwardRef(function PaymentDialog({ action, candidate, tokenId, pricePerYear, currency, onDone }, ref) {
  const titleId = useId()
  const dialogRef = useRef(null)
  const queryClient = useQueryClient()
  const { address } = useConnection()
  const [years, setYears] = useState(1)
  const [sending, setSending] = useState(false)
  const [coin, setCoin] = useState(COINS[0])
  const [holder, setHolder] = useState('')
  const copy = COPY[action]
  const total = pricePerYear * BigInt(years)

  // LYX buys a registration only, on the live registry
  const lyxOffered = useCheckout() && action === 'register' && candidate.namespace.onchainId != null
  const inLyx = lyxOffered && coin === 'lyx'
  const quoteHolder = useDebouncedValue(holder.trim(), HOLDER_DEBOUNCE_MS)
  const quote = useQuery({
    queryKey: ['checkout-quote', candidate.namespace.id, candidate.label, quoteHolder.toLowerCase(), years],
    queryFn: () => requestQuote({ namespace: candidate.namespace, label: candidate.label, holder: quoteHolder, years }),
    enabled: inLyx && isAddress(quoteHolder),
    staleTime: (checkout.quoteSeconds - checkout.quoteFloorSeconds) * SECOND,
    retry: false,
  })

  useImperativeHandle(
    ref,
    () => ({
      open: () => {
        setYears(1)
        setCoin(COINS[0])
        setHolder(address ?? '')
        dialogRef.current?.open()
      },
      close: () => dialogRef.current?.close(),
    }),
    [address]
  )

  const report = (progress, message, type) => {
    if (!progress.update(message, type)) toast(message, type)
  }

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['lookup', candidate.namespace.id] })
    queryClient.invalidateQueries({ queryKey: ['names'] })
  }

  const payInEth = async () => {
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
        refresh()
        if (success) onDone?.()
      })
      .catch((error) => report(progress, paymentError(error), 'error'))
  }

  const payInLyx = async () => {
    // A quote about to run out is asked for again, so the payment lands while it holds
    const fresh = quoteFresh(quote.data) ? quote.data : await quote.refetch().then(({ data, error }) => (error ? Promise.reject(error) : data))
    const hash = await payQuote(fresh)
    dialogRef.current?.close()
    followPayment(
      { hash, name: candidate.name, amount: fresh.amount },
      {
        onDone: () => {
          refresh()
          onDone?.()
        },
      }
    )
  }

  const confirm = async () => {
    setSending(true)
    try {
      await (inLyx ? payInLyx() : payInEth())
    } catch (error) {
      toast(paymentError(error), 'error')
    } finally {
      setSending(false)
    }
  }

  const holderError = inLyx && quote.error ? quote.error.message : null

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

      {lyxOffered && (
        <div className={styles.payment__years}>
          <span className={styles.payment__term}>{lyx.choice.label}</span>
          <div className={styles.payment__coins} role="group" aria-label={lyx.choice.label}>
            {COINS.map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={coin === value}
                className={clsx(styles.payment__coin, coin === value && styles['payment__coin--active'])}
                disabled={sending}
                onClick={() => setCoin(value)}
              >
                {lyx.choice[value]}
              </button>
            ))}
          </div>
        </div>
      )}

      {inLyx ? (
        <>
          <dl className={styles.payment__panel}>
            <div className={styles.payment__row}>
              <dt className={styles.payment__term}>{lyx.total}</dt>
              <dd className={styles.payment__amount} aria-live="polite">
                {quote.data && !quote.isFetching ? (
                  <>
                    <span className={styles.payment__total}>{formatAmount(quote.data.amount, checkout.coin)}</span>
                    {quote.data.usd != null && (
                      <span className={styles.payment__usd}>{site.usd.label.replace('{amount}', formatUsd(quote.data.usd))}</span>
                    )}
                  </>
                ) : quote.isFetching ? (
                  <Shimmer className={styles.payment__quoting} label={lyx.quoting} />
                ) : (
                  <span className={styles.payment__total}>{lyx.choice.lyx}</span>
                )}
              </dd>
            </div>
          </dl>

          <Field
            label={lyx.holder.label}
            hint={fill(lyx.holder.hint, { chain: CHAIN })}
            mono
            value={holder}
            placeholder="0x…"
            spellCheck={false}
            autoComplete="off"
            disabled={sending}
            aria-invalid={Boolean(holderError)}
            onChange={(event) => setHolder(event.target.value)}
          />
          {holderError && (
            <p className={styles.payment__error} role="alert">
              {holderError}
            </p>
          )}

          <p className={styles.payment__note}>
            {LYX_NOTE} {LYX_HELD}
          </p>
        </>
      ) : (
        <>
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
        </>
      )}

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

      <Button size="lg" block loading={sending} disabled={inLyx && !quote.data} onClick={confirm}>
        {inLyx && quote.data ? fill(lyx.action, { amount: formatAmount(quote.data.amount, checkout.coin) }) : copy.title}
      </Button>
      {currency && !inLyx && <OnrampLink currency={currency} />}
    </NativeDialog>
  )
})

export default PaymentDialog
