'use client'

import { useState } from 'react'
import { TABS } from './benchmark-data'
import styles from './page.module.css'

function format(value, unit) {
  if (unit === 'req/s') return `${Math.round(value / 1000)}k`
  return `${value} ${unit}`
}

function Info({ id, name, text }) {
  return (
    <>
      <button
        type="button"
        className={styles.benchInfo}
        aria-label={`About ${name}`}
        aria-describedby={id}
      >
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
          <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="1.4" />
          <circle cx="8" cy="4.9" r="0.95" fill="currentColor" />
          <path d="M8 7.2v4.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
      <span role="tooltip" id={id} className={styles.benchPopover}>
        {text.map(paragraph => (
          <span key={paragraph}>{paragraph}</span>
        ))}
      </span>
    </>
  )
}

function Group({ group, data, tab }) {
  const max = Math.max(...group.values)
  const id = `bench-${tab}-${group.name.replace(/\W+/g, '-')}`
  const row = group.extra ? styles.benchRowMem : styles.benchRow
  return (
    <div className={styles.benchGroup}>
      <div className={styles.benchHead}>
        <span className={styles.benchTitle}>
          <code className={styles.benchName}>{group.name}</code>
          {group.detail && <Info id={id} name={group.name} text={group.detail} />}
        </span>
        <span className={styles.benchWhat}>{group.what}</span>
      </div>
      {group.extra && (
        <div className={`${row} ${styles.benchCols}`} aria-hidden="true">
          <span />
          <span />
          <span>{data.valueLabel}</span>
          <span>{data.extraLabel}</span>
        </div>
      )}
      {(group.series ?? data.series).map((name, i) => {
        const value = group.values[i]
        const nio = name === 'Nio'
        return (
          <div className={row} key={name}>
            <span className={nio ? styles.benchLabelNio : styles.benchLabel}>
              {name}
            </span>
            <span className={styles.benchTrack}>
              <span
                className={nio ? styles.benchBarNio : styles.benchBar}
                style={{ width: `${Math.max((value / max) * 100, 1.5)}%` }}
              />
            </span>
            <span className={nio ? styles.benchValueNio : styles.benchValue}>
              {format(value, data.unit)}
            </span>
            {group.extra && (
              <span className={nio ? styles.benchMemNio : styles.benchMem}>
                {group.extra[i]}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

export function Benchmarks() {
  const [active, setActive] = useState(TABS[0].key)
  const tab = TABS.find(t => t.key === active)
  const { data } = tab

  return (
    <div className={styles.bench}>
      <div className={styles.tabs} role="tablist" aria-label="Benchmarks">
        {TABS.map(t => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={t.key === active}
            className={t.key === active ? styles.tabActive : styles.tab}
            onClick={() => setActive(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <p className={styles.benchNote}>
        <strong>{data.better === 'lower' ? 'Lower is better.' : 'Higher is better.'}</strong>{' '}
        {data.note}
      </p>
      <div className={styles.benchGrid} role="tabpanel">
        {data.groups.map(group => (
          <Group key={group.name} group={group} data={data} tab={tab.key} />
        ))}
      </div>
    </div>
  )
}
