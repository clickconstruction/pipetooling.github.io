import { Link } from 'react-router-dom'
import type { CountyAssignments } from '../../lib/legal/firmCounties'
import { countyCardFacts, type LegalMapCase } from '../../lib/legal/firmMap'

/**
 * The contents card under the firm cards (punch list #144, PR 1b): what is in the county
 * under the pointer. Its firm, its cases with where each stands, its dollars, and a door to
 * the desk on each. A held case (a dot clicked on the map) is marked and the card stays on
 * its county until another dot is clicked. Nothing here colors a county.
 */
export default function LegalCountyContentsCard({ county, cases, assignments, firmNames, heldId, onHold }: {
  county: string | null
  cases: ReadonlyArray<LegalMapCase>
  assignments: CountyAssignments
  firmNames: ReadonlyMap<string, string>
  /** The held case's `id`. */
  heldId: string | null
  onHold: (c: LegalMapCase) => void
}) {
  const frame = { border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', background: 'var(--surface)', fontSize: '0.8rem' } as const
  const muted = { color: 'var(--text-muted)', fontSize: '0.74rem' } as const
  if (!county) {
    return (
      <div data-legal-county-card="" style={frame}>
        <h4 style={{ margin: '0 0 4px', fontSize: '0.84rem' }}>What is where</h4>
        <div style={muted}>Hover a county to see the cases in it. Click a dot to hold one here while you color.</div>
      </div>
    )
  }
  const facts = countyCardFacts(county, cases, assignments, firmNames)
  return (
    <div data-legal-county-card={county} style={frame}>
      <h4 style={{ margin: '0 0 2px', fontSize: '0.84rem' }}>
        {facts.title}{' '}
        <span style={{ fontWeight: 400, ...muted }}>
          · {facts.firmName ?? <span style={{ padding: '0 6px', borderRadius: 999, background: 'var(--bg-red-tint)', color: 'var(--text-red-700)' }}>no firm covers it</span>}
        </span>
      </h4>
      <div style={{ ...muted, marginBottom: 4 }}>{facts.countLine}</div>
      {facts.emptyLine ? <div style={{ ...muted, padding: '4px 0' }}>{facts.emptyLine}</div> : null}
      {facts.rows.map((row) => {
        const held = row.case.id === heldId
        return (
          <div
            key={row.case.id}
            data-legal-county-case={row.case.id}
            data-held={held ? '1' : '0'}
            role="button"
            tabIndex={0}
            onClick={() => onHold(row.case)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onHold(row.case)
              }
            }}
            style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '6px 12px', margin: '0 -12px', borderTop: '1px solid var(--border)', cursor: 'pointer', background: held ? 'var(--bg-muted)' : 'transparent' }}
          >
            <span>
              <span aria-hidden style={{ width: 9, height: 9, borderRadius: '50%', display: 'inline-block', verticalAlign: -1, marginRight: 6, background: row.color }} />
              {row.case.name}
              <div style={muted}>
                {row.case.jobLabels} · {row.case.note}
                {row.case.viaGc ? ' · GC pays' : ''}
              </div>
            </span>
            <span style={{ textAlign: 'right', flexShrink: 0 }}>
              <b>{row.money}</b>
              <div style={muted}>
                <Link to={`/jobs?tab=stages&legal=${encodeURIComponent(row.case.key)}`} onClick={(e) => e.stopPropagation()} style={{ color: 'var(--text-muted)' }}>
                  Open on the desk ↗
                </Link>
              </div>
            </span>
          </div>
        )
      })}
    </div>
  )
}
