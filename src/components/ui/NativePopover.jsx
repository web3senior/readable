'use client'

import { cloneElement, forwardRef, isValidElement, useCallback, useEffect, useId, useImperativeHandle, useRef } from 'react'
import clsx from 'clsx'
import styles from './NativePopover.module.scss'

const GAP = 6
const MARGIN = 8

// Triggers inside fixed/sticky UI keep a viewport-fixed panel; in-flow triggers scroll with the page
function isViewportAnchored(el) {
  let node = el
  while (node && node !== document.body) {
    const position = getComputedStyle(node).position
    if (position === 'fixed' || position === 'sticky') return true
    node = node.parentElement
  }
  return false
}

const FLIP = {
  'bottom-start': 'top-start',
  'bottom-end': 'top-end',
  'top-start': 'bottom-start',
  'top-end': 'bottom-end',
  'right-start': 'left-start',
  'right-end': 'left-end',
  'left-start': 'right-start',
  'left-end': 'right-end',
  top: 'bottom',
  bottom: 'top',
  left: 'right',
  right: 'left',
}

function computePosition(triggerRect, pw, ph, placement) {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const { left: tx, top: ty, width: tw, height: th } = triggerRect

  if (placement === 'center') return { top: '50%', left: '50%', transform: '', placement }

  const coordsFor = (side) => {
    switch (side) {
      case 'bottom-end':   return { top: ty + th + GAP, left: tx + tw - pw }
      case 'top-start':    return { top: ty - ph - GAP, left: tx }
      case 'top-end':      return { top: ty - ph - GAP, left: tx + tw - pw }
      case 'right-start':  return { top: ty, left: tx + tw + GAP }
      case 'right-end':    return { top: ty + th - ph, left: tx + tw + GAP }
      case 'left-start':   return { top: ty, left: tx - pw - GAP }
      case 'left-end':     return { top: ty + th - ph, left: tx - pw - GAP }
      case 'top':          return { top: ty - ph - GAP, left: tx + tw / 2 - pw / 2 }
      case 'bottom':       return { top: ty + th + GAP, left: tx + tw / 2 - pw / 2 }
      case 'left':         return { top: ty + th / 2 - ph / 2, left: tx - pw - GAP }
      case 'right':        return { top: ty + th / 2 - ph / 2, left: tx + tw + GAP }
      case 'bottom-start':
      default:             return { top: ty + th + GAP, left: tx }
    }
  }

  // Flip only when the preferred side overflows and the opposite side fully fits
  let resolved = placement
  let { top, left } = coordsFor(placement)
  const isVertical = placement.startsWith('top') || placement.startsWith('bottom')
  const overflows = isVertical ? top < MARGIN || top + ph > vh - MARGIN : left < MARGIN || left + pw > vw - MARGIN
  if (overflows) {
    const flipped = FLIP[placement]
    const alt = coordsFor(flipped)
    const altFits = isVertical
      ? alt.top >= MARGIN && alt.top + ph <= vh - MARGIN
      : alt.left >= MARGIN && alt.left + pw <= vw - MARGIN
    if (altFits) {
      resolved = flipped
      top = alt.top
      left = alt.left
    }
  }

  left = Math.max(MARGIN, Math.min(left, vw - pw - MARGIN))
  top = Math.max(MARGIN, Math.min(top, vh - ph - MARGIN))

  return { top: `${top}px`, left: `${left}px`, bottom: 'auto', right: 'auto', transform: '', placement: resolved }
}

/** Measures a laid-out panel against its trigger and writes its coordinates. */
export function anchorElement(panelEl, triggerEl, placement, matchTriggerWidth = false) {
  if (!panelEl || !triggerEl) return
  // Measure from a clean slate so a shrink-to-fit panel never sizes against stale coords
  panelEl.style.position = 'fixed'
  panelEl.style.top = '0px'
  panelEl.style.left = '0px'
  panelEl.style.bottom = 'auto'
  panelEl.style.right = 'auto'
  if (matchTriggerWidth) panelEl.style.width = `${triggerEl.offsetWidth}px`
  const rect = triggerEl.getBoundingClientRect()
  const anchored = placement !== 'center'
  const { placement: resolvedPlacement, ...pos } = computePosition(rect, panelEl.offsetWidth, panelEl.offsetHeight, placement)
  panelEl.dataset.placement = resolvedPlacement
  if (anchored && !isViewportAnchored(triggerEl)) {
    panelEl.style.position = 'absolute'
    pos.top = `${parseFloat(pos.top) + window.scrollY}px`
    pos.left = `${parseFloat(pos.left) + window.scrollX}px`
  }
  Object.assign(panelEl.style, pos)
}

/**
 * Anchored, non-modal top-layer panel on the Popover API. Backdrops never block clicks by spec,
 * so anything that must block the page is a NativeDialog instead. Pass `anchorRef` without a
 * `trigger` to hang the panel off any element and drive it through the ref's open/close.
 */
const NativePopover = forwardRef(function NativePopover(
  {
    trigger,
    anchorRef,
    children,
    type = 'auto',
    action = 'toggle',
    placement = 'bottom-start',
    matchTriggerWidth = false,
    onBeforeToggle,
    onToggle,
    className,
    ...rest
  },
  ref
) {
  const rawId = useId()
  const popoverId = `popover-${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}`
  const popoverRef = useRef(null)
  const triggerRef = useRef(null)

  const getAnchor = useCallback(() => anchorRef?.current ?? triggerRef.current, [anchorRef])

  const reposition = useCallback(() => {
    anchorElement(popoverRef.current, getAnchor(), placement, matchTriggerWidth)
  }, [getAnchor, placement, matchTriggerWidth])

  // At beforetoggle the panel is still display:none, so measure on the next frame, hidden
  const applyPosition = useCallback(() => {
    const panel = popoverRef.current
    if (!getAnchor() || !panel) return
    panel.style.visibility = 'hidden'
    requestAnimationFrame(() => {
      reposition()
      panel.style.visibility = ''
    })
  }, [getAnchor, reposition])

  useEffect(() => {
    const node = popoverRef.current
    if (!node) return

    const handleBeforeToggle = (event) => {
      if (event.newState === 'open') applyPosition()
      onBeforeToggle?.(event)
    }

    const handleKeyDown = (event) => {
      if (event.key !== 'Escape') return
      try {
        node.hidePopover()
      } catch {
        // Already closed
      }
    }

    let frameId = null
    const schedule = (task) => {
      if (frameId) return
      frameId = requestAnimationFrame(() => {
        frameId = null
        if (node.matches(':popover-open')) task()
      })
    }
    // Scrolling closes the panel once its trigger leaves the viewport; resizing re-anchors it
    const handleScroll = () =>
      schedule(() => {
        const rect = getAnchor()?.getBoundingClientRect()
        if (!rect) return
        const outOfView = rect.bottom < 0 || rect.top > window.innerHeight || rect.right < 0 || rect.left > window.innerWidth
        if (outOfView) node.hidePopover()
      })
    const handleResize = () => schedule(reposition)

    node.addEventListener('beforetoggle', handleBeforeToggle)
    if (onToggle) node.addEventListener('toggle', onToggle)
    window.addEventListener('keydown', handleKeyDown, true)
    window.addEventListener('scroll', handleScroll, true)
    window.addEventListener('resize', handleResize)

    return () => {
      node.removeEventListener('beforetoggle', handleBeforeToggle)
      if (onToggle) node.removeEventListener('toggle', onToggle)
      window.removeEventListener('keydown', handleKeyDown, true)
      window.removeEventListener('scroll', handleScroll, true)
      window.removeEventListener('resize', handleResize)
      if (frameId) cancelAnimationFrame(frameId)
    }
  }, [applyPosition, getAnchor, reposition, onBeforeToggle, onToggle])

  const close = useCallback(() => {
    const el = popoverRef.current
    if (el?.matches(':popover-open')) el.hidePopover()
  }, [])

  const open = useCallback(() => {
    const el = popoverRef.current
    if (!el || el.matches(':popover-open')) return
    el.showPopover()
  }, [])

  useImperativeHandle(ref, () => ({ open, close }), [open, close])

  const triggerProps = {
    popoverTarget: popoverId,
    popoverTargetAction: action,
    'aria-controls': popoverId,
  }

  const triggerNode = !trigger ? null : isValidElement(trigger) ? (
    cloneElement(trigger, {
      ...triggerProps,
      ref: triggerRef,
      type: trigger.props.type ?? 'button',
    })
  ) : (
    <button type="button" {...triggerProps} ref={triggerRef} className={styles.trigger}>
      {trigger}
    </button>
  )

  return (
    <>
      {triggerNode}
      <div
        id={popoverId}
        ref={popoverRef}
        popover={type}
        data-placement={placement}
        className={clsx(styles.panel, className)}
        {...rest}
      >
        {typeof children === 'function' ? children({ close, open }) : children}
      </div>
    </>
  )
})

export default NativePopover
