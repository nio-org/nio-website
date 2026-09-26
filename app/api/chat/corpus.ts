import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'

// Every documentation page and example program, as one block of text for the
// system prompt. The text is the same for every request, so the provider can
// cache it as a prompt prefix.

const root = process.cwd()

function files(dir: string, ext: string): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .flatMap(e => {
      const p = join(dir, e.name)
      if (e.isDirectory()) return files(p, ext)
      return e.name.endsWith(ext) ? [p] : []
    })
    .sort()
}

// content/index.md is /docs, content/stdlib/http.md is /docs/stdlib/http.
function pageUrl(file: string): string {
  const rel = relative(join(root, 'content'), file).replace(/\.mdx?$/, '')
  return '/docs/' + rel.replace(/(^|\/)index$/, '')
}

function build(): string {
  const pages = [...files(join(root, 'content'), '.md'), ...files(join(root, 'content'), '.mdx')]
    .map(f => `<page url="${pageUrl(f).replace(/\/$/, '')}">\n${readFileSync(f, 'utf8').trim()}\n</page>`)
  const examples = files(join(root, 'examples'), '.nio').map(
    f => `<example file="${relative(root, f)}">\n${readFileSync(f, 'utf8').trim()}\n</example>`
  )
  return `<documentation>\n${pages.join('\n\n')}\n</documentation>\n\n<examples>\n${examples.join('\n\n')}\n</examples>`
}

let cached: string | undefined

export function corpus(): string {
  cached ??= build()
  return cached
}
