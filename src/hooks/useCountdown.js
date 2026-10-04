'use client'

import { useEffect, useState } from 'react'

const SECOND = 1000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

const partsFor = (remaining) => ({
  days: Math.floor(remaining / DAY),
  hours: Math.floor((remaining % DAY) / HOUR),
  minutes: Math.floor((remaining % HOUR) / MINUTE),
  seconds: Math.floor((remaining % MINUTE) / SECOND),
})

/** Ticks once a second toward `target` (ms). */
export default function useCountdown(target) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), SECOND)
    return () => clearInterval(timer)
  }, [])

  const remaining = Math.max(0, target - now)
  return { ...partsFor(remaining), now, done: remaining === 0 }
}
