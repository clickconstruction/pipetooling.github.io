import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import type { ReadingGap } from '../../lib/bridge/readingGaps'

/**
 * Fix the reading (v2.5220): the gaps that make the Bridge read low or thin,
 * each with what it moves and its door, biggest mover first.
 */

const label: CSSProperties = { fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)' }
const det: CSSProperties = { fontSize: '0.78rem', color: 'var(--text-muted)' }
const panel: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.7rem 0.9rem' }
/** A chip holds its line while it fits; only one wider than the row wraps its words, so it never pushes the row past the screen. */
const chip: CSSProperties = { display: 'inline-block', fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-amber-900)', background: 'var(--bg-amber-tint)', border: '1px solid var(--border-amber)', borderRadius: 999, padding: '0.1rem 0.6rem', maxWidth: '100%' }

export function BridgeReadingGaps({ gaps }: { gaps: ReadingGap[] }) {
  return (
    <div style={{ ...panel, minWidth: 0 }} data-testid="bridge-reading-gaps">
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', flexWrap: 'wrap' }}>
        <span style={label}>Fix the reading</span>
        <span style={det}>{gaps.length === 0 ? 'nothing makes the page read low or thin today' : 'what makes the page read low or thin, biggest mover first'}</span>
      </div>
      {gaps.length > 0 && (
        <ul style={{ listStyle: 'none', margin: '0.3rem 0 0', padding: 0 }}>
          {gaps.map((g) => (
            // The row wraps: a chip too long for a phone's line ("5 jobs worked this window with no % complete") used to
            // shrink the words to nothing and push the door past the screen; now the words and the door drop under it.
            <li key={g.key} style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', alignItems: 'baseline', padding: '0.35rem 0', borderTop: '1px solid var(--border)', fontSize: '0.85rem' }} data-testid={`bridge-gap-${g.key}`}>
              <span style={chip}>{g.chip}</span>
              <span style={{ flex: '1 1 8rem', minWidth: 0, color: 'var(--text)' }}>{g.moves}</span>
              {g.door ? (
                <Link to={g.door.to} style={{ whiteSpace: 'nowrap', fontSize: '0.8rem' }}>
                  {g.door.label}
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
