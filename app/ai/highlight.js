// Syntax highlighting for code in chat answers. The chat imports this module
// only when an answer holds a code block.
import { createHighlighterCore } from 'shiki/core'
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript'
import githubDark from 'shiki/themes/github-dark.mjs'
import githubLight from 'shiki/themes/github-light.mjs'
import grammar from '../../grammars/nio.tmLanguage.json'

const ALIASES = { sh: 'shellscript', bash: 'shellscript', shell: 'shellscript', zsh: 'shellscript', js: 'javascript', ts: 'typescript' }

const highlighter = createHighlighterCore({
  themes: [githubLight, githubDark],
  langs: [
    { ...grammar, name: 'nio' },
    import('shiki/langs/shellscript.mjs'),
    import('shiki/langs/json.mjs'),
    import('shiki/langs/c.mjs'),
    import('shiki/langs/javascript.mjs'),
    import('shiki/langs/typescript.mjs'),
    import('shiki/langs/toml.mjs'),
    import('shiki/langs/diff.mjs')
  ],
  engine: createJavaScriptRegexEngine()
})

export async function highlight(code, lang) {
  const h = await highlighter
  const name = ALIASES[lang] ?? lang
  return h.codeToHtml(code, {
    lang: h.getLoadedLanguages().includes(name) ? name : 'text',
    themes: { light: 'github-light', dark: 'github-dark' },
    defaultColor: false
  })
}
