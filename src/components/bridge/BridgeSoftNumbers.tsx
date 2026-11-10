import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import type { SoftNumber } from '../../lib/bridge/softNumbers'

/**
 * Soft numbers (v2.6840, punch list #303, PR 2): the one list of what makes the Bridge's
 * reading unsure, each row with what it moves and its door, the biggest mover first. It stands
 * where *This week* and *Fix the reading* stood side by side.
 */

const label: CSSProperties = { fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)' }
const panel: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.7rem 0.9rem' }

export function BridgeSoftNumbers({ rows }: { rows: SoftNumber[] }) {
  return (
    <div style={{ ...panel, minWidth: 0 }} data-testid="bridge-soft-numbers">
      <div style={label}>Soft numbers</div>
      <p style={{ margin: '0.15rem 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Each one makes the page read low or thin. The biggest mover is first.</p>
      <ul style={{ listStyle: 'none', margin: '0.35rem 0 0', padding: 0 }}>
        {rows.map((r) => (
          <li key={r.key} data-testid={`bridge-soft-${r.key}`} style={{ display: 'flex', flexWrap: 'wrap', gap: '0.2rem 0.8rem', alignItems: 'center', padding: '0.45rem 0', borderTop: '1px solid var(--border)', minHeight: 44 }}>
            <span style={{ flex: '1 1 16rem', minWidth: 0 }}>
              <b style={{ display: 'block', fontSize: '0.88rem', color: 'var(--text-amber-900)' }}>{r.name}</b>
              <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-700)', lineHeight: 1.35 }}>{r.moves}</span>
            </span>
            {r.door ? (
              <Link to={r.door.to} style={{ whiteSpace: 'nowrap', fontSize: '0.85rem', fontWeight: 600, padding: '0.35rem 0' }}>
                {r.door.label} ›
              </Link>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  )
}
