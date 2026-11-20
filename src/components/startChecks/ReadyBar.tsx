/**
 * Before we start (punch list #382): the ready bar. Small check boxes in a row, one a bullet, with a line under the
 * whole row: green under what is ready, amber under what is open, red under an open one once the stage itself is
 * red, and red under a No. A percent follows. Every bullet is one equal step, and the percent reads 100 only when
 * every bullet has a yes (`readiness`). `light` pins the open box to white for the GC's page, which stays light.
 */
import { useState } from 'react'
import type { ReadyList, ReadyMark } from '../../lib/startChecks/startChecks'

const GREEN = '#16a34a'
const RED = '#dc2626'
const AMBER = '#f59e0b'

export function ReadyBar({ marks, urgent = false, light = false }: { marks: readonly ReadyMark[]; urgent?: boolean; light?: boolean }) {
  return (
    <span aria-hidden data-ready-bar style={{ display: 'inline-flex', verticalAlign: 'middle' }}>
      {marks.map((m, i) => {
        const line = m === 'yes' ? GREEN : m === 'no' || urgent ? RED : AMBER
        const fill = m === 'yes' ? GREEN : m === 'no' ? RED : light ? '#fff' : 'var(--surface)'
        const edge = m === 'yes' ? GREEN : m === 'no' ? RED : 'var(--text-muted)'
        return (
          <span key={i} data-ready-mark={m} style={{ display: 'inline-grid', justifyItems: 'center', padding: '0 2px' }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, display: 'inline-grid', placeItems: 'center', fontSize: 9, fontWeight: 800, lineHeight: 1, color: '#fff', background: fill, borderWidth: 1.5, borderStyle: 'solid', borderColor: edge }}>
              {m === 'yes' ? '✓' : m === 'no' ? '✕' : ''}
            </span>
            <span data-ready-line={line === GREEN ? 'green' : line === RED ? 'red' : 'amber'} style={{ display: 'block', height: 4, background: line, justifySelf: 'stretch', margin: '3px -2px 0', borderRadius: i === 0 ? '2px 0 0 2px' : i === marks.length - 1 ? '0 2px 2px 0' : 0 }} />
          </span>
        )
      })}
    </span>
  )
}

/** The bar with its percent: 83% ready. Green at 100. */
export function ReadyPercent({ marks, pct, urgent = false }: { marks: readonly ReadyMark[]; pct: number; urgent?: boolean }) {
  if (!marks.length) return null
  const yes = marks.filter((m) => m === 'yes').length
  return (
    <span role="img" aria-label={`${pct}% ready, ${yes} of ${marks.length}`} data-ready-percent={pct} style={{ display: 'inline-flex', gap: 5, alignItems: 'center', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
      <ReadyBar marks={marks} urgent={urgent} />
      <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: pct === 100 ? 'var(--text-green-700)' : 'var(--text-strong)' }}>{pct}%</span>
      <span style={{ fontSize: '0.78125rem', color: 'var(--text-muted)' }}>ready</span>
    </span>
  )
}

/**
 * The ready bar as a press of its own: resting the cursor on it, or pressing it on a phone, lists what it takes to
 * start the stage. The open bullets come first with where each stands, then the ones with a yes, dulled.
 */
export function ReadyMarks({ list, marks, pct, urgent = false }: { list: ReadyList; marks: readonly ReadyMark[]; pct: number; urgent?: boolean }) {
  const [show, setShow] = useState(false)
  if (!marks.length) return null
  const yes = marks.filter((m) => m === 'yes').length
  const box = (m: ReadyMark, size: number) => (
    <span aria-hidden style={{ width: size, height: size, borderRadius: 4, flex: '0 0 auto', display: 'inline-grid', placeItems: 'center', fontSize: size * 0.72, fontWeight: 800, lineHeight: 1, color: '#fff', background: m === 'yes' ? GREEN : m === 'no' ? RED : 'var(--surface)', borderWidth: 2, borderStyle: 'solid', borderColor: m === 'yes' ? GREEN : m === 'no' ? RED : 'var(--text-muted)', marginTop: 2 }}>
      {m === 'yes' ? '✓' : m === 'no' ? '✕' : ''}
    </span>
  )
  return (
    <span style={{ position: 'relative', display: 'inline-block', verticalAlign: 'middle' }} onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      <button
        type="button"
        className="scReady"
        aria-expanded={show}
        aria-label={`${pct}% ready, ${yes} of ${marks.length}. Press to see what it takes to start.`}
        onFocus={() => setShow(true)}
        onBlur={() => setShow(false)}
        onClick={(e) => {
          e.stopPropagation()
          setShow((v) => !v)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && show) {
            e.stopPropagation()
            setShow(false)
          }
        }}
      >
        <ReadyBar marks={marks} urgent={urgent} />
        <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: pct === 100 ? 'var(--text-green-700)' : 'var(--text-strong)' }}>{pct}%</span>
        <span style={{ fontSize: '0.78125rem', color: 'var(--text-muted)', fontWeight: 400 }}>ready</span>
      </button>
      {show ? (
        <span role="status" data-ready-list className="scReadyList">
          <b style={{ color: 'var(--text-strong)', fontSize: '0.875rem' }}>{list.title}</b>
          <span style={{ display: 'block', fontSize: '0.78125rem', color: 'var(--text-muted)' }}>{list.count}</span>
          {list.open.length ? <span style={{ display: 'block', marginTop: 8, fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-strong)' }}>Still open · {list.open.length}</span> : null}
          {list.open.map((b) => (
            <span key={b.id} style={{ display: 'flex', gap: 8, marginTop: 6, alignItems: 'flex-start' }}>
              {box(b.no ? 'no' : 'open', 16)}
              <span>
                <span style={{ color: 'var(--text-strong)', fontWeight: 600 }}>{b.words}</span>
                <span style={{ display: 'block', fontSize: '0.78125rem', color: b.no ? 'var(--text-red-700)' : 'var(--text-muted)' }}>{b.line}</span>
              </span>
            </span>
          ))}
          {list.met.length ? <span style={{ display: 'block', marginTop: 10, fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Has a yes · {list.met.length}</span> : null}
          {list.met.map((b) => (
            <span key={b.id} style={{ display: 'flex', gap: 8, marginTop: 4, alignItems: 'flex-start', opacity: 0.65 }}>
              {box('yes', 14)}
              <span>{b.words}</span>
            </span>
          ))}
        </span>
      ) : null}
    </span>
  )
}
