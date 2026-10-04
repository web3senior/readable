import MyNames from '@/components/names/MyNames'
import Watchlist from '@/components/names/Watchlist'
import { site } from '@/config/site'
import styles from './page.module.scss'

export const metadata = {
  title: site.names.title,
  robots: { index: false, follow: false },
}

export default function NamesPage() {
  return (
    <main className={styles.page}>
      <div className={styles.page__container}>
        <header className={styles.page__intro}>
          <h1 className={styles.page__title}>{site.names.title}</h1>
          <p className={styles.page__subtitle}>{site.names.intro}</p>
        </header>
        <MyNames />
        <Watchlist />
      </div>
    </main>
  )
}
