'use client'

import clsx from 'clsx'
import { leave, rise } from 'cube-motion'
import { createRoot } from 'react-dom/client'
import { Spinner } from '@/components/Loading'
import styles from './NextToast.module.scss'

const CONTAINER_ID = 'toast'
const DEFAULT_DURATION = 5000
const DEFAULT_POSITION = 'top-right'
const MAX_VISIBLE = 3
const EXPAND_GAP_PX = 12
const POSITIONS = new Set(['top-left', 'top-right', 'bottom-left', 'bottom-right'])

// Callers say `error`; the style variant is `danger`
const TYPE_ALIASES = { error: 'danger' }

const ICONS = {
  success: `<svg viewBox="0 0 24 24" fill="currentColor"><path fill-rule="evenodd" clip-rule="evenodd" d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10Zm4.774-12.834a1 1 0 0 0-1.548-1.266l-4.3 5.257-2.219-2.22a1 1 0 0 0-1.414 1.415l3 3a1 1 0 0 0 1.481-.075l5-6.111Z"/></svg>`,
  danger: `<svg viewBox="0 0 24 24" fill="currentColor"><path fill-rule="evenodd" clip-rule="evenodd" d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10ZM9.707 8.293a1 1 0 0 0-1.414 1.414L10.586 12l-2.293 2.293a1 1 0 1 0 1.414 1.414L12 13.414l2.293 2.293a1 1 0 0 0 1.414-1.414L13.414 12l2.293-2.293a1 1 0 0 0-1.414-1.414L12 10.586 9.707 8.293Z"/></svg>`,
  warning: `<svg viewBox="0 0 24 24" fill="currentColor"><path fill-rule="evenodd" clip-rule="evenodd" d="M10.257 3.099c.765-1.36 2.722-1.36 3.486 0l8.485 15.098c.75 1.335-.214 2.985-1.743 2.985H3.515c-1.53 0-2.493-1.65-1.743-2.985L10.257 3.1ZM12 8a1 1 0 0 1 1 1v4a1 1 0 1 1-2 0V9a1 1 0 0 1 1-1Zm0 10a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5Z"/></svg>`,
  info: `<svg viewBox="0 0 24 24" fill="currentColor"><path fill-rule="evenodd" clip-rule="evenodd" d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10Zm0-16a1.25 1.25 0 1 0 0 2.5A1.25 1.25 0 0 0 12 6Zm1 5a1 1 0 1 0-2 0v6a1 1 0 1 0 2 0v-6Z"/></svg>`,
}

// A loading toast shows the app's own spinner, rendered by React into the icon slot
const LOADING = 'loading'

const CLOSE_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`

// Newest toast is the front card at --stack-index 0; older ones peek out behind it
const restack = (container) => {
  const items = [...container.children]
  const direction = container.dataset.position?.startsWith('bottom') ? -1 : 1
  let offset = 0
  for (let i = items.length - 1; i >= 0; i--) {
    const el = items[i]
    const depth = items.length - 1 - i
    el.style.setProperty('--stack-index', depth)
    el.style.setProperty('--expand-offset', `${direction * offset}px`)
    el.style.zIndex = String(items.length - depth)
    el.classList.toggle(styles['toast--buried'], depth >= MAX_VISIBLE)
    offset += el.offsetHeight + EXPAND_GAP_PX
  }
}

// A loading toast has no finite default; the caller's handle resolves it
const resolveDuration = (opts, resolvedType) => opts.duration ?? (resolvedType === LOADING ? Infinity : DEFAULT_DURATION)

const NOOP_HANDLE = { update: () => false, dismiss: () => {} }

/**
 * Imperative toast that outlives the component that raised it.
 * @returns {{ update: (message?: string, type?: string, options?: object|number) => boolean, dismiss: () => void }}
 */
export const toast = (message, type = 'info', options) => {
  const container = document.getElementById(CONTAINER_ID)
  if (!container) return NOOP_HANDLE

  const opts = typeof options === 'number' ? { duration: options } : (options ?? {})
  let resolvedType = TYPE_ALIASES[type] ?? type
  let duration = resolveDuration(opts, resolvedType)
  if (POSITIONS.has(opts.position)) container.dataset.position = opts.position

  // Re-showing moves the container to the front of the top layer, above any open popover
  if (container.matches(':popover-open')) container.hidePopover()
  container.showPopover()

  if (!container.dataset.expandBound) {
    container.dataset.expandBound = 'true'
    container.addEventListener('mouseenter', () => container.classList.add(styles['next-toast--expanded']))
    container.addEventListener('mouseleave', () => container.classList.remove(styles['next-toast--expanded']))
  }

  const card = document.createElement('div')
  card.setAttribute('role', resolvedType === 'danger' ? 'alert' : 'status')

  const icon = document.createElement('span')
  icon.className = styles.toast__icon

  const text = document.createElement('span')
  text.className = styles.toast__message
  text.textContent = message

  let spinner = null

  // Detached first, unmounted after, so an update made during a React commit never unmounts mid-commit
  const stopSpinner = () => {
    if (!spinner) return
    const root = spinner
    spinner = null
    queueMicrotask(() => root.unmount())
  }

  const applyType = (nextType) => {
    resolvedType = TYPE_ALIASES[nextType] ?? nextType
    card.className = clsx(styles.toast, styles[`toast--${resolvedType}`])
    if (resolvedType === LOADING) {
      if (!spinner) {
        const host = document.createElement('span')
        icon.replaceChildren(host)
        spinner = createRoot(host)
        spinner.render(<Spinner label={null} />)
      }
    } else {
      stopSpinner()
      if (ICONS[resolvedType]) icon.innerHTML = ICONS[resolvedType]
    }
    if (resolvedType === LOADING || ICONS[resolvedType]) {
      if (!icon.isConnected) card.insertBefore(icon, text)
    } else if (icon.isConnected) {
      icon.remove()
    }
  }

  card.appendChild(text)
  applyType(type)

  const close = document.createElement('button')
  close.type = 'button'
  close.className = styles.toast__close
  close.innerHTML = CLOSE_ICON
  close.setAttribute('aria-label', 'Dismiss')
  card.appendChild(close)

  container.appendChild(card)
  restack(container)
  // cube moves `translate`, so it composes with the stack's `transform`
  rise(card)

  let timer
  let dismissed = false

  const pause = () => window.clearTimeout(timer)

  const arm = () => {
    // setTimeout would coerce Infinity to 0 and fire at once
    if (!Number.isFinite(duration)) return
    timer = window.setTimeout(dismiss, duration)
  }

  const dismiss = () => {
    if (dismissed) return
    dismissed = true
    window.clearTimeout(timer)
    container.removeEventListener('mouseenter', pause)
    container.removeEventListener('mouseleave', arm)
    card.classList.add(styles['toast--exit'])
    // An interrupted exit rejects with AbortError and leaves the card where it is
    Promise.all(leave(card).map((animation) => animation.finished)).then(
      () => {
        card.remove()
        stopSpinner()
        restack(container)
      },
      () => {}
    )
  }

  // Morphs the toast in place; returns false once the reader already closed it
  const update = (nextMessage, nextType = resolvedType, nextOptions) => {
    if (dismissed) return false
    const nextOpts = typeof nextOptions === 'number' ? { duration: nextOptions } : (nextOptions ?? {})
    duration = resolveDuration(nextOpts, TYPE_ALIASES[nextType] ?? nextType)
    if (nextMessage != null) text.textContent = nextMessage
    applyType(nextType)
    restack(container)
    pause()
    if (!container.matches(':hover')) arm()
    return true
  }

  close.addEventListener('click', dismiss)
  container.addEventListener('mouseenter', pause)
  container.addEventListener('mouseleave', arm)

  arm()

  return { update, dismiss }
}

export default function NextToast({ position = DEFAULT_POSITION }) {
  return (
    <div
      id={CONTAINER_ID}
      popover="manual"
      aria-live="polite"
      data-position={POSITIONS.has(position) ? position : DEFAULT_POSITION}
      className={styles['next-toast']}
    />
  )
}
