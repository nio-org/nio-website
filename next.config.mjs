import { readFileSync } from 'node:fs'
import nextra from 'nextra'
import { bundledLanguages, createHighlighter } from 'shiki'

// The grammar every Nio editor uses, copied from the language repository's
// editors/shared/nio.tmLanguage.json. Copy it again when that file changes.
const nio = {
  ...JSON.parse(
    readFileSync(new URL('./grammars/nio.tmLanguage.json', import.meta.url), 'utf8')
  ),
  name: 'nio'
}

const withNextra = nextra({
  // Serve the `content` directory under `/docs` instead of the root
  contentDirBasePath: '/docs',
  mdxOptions: {
    // .md pages are plain Markdown, so a `<` or `{` in prose is text.
    format: 'detect',
    rehypePrettyCodeOptions: {
      // A function cannot cross into a Turbopack loader, which is why the
      // scripts in package.json build with webpack.
      getHighlighter(opts) {
        const langs = Object.keys(bundledLanguages).filter(l => l !== 'mermaid')
        return createHighlighter({ ...opts, langs: [...langs, nio] })
      }
    }
  }
})

export default withNextra({
  // Pin the workspace root so Next doesn't infer it from a parent lockfile
  turbopack: { root: import.meta.dirname },
  // The chat route reads the documentation from disk at run time, which
  // file tracing cannot see.
  outputFileTracingIncludes: {
    '/api/chat': ['./content/**/*', './examples/**/*']
  }
})
