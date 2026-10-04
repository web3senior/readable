'use client'

// Refcounted because overlays nest; only the outermost release restores the scroller
let locks = 0
let lockedScrollY = 0

export function lockPageScroll() {
  if (locks++ > 0) return
  const html = document.documentElement
  lockedScrollY = window.scrollY

  // Pads by the width actually reclaimed, a no-op wherever scrollbar-gutter held
  const widthBefore = document.body.getBoundingClientRect().width
  html.style.overflowY = 'hidden'
  const reclaimed = document.body.getBoundingClientRect().width - widthBefore
  if (reclaimed > 0) html.style.paddingRight = `${reclaimed}px`
}

export function unlockPageScroll() {
  if (locks === 0 || --locks > 0) return
  const html = document.documentElement
  html.style.overflowY = ''
  html.style.paddingRight = ''
  window.scrollTo({ top: lockedScrollY, left: 0, behavior: 'instant' })
}
