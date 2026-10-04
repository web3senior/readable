'use client'

import { Fragment } from 'react'
import useCountdown from '@/hooks/useCountdown'
import { formatDays, formatRelative } from '@/lib/format'
import styles from './Countdown.module.scss'

const pad = (value) => String(value).padStart(2, '0')

/** Days, then hh:mm:ss in single-digit tiles, ticking toward `target` (ms). */
export default function Countdown({ target, label }) {
  const { days, hours, minutes, seconds, now } = useCountdown(target)

  return (
    <div className={styles.countdown}>
      <p className={styles.countdown__label}>{label}</p>
      <div className={styles.countdown__row} role="timer" aria-label={`${label} ${formatRelative(target, now)}`}>
        <span className={styles.countdown__days} aria-hidden="true">
          {formatDays(days)}
        </span>
        {[hours, minutes, seconds].map((value, index) => (
          <Fragment key={index}>
            <span className={styles.countdown__separator} aria-hidden="true">
              :
            </span>
            <span className={styles.countdown__pair} aria-hidden="true">
              {pad(value)
                .split('')
                .map((digit, digitIndex) => (
                  <span key={digitIndex} className={styles.countdown__digit}>
                    {digit}
                  </span>
                ))}
            </span>
          </Fragment>
        ))}
      </div>
    </div>
  )
}
