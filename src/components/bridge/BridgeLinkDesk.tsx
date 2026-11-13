import { useState, type CSSProperties } from 'react'
import type { CallLink } from '../../lib/bridge/calls'
import { CALL_LINK_NAMES, stageKindOf } from '../../lib/bridge/calls'
import { LINK_DESK } from '../../lib/bridge/linkDesk'
import type { DeskMove } from '../../lib/bridge/weekCall'
import { NOW_GO_PRESS, NOW_NOT_ON_LIST, NOW_ON_LIST } from '../../lib/bridge/pulseWords'

/**
 * The link's desk (link PR 2): for the pressed stage, what it is, why it
 * matters, how the Bridge reads it, and today's reading. The step's whole list
 * of moves is here to read behind one press, each with today's number and
 * whether the card at the top holds it. Since punch list #334, PR 7 the page
 * makes no call, so this card says nothing of one: its press goes up to
 * *What to do now*.
 */

const label: CSSProperties = { fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)' }
const det: CSSProperties = { fontSize: '0.78rem', color: 'var(--text-muted)' }

export function BridgeLinkDesk({
  link,
  status,
  todayReading,
  door,
  onGoToCall,
  moves = [],
  movesFoot = '',
}: {
  link: CallLink
  status: string
  todayReading: string
  /** A door under today's reading (v2.5853: Collect's *Break it down*). */
  door?: { label: string; onPress: () => void }
  /** Takes the reader to the first screen's card. */
  onGoToCall: () => void
  /** Every move this step would ask for (`deskMoves`), and the line that says how many the card shows. */
  moves?: DeskMove[]
  movesFoot?: string
}) {
  const [movesOpen, setMovesOpen] = useState(false)
  const desk = LINK_DESK[link]
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.7rem 0.9rem', marginTop: '0.6rem' }} data-testid="bridge-link-desk">
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem 0.9rem', alignItems: 'baseline' }}>
        <span style={{ fontSize: '1.1rem', fontWeight: 700 }}>{CALL_LINK_NAMES[link]}</span>
        <span style={det}>· {stageKindOf(link)}</span>
        <span style={{ ...det, marginLeft: 'auto' }} data-testid="bridge-link-desk-status">
          {status}
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))', gap: '0.5rem 1.2rem', marginTop: '0.5rem', fontSize: '0.85rem' }}>
        <div>
          <div style={label}>What it is</div>
          <div>{desk.what}</div>
        </div>
        <div>
          <div style={label}>Why it matters to throughput</div>
          <div>{desk.why}</div>
        </div>
        <div>
          <div style={label}>How the Bridge reads it</div>
          <div>{desk.how}</div>
        </div>
        <div>
          <div style={label}>Today's reading</div>
          <div data-testid="bridge-link-desk-today">{todayReading}</div>
          {door && (
            <button type="button" onClick={door.onPress} style={{ marginTop: 6, height: 30, padding: '0 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }} data-testid="bridge-link-desk-door">
              {door.label} ›
            </button>
          )}
        </div>
      </div>
      {moves.length > 0 && (
        <div style={{ marginTop: '0.6rem' }}>
          <button type="button" onClick={() => setMovesOpen((o) => !o)} aria-expanded={movesOpen} data-testid="bridge-link-desk-moves-toggle" style={{ font: 'inherit', fontSize: '0.82rem', fontWeight: 600, minHeight: 36, padding: '0.25rem 0.7rem', border: '1px solid var(--border-strong)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text-strong)', cursor: 'pointer' }}>
            Every move for {CALL_LINK_NAMES[link]}, {moves.length} {movesOpen ? '▴' : '▾'}
          </button>
          {movesOpen && (
            <div data-testid="bridge-link-desk-moves">
              <ol style={{ listStyle: 'none', margin: '0.4rem 0 0', padding: 0 }}>
                {moves.map((m) => (
                  <li key={m.title} style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', padding: '0.4rem 0', borderTop: '1px solid var(--border)', minHeight: 44, fontSize: '0.86rem' }}>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <b style={{ color: 'var(--text-strong)' }}>{m.title}</b>
                      {m.today && <span style={{ display: 'block', fontSize: '0.74rem', color: 'var(--text-muted)' }}>{m.today}</span>}
                    </span>
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: 999, whiteSpace: 'nowrap', border: `1px solid ${m.onCall ? 'var(--border-blue)' : 'var(--border-strong)'}`, background: m.onCall ? 'var(--bg-blue-tint)' : 'transparent', color: m.onCall ? 'var(--text-link)' : 'var(--text-muted)' }}>{m.onCall ? NOW_ON_LIST : NOW_NOT_ON_LIST}</span>
                  </li>
                ))}
              </ol>
              {movesFoot && <div style={det}>{movesFoot}</div>}
            </div>
          )}
        </div>
      )}
      <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap', marginTop: '0.6rem' }}>
        <button type="button" onClick={onGoToCall} data-testid="bridge-link-desk-go" style={{ marginLeft: 'auto', font: 'inherit', fontSize: '0.85rem', fontWeight: 600, minHeight: 36, padding: '0.3rem 0.8rem', border: '1px solid var(--border-strong)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text-strong)', cursor: 'pointer' }}>
          {NOW_GO_PRESS} ↑
        </button>
      </div>
    </div>
  )
}
