import { docPages, SITE_DESCRIPTION, SITE_URL } from '../seo'

// An index of the documentation for language models (https://llmstxt.org).
export const dynamic = 'force-static'

export function GET() {
  const sections = new Map()
  for (const page of docPages()) {
    if (!sections.has(page.section)) sections.set(page.section, [])
    sections.get(page.section).push(page)
  }

  let text = `# Nio\n\n> ${SITE_DESCRIPTION}\n\n`
  text +=
    'Nio has no generics and no threads. Code samples in these pages compile with the current release. ' +
    `The whole documentation in one file is at ${SITE_URL}/llms-full.txt.\n`
  for (const [section, pages] of sections) {
    text += `\n## ${section}\n\n`
    for (const page of pages) {
      text += `- [${page.title}](${SITE_URL}${page.path}): ${page.description}\n`
    }
  }
  text += '\n## Optional\n\n'
  text +=
    '- [Language reference](https://github.com/nio-org/nio/blob/main/specs.md): every rule of the language and its standard library\n'
  text += '- [Source code](https://github.com/nio-org/nio): the compiler, runtime and standard library\n'

  return new Response(text, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
}
