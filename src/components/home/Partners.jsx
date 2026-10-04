import clsx from 'clsx'
import { Reveal } from 'cube-motion/react'
import { site } from '@/config/site'
import styles from './Partners.module.scss'

const { label, items } = site.partners

function Partner({ partner }) {
  // The name is never written out: it is what a screen reader says for the logo
  const logo = (
    <span
      className={clsx(styles.partners__logo, partner.ink && styles['partners__logo--ink'], partner.wordmark && styles['partners__logo--wordmark'])}
      style={{ '--partner-logo': `url(${partner.logo})` }}
      role="img"
      aria-label={partner.name}
    />
  )

  if (!partner.url) return <span className={styles.partners__partner}>{logo}</span>

  return (
    <a className={clsx(styles.partners__partner, styles['partners__partner--link'])} href={partner.url} target="_blank" rel="noopener noreferrer">
      {logo}
    </a>
  )
}

/** The partners' logos, with no heading. Absent while the list is empty. */
export default function Partners() {
  if (items.length === 0) return null

  return (
    <section className={styles.partners} aria-label={label}>
      <Reveal as="ul" targets="children" className={styles.partners__list}>
        {items.map((partner) => (
          <li key={partner.name}>
            <Partner partner={partner} />
          </li>
        ))}
      </Reveal>
    </section>
  )
}
