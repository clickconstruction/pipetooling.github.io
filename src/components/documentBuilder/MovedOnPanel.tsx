/**
 * The panel for one thing that moved on somewhere else (punch list #404): a builder's draft or a job's sheet that a
 * teammate or another tab saved or published after this page read it. This page's save was refused, what was typed
 * here is still on the page, and nothing is thrown away until the person presses one of the two. The words are
 * `lib/documentBuilder/movedOn.ts`.
 */
import type { CSSProperties } from 'react'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import type { MovedOnWords } from '../../lib/documentBuilder/movedOn'

const CARD: CSSProperties = { background: 'var(--bg-amber-tint)', border: '1px solid var(--text-amber-700)', borderRadius: 10, padding: '12px 14px', display: 'grid', gap: 8, minWidth: 0 }
const TITLE: CSSProperties = { margin: 0, fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-strong)' }
const LINE: CSSProperties = { margin: 0, fontSize: '0.8rem', color: 'var(--text-base)' }
const FINE: CSSProperties = { margin: 0, fontSize: '0.75rem', color: 'var(--text-700)' }
const BTNS: CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }
const SECOND: CSSProperties = { border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', borderRadius: 9, padding: '9px 14px', fontFamily: 'inherit', fontSize: '0.875rem', fontWeight: 600, minHeight: 44, cursor: 'pointer' }

function mainPress(dead: boolean): CSSProperties {
  return { border: 0, background: dead ? DEAD_PRESS_FILL : '#2563eb', color: dead ? DEAD_PRESS_TEXT : 'white', borderRadius: 9, padding: '9px 14px', fontFamily: 'inherit', fontSize: '0.875rem', fontWeight: 700, minHeight: 44, cursor: dead ? 'not-allowed' : 'pointer' }
}

type Props = {
  words: MovedOnWords
  /** A publish or another write is on its way: both presses wait. */
  busy?: boolean
  onLoad: () => void
  onKeep: () => void
}

export function MovedOnPanel({ words, busy = false, onLoad, onKeep }: Props) {
  return (
    <div role="alert" style={CARD}>
      <h3 style={TITLE}>{words.title}</h3>
      {words.lines.map((line) => (
        <p key={line} style={LINE}>
          {line}
        </p>
      ))}
      <div style={BTNS}>
        <button type="button" disabled={busy} style={mainPress(busy)} onClick={onLoad}>
          {words.load}
        </button>
        <button type="button" disabled={busy} style={busy ? { ...SECOND, background: DEAD_PRESS_FILL, color: DEAD_PRESS_TEXT, cursor: 'not-allowed' } : SECOND} onClick={onKeep}>
          {words.keep}
        </button>
      </div>
      {words.costs.map((line) => (
        <p key={line} style={FINE}>
          {line}
        </p>
      ))}
    </div>
  )
}
