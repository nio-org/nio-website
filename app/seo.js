import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export const SITE_URL = 'https://nio-lang.org'
export const SITE_NAME = 'Nio'
export const SITE_TITLE = 'Nio: a fast, safe programming language for back-end services'
export const SITE_DESCRIPTION =
  'Nio is a statically typed language that compiles to one native program, with errors you cannot forget, async on one thread, and HTTP and TLS built in.'
export const TITLE_SUFFIX = ' | Nio programming language'

const OG_IMAGE = {
  url: '/og.png',
  width: 1200,
  height: 630,
  alt: 'Nio: fast, safe programs for the back end'
}

// The tags one page needs beyond its title and description: its canonical
// URL and its card on social sites. `title` is the page's own title, without
// the site suffix that the root layout's template adds.
export function pageMetadata({ title, description, path, absoluteTitle = false }) {
  const full = absoluteTitle ? title : title + TITLE_SUFFIX
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: 'website',
      siteName: SITE_NAME,
      locale: 'en_US',
      url: path,
      title: full,
      description,
      images: [OG_IMAGE]
    },
    twitter: {
      card: 'summary_large_image',
      title: full,
      description,
      images: [OG_IMAGE.url]
    }
  }
}

const CONTENT = join(process.cwd(), 'content')

// The keys of a _meta.js file, in the order the sidebar shows them.
function metaOrder(dir) {
  try {
    const text = readFileSync(join(dir, '_meta.js'), 'utf8')
    return [...text.matchAll(/^\s*['"]?([\w-]+)['"]?\s*:/gm)].map(m => m[1])
  } catch {
    return []
  }
}

function frontMatter(text) {
  const block = text.match(/^---\n([\s\S]*?)\n---\n/)
  const fields = {}
  if (!block) return { fields, body: text }
  for (const line of block[1].split('\n')) {
    const m = line.match(/^(\w+):\s*(.*)$/)
    if (m) fields[m[1]] = m[2].startsWith('"') ? JSON.parse(m[2]) : m[2]
  }
  return { fields, body: text.slice(block[0].length) }
}

// Every documentation page, in sidebar order: its URL path, title,
// description, section and Markdown body.
export function docPages(dir = CONTENT, route = '/docs', section = 'Documentation') {
  const entries = readdirSync(dir, { withFileTypes: true })
  const names = entries
    .map(e => (e.isDirectory() ? e.name : e.name.replace(/\.mdx?$/, '')))
    .filter(n => n !== '_meta.js' && !n.startsWith('.'))
  const order = metaOrder(dir)
  const rank = n => (order.includes(n) ? order.indexOf(n) : order.length)
  const sorted = [...new Set(names)].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))

  const pages = []
  for (const name of sorted) {
    const entry = entries.find(e => e.name === name && e.isDirectory())
    if (entry) {
      const title = sectionTitle(dir, name)
      pages.push(...docPages(join(dir, name), `${route}/${name}`, title))
      continue
    }
    const file = entries.find(e => e.isFile() && e.name.replace(/\.mdx?$/, '') === name)
    if (!file) continue
    const { fields, body } = frontMatter(readFileSync(join(dir, file.name), 'utf8'))
    const heading = body.match(/^# (.+)$/m)?.[1]
    pages.push({
      path: name === 'index' ? route : `${route}/${name}`,
      title: fields.title ?? heading ?? name,
      description: fields.description ?? '',
      section,
      body
    })
  }
  return pages
}

function sectionTitle(dir, name) {
  const text = readFileSync(join(dir, '_meta.js'), 'utf8')
  return text.match(new RegExp(`^\\s*${name}\\s*:\\s*'([^']+)'`, 'm'))?.[1] ?? name
}
