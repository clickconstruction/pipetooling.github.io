/**
 * Before we start (punch list #382): the ready bar. Small check boxes in a row, one a bullet, with a line under the
 * whole row: green under what is ready, amber under what is open, red under an open one once the stage itself is
 * red, and red under a No. A percent follows. Every bullet is one equal step, and the percent reads 100 only when
 * every bullet has a yes (`readiness`). `light` pins the open box to white for the GC's page, which stays light.
 */
import { useLayoutEffect, useRef, useState } from 'react'
import type { ReadyList, ReadyMark } from '../../lib/startChecks/startChecks'

/** A click this soon after the list opened is the same press that opened it. */
const READY_LIST_SAME_PRESS_MS = 400
/** The room the list keeps from the screen's edge. */
const READY_LIST_EDGE_GAP = 8
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
  // A tap on a phone enters, focuses and clicks in one go. The press that opened the list must not shut it.
  const openedAt = useRef(0)
  const open = () =>
    setShow((v) => {
      if (!v) openedAt.current = Date.now()
      return true
    })
  // The list hangs from the bar, which can sit mid-line: it is pulled back so it never runs off the screen's right edge.
  const listRef = useRef<HTMLSpanElement | null>(null)
  const [pull, setPull] = useState(0)
  useLayoutEffect(() => {
    if (!show) {
      setPull(0)
      return
    }
    const r = listRef.current?.getBoundingClientRect()
    if (!r) return
    // The page's own width: a phone's window can read wider while something overflows it.
    const screen = document.documentElement.clientWidth || window.innerWidth
    const over = r.right - (screen - READY_LIST_EDGE_GAP)
    setPull(over > 0 ? Math.min(over, Math.max(0, r.left - READY_LIST_EDGE_GAP)) : 0)
  }, [show])
  if (!marks.length) return null
  const yes = marks.filter((m) => m === 'yes').length
  const box = (m: ReadyMark, size: number) => (
    <span aria-hidden style={{ width: size, height: size, borderRadius: 4, flex: '0 0 auto', display: 'inline-grid', placeItems: 'center', fontSize: size * 0.72, fontWeight: 800, lineHeight: 1, color: '#fff', background: m === 'yes' ? GREEN : m === 'no' ? RED : 'var(--surface)', borderWidth: 2, borderStyle: 'solid', borderColor: m === 'yes' ? GREEN : m === 'no' ? RED : 'var(--text-muted)', marginTop: 2 }}>
      {m === 'yes' ? '✓' : m === 'no' ? '✕' : ''}
    </span>
  )
  return (
    <span style={{ position: 'relative', display: 'inline-block', verticalAlign: 'middle' }} onMouseEnter={open} onMouseLeave={() => setShow(false)}>
      <button
        type="button"
        className="scReady"
        aria-expanded={show}
        aria-label={`${pct}% ready, ${yes} of ${marks.length}. Press to see what it takes to start.`}
        onFocus={open}
        onBlur={() => setShow(false)}
        onClick={(e) => {
          e.stopPropagation()
          setShow((v) => {
            if (v && Date.now() - openedAt.current < READY_LIST_SAME_PRESS_MS) return v
            if (!v) openedAt.current = Date.now()
            return !v
          })
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
        <span ref={listRef} role="status" data-ready-list className="scReadyList" style={pull ? { left: -pull } : undefined}>
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
