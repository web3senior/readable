import Image from 'next/image'
import Link from 'next/link'
import { CaretRightIcon } from '@phosphor-icons/react/ssr'
import HowItWorks from '@/components/home/HowItWorks'
import LatestActivity from '@/components/home/LatestActivity'
import SearchExperience from '@/components/search/SearchExperience'
import { site } from '@/config/site'
import styles from './page.module.scss'

const { line, chain, claim } = site.hero
// The file's size; the stylesheet sets it to the text's
const LOGO_PX = 20

/** The hero's second sentence, with the chain's badge and the claim in place. */
function HeroLine() {
  const parts = line.split(/(\{chain\}|\{claim\})/)
  return parts.map((part, index) => {
    if (part === '{chain}') {
      // The punctuation after the badge stays on its line
      return (
        <span key={index} className={styles.page__chain}>
          <span className={styles.page__badge}>
            <Image className={styles.page__logo} src={chain.logo} width={LOGO_PX} height={LOGO_PX} alt="" />
            {chain.name}
          </span>
          {parts[index + 1].match(/^\S*/)[0]}
        </span>
      )
    }
    if (parts[index - 1] === '{chain}') return part.replace(/^\S*/, '')
    if (part === '{claim}') {
      return (
        <strong key={index} className={styles.page__claim}>
          {claim}
        </strong>
      )
    }
    return part
  })
}

export default async function HomePage({ searchParams }) {
  const params = await searchParams
  const query = params?.[site.search.queryParam]
  const initialQuery = typeof query === 'string' ? query : ''

  return (
    <main className={styles.page}>
      <div className={styles.page__container}>
        <div className={styles.page__intro}>
          <h1 className={styles.page__title}>{site.tagline}</h1>
          <p className={styles.page__subtitle}>
            <span className={styles.page__sentence}>{site.subtitle}</span>{' '}
            <span className={styles.page__sentence}>
              <HeroLine />{' '}
              <Link href={site.docs.path} className={styles.page__more}>
                {site.hero.more}
                <CaretRightIcon size={16} weight="bold" aria-hidden="true" />
              </Link>
            </span>
          </p>
        </div>
        <SearchExperience initialQuery={initialQuery} />
        <LatestActivity className={styles.page__activity} />
        <HowItWorks className={styles.page__how} />
      </div>
    </main>
  )
}
