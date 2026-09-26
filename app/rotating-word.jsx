'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import styles from './page.module.css'

const WORDS = ['the back end', 'CLIs', 'webview apps']
const INTERVAL_MS = 3500
const EXIT_MS = 300

export function RotatingWord() {
  const [index, setIndex] = useState(0)
  const [leaving, setLeaving] = useState(false)
  const [widths, setWidths] = useState(null)
  const measure = useRef(null)

  useEffect(() => {
    let swap
    const tick = setInterval(() => {
      setLeaving(true)
      swap = setTimeout(() => {
        setIndex(i => (i + 1) % WORDS.length)
        setLeaving(false)
      }, EXIT_MS)
    }, INTERVAL_MS)
    return () => {
      clearInterval(tick)
      clearTimeout(swap)
    }
  }, [])

  // The width of each word changes with the viewport and when the web font loads.
  useLayoutEffect(() => {
    const words = [...measure.current.children]
    const read = () =>
      setWidths(words.map(w => w.getBoundingClientRect().width))
    read()
    const observer = new ResizeObserver(read)
    for (const w of words) observer.observe(w)
    return () => observer.disconnect()
  }, [])

  // The box starts to move to the next width when the current word starts to leave.
  const target = leaving ? (index + 1) % WORDS.length : index

  return (
    <>
      <span className={styles.srOnly}>
        {WORDS.slice(0, -1).join(', ')} and {WORDS.at(-1)}.
      </span>
      <span ref={measure} className={styles.rotatingMeasure} aria-hidden="true">
        {WORDS.map(w => (
          <span key={w}>{w}.</span>
        ))}
      </span>
      <span
        className={styles.rotatingBox}
        style={widths ? { width: widths[target] } : undefined}
        aria-hidden="true"
      >
        <span className={styles.rotatingSpacer}>{WORDS[index]}.</span>
        <span
          key={index}
          className={`${styles.accentText} ${styles.rotatingWord} ${
            leaving ? styles.rotatingWordOut : ''
          }`}
        >
          {WORDS[index]}.
        </span>
      </span>
    </>
  )
}
