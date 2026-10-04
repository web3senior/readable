'use client'

import { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import { docGroups, docSectionIds } from '@/config/docs'
import { site } from '@/config/site'
import styles from './DocsNav.module.scss'

// The band of the screen a section is read in: from where an anchor lands it down to this far
// from the bottom. The whole screen would hold three sections at once on a tall one
const BAND_BOTTOM = '-60%'
// Lets a section that an anchor has just landed count as inside the band
const BAND_SLACK_PX = 8

/**
 * The docs' contents, with the section being read lit: a sidebar on a wide screen, one row
 * under the header on a narrow one.
 */
export default function DocsNav() {
  const [activeId, setActiveId] = useState(docSectionIds[0])
  const listRef = useRef(null)

  useEffect(() => {
    let observer

    // A frame later the page has its first layout, so the band is measured against real positions
    const frame = requestAnimationFrame(() => {
      const sections = docSectionIds.map((id) => document.getElementById(id)).filter(Boolean)
      if (!sections.length) return

      // Where an anchor lands a section is the stylesheet's to say
      const landing = parseFloat(getComputedStyle(sections[0]).scrollMarginTop) || 0
      const visible = new Set()

      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) visible.add(entry.target.id)
            else visible.delete(entry.target.id)
          })
          // The order of the page breaks a tie, so the light only moves the way the page does
          const first = docSectionIds.find((id) => visible.has(id))
          if (first) setActiveId(first)
        },
        { rootMargin: `-${Math.max(landing - BAND_SLACK_PX, 0)}px 0px ${BAND_BOTTOM} 0px`, threshold: 0 }
      )
      sections.forEach((section) => observer.observe(section))
    })

    return () => {
      cancelAnimationFrame(frame)
      observer?.disconnect()
    }
  }, [])

  // The contents scroll on their own when they don't fit: sideways as a row on a narrow screen,
  // down as a sidebar on a short one. The lit entry is kept in the middle of what shows
  useEffect(() => {
    const list = listRef.current
    if (!list || (list.scrollWidth <= list.clientWidth && list.scrollHeight <= list.clientHeight)) return
    const link = list.querySelector('[aria-current]')
    if (!link) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    list.scrollTo({
      left: link.offsetLeft - (list.clientWidth - link.offsetWidth) / 2,
      top: link.offsetTop - (list.clientHeight - link.offsetHeight) / 2,
      behavior: reduced ? 'auto' : 'smooth',
    })
  }, [activeId])

  return (
    <nav className={styles.nav} aria-label={site.docs.navLabel}>
      <div ref={listRef} className={styles.nav__inner}>
        {docGroups.map((group) => (
          <div key={group.label} className={styles.nav__group}>
            <p className={styles.nav__label}>{group.label}</p>
            <ul className={styles.nav__list}>
              {group.items.map((item) => (
                <li key={item.id}>
                  <a
                    href={`#${item.id}`}
                    className={clsx(styles.nav__link, activeId === item.id && styles['nav__link--active'])}
                    aria-current={activeId === item.id ? 'location' : undefined}
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  )
}
