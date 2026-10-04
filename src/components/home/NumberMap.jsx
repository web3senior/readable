'use client'

import { useEffect, useRef, useState } from 'react'
import { Rise } from 'cube-motion/react'
import { AddressBookIcon, CoinsIcon, MagnifyingGlassIcon, RobotIcon, WalletIcon } from '@phosphor-icons/react'
import clsx from 'clsx'
import { site } from '@/config/site'
import { truncateAddress } from '@/lib/format'
import styles from './NumberMap.module.scss'

const { howItWorks } = site
const { kinds } = howItWorks.map

const ICONS = { wallet: WalletIcon, chains: CoinsIcon, card: AddressBookIcon, agent: RobotIcon }

// The tree's sizes, in rem: a kind's height and the gap under it, a row's, and the height every
// column is centered in. The lines are drawn from the same numbers, so CSS takes them from here
const KIND = { height: 3, gap: 1 }
const ROW = { height: 3, gap: 0.5 }
const HEIGHT = 17.5
// The lines' own width, which CSS stretches to the room between two columns
const SPAN = 10
// How long each kind shows its rows
const DWELL_MS = 3200
// How much of the tree is on screen before the kinds take turns
const PLAY_THRESHOLD = 0.5

/** Where the middle of each of `count` items falls, the items centered in the tree's height. */
const centers = (count, { height, gap }) => {
  const top = (HEIGHT - (count * height + (count - 1) * gap)) / 2
  return Array.from({ length: count }, (_, index) => top + index * (height + gap) + height / 2)
}

/** A line that leaves flat at `from` and arrives flat at `to`. */
const curve = (from, to) => `M0 ${from} C${SPAN * 0.55} ${from} ${SPAN * 0.4} ${to} ${SPAN} ${to}`

function Lines({ from, to, active, className }) {
  return (
    <svg className={clsx(styles.map__lines, className)} viewBox={`0 0 ${SPAN} ${HEIGHT}`} preserveAspectRatio="none" aria-hidden="true">
      {to.map((y, index) => (
        <path
          key={index}
          d={curve(from, y)}
          vectorEffect="non-scaling-stroke"
          className={clsx(styles.map__line, (active ?? index) === index && styles['map__line--active'])}
        />
      ))}
    </svg>
  )
}

/**
 * What one number answers with, as a tree on a tilted plane: the number, the kinds of thing it
 * carries, and the rows of one kind, the kinds taking turns while the tree is on screen. The
 * mouse over it holds the kind shown; with reduced motion it rests on the first. A phone shows
 * the number and its kinds alone.
 */
export default function NumberMap({ number, className }) {
  const ref = useRef(null)
  const [active, setActive] = useState(0)
  const [visible, setVisible] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [still, setStill] = useState(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setStill(window.matchMedia('(prefers-reduced-motion: reduce)').matches)
        setVisible(entry.isIntersecting)
      },
      { threshold: PLAY_THRESHOLD }
    )
    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (still || !visible || hovered) return
    const timer = setInterval(() => setActive((index) => (index + 1) % kinds.length), DWELL_MS)
    return () => clearInterval(timer)
  }, [still, visible, hovered])

  // A mouse only: a tap would hold the tree with nothing to move off it
  const hover = (over) => (event) => event.pointerType === 'mouse' && setHovered(over)

  const kind = kinds[active]
  const kindYs = centers(kinds.length, KIND)
  const rowYs = centers(kind.rows.length, ROW)

  return (
    <div
      ref={ref}
      className={clsx(styles.map, className)}
      role="img"
      aria-label={howItWorks.map.label.replace('{number}', number)}
      onPointerEnter={hover(true)}
      onPointerLeave={hover(false)}
      style={{
        '--map-height': `${HEIGHT}rem`,
        '--kind-height': `${KIND.height}rem`,
        '--kind-gap': `${KIND.gap}rem`,
        '--row-height': `${ROW.height}rem`,
        '--row-gap': `${ROW.gap}rem`,
      }}
    >
      <div className={styles.map__plane}>
        {/* Out of focus, before and behind the tree: the search the number was typed into */}
        <span className={clsx(styles.map__ghost, styles['map__ghost--near'])} aria-hidden="true">
          <MagnifyingGlassIcon size={22} weight="bold" />
          <span className={styles.map__bar} />
        </span>
        <span className={clsx(styles.map__ghost, styles['map__ghost--far'])} aria-hidden="true">
          <span className={styles.map__bar} />
        </span>

        <div className={styles.map__source}>
          <span className={styles.map__number}>{number}</span>
          <span className={clsx(styles.map__dot, styles['map__dot--active'])} />
        </div>

        <Lines from={HEIGHT / 2} to={kindYs} active={active} className={styles['map__lines--kinds']} />

        <div className={styles.map__kinds}>
          {kinds.map((item, index) => {
            const Icon = ICONS[item.id]
            const selected = index === active
            return (
              <div key={item.id} className={clsx(styles.map__kind, selected && styles['map__kind--active'])}>
                <span className={styles['map__kind-card']}>
                  <Icon size={18} weight={selected ? 'fill' : 'regular'} />
                  {item.label}
                </span>
                <span className={clsx(styles.map__dot, selected && styles['map__dot--active'])} />
              </div>
            )
          })}
        </div>

        <Rise key={kind.id} className={styles.map__fan}>
          <Lines from={kindYs[active]} to={rowYs} className={styles['map__lines--rows']} />
          <div className={styles.map__rows}>
            {kind.rows.map((row) => {
              const value = row.value ?? howItWorks.holder.address
              return (
                <span key={row.label} className={styles.map__row}>
                  <span className={styles['map__row-label']}>{row.label}</span>
                  <span className={styles['map__row-value']}>{row.address ? truncateAddress(value, 8, 6) : value}</span>
                </span>
              )
            })}
          </div>
        </Rise>
      </div>
    </div>
  )
}
