import { Link } from 'react-router-dom'
import { gcProjectHref } from '../../lib/gc/links'
import { GC_WORK_LABELS, NOTHING_BIDDING, biddingDueWords, deckBidWords, leadsWithOpenBid, type BiddingLine, type GcWorkCounts, type ProspectJob } from '../../lib/prospects/gcLeadLane'

/**
 * GC work in flight (v2.5561, v2.5785): the Project Board's counts over the Jobs to GC deck, the projects bidding
 * now, and how many leads on the deck carry a job with a bid day. Moved out of `src/pages/Prospects.tsx` unchanged;
 * the page decides when it shows (the lane, with the read answered or failed).
 */
export function GcWorkStrip({
  work,
  bidding,
  deckIds,
  jobsByProspect,
}: {
  /** The counts; null when the Project Board could not be read. */
  work: GcWorkCounts | null
  bidding: readonly BiddingLine[]
  /** The leads on the deck, in order. */
  deckIds: readonly string[]
  jobsByProspect: Record<string, ProspectJob[]>
}) {
  return (
      <div
        role="group"
        aria-label="GC work in flight"
        style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '0.5rem 0.75rem', marginBottom: '0.75rem', fontSize: '0.8125rem' }}
      >
        <span style={{ fontWeight: 700, color: 'var(--text-700)' }}>GC work in flight</span>
        {work == null ? (
          // Only a failed read lands here: the strip draws nothing while loading (v2.5585).
          <span style={{ color: 'var(--text-muted)' }}>the Project Board could not be read</span>
        ) : (
          GC_WORK_LABELS.map((w) => (
            <span key={w.key} style={{ display: 'inline-flex', gap: '0.35rem', alignItems: 'baseline', border: '1px solid var(--border)', borderRadius: 999, padding: '0.1rem 0.6rem', color: work[w.key] === 0 ? 'var(--text-muted)' : 'var(--text-strong)' }}>
              <b>{w.label}</b> {work[w.key]}
              {w.key === 'lost' && work.lost > 0 && <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>· each owner can come back here</span>}
            </span>
          ))
        )}
        <Link to="/gc" style={{ marginLeft: 'auto', color: 'var(--text-link)', fontSize: '0.75rem' }}>
          from the Project Board
        </Link>
        {work != null && (
          // The honesty under the counts (v2.5785): which projects are bidding and by when, and how many
          // leads on this deck carry a job with a bid day, so the strip never reads as more than it is.
          <div style={{ flexBasis: '100%', display: 'flex', flexDirection: 'column', gap: '0.2rem', color: 'var(--text-600)' }}>
            <span>
              <b style={{ color: 'var(--text-700)' }}>Bidding now:</b>{' '}
              {bidding.length === 0
                ? NOTHING_BIDDING
                : bidding.map((line, i) => {
                    const due = biddingDueWords(line)
                    return (
                      <span key={line.id}>
                        {i > 0 && ' · '}
                        <Link to={gcProjectHref(line.id)} style={{ color: 'var(--text-link)', fontWeight: 600 }}>
                          {line.name}
                        </Link>
                        , <span style={{ color: due.tone === 'red' ? 'var(--text-red-700)' : 'inherit', fontWeight: due.tone === 'red' ? 600 : 400 }}>{due.text}</span>
                      </span>
                    )
                  })}
            </span>
            <span>
              <b style={{ color: 'var(--text-700)' }}>On this deck:</b> {deckBidWords(leadsWithOpenBid(deckIds, jobsByProspect), deckIds.length)}
              {deckIds.length > 0 && <span style={{ color: 'var(--text-muted)' }}> · a bid day goes in the lead’s Jobs box</span>}
            </span>
          </div>
        )}
      </div>
  )
}
