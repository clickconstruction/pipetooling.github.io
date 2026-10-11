import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import type { Move } from '../../lib/bridge/thisWeek'

/** This week (v2.5221): the moves that change the two lines, sized where they can be, each ending in its door. */

const label: CSSProperties = { fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)' }
const det: CSSProperties = { fontSize: '0.78rem', color: 'var(--text-muted)' }
const panel: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.7rem 0.9rem' }

export function BridgeThisWeek({ moves }: { moves: Move[] }) {
  return (
    <div style={{ ...panel, minWidth: 0 }} data-testid="bridge-this-week">
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', flexWrap: 'wrap' }}>
        <span style={label}>This week — what moves the two lines</span>
        <span style={det}>{moves.length === 0 ? 'nothing to move today' : 'biggest lever first'}</span>
      </div>
      {moves.length > 0 && (
        <ol style={{ listStyle: 'none', margin: '0.3rem 0 0', padding: 0 }}>
          {moves.map((m, i) => (
            <li key={`${m.key}:${m.title}`} style={{ display: 'flex', gap: '0.6rem', alignItems: 'baseline', padding: '0.35rem 0', borderTop: '1px solid var(--border)', fontSize: '0.85rem' }} data-testid={`bridge-move-${m.key}`}>
              <span style={{ ...det, fontWeight: 700, width: 16, flex: '0 0 auto' }}>{i + 1}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <b>{m.title}</b>
                <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)' }}>{m.why}</span>
              </span>
              <span style={{ fontWeight: 700, fontSize: '0.78rem', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', color: m.leverTone === 'green' ? 'var(--text-green-700)' : 'var(--text-muted)' }}>{m.lever}</span>
              {m.door ? (
                <Link to={m.door.to} style={{ whiteSpace: 'nowrap', fontSize: '0.8rem' }}>
                  {m.door.label}
                </Link>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
