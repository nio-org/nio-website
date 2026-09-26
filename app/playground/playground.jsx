'use client'

import Link from 'next/link'
import { useTheme } from 'nextra-theme-docs'
import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import styles from './playground.module.css'

// The service that compiles and runs programs: runner/ in this repository.
// Its address is fixed when the site builds. Only a development server falls
// back to a runner on this machine: from a public site, a request to
// localhost makes the browser ask the visitor for access to local services.
const RUNNER = (
  process.env.NEXT_PUBLIC_RUNNER_URL ||
  (process.env.NODE_ENV === 'development' ? 'http://localhost:8080' : '')
).replace(/\/$/, '')

const STORE = 'nio-playground:v1:'

// Storage can be missing or refuse writes (private windows, blocked site
// data). The playground then works as before and forgets edits on reload.
function load(key) {
  try {
    return localStorage.getItem(STORE + key)
  } catch {
    return null
  }
}

function save(key, value) {
  try {
    if (value == null) localStorage.removeItem(STORE + key)
    else localStorage.setItem(STORE + key, value)
  } catch {}
}

// Monaco's default key bindings, which are VS Code's, plus Run.
const SHORTCUTS = [
  ['⌘ ↵', 'Ctrl+Enter', 'Run'],
  ['⌥ ↑ / ⌥ ↓', 'Alt+↑ / Alt+↓', 'Move line up or down'],
  ['⇧ ⌥ ↑ / ⇧ ⌥ ↓', 'Shift+Alt+↑ / Shift+Alt+↓', 'Copy line up or down'],
  ['⌥ ← / ⌥ →', 'Ctrl+← / Ctrl+→', 'Move by word'],
  ['⌘ D', 'Ctrl+D', 'Select the next match'],
  ['⇧ ⌘ L', 'Ctrl+Shift+L', 'Select every match'],
  ['⌥ ⌘ ↑ / ⌥ ⌘ ↓', 'Ctrl+Alt+↑ / Ctrl+Alt+↓', 'Add a cursor above or below'],
  ['⌥ click', 'Alt+click', 'Add a cursor'],
  ['⌘ /', 'Ctrl+/', 'Comment or uncomment'],
  ['⇧ ⌘ K', 'Ctrl+Shift+K', 'Delete line'],
  ['⌘ ] / ⌘ [', 'Ctrl+] / Ctrl+[', 'Indent or outdent'],
  ['⌥ ⌘ [ / ⌥ ⌘ ]', 'Ctrl+Shift+[ / Ctrl+Shift+]', 'Fold or unfold'],
  ['⌘ F / ⌥ ⌘ F', 'Ctrl+F / Ctrl+H', 'Find or replace'],
  ['⌃ G', 'Ctrl+G', 'Go to line'],
  ['⌘ S', 'Ctrl+S', 'Save in this browser'],
  ['F1', 'F1', 'All commands']
]

const EDITOR_OPTIONS = {
  language: 'nio',
  automaticLayout: true,
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  fontSize: 14,
  lineHeight: 22,
  tabSize: 4,
  insertSpaces: true,
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
  padding: { top: 14, bottom: 14 },
  renderLineHighlight: 'line',
  renderLineHighlightOnlyWhenFocus: true,
  smoothScrolling: true,
  fixedOverflowWidgets: true,
  stickyScroll: { enabled: false },
  // The theme colours brackets already, as the site's code blocks do.
  bracketPairColorization: { enabled: false },
  guides: { indentation: true, bracketPairs: false }
}

const LOCATION = /-->\s*main\.nio:(\d+):(\d+)/

// The compiler's messages as editor markers. Each one is a header line, a
// location line and, a few lines on, the carets under the span it names.
function markersOf(text, severity) {
  const lines = text.split('\n')
  const out = []
  lines.forEach((line, i) => {
    const head = /^(error|warning): (.*)$/.exec(line)
    const at = LOCATION.exec(lines[i + 1] || '')
    if (!head || !at) return
    let width = 1
    for (let j = i + 2; j < Math.min(lines.length, i + 6); j++) {
      const carets = /^\s*\d*\s*\|\s*(\^+)/.exec(lines[j])
      if (carets) {
        width = carets[1].length
        break
      }
    }
    const lineNumber = Number(at[1])
    const column = Number(at[2])
    out.push({
      severity: head[1] === 'error' ? severity.Error : severity.Warning,
      message: head[2],
      startLineNumber: lineNumber,
      startColumn: column,
      endLineNumber: lineNumber,
      endColumn: column + width
    })
  })
  return out
}

function duration(ms) {
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(ms < 10000 ? 2 : 1)} s`
}

// How long the compile and the run took. A result saved before the runner
// reported compileMs has none.
function timing(r) {
  const compiled = r.compileMs >= 0 ? duration(r.compileMs) : null
  if (r.stage === 'compile') return compiled && `after ${compiled}`
  const ran = `ran in ${duration(Math.max(r.runMs, 0))}`
  return compiled ? `compiled in ${compiled}, ${ran}` : ran
}

// What the status line says about a finished run.
function summary(r) {
  if (r.stage === 'compile') return { tone: 'bad', text: 'Did not compile' }
  if (r.timedOut) return { tone: 'bad', text: `Stopped after ${Math.round(r.runMs / 1000)} s` }
  if (r.truncated) return { tone: 'warn', text: 'Output cut at 64 KB' }
  if (r.exitCode === 137) return { tone: 'bad', text: 'Stopped: out of memory' }
  if (r.exitCode === 0) return { tone: 'ok', text: 'Done' }
  return { tone: 'bad', text: `Exited with status ${r.exitCode}` }
}

export function Playground({ examples }) {
  const byId = Object.fromEntries(examples.map(e => [e.id, e]))
  const [current, setCurrent] = useState(examples[0].id)
  const [edited, setEdited] = useState(() => new Set())
  const [results, setResults] = useState({})
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const [mac, setMac] = useState(true)
  const [notice, setNotice] = useState('')
  const { resolvedTheme } = useTheme()

  const host = useRef(null)
  const editor = useRef(null)
  const monaco = useRef(null)
  const themes = useRef(null)
  const models = useRef({})
  const views = useRef({})
  const shown = useRef(current)
  const noticeTimer = useRef(0)
  const runRef = useRef(() => {})

  const flash = useCallback(text => {
    setNotice(text)
    clearTimeout(noticeTimer.current)
    noticeTimer.current = setTimeout(() => setNotice(''), 1800)
  }, [])

  const markEdited = useCallback((id, isEdited) => {
    setEdited(prev => {
      if (prev.has(id) === isEdited) return prev
      const next = new Set(prev)
      if (isEdited) next.add(id)
      else next.delete(id)
      return next
    })
  }, [])

  const persist = useCallback(
    id => {
      const model = models.current[id]
      if (!model) return
      const text = model.getValue()
      const isEdited = text !== byId[id].code
      save(id, isEdited ? text : null)
      markEdited(id, isEdited)
    },
    // byId is rebuilt on every render from the same props.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [examples, markEdited]
  )

  const reset = useCallback(() => {
    const id = shown.current
    const model = models.current[id]
    if (!model) return
    // An edit rather than setValue, so ⌘Z brings the changes back.
    model.pushEditOperations(
      [],
      [{ range: model.getFullModelRange(), text: byId[id].code }],
      () => null
    )
    persist(id)
    flash('Reset to the original')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examples, persist, flash])

  const text = () => models.current[shown.current]?.getValue() ?? byId[shown.current].code

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text())
      flash('Copied')
    } catch {
      flash('Copying is blocked here')
    }
  }

  const download = useCallback(() => {
    const blob = new Blob([text()], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = byId[shown.current].file
    a.click()
    URL.revokeObjectURL(url)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examples])

  const run = async () => {
    const id = shown.current
    if (!RUNNER || results[id]?.state === 'running') return
    const model = models.current[id]
    const code = text()
    setResults(prev => ({ ...prev, [id]: { state: 'running', previous: prev[id] } }))
    const abort = new AbortController()
    const timer = setTimeout(() => abort.abort(), 60000)
    let result
    try {
      const res = await fetch(`${RUNNER}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
        signal: abort.signal
      })
      const body = await res.json().catch(() => ({}))
      result = res.ok
        ? { state: 'done', data: body }
        : { state: 'failed', message: body.error || `The runner answered ${res.status}.` }
    } catch {
      result = { state: 'failed', message: 'The runner could not be reached. Try again in a moment.' }
    } finally {
      clearTimeout(timer)
    }
    if (result.state === 'done') result.data.code = code
    setResults(prev => ({ ...prev, [id]: result }))
    const api = monaco.current
    if (api && model && !model.isDisposed()) {
      const markers =
        result.state === 'done' ? markersOf(result.data.compilerOutput, api.MarkerSeverity) : []
      api.editor.setModelMarkers(model, 'nio', markers)
    }
  }
  runRef.current = run

  const reveal = (line, column) => {
    const ed = editor.current
    if (!ed) return
    ed.setPosition({ lineNumber: line, column })
    ed.revealLineInCenter(line)
    ed.focus()
  }

  // Chooses the example from the address or from the last visit.
  useEffect(() => {
    setMac(/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent))
    const fromHash = decodeURIComponent(location.hash.slice(1))
    const last = load('last')
    if (byId[fromHash]) setCurrent(fromHash)
    else if (last && byId[last]) setCurrent(last)
    const saved = examples.filter(e => {
      const t = load(e.id)
      return t != null && t !== e.code
    })
    setEdited(new Set(saved.map(e => e.id)))

    const onHash = () => {
      const id = decodeURIComponent(location.hash.slice(1))
      if (byId[id]) setCurrent(id)
    }
    addEventListener('hashchange', onHash)
    return () => removeEventListener('hashchange', onHash)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Creates the editor once, with one model per example. A model keeps its
  // own undo history, so switching examples works like switching tabs.
  useEffect(() => {
    let disposed = false
    const timers = {}
    import('./monaco')
      .then(async m => {
        const api = await m.setup()
        if (disposed || !host.current) return
        monaco.current = api
        themes.current = m.THEMES
        for (const e of examples) {
          const model = api.editor.createModel(
            load(e.id) ?? e.code,
            'nio',
            api.Uri.parse(`file:///${e.file}`)
          )
          model.onDidChangeContent(() => {
            clearTimeout(timers[e.id])
            timers[e.id] = setTimeout(() => persist(e.id), 300)
          })
          models.current[e.id] = model
        }
        const ed = api.editor.create(host.current, {
          ...EDITOR_OPTIONS,
          model: models.current[shown.current],
          theme: document.documentElement.classList.contains('dark')
            ? m.THEMES.dark
            : m.THEMES.light
        })
        ed.addAction({
          id: 'nio.run',
          label: 'Nio: Run',
          keybindings: [api.KeyMod.CtrlCmd | api.KeyCode.Enter],
          run: () => runRef.current()
        })
        ed.addCommand(api.KeyMod.CtrlCmd | api.KeyCode.KeyS, () => {
          persist(shown.current)
          flash('Saved in this browser')
        })
        ed.addAction({ id: 'nio.reset', label: 'Nio: Reset example', run: reset })
        ed.addAction({ id: 'nio.download', label: 'Nio: Download file', run: download })
        editor.current = ed
        setReady(true)
      })
      .catch(err => {
        console.error(err)
        if (!disposed) setFailed(true)
      })
    return () => {
      disposed = true
      Object.values(timers).forEach(clearTimeout)
      editor.current?.dispose()
      Object.values(models.current).forEach(model => model.dispose())
      models.current = {}
      editor.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Shows the chosen example, keeping the cursor and scroll of each.
  useEffect(() => {
    save('last', current)
    if (location.hash.slice(1) !== current) history.replaceState(null, '', `#${current}`)
    const ed = editor.current
    if (!ed || shown.current === current) {
      shown.current = current
      return
    }
    views.current[shown.current] = ed.saveViewState()
    shown.current = current
    ed.setModel(models.current[current])
    const view = views.current[current]
    if (view) ed.restoreViewState(view)
    ed.focus()
  }, [current, ready])

  useEffect(() => {
    if (!ready || !resolvedTheme) return
    monaco.current.editor.setTheme(
      resolvedTheme === 'dark' ? themes.current.dark : themes.current.light
    )
  }, [resolvedTheme, ready])

  const example = byId[current]
  const result = results[current]
  const running = result?.state === 'running'

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Playground</h1>
        <p className={styles.lead}>
          Pick an example, change it and run it. Programs run on our server in a
          sandbox with no internet access, for up to five seconds. To run Nio on
          your own machine, <Link href="/docs/installation">install it</Link>.
        </p>
      </header>

      <nav className={styles.tabs} aria-label="Examples">
        {examples.map(e => (
          <button
            key={e.id}
            type="button"
            className={styles.tab}
            aria-pressed={e.id === current}
            onClick={() => setCurrent(e.id)}
          >
            {e.title}
            {edited.has(e.id) && <span className={styles.editedDot} title="Edited" />}
          </button>
        ))}
      </nav>

      <p className={styles.about}>{example.about}</p>

      <div className={styles.workspace}>
        <section className={styles.window} aria-label="Code">
          <div className={styles.bar}>
            <span className={styles.dot} />
            <span className={styles.dot} />
            <span className={styles.dot} />
            <span className={styles.file}>
              {example.file}
              {edited.has(current) && <span className={styles.editedLabel}>edited</span>}
            </span>
            <span className={styles.notice} aria-live="polite">
              {notice}
            </span>
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.action}
                onClick={reset}
                disabled={!ready || !edited.has(current)}
              >
                Reset
              </button>
              <button type="button" className={styles.action} onClick={copy}>
                Copy
              </button>
              <button type="button" className={styles.action} onClick={download}>
                Download
              </button>
              <button
                type="button"
                className={styles.run}
                onClick={run}
                disabled={running || !RUNNER}
                title={mac ? 'Run (⌘ ↵)' : 'Run (Ctrl+Enter)'}
              >
                <svg viewBox="0 0 16 16" aria-hidden="true">
                  <path d="M4 2.5v11l9-5.5z" fill="currentColor" />
                </svg>
                {running ? 'Running' : 'Run'}
              </button>
            </div>
          </div>
          <div className={styles.editorArea}>
            <div ref={host} className={styles.editor} />
            {!ready && (
              <pre className={styles.fallback}>
                {failed && (
                  <span className={styles.failed}>
                    The editor could not load. This is the example as plain text.
                    {'\n\n'}
                  </span>
                )}
                {example.code}
              </pre>
            )}
          </div>
        </section>

        <section className={styles.window} aria-label="Output">
          <div className={styles.bar}>
            <span className={styles.paneTitle}>Output</span>
            <Status result={result} />
          </div>
          <div className={styles.output} aria-live="polite" aria-busy={running}>
            <Output result={result} mac={mac} onLocation={reveal} />
          </div>
        </section>
      </div>

      <details className={styles.shortcuts}>
        <summary>Keyboard shortcuts</summary>
        <table>
          <tbody>
            {SHORTCUTS.map(([macKeys, keys, what]) => (
              <tr key={what}>
                <td>
                  <kbd>{mac ? macKeys : keys}</kbd>
                </td>
                <td>{what}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  )
}

function Status({ result }) {
  if (!result) return null
  if (result.state === 'running') {
    return (
      <span className={styles.status}>
        <span className={styles.spinner} aria-hidden="true" />
        Compiling and running
      </span>
    )
  }
  if (result.state === 'failed') {
    return <span className={styles.status} data-tone="bad">Not run</span>
  }
  const r = result.data
  const s = summary(r)
  return (
    <span className={styles.status} data-tone={s.tone}>
      {s.text}
      {timing(r) && <span className={styles.timing}>{timing(r)}</span>}
    </span>
  )
}

function Output({ result, mac, onLocation }) {
  // While a run is in flight the previous output stays, dimmed, so the pane
  // does not jump.
  if (result?.state === 'running') {
    return result.previous?.state === 'done' ? (
      <div className={styles.stale}>
        <Output result={result.previous} mac={mac} onLocation={onLocation} />
      </div>
    ) : null
  }
  if (!result && !RUNNER) {
    return (
      <p className={styles.hint}>
        Running programs is not available on this site yet. Download the file and run it with{' '}
        <kbd>nio run</kbd> on your machine.
      </p>
    )
  }
  if (!result) {
    return (
      <p className={styles.hint}>
        Press <b>Run</b> or <kbd>{mac ? '⌘ ↵' : 'Ctrl+Enter'}</kbd> to compile this program and see
        what it prints.
      </p>
    )
  }
  if (result.state === 'failed') {
    return <p className={styles.problem}>{result.message}</p>
  }
  const r = result.data
  return (
    <>
      {r.compilerOutput && (
        <pre className={styles.compiler}>
          {r.compilerOutput.split('\n').map((line, i) => {
            const at = LOCATION.exec(line)
            if (!at) return <span key={i}>{line + '\n'}</span>
            // The newline stays outside the button, which lays out as a box.
            return (
              <Fragment key={i}>
                <button
                  type="button"
                  className={styles.location}
                  title="Show this place in the code"
                  onClick={() => onLocation(Number(at[1]), Number(at[2]))}
                >
                  {line}
                </button>
                {'\n'}
              </Fragment>
            )
          })}
        </pre>
      )}
      {r.stage === 'run' &&
        (r.output ? (
          <pre className={styles.program}>
            {r.output.split('\n').map((line, i, all) => {
              const last = i === all.length - 1
              if (last && line === '') return null
              const fault = /^runtime error:/.test(line)
              return (
                <span key={i} className={fault ? styles.fault : undefined}>
                  {line + (last ? '' : '\n')}
                </span>
              )
            })}
          </pre>
        ) : (
          <p className={styles.hint}>The program printed nothing.</p>
        ))}
      {r.truncated && (
        <p className={styles.hint}>The rest of the output was cut: a run keeps its first 64 KB.</p>
      )}
      {r.network === 'none' && /import\s+'(net|http|tls)'/.test(r.code || '') && (
        <p className={styles.hint}>
          This server runs programs without network sockets, so a program that serves or
          connects cannot work here. Download it and run it on your machine.
        </p>
      )}
    </>
  )
}
