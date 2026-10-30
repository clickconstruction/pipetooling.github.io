import { Link } from 'react-router-dom'
import type { CountyAssignments } from '../../lib/legal/firmCounties'
import { countyCardFacts, type LegalMapCase } from '../../lib/legal/firmMap'
import type { VenueBlock } from '../../lib/legal/legalParties'

/**
 * The contents card under the firm cards (punch list #144, PR 1b): what is in the county
 * under the pointer. Its firm, its cases with where each stands, its dollars, and a door to
 * the desk on each. A held case (a dot clicked on the map) is marked and the card stays on
 * its county until another dot is clicked. Nothing here colors a county. On the Legal desk's
 * Map (v2.5784, `onOpen`) the door is a press that opens the desk on the case, not a link away.
 */
export default function LegalCountyContentsCard({ county, cases, assignments, firmNames, heldId, onHold, onOpen, lens = false, venue = null }: {
  county: string | null
  cases: ReadonlyArray<LegalMapCase>
  assignments: CountyAssignments
  firmNames: ReadonlyMap<string, string>
  /** The held case's `id`. */
  heldId: string | null
  onHold: (c: LegalMapCase) => void
  /** The desk's Map: open the desk on this case, in place of the link. */
  onOpen?: (c: LegalMapCase) => void
  /** The desk's Map: the empty card says tap, not color. */
  lens?: boolean
  /** The held case's venue (punch list #219, v2.6174): the places a suit can be filed and the rule lines, under the rows. */
  venue?: VenueBlock | null
}) {
  const frame = { border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', background: 'var(--surface)', fontSize: '0.8rem' } as const
  const muted = { color: 'var(--text-muted)', fontSize: '0.74rem' } as const
  if (!county) {
    return (
      <div data-legal-county-card="" style={frame}>
        <h4 style={{ margin: '0 0 4px', fontSize: '0.84rem' }}>What is where</h4>
        <div style={muted}>{lens ? 'Tap a county to see the cases in it. Tap a case to open the desk on it.' : 'Hover a county to see the cases in it. Click a dot to hold one here while you color.'}</div>
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
                {onOpen ? (
                  <button type="button" onClick={(e) => { e.stopPropagation(); onOpen(row.case) }} data-legal-map-open={row.case.key} style={{ border: 'none', background: 'none', padding: 0, font: 'inherit', color: 'var(--text-link)', cursor: 'pointer' }}>
                    Open on the desk ›
                  </button>
                ) : (
                  <Link to={`/jobs?tab=stages&legal=${encodeURIComponent(row.case.key)}`} onClick={(e) => e.stopPropagation()} style={{ color: 'var(--text-muted)' }}>
                    Open on the desk ↗
                  </Link>
                )}
              </div>
            </span>
          </div>
        )
      })}
      {venue ? (
        <div data-legal-venue-block style={{ borderTop: '1px solid var(--border)', margin: '6px -12px 0', padding: '8px 12px 0' }}>
          <div style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6 }}>{venue.title}</div>
          {venue.places.map((p) => (
            <div key={p.basis} data-legal-venue-place={p.basis} style={{ border: '1px solid var(--border)', borderRadius: 6, padding: '6px 9px', marginBottom: 6, borderLeft: p.basis === 'work' ? '3px solid var(--text-blue-700)' : undefined }}>
              <div style={{ fontSize: '0.64rem', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{p.label}</div>
              <div style={{ fontWeight: 600, fontSize: '0.8rem' }}>{p.main}</div>
              <div style={muted}>{p.quiet}</div>
            </div>
          ))}
          {venue.rules.map((r) => <div key={r} style={{ ...muted, marginTop: 4 }}>{r}</div>)}
          <div style={{ ...muted, marginTop: 4 }}>{venue.source}</div>
          <div style={{ marginTop: 8 }}>
            <Link to="/map" data-legal-venue-court-areas style={{ fontSize: '0.74rem', color: 'var(--text-link)' }}>Court areas on the Map page ↗</Link>
          </div>
        </div>
      ) : null}
    </div>
  )
}
