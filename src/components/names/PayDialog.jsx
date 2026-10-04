'use client'

import { forwardRef, useId, useImperativeHandle, useRef, useState } from 'react'
import { parseUnits } from 'viem'
import { XIcon } from '@phosphor-icons/react'
import NativeDialog from '@/components/ui/NativeDialog'
import AddressAvatar from '@/components/ui/AddressAvatar'
import Button from '@/components/ui/Button'
import Field from '@/components/ui/Field'
import OnrampLink from '@/components/search/OnrampLink'
import { toast } from '@/components/NextToast'
import { site } from '@/config/site'
import { formatAmount, truncateAddress } from '@/lib/format'
import { payName } from '@/lib/pay'
import { paymentError, waitForReceipt } from '@/lib/registryActions'
import styles from './PayDialog.module.scss'

const { pay } = site
const fill = (template, values) => Object.entries(values).reduce((text, [key, value]) => text.replaceAll(`{${key}}`, value), template)

// What was typed, in wei, or null when it isn't an amount above zero
const toUnits = (text, decimals) => {
  const value = String(text ?? '').trim().replace(',', '.')
  if (!/^\d+(\.\d+)?$/.test(value)) return null
  try {
    const units = parseUnits(value, decimals)
    return units > 0n ? units : null
  } catch {
    return null
  }
}

/**
 * Sends ETH to a name: to the wallet it points to when the payer signs,
 * looked up again at that moment. Closes once the wallet signs; the toast follows the transfer.
 * `target` is where the name pointed when its page was read, shown so the payer sees who it is.
 */
const PayDialog = forwardRef(function PayDialog({ candidate, target, currency }, ref) {
  const titleId = useId()
  const dialogRef = useRef(null)
  const [amount, setAmount] = useState('')
  const [sending, setSending] = useState(false)
  const units = toUnits(amount, currency.decimals)

  useImperativeHandle(
    ref,
    () => ({
      open: () => {
        setAmount('')
        dialogRef.current?.open()
      },
      close: () => dialogRef.current?.close(),
    }),
    []
  )

  const send = async (event) => {
    event.preventDefault()
    if (!units) return
    setSending(true)
    try {
      const { hash } = await payName({ candidate, amount: units, currency })
      dialogRef.current?.close()
      const values = { amount: formatAmount(units, currency), name: candidate.name }
      const progress = toast(`${fill(pay.pending, values)}…`, 'loading')
      const report = (message, type) => {
        if (!progress.update(message, type)) toast(message, type)
      }
      waitForReceipt(hash)
        .then((receipt) => report(receipt.status === 'success' ? fill(pay.done, values) : `${fill(pay.pending, values)} failed onchain`, receipt.status === 'success' ? 'success' : 'error'))
        .catch((error) => report(paymentError(error), 'error'))
    } catch (error) {
      toast(paymentError(error), 'error')
    } finally {
      setSending(false)
    }
  }

  return (
    <NativeDialog ref={dialogRef} lightDismiss className={styles.pay} aria-labelledby={titleId}>
      <form className={styles.pay__form} onSubmit={send}>
        <header className={styles.pay__header}>
          <h2 id={titleId} className={styles.pay__title}>
            {pay.title}{' '}
            <span className={styles.pay__name} dir="auto">
              {candidate.name}
            </span>
          </h2>
          <Button variant="ghost" size="sm" iconOnly aria-label="Close" icon={<XIcon size={16} weight="bold" />} onClick={() => dialogRef.current?.close()} />
        </header>

        <div className={styles.pay__to}>
          <span className={styles.pay__term}>{pay.to}</span>
          <span className={styles.pay__identity}>
            <AddressAvatar address={target} size="sm" />
            <span title={target}>{truncateAddress(target)}</span>
          </span>
        </div>

        <Field
          label={`${pay.amount} (${currency.symbol})`}
          inputMode="decimal"
          autoComplete="off"
          placeholder="0.00"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          disabled={sending}
        />
        <div className={styles.pay__presets}>
          {pay.presets.map((preset) => (
            <button key={preset} type="button" className={styles.pay__preset} onClick={() => setAmount(String(preset))} disabled={sending}>
              {preset} {currency.symbol}
            </button>
          ))}
        </div>

        <p className={styles.pay__note}>{fill(pay.note, { name: candidate.name })}</p>

        <Button type="submit" size="lg" block loading={sending} disabled={!units}>
          {units ? `${pay.action} ${formatAmount(units, currency)}` : pay.action}
        </Button>
        <OnrampLink currency={currency} />
      </form>
    </NativeDialog>
  )
})

export default PayDialog
