import { docPages, SITE_DESCRIPTION, SITE_URL } from '../seo'

// The whole documentation as one Markdown file, for language models.
export const dynamic = 'force-static'

export function GET() {
  let text = `# Nio\n\n> ${SITE_DESCRIPTION}\n`
  for (const page of docPages()) {
    text += `\n---\n\nSource: ${SITE_URL}${page.path}\n\n${page.body.trim()}\n`
  }
  return new Response(text, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
}
