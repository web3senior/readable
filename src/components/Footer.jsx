import Link from 'next/link'
import { site } from '@/config/site'
import styles from './Footer.module.scss'

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.footer__inner}>
        <span className={styles.footer__brand}>{site.name}</span>
        <span>{site.footer}</span>
        <nav className={styles.footer__links} aria-label="Footer">
          <Link href={site.agents.path} className={styles.footer__link}>
            {site.agents.title}
          </Link>
          <Link href={site.docs.path} className={styles.footer__link}>
            {site.docs.title}
          </Link>
        </nav>
      </div>
    </footer>
  )
}
