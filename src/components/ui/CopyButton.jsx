'use client'

import { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import { CheckIcon, CopyIcon } from '@phosphor-icons/react'
import { toast } from '@/components/NextToast'
import styles from './CopyButton.module.scss'

const CONFIRM_MS = 1600

/**
 * Copies a value and confirms in place; a toast is opt-in for buttons that scroll away.
 * @param {string} props.value A value starting with `/` is copied as an absolute URL.
 * @param {React.ReactNode} [props.label] Visible label; icon-only without it.
 * @param {'ghost'|'chip'} [props.variant='ghost']
 */
export default function CopyButton({
  value,
  label,
  title = 'Copy',
  copiedTitle = 'Copied',
  toastMessage,
  size = 14,
  variant = 'ghost',
  className,
  onCopied,
}) {
  const [copied, setCopied] = useState(false)
  const timerRef = useRef(null)

  useEffect(() => () => clearTimeout(timerRef.current), [])

  const handleCopy = async (event) => {
    event.preventDefault()
    event.stopPropagation()
    if (!value) return

    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable')
      await navigator.clipboard.writeText(value.startsWith('/') ? `${window.location.origin}${value}` : value)
      setCopied(true)
      clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => setCopied(false), CONFIRM_MS)
      if (toastMessage) toast(toastMessage, 'success')
      onCopied?.()
    } catch {
      toast('Could not copy. Your browser blocked the clipboard.', 'error')
    }
  }

  return (
    <button
      type="button"
      className={clsx(styles.copy, styles[`copy--${variant}`], copied && styles['copy--copied'], className)}
      onClick={handleCopy}
      title={copied ? copiedTitle : title}
      aria-label={copied ? copiedTitle : title}
    >
      {copied ? <CheckIcon size={size} weight="bold" aria-hidden="true" /> : <CopyIcon size={size} aria-hidden="true" />}
      {label && <span>{copied ? copiedTitle : label}</span>}
    </button>
  )
}
