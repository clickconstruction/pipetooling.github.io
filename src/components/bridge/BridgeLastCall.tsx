import { useState, type CSSProperties } from 'react'
import type { CallOutcome, Scorecard } from '../../lib/bridge/calls'

/**
 * Last week's call, against what moved (link PR 2): the scorecard Monday opens
 * on — the link, who called it and when, the streak, a verdict chip, the moves
 * with owner and then → now, the link's measure, and the consequence. On
 * Friday it asks whether the link moved and records the answer.
 */

const label: CSSProperties = { fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)' }
const det: CSSProperties = { fontSize: '0.78rem', color: 'var(--text-muted)' }
const cap: CSSProperties = { fontSize: '0.62rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }
const cell: CSSProperties = { borderTop: '1px solid var(--border)', padding: '0.25rem 0' }

const verdictColor = (v: Scorecard['verdict']): string => (v === 'moved' ? 'var(--text-green-700)' : v === 'did_not_move' ? 'var(--text-red-700)' : 'var(--text-muted)')
const doneWord = (d: Scorecard['moves'][number]['done']): string => (d === 'yes' ? 'yes' : d === 'part' ? 'part' : d === 'no' ? 'no' : '—')
const doneColor = (d: Scorecard['moves'][number]['done']): string => (d === 'yes' ? 'var(--text-green-700)' : d === 'part' ? 'var(--text-amber-800)' : d === 'no' ? 'var(--text-red-700)' : 'var(--text-muted)')

export function BridgeLastCall({ card, answering, onAnswer }: { card: Scorecard | null; answering: boolean; onAnswer: (outcome: CallOutcome, note: string | null) => void }) {
  const [note, setNote] = useState('')
  if (!card) {
    return (
      <div id="bridge-last-call" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.7rem 0.9rem', marginTop: '0.6rem' }} data-testid="bridge-last-call">
        <div style={label}>Last week's call, against what moved</div>
        <div style={{ ...det, marginTop: '0.3rem' }}>No call yet. Press a stage, name the moves and their owners, and record the link for this week. Friday asks whether it moved.</div>
      </div>
    )
  }
  return (
    <div id="bridge-last-call" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.7rem 0.9rem', marginTop: '0.6rem', fontSize: '0.85rem' }} data-testid="bridge-last-call">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
        <span style={label}>Last week's call, against what moved</span>
        <span style={{ marginLeft: 'auto', fontSize: '0.78rem', fontWeight: 700, padding: '2px 10px', borderRadius: 999, border: `1px solid ${verdictColor(card.verdict)}`, color: verdictColor(card.verdict), whiteSpace: 'nowrap' }} data-testid="bridge-last-call-verdict">
          {card.verdictText}
        </span>
      </div>
      <div style={{ marginTop: '0.3rem' }}>
        <b style={{ fontSize: '1rem' }}>{card.linkName}</b> <span style={det}>· {card.calledLabel} · {card.streakText}</span>
      </div>
      {card.moves.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) auto minmax(0, 1.4fr) auto', gap: '0.15rem 0.8rem', alignItems: 'baseline', marginTop: '0.4rem' }}>
          <span style={cap}>move</span>
          <span style={cap}>owner</span>
          <span style={cap}>then → now</span>
          <span style={cap}>done</span>
          {card.moves.map((m) => (
            <span key={m.title} style={{ display: 'contents' }}>
              <span style={cell}>{m.title}</span>
              <span style={{ ...cell, color: 'var(--text-muted)' }}>{m.who}</span>
              <span style={cell}>
                {m.thenText} <span style={{ color: 'var(--text-muted)' }}>→</span> <b style={{ color: m.done === 'no' ? 'var(--text-red-700)' : m.done === 'yes' ? 'var(--text-green-700)' : 'var(--text)' }}>{m.nowText}</b>
              </span>
              <span style={{ ...cell, fontWeight: 700, color: doneColor(m.done) }}>{doneWord(m.done)}</span>
            </span>
          ))}
        </div>
      )}
      {card.measure && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '0.3rem', marginTop: '0.3rem' }}>
          The link's measure: <b>{card.measure.then}</b> <span style={{ color: 'var(--text-muted)' }}>→</span> <b style={{ color: verdictColor(card.verdict) }}>{card.measure.now}</b>
        </div>
      )}
      <div style={{ marginTop: '0.4rem', padding: '0.45rem 0.6rem', borderRadius: 6, background: card.verdict === 'moved' ? 'var(--bg-green-tint, transparent)' : 'var(--bg-amber-tint, transparent)', border: `1px solid ${card.verdict === 'moved' ? 'var(--text-green-700)' : 'var(--text-amber-800)'}`, color: card.verdict === 'moved' ? 'var(--text-green-700)' : 'var(--text-amber-800)' }} data-testid="bridge-last-call-consequence">
        {card.consequence}
      </div>
      {card.fridayAsks && (
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', marginTop: '0.5rem' }} data-testid="bridge-last-call-friday">
          <span style={{ fontWeight: 600 }}>Friday asks: did {card.linkName} move?</span>
          <input aria-label="A note on the answer" placeholder="a note, if any" value={note} onChange={(e) => setNote(e.target.value)} style={{ font: 'inherit', fontSize: '0.8rem', padding: '0.15rem 0.4rem', border: '1px solid var(--border)', borderRadius: 5, background: 'var(--surface)', color: 'var(--text)', width: 200 }} />
          <button type="button" disabled={answering} onClick={() => onAnswer('moved', note.trim() || null)} style={{ font: 'inherit', fontSize: '0.8rem', fontWeight: 600, padding: '0.25rem 0.7rem', border: '1px solid var(--text-green-700)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text-green-700)', cursor: 'pointer' }}>
            It moved
          </button>
          <button type="button" disabled={answering} onClick={() => onAnswer('did_not_move', note.trim() || null)} style={{ font: 'inherit', fontSize: '0.8rem', fontWeight: 600, padding: '0.25rem 0.7rem', border: '1px solid var(--text-red-700)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text-red-700)', cursor: 'pointer' }}>
            It did not
          </button>
        </div>
      )}
    </div>
  )
}
