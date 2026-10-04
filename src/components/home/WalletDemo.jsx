'use client'

import { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import { leave, rise } from 'cube-motion'
import { useMorph } from 'cube-motion/react'
import AddressAvatar from '@/components/ui/AddressAvatar'
import { site } from '@/config/site'
import useNumberNamespace from '@/hooks/useNumberNamespace'
import { truncateAddress } from '@/lib/format'
import { formatNumber } from '@/lib/query/numbers'
import styles from './WalletDemo.module.scss'

const { holders, label } = site.hero

// How long each face is read before it changes
const HOLD_MS = { address: 2200, number: 2800 }
// What is kept of an address where the whole of it doesn't fit
const SHORT = { lead: 8, tail: 6 }

/** The hero's pill: a wallet's address turns into its number, one holder after another. */
export default function WalletDemo({ className }) {
  const rootRef = useRef(null)
  const pillRef = useRef(null)
  const rulerRef = useRef(null)
  // The round whose pill is on screen; the first one is there from the start and never rises
  const risen = useRef(0)
  const [round, setRound] = useState(0)
  const [named, setNamed] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [roomy, setRoomy] = useState(false)
  const [addressRef, numberRef] = useMorph(named)
  const namespace = useNumberNamespace()

  const holder = holders[round % holders.length]
  const address = roomy ? holder.address : truncateAddress(holder.address, SHORT.lead, SHORT.tail)
  const number = formatNumber(holder.digits, namespace)

  useEffect(() => {
    const root = rootRef.current
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    // It plays while it is on screen. Without motion it rests on the first number
    const observer = new IntersectionObserver(([entry]) => (still ? setNamed(true) : setPlaying(entry.isIntersecting)))
    const ruler = new ResizeObserver(() => setRoomy(rulerRef.current.offsetWidth <= root.clientWidth))
    observer.observe(root)
    ruler.observe(root)
    return () => {
      observer.disconnect()
      ruler.disconnect()
    }
  }, [])

  useEffect(() => {
    if (!playing) return
    const timer = setTimeout(
      () => {
        if (!named) return setNamed(true)
        // The pill leaves with its number, and the next holder takes its place
        Promise.all(leave(pillRef.current).map((animation) => animation.finished))
          .then(() => {
            setRound((count) => count + 1)
            setNamed(false)
          })
          .catch(() => {})
      },
      named ? HOLD_MS.number : HOLD_MS.address
    )
    return () => clearTimeout(timer)
  }, [playing, named])

  useEffect(() => {
    if (risen.current === round) return
    risen.current = round
    rise(pillRef.current)
  }, [round])

  return (
    <div ref={rootRef} className={clsx(styles.wallet, className)} role="img" aria-label={label}>
      <div ref={pillRef} className={clsx(styles.wallet__pill, named && styles['wallet__pill--named'])}>
        <AddressAvatar address={holder.address} />
        {/* A new pair of faces each round, so the next address is set in place, not morphed into */}
        <span key={round} className={styles.wallet__name}>
          <span ref={addressRef} className={clsx(styles.wallet__face, styles['wallet__face--address'])}>
            {address}
          </span>
          <span ref={numberRef} className={clsx(styles.wallet__face, styles['wallet__face--number'], styles['wallet__face--waiting'])}>
            {number}
          </span>
        </span>
      </div>

      {/* The whole address, never painted: its width tells whether the pill can show it */}
      <div className={styles.wallet__ruler} aria-hidden="true">
        <div ref={rulerRef} className={clsx(styles.wallet__pill, styles['wallet__pill--ruler'])}>
          <AddressAvatar address={holder.address} />
          <span className={clsx(styles.wallet__face, styles['wallet__face--address'])}>{holder.address}</span>
        </div>
      </div>
    </div>
  )
}
