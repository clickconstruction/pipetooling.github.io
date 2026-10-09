/**
 * The Division 22 window's Sections tab (v2.5058, the rules manager's read side — PR 3 of the train in
 * `to-dos/division-22-rules-manager.md`). Every spec section with the rules filed under it and the names and
 * bids those rules decide (`sectionTallies`), the deliberate no-code rules last. Read-only; adding and renaming a
 * section is PR 4.
 */
import type { CSSProperties } from 'react'

import type { SectionTally } from '../../lib/specSectionRules'

const cell: CSSProperties = { padding: '0.4rem 0.6rem', borderBottom: '1px solid var(--border)', fontSize: '0.8125rem', textAlign: 'left' }
const num: CSSProperties = { ...cell, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }
const head: CSSProperties = { ...cell, fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)', background: 'var(--bg-subtle)' }

export function SpecSectionSectionsTab({ tallies }: { tallies: ReadonlyArray<SectionTally> }) {
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden', maxHeight: '56vh', overflowY: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', color: 'var(--text-strong)' }}>
        <thead>
          <tr>
            <th scope="col" style={head}>Section</th>
            <th scope="col" style={head}>Title</th>
            <th scope="col" style={{ ...head, textAlign: 'right' }}>Rules</th>
            <th scope="col" style={{ ...head, textAlign: 'right' }}>Names</th>
            <th scope="col" style={{ ...head, textAlign: 'right' }}>Bids</th>
          </tr>
        </thead>
        <tbody>
          {tallies.map((t) => {
            const quiet = t.rules === 0
            const color = quiet ? 'var(--text-muted)' : 'var(--text-strong)'
            return (
              <tr key={t.code ?? 'no-code'}>
                <td style={{ ...cell, color, fontFamily: 'ui-monospace, Menlo, monospace', whiteSpace: 'nowrap' }}>{t.code ?? '—'}</td>
                <td style={{ ...cell, color }}>{t.title}</td>
                <td style={{ ...num, color }}>{t.rules}</td>
                <td style={{ ...num, color }}>{t.names}</td>
                <td style={{ ...num, color }}>{t.bids}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
