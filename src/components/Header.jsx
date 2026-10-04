import Link from 'next/link'
import ConnectButton from '@/components/ConnectButton'
import ThemeToggle from '@/components/ThemeToggle'
import { site } from '@/config/site'
import styles from './Header.module.scss'

export default function Header() {
  return (
    <header className={styles.header}>
      <div className={styles.header__inner}>
        <Link href="/" className={styles.header__brand} aria-label={`${site.name} home`}>
          <span>{site.wordmark.lead}</span>
          <span className={styles.header__tail}>{site.wordmark.tail}</span>
        </Link>

        <div className={styles.header__actions}>
          <Link href={site.agents.path} className={styles.header__link}>
            {site.agents.title}
          </Link>
          <Link href={site.docs.path} className={styles.header__link}>
            {site.docs.title}
          </Link>
          <ConnectButton />
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
