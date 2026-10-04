import { Inter, JetBrains_Mono } from 'next/font/google'
import Providers from '@/components/Providers'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { site } from '@/config/site'
import './Globals.scss'

const inter = Inter({ variable: '--font-inter', subsets: ['latin'], display: 'swap' })
const jetbrains = JetBrains_Mono({ variable: '--font-jetbrains', subsets: ['latin'], display: 'swap' })

export const metadata = {
  metadataBase: new URL(site.baseUrl),
  title: { template: `%s · ${site.name}`, default: `${site.name}: ${site.tagline}` },
  description: site.description,
  keywords: site.keywords,
  applicationName: site.name,
  // Each page's own title and description fill the preview; set here, every page would share them
  openGraph: { siteName: site.name, type: 'website' },
  twitter: { card: 'summary_large_image' },
}

export const viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: site.themeColor.light },
    { media: '(prefers-color-scheme: dark)', color: site.themeColor.dark },
  ],
}

export default function RootLayout({ children }) {
  return (
    // next-themes writes data-theme before hydration
    <html lang="en" className={`${inter.variable} ${jetbrains.variable}`} suppressHydrationWarning>
      <body>
        <Providers>
          <Header />
          {children}
          <Footer />
        </Providers>
      </body>
    </html>
  )
}
