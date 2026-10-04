import AdminConsole from '@/components/admin/AdminConsole'
import { site } from '@/config/site'
import styles from './page.module.scss'

export const metadata = {
  title: site.admin.title,
  robots: { index: false, follow: false },
}

export default function AdminPage() {
  return (
    <main className={styles.page}>
      <div className={styles.page__container}>
        <header className={styles.page__intro}>
          <h1 className={styles.page__title}>{site.admin.heading}</h1>
          <p className={styles.page__subtitle}>{site.admin.intro}</p>
        </header>
        <AdminConsole />
      </div>
    </main>
  )
}
