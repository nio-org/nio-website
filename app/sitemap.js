import { docPages, SITE_URL } from './seo'

export default function sitemap() {
  return [
    { url: `${SITE_URL}/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE_URL}/playground`, changeFrequency: 'monthly', priority: 0.8 },
    ...docPages().map(page => ({
      url: `${SITE_URL}${page.path}`,
      changeFrequency: 'weekly',
      priority: page.path === '/docs' ? 0.9 : 0.7
    }))
  ]
}
