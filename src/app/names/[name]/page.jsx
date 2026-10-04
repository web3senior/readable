import NamePage from '@/components/names/NamePage'
import { site } from '@/config/site'
import { miniAppEmbeds } from '@/lib/miniapp'
import { nameFromSlug } from '@/lib/namespaces'
import styles from '../page.module.scss'

// Written from the path alone, so a link preview never waits for the chain. The picture is
// opengraph-image beside this page
export async function generateMetadata({ params }) {
  const { name: slug } = await params
  const name = nameFromSlug(slug)
  const description = site.nft.description.replaceAll('{name}', name)
  return {
    title: name,
    description,
    robots: { index: false, follow: false },
    openGraph: { title: `${name} · ${site.name}`, description, siteName: site.name, type: 'profile' },
    twitter: { card: 'summary_large_image', title: `${name} · ${site.name}`, description },
    // In a Farcaster or Base app feed, the link opens this page as a mini app
    other: miniAppEmbeds(`${site.names.path}/${slug}`),
  }
}

// The page is sent at once; the name is read in the browser
export default async function NameDetailPage({ params }) {
  const { name } = await params
  return (
    <main className={styles.page}>
      <div className={styles.page__container}>
        <NamePage slug={name} />
      </div>
    </main>
  )
}
