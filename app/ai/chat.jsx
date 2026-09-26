'use client'

import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { usePathname } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import { NioLogo } from '../logo'
import styles from './chat.module.css'
import { Markdown } from './markdown'

const SUGGESTIONS = [
  'How do I create a web server with routes?',
  'How do errors and catch work?',
  'How do I parse JSON into a record?',
  'How do async functions and futures work?'
]

function joinText(message, type) {
  return message.parts
    .filter(p => p.type === type)
    .map(p => p.text)
    .join('\n\n')
}

// Reasoning summaries start each step with a bold title, for example
// "**Checking the HTTP routes**". The newest title says what the model does now.
function latestTitle(text) {
  const all = [...text.matchAll(/\*\*([^*\n]+)\*\*/g)]
  return all.at(-1)?.[1]
}

// `since` is when the question was sent. The first chunk of an answer can
// arrive long after that, so the time of mount is too late.
function Thinking({ text, active, since }) {
  const [open, setOpen] = useState(false)
  const mounted = useRef(Date.now())
  const [seconds, setSeconds] = useState(null)

  useEffect(() => {
    if (active || seconds !== null) return
    const start = since?.current ?? mounted.current
    setSeconds(Math.max(1, Math.round((Date.now() - start) / 1000)))
  }, [active, seconds, since])

  const title = latestTitle(text)
  const label = active ? 'Thinking' : seconds ? `Thought for ${seconds}s` : 'Thought'

  return (
    <div className={styles.thinking} data-active={active || undefined}>
      <button
        type="button"
        className={styles.thinkingHead}
        onClick={() => setOpen(o => !o)}
        disabled={!text}
        aria-expanded={open}
      >
        <span className={styles.orb} aria-hidden="true">
          <NioLogo size={18} id="think" className={styles.orbLogo} />
        </span>
        <span className={active ? styles.shimmer : styles.thinkingLabel}>{label}</span>
        {active && title && <span className={styles.thinkingTitle}>{title}</span>}
        {text && <ChevronIcon className={styles.chevron} data-open={open || undefined} />}
      </button>
      {open && text && (
        <div className={styles.thinkingBody}>
          <Markdown text={text} streaming={active} />
        </div>
      )}
    </div>
  )
}

function AssistantMessage({ message, busy, isLast, since, onNavigate, onRetry }) {
  const reasoning = joinText(message, 'reasoning')
  const text = joinText(message, 'text')
  const answering = busy && isLast
  const thinking = answering && text.trim() === ''
  const [copied, setCopied] = useState(false)

  return (
    <div className={styles.assistant}>
      {(reasoning || thinking) && <Thinking text={reasoning} active={thinking} since={isLast ? since : undefined} />}
      {text && <Markdown text={text} streaming={answering} onNavigate={onNavigate} />}
      {!answering && text && (
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.action}
            onClick={() =>
              navigator.clipboard.writeText(text).then(() => {
                setCopied(true)
                setTimeout(() => setCopied(false), 1500)
              })
            }
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
          {isLast && (
            <button type="button" className={styles.action} onClick={onRetry}>
              Regenerate
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export function AskAI() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const logRef = useRef(null)
  const inputRef = useRef(null)
  const pinned = useRef(true)
  const sentAt = useRef(null)
  const [mod, setMod] = useState('⌘')

  const transport = useMemo(
    () => new DefaultChatTransport({ api: '/api/chat', body: () => ({ page: window.location.pathname }) }),
    []
  )
  const { messages, sendMessage, status, stop, error, regenerate, setMessages, clearError } = useChat({
    transport,
    throttle: 40
  })
  const busy = status === 'submitted' || status === 'streaming'

  useEffect(() => {
    if (status === 'submitted') sentAt.current = Date.now()
  }, [status])
  const onDocs = pathname?.startsWith('/docs')
  const onPage = onDocs && pathname !== '/docs'

  useEffect(() => {
    if (!/Mac|iPhone|iPad/.test(navigator.platform)) setMod('Ctrl ')
  }, [])

  useEffect(() => {
    function onKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'i') {
        e.preventDefault()
        setOpen(o => !o)
      } else if (e.key === 'Escape') {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  // Follow new text only while the reader is at the bottom of the log.
  useEffect(() => {
    const el = logRef.current
    if (el && pinned.current) el.scrollTop = el.scrollHeight
  }, [messages, status])

  function onScroll() {
    const el = logRef.current
    pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48
  }

  function resize() {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`
  }

  function send(text) {
    const t = text.trim()
    if (!t || busy) return
    if (error) clearError()
    pinned.current = true
    sendMessage({ text: t })
    setInput('')
    requestAnimationFrame(resize)
  }

  function reset() {
    stop()
    setMessages([])
    clearError()
    inputRef.current?.focus()
  }

  // On a narrow screen the panel covers the page, so a link closes it.
  function onNavigate() {
    if (window.matchMedia('(max-width: 640px)').matches) setOpen(false)
  }

  const last = messages.at(-1)
  const waiting = busy && last?.role === 'user'

  return (
    <>
      {onDocs && !open && (
        <button
          type="button"
          className={styles.trigger}
          onClick={() => setOpen(true)}
          aria-label="Ask AI"
          aria-keyshortcuts="Meta+I Control+I"
        >
          <SparkIcon />
          Ask AI
          <kbd className={styles.kbd}>{mod}I</kbd>
        </button>
      )}

      {open && (
        <section className={styles.panel} role="dialog" aria-label="Ask AI about Nio" data-busy={busy || undefined}>
          <div className={styles.progress} aria-hidden="true" />
          <header className={styles.header}>
            <NioLogo size={26} id="chat-head" className={busy ? styles.logoBusy : undefined} />
            <div className={styles.headerText}>
              <div className={styles.headerTitle}>Ask Nio AI</div>
              <div className={styles.headerSub}>Answers from the Nio documentation</div>
            </div>
            {messages.length > 0 && (
              <button type="button" className={styles.iconButton} onClick={reset} title="New chat" aria-label="New chat">
                <PlusIcon />
              </button>
            )}
            <button type="button" className={styles.iconButton} onClick={() => setOpen(false)} title="Close" aria-label="Close">
              <CloseIcon />
            </button>
          </header>

          <div className={styles.log} ref={logRef} onScroll={onScroll} role="log" aria-live="polite">
            {messages.length === 0 ? (
              <div className={styles.empty}>
                <div className={styles.emptyMark}>
                  <NioLogo size={44} id="chat-empty" />
                </div>
                <h2 className={styles.emptyTitle}>How can I help?</h2>
                <p className={styles.emptyText}>
                  Ask anything about the language, the standard library or the tools. Answers link to the pages they come
                  from.
                </p>
                <div className={styles.suggestions}>
                  {onPage && (
                    <button type="button" className={styles.suggestion} onClick={() => send('Summarize this page for me.')}>
                      Summarize this page
                    </button>
                  )}
                  {SUGGESTIONS.map(s => (
                    <button key={s} type="button" className={styles.suggestion} onClick={() => send(s)}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m, i) =>
                m.role === 'user' ? (
                  <div key={m.id} className={styles.user}>
                    {joinText(m, 'text')}
                  </div>
                ) : (
                  <AssistantMessage
                    key={m.id}
                    message={m}
                    busy={busy}
                    isLast={i === messages.length - 1}
                    since={sentAt}
                    onNavigate={onNavigate}
                    onRetry={() => regenerate()}
                  />
                )
              )
            )}
            {waiting && (
              <div className={styles.assistant}>
                <Thinking text="" active since={sentAt} />
              </div>
            )}
            {error && (
              <div className={styles.error}>
                Something went wrong while answering.
                <button type="button" className={styles.action} onClick={() => regenerate()}>
                  Try again
                </button>
              </div>
            )}
          </div>

          <form
            className={styles.composer}
            onSubmit={e => {
              e.preventDefault()
              send(input)
            }}
          >
            <div className={styles.inputWrap}>
              <textarea
                ref={inputRef}
                className={styles.input}
                value={input}
                rows={1}
                placeholder="Ask a question about Nio…"
                maxLength={8000}
                onChange={e => {
                  setInput(e.target.value)
                  resize()
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault()
                    send(input)
                  }
                }}
              />
              {busy ? (
                <button type="button" className={styles.send} onClick={() => stop()} aria-label="Stop">
                  <StopIcon />
                </button>
              ) : (
                <button type="submit" className={styles.send} disabled={!input.trim()} aria-label="Send">
                  <ArrowIcon />
                </button>
              )}
            </div>
            <p className={styles.disclaimer}>AI answers can be wrong. Check the linked pages.</p>
          </form>
        </section>
      )}
    </>
  )
}

function SparkIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2.5c.4 3.9 1.3 5.9 2.8 7.2 1.4 1.3 3.5 2 6.7 2.3-3.2.3-5.3 1-6.7 2.3-1.5 1.3-2.4 3.3-2.8 7.2-.4-3.9-1.3-5.9-2.8-7.2C7.8 13 5.7 12.3 2.5 12c3.2-.3 5.3-1 6.7-2.3 1.5-1.3 2.4-3.3 2.8-7.2Z" />
    </svg>
  )
}

function ArrowIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 19V5M5 12l7-7 7 7" />
    </svg>
  )
}

function StopIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <rect x="4" y="4" width="16" height="16" rx="3" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  )
}

function ChevronIcon(props) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="m9 6 6 6-6 6" />
    </svg>
  )
}
