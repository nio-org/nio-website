'use client'

import Link from 'next/link'
import { memo, useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remend from 'remend'
import styles from './chat.module.css'

function hastText(node) {
  if (node.type === 'text') return node.value
  return (node.children ?? []).map(hastText).join('')
}

function CodeBlock({ code, lang }) {
  const [html, setHtml] = useState(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let live = true
    import('./highlight').then(m => m.highlight(code, lang)).then(
      h => live && setHtml(h),
      () => {}
    )
    return () => {
      live = false
    }
  }, [code, lang])

  function copy() {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <div className={styles.code}>
      <div className={styles.codeHeader}>
        <span>{lang || 'text'}</span>
        <button type="button" onClick={copy} className={styles.codeCopy} aria-label="Copy code">
          {copied ? <CheckIcon /> : <CopyIcon />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      {html ? (
        <div className={styles.codeBody} dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <div className={styles.codeBody}>
          <pre>
            <code>{code}</code>
          </pre>
        </div>
      )}
    </div>
  )
}

function MarkdownLink({ href = '', children, onNavigate }) {
  if (href.startsWith('/') && !href.startsWith('//')) {
    return (
      <Link href={href} onClick={onNavigate}>
        {children}
      </Link>
    )
  }
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  )
}

export const Markdown = memo(function Markdown({ text, streaming, onNavigate }) {
  return (
    <div className={styles.markdown}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          pre({ node }) {
            const code = node.children.find(c => c.tagName === 'code') ?? node
            const cls = code.properties?.className ?? []
            const lang = cls.find(c => String(c).startsWith('language-'))?.slice(9) ?? ''
            return <CodeBlock code={hastText(code).replace(/\n$/, '')} lang={lang} />
          },
          a({ href, children }) {
            return (
              <MarkdownLink href={href} onNavigate={onNavigate}>
                {children}
              </MarkdownLink>
            )
          },
          table({ children }) {
            return (
              <div className={styles.tableWrap}>
                <table>{children}</table>
              </div>
            )
          }
        }}
      >
        {streaming ? remend(text) : text}
      </ReactMarkdown>
    </div>
  )
})

function CopyIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}
