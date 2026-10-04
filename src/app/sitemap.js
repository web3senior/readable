import { site } from '@/config/site'

// The pages a search engine should list; a name's page and the wallet's own pages are noindex
const PAGES = ['/', site.docs.path, site.agents.path]

export default function sitemap() {
  return PAGES.map((path) => ({ url: new URL(path, site.baseUrl).href }))
}
