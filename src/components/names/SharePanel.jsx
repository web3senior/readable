'use client'

import { useId } from 'react'
import CopyButton from '@/components/ui/CopyButton'
import QrCode from '@/components/ui/QrCode'
import { site } from '@/config/site'
import useIsClient from '@/hooks/useIsClient'
import styles from './SharePanel.module.scss'

const { share } = site.profile

/**
 * Ways to hand a name to someone: its page's link, a code a phone scans, and a badge for a site.
 * `path` is the name's page, `/names/+0-4242`.
 */
export default function SharePanel({ name, path }) {
  const titleId = useId()
  // The links point at the site the visitor is on, so a preview or a local server shares itself
  const origin = useIsClient() ? window.location.origin : site.baseUrl
  const link = `${origin}${path}`
  const slug = path.slice(site.names.path.length + 1)
  const badge = `${origin}${site.badge.path}/${slug}`
  const markdown = `[![${name} on ${site.name}](${badge})](${link})`

  return (
    <section className={styles.share} aria-labelledby={titleId}>
      <h2 id={titleId} className={styles.share__title}>
        {share.title}
      </h2>
      <p className={styles.share__intro}>{share.intro}</p>

      <div className={styles.share__layout}>
        <div className={styles.share__code}>
          <QrCode value={link} label={share.qr.replace('{name}', name)} />
        </div>

        <div className={styles.share__links}>
          <div className={styles.share__item}>
            <span className={styles.share__link}>{link.replace(/^https?:\/\//, '')}</span>
            <CopyButton value={link} label={share.copy} title={share.copy} variant="chip" />
          </div>

          <div className={styles.share__item}>
            <span className={styles.share__label}>{share.badge}</span>
            {/* Drawn by the site; an SVG gains nothing from the image optimizer */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className={styles.share__badge} src={`${site.badge.path}/${slug}`} alt={`${site.badge.label} ${name}`} height={site.badge.height} />
            <p className={styles.share__note}>{share.badgeNote}</p>
            <CopyButton value={markdown} label={share.copyBadge} title={share.copyBadge} variant="chip" />
          </div>
        </div>
      </div>
    </section>
  )
}
