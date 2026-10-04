'use client'

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import clsx from 'clsx'
import { XIcon } from '@phosphor-icons/react'
import NativeDialog from '@/components/ui/NativeDialog'
import Button from '@/components/ui/Button'
import styles from './DialogSheet.module.scss'

// The stylesheet says when the sheet is docked, so the breakpoint lives in one place
const DOCKED_PROPERTY = '--sheet-docked'
// Releasing past this fraction of the sheet's height, or flinging down faster than
// FLING_VELOCITY px/ms, dismisses; anything less snaps back
const DISMISS_FRACTION = 0.33
const FLING_VELOCITY = 0.5
const FLING_MIN_DISTANCE = 24
const RECOVER_VELOCITY = -0.15
// A finger that rested this long before lifting has no fling left
const FLING_STALE_MS = 100
// For the settles whose transitionend never fires
const SETTLE_TIMEOUT_MS = 400

const isDocked = (el) => getComputedStyle(el).getPropertyValue(DOCKED_PROPERTY).trim() === '1'

function afterTransform(el, done) {
  let settled = false
  const settle = () => {
    if (settled) return
    settled = true
    el.removeEventListener('transitionend', onEnd)
    clearTimeout(timer)
    done()
  }
  const onEnd = (event) => {
    if (event.target === el && event.propertyName === 'transform') settle()
  }
  el.addEventListener('transitionend', onEnd)
  const timer = setTimeout(settle, SETTLE_TIMEOUT_MS)
}

// A scrolled container keeps its own pans; only one at rest cedes them to the sheet
function hasScrolledAncestor(node, stopEl) {
  for (let el = node; el && el !== stopEl; el = el.parentElement) {
    if (el.scrollTop > 0) return true
  }
  return false
}

/**
 * The bottom-sheet drag. Move and end listeners attach natively for the gesture's duration:
 * React delivers touchmove passively, and a passive listener can't hold the page still.
 * The transitions themselves live in the stylesheet, keyed off `data-drag`.
 */
function createSheetGesture() {
  let el = null
  let touchId = null
  let startTarget = null
  let startX = 0
  let startY = 0
  let lastY = 0
  let lastT = 0
  let velocity = 0
  let decided = false
  let dragging = false
  let dismissing = false

  const teardown = () => {
    touchId = null
    decided = false
    dragging = false
    if (!el) return
    el.removeEventListener('touchmove', onMove)
    el.removeEventListener('touchend', onEnd)
    el.removeEventListener('touchcancel', onCancel)
  }

  const settle = (dismiss) => {
    const sheet = el
    if (dismiss) dismissing = true
    sheet.dataset.drag = 'settling'
    sheet.style.transform = dismiss ? 'translateY(100%)' : ''
    afterTransform(sheet, () => {
      // A reopen mid-slide already reset the sheet
      if (dismiss && !dismissing) return
      delete sheet.dataset.drag
      if (!dismiss) return
      dismissing = false
      // The inline transform keeps the sheet parked offscreen while the backdrop fades
      sheet.close()
    })
  }

  const findTouch = (list) => {
    for (const touch of list) if (touch.identifier === touchId) return touch
    return null
  }

  const onMove = (event) => {
    const touch = findTouch(event.touches)
    if (!touch) return
    const dx = touch.clientX - startX
    const dy = touch.clientY - startY
    if (!decided) {
      if (dx === 0 && dy === 0) return
      decided = true
      // Only a mostly vertical, downward pan that no inner scroller claims drags the sheet
      if (dy <= 0 || Math.abs(dx) > dy || hasScrolledAncestor(startTarget, el)) {
        teardown()
        return
      }
      dragging = true
      el.dataset.drag = 'active'
    }
    if (!dragging) return
    event.preventDefault()
    el.style.transform = `translateY(${Math.max(0, dy)}px)`
    const dt = event.timeStamp - lastT
    // Smoothed, so one hesitant frame in a committed fling can't zero it
    if (dt > 0) velocity = ((touch.clientY - lastY) / dt) * 0.6 + velocity * 0.4
    lastY = touch.clientY
    lastT = event.timeStamp
  }

  const onEnd = (event) => {
    if (!findTouch(event.changedTouches)) return
    const wasDragging = dragging
    const flingVelocity = event.timeStamp - lastT > FLING_STALE_MS ? 0 : velocity
    teardown()
    if (!wasDragging) return
    const dy = Math.max(0, lastY - startY)
    // An upward fling always recovers the sheet, however far it was pulled
    const dismiss =
      flingVelocity >= RECOVER_VELOCITY &&
      (dy > el.offsetHeight * DISMISS_FRACTION || (flingVelocity > FLING_VELOCITY && dy > FLING_MIN_DISTANCE))
    settle(dismiss)
  }

  const onCancel = (event) => {
    if (!findTouch(event.changedTouches)) return
    const wasDragging = dragging
    teardown()
    if (wasDragging) settle(false)
  }

  const onTouchStart = (event) => {
    if (touchId !== null || dismissing) return
    if (event.touches.length !== 1) return
    const sheet = event.currentTarget
    if (!isDocked(sheet)) return
    const touch = event.touches[0]
    // Backdrop touches reach the dialog element too; those stay lightDismiss's business
    const rect = sheet.getBoundingClientRect()
    if (touch.clientY < rect.top || touch.clientX < rect.left || touch.clientX > rect.right) return

    el = sheet
    touchId = touch.identifier
    startTarget = event.target
    startX = touch.clientX
    startY = touch.clientY
    lastY = touch.clientY
    lastT = event.timeStamp
    velocity = 0
    el.addEventListener('touchmove', onMove, { passive: false })
    el.addEventListener('touchend', onEnd)
    el.addEventListener('touchcancel', onCancel)
  }

  // Clears what a dismissal parked on the element, so the sheet always opens from rest
  const reset = () => {
    teardown()
    dismissing = false
    if (!el) return
    el.style.transform = ''
    delete el.dataset.drag
  }

  return { onTouchStart, reset }
}

/**
 * The shared modal layout, one layer above NativeDialog: header, grouped rows and footnote.
 * On a phone it docks to the bottom edge and drags down to dismiss; from the `sm` breakpoint
 * it is a centered dialog. Everything not listed forwards to NativeDialog, the ref included.
 * @param {boolean} [props.swipeDismiss=true] Off for sheets that must not close casually.
 */
const DialogSheet = forwardRef(function DialogSheet({ children, className, swipeDismiss = true, onTouchStart, ...rest }, ref) {
  const innerRef = useRef(null)
  const gestureRef = useRef(null)
  if (gestureRef.current === null) gestureRef.current = createSheetGesture()

  useImperativeHandle(
    ref,
    () => ({
      open: () => {
        gestureRef.current.reset()
        innerRef.current?.open()
      },
      close: () => innerRef.current?.close(),
    }),
    []
  )

  useEffect(() => {
    const gesture = gestureRef.current
    return () => gesture.reset()
  }, [])

  const handleTouchStart = (event) => {
    onTouchStart?.(event)
    if (swipeDismiss) gestureRef.current.onTouchStart(event)
  }

  return (
    <NativeDialog ref={innerRef} className={clsx(styles.sheet, className)} onTouchStart={handleTouchStart} {...rest}>
      {children}
    </NativeDialog>
  )
})

/** Centered title; the close button appears when `onClose` is given. */
function Header({ id, title, description, onClose, closeLabel, className }) {
  return (
    <header className={clsx(styles.sheet__header, className)}>
      <h2 id={id} className={styles.sheet__title}>
        {title}
      </h2>

      {onClose && (
        <Button
          variant="ghost"
          size="sm"
          iconOnly
          className={styles.sheet__close}
          aria-label={closeLabel}
          icon={<XIcon size={16} weight="bold" />}
          onClick={onClose}
        />
      )}

      {description && <p className={styles.sheet__description}>{description}</p>}
    </header>
  )
}

/** The scrolling region between header and footer. */
function Body({ children, className }) {
  return <div className={clsx(styles.sheet__body, className)}>{children}</div>
}

/** Rows under one rounded outline, divided by hairlines. */
function Group({ children, className }) {
  return <div className={clsx(styles.sheet__group, className)}>{children}</div>
}

/** Leading icon, name with an optional hint, trailing meta. A <button> when it has an onClick. */
function Row({ icon, name, hint, meta, onClick, disabled, className, ...rest }) {
  const interactive = Boolean(onClick)
  const Element = interactive ? 'button' : 'div'

  return (
    <Element
      className={clsx(styles.sheet__row, interactive && styles['sheet__row--interactive'], className)}
      onClick={onClick}
      disabled={interactive ? disabled : undefined}
      type={interactive ? 'button' : undefined}
      {...rest}
    >
      {icon && <span className={styles.sheet__icon}>{icon}</span>}

      <span className={styles.sheet__label}>
        <span className={styles.sheet__name}>{name}</span>
        {hint && <span className={styles.sheet__hint}>{hint}</span>}
      </span>

      {meta && <span className={styles.sheet__meta}>{meta}</span>}
    </Element>
  )
}

/** Muted fine print below the body. */
function Footer({ children, className }) {
  return <footer className={clsx(styles.sheet__footer, className)}>{children}</footer>
}

DialogSheet.Header = Header
DialogSheet.Body = Body
DialogSheet.Group = Group
DialogSheet.Row = Row
DialogSheet.Footer = Footer

export default DialogSheet
