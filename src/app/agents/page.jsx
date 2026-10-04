import AgentsDirectory from '@/components/agents/AgentsDirectory'
import { site } from '@/config/site'
import styles from '../names/page.module.scss'

export const metadata = {
  title: site.agents.title,
  description: site.agents.intro,
}

// Sent at once; the directory is read in the browser, from the server's cached reading
export default function AgentsPage() {
  return (
    <main className={styles.page}>
      <div className={styles.page__container}>
        <header className={styles.page__intro}>
          <h1 className={styles.page__title}>{site.agents.title}</h1>
          <p className={styles.page__subtitle}>{site.agents.intro}</p>
        </header>
        <AgentsDirectory />
      </div>
    </main>
  )
}
