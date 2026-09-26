import { Footer, Layout, Navbar } from 'nextra-theme-docs'
import { Head } from 'nextra/components'
import { getPageMap } from 'nextra/page-map'
import 'nextra-theme-docs/style.css'
import { AskAI } from './ai/chat'
import { NioLogo } from './logo'
import { SITE_DESCRIPTION, SITE_NAME, SITE_TITLE, SITE_URL, TITLE_SUFFIX } from './seo'

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: `%s${TITLE_SUFFIX}`
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME
}

const navbar = (
  <Navbar
    logo={
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
        <NioLogo size={28} id="nav-logo" />
        <b style={{ fontSize: '1.15rem', letterSpacing: '-0.02em' }}>Nio</b>
      </span>
    }
    projectLink="https://github.com/nio-org/nio"
  />
)

const footer = <Footer>Nio {new Date().getFullYear()}</Footer>

export default async function RootLayout({ children }) {
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <Head
        color={{
          hue: 142,
          saturation: 72,
          lightness: { light: 34, dark: 55 }
        }}
      />
      <body>
        <Layout
          navbar={navbar}
          pageMap={await getPageMap()}
          docsRepositoryBase="https://github.com/nio-org/nio-website/tree/main"
          footer={footer}
        >
          {children}
        </Layout>
        <AskAI />
      </body>
    </html>
  )
}
