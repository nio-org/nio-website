// Monaco with Nio highlighting. Only the browser loads this module: the
// playground imports it after the page mounts.
import * as monaco from 'monaco-editor/editor/editor.api.js'
import 'monaco-editor/features/register.all.js'
import { shikiToMonaco } from '@shikijs/monaco'
import { createHighlighterCore } from 'shiki/core'
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript'
import githubDark from 'shiki/themes/github-dark.mjs'
import githubLight from 'shiki/themes/github-light.mjs'
import config from '../../grammars/language-configuration.json'
import grammar from '../../grammars/nio.tmLanguage.json'

self.MonacoEnvironment = {
  getWorker: () =>
    new Worker(new URL('./editor.worker.js', import.meta.url), { type: 'module' })
}

// The code blocks on the rest of the site use the GitHub themes. The
// backgrounds are the ones the home page gives its code windows.
export const THEMES = { light: 'nio-light', dark: 'nio-dark' }

function withBackground(theme, name, background) {
  return {
    ...theme,
    name,
    colors: { ...theme.colors, 'editor.background': background }
  }
}

// language-configuration.json is a copy of the language repository's
// editors/shared/language-configuration.json. Copy it again when that file
// changes. It is VS Code's format, where a pattern is a string and an indent
// action is a name. Monaco wants RegExp values and enums.
function toMonacoConfig(c) {
  const re = s => (s ? new RegExp(s) : undefined)
  const indent = {
    none: monaco.languages.IndentAction.None,
    indent: monaco.languages.IndentAction.Indent,
    indentOutdent: monaco.languages.IndentAction.IndentOutdent,
    outdent: monaco.languages.IndentAction.Outdent
  }
  return {
    comments: c.comments,
    brackets: c.brackets,
    autoClosingPairs: c.autoClosingPairs,
    surroundingPairs: c.surroundingPairs.map(([open, close]) => ({ open, close })),
    folding: {
      markers: { start: re(c.folding.markers.start), end: re(c.folding.markers.end) }
    },
    indentationRules: {
      increaseIndentPattern: re(c.indentationRules.increaseIndentPattern),
      decreaseIndentPattern: re(c.indentationRules.decreaseIndentPattern)
    },
    onEnterRules: c.onEnterRules.map(r => ({
      beforeText: re(r.beforeText),
      afterText: re(r.afterText),
      action: { ...r.action, indentAction: indent[r.action.indent] }
    }))
  }
}

let ready

// Registers the language and the themes once, however many editors ask.
export function setup() {
  ready ??= (async () => {
    monaco.languages.register({ id: 'nio', extensions: ['.nio'] })
    monaco.languages.setLanguageConfiguration('nio', toMonacoConfig(config))
    const highlighter = await createHighlighterCore({
      themes: [
        withBackground(githubLight, THEMES.light, '#fbfdfc'),
        withBackground(githubDark, THEMES.dark, '#0d110f')
      ],
      langs: [{ ...grammar, name: 'nio' }],
      engine: createJavaScriptRegexEngine()
    })
    shikiToMonaco(highlighter, monaco)
    return monaco
  })()
  return ready
}
