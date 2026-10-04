import { site } from '@/config/site'

export default function robots() {
  return {
    rules: { userAgent: '*', allow: '/', disallow: site.crawl.disallow },
    sitemap: new URL('/sitemap.xml', site.baseUrl).href,
  }
}
