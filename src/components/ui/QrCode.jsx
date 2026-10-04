'use client'

import { useMemo } from 'react'
import clsx from 'clsx'
import QRCode from 'qrcode'
import styles from './QrCode.module.scss'

// The light margin a scanner needs around the code, in modules
const QUIET_ZONE = 2

/**
 * `value` as a QR code: an SVG of its dark modules, drawn in the ink token on the plate token so
 * it reads in either theme. `label` is what a screen reader says for it.
 */
export default function QrCode({ value, label, className }) {
  const { size, path } = useMemo(() => {
    const { modules } = QRCode.create(value, { errorCorrectionLevel: 'M' })
    let d = ''
    for (let row = 0; row < modules.size; row++) {
      for (let column = 0; column < modules.size; column++) {
        if (modules.get(row, column)) d += `M${column + QUIET_ZONE} ${row + QUIET_ZONE}h1v1h-1z`
      }
    }
    return { size: modules.size + QUIET_ZONE * 2, path: d }
  }, [value])

  return (
    <svg className={clsx(styles.qr, className)} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label} shapeRendering="crispEdges">
      <rect className={styles.qr__plate} width={size} height={size} />
      <path className={styles.qr__ink} d={path} />
    </svg>
  )
}
