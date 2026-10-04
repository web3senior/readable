'use client'

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import clsx from 'clsx'
import { lockPageScroll, unlockPageScroll } from '@/lib/scrollLock'
import styles from './NativeDialog.module.scss'

/**
 * The one modal primitive, built on <dialog>.showModal(): top layer, inert page, focus trap
 * and native Esc. Chrome (size, padding, background, radius) comes from the consumer's
 * className. `lightDismiss` closes on a backdrop click.
 */
const NativeDialog = forwardRef(function NativeDialog({ children, className, lightDismiss = false, onClick, ...rest }, ref) {
  const dialogRef = useRef(null)

  // Per-instance claim on the page-scroll lock, so every close path releases exactly once
  const lockedRef = useRef(false)
  const acquireLock = () => {
    if (lockedRef.current) return
    lockedRef.current = true
    lockPageScroll()
  }
  const releaseLock = () => {
    if (!lockedRef.current) return
    lockedRef.current = false
    unlockPageScroll()
  }

  // A click on the dialog element outside its box can only come from the ::backdrop
  const handleClick = (event) => {
    onClick?.(event)
    if (!lightDismiss || event.defaultPrevented) return
    const el = dialogRef.current
    if (!el || event.target !== el) return
    const rect = el.getBoundingClientRect()
    const inside =
      event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom
    if (!inside) el.close()
  }

  useImperativeHandle(
    ref,
    () => ({
      open: () => {
        const el = dialogRef.current
        if (!el || el.open) return
        el.showModal()
        acquireLock()
      },
      close: () => dialogRef.current?.close(),
    }),
    []
  )

  // Native close, not React's onClose: React re-dispatches close up the tree to parent dialogs
  useEffect(() => {
    const el = dialogRef.current
    if (!el) return
    if (el.open) acquireLock()
    el.addEventListener('close', releaseLock)
    return () => {
      el.removeEventListener('close', releaseLock)
      releaseLock()
    }
  }, [])

  return (
    <dialog ref={dialogRef} className={clsx(styles.dialog, className)} onClick={handleClick} {...rest}>
      {children}
    </dialog>
  )
})

export default NativeDialog
