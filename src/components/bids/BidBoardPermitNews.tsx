import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { MARK_LOST_LABEL, NEWS_TITLE, type NewsItem } from '../../lib/research/bidPermitNews'

/**
 * Permit news on the Bid Board (punch list #307, PR 5): the strip above the sections. Each line
 * is one undecided bid whose address the city has news on, with the press Open the bid. A
 * general plumbing permit that lists another name comes first, and on a sent bid its line has a
 * second press, Mark lost…, which opens the board's own outcome under the line. The kernel says
 * which lines offer it (`markLost`); the board passes the window. It marks no bid by itself.
 */
const FIRST = 4

// `font` comes first: the shorthand resets the size and weight, so written last it undid both.
const press: CSSProperties = { font: 'inherit', background: 'var(--surface)', color: 'var(--text-strong)', border: '1px solid var(--border-strong)', borderRadius: 6, padding: '6px 12px', fontSize: '0.8125rem', fontWeight: 600, minHeight: 34, cursor: 'pointer', whiteSpace: 'nowrap' }
const pressBlue: CSSProperties = { ...press, background: '#2563eb', color: '#fff', border: '1px solid #2563eb' }

export function BidBoardPermitNews({
  news,
  onOpenBid,
  renderMarkLost,
}: {
  news: readonly NewsItem[]
  onOpenBid: (bidId: string) => void
  /** The board's own window for marking this bid lost, drawn under its line while open. Left out, no line offers Mark lost…. */
  renderMarkLost?: (bidId: string, close: () => void) => ReactNode
}) {
  const [open, setOpen] = useState(false)
  /** The bid whose outcome is open under its line, one at a time. */
  const [lostBidId, setLostBidId] = useState<string | null>(null)
  const lostLineStands = lostBidId != null && news.some((n) => n.bidId === lostBidId && n.markLost)
  // The bid was decided and its line left: the window goes with it, and does not come back by itself.
  useEffect(() => {
    if (lostBidId != null && !lostLineStands) setLostBidId(null)
  }, [lostBidId, lostLineStands])
  if (news.length === 0) return null
  const shown = open ? news : news.slice(0, FIRST)
  return (
    <section aria-label={NEWS_TITLE} style={{ border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface)', padding: '10px 14px', display: 'grid', gap: 0 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 600, fontSize: '0.875rem', marginBottom: 4 }}>
        {NEWS_TITLE}
        <span style={{ display: 'inline-block', borderRadius: 999, padding: '1px 8px', fontSize: '0.72rem', fontWeight: 700, background: 'var(--bg-red-tint)', color: 'var(--text-red-700)' }}>{news.length}</span>
      </div>
      {shown.map((n) => {
        const offersLost = n.markLost && renderMarkLost != null
        const lostOpen = offersLost && lostBidId === n.bidId
        return (
          <div key={`${n.bidId}-${n.kind}`} style={{ padding: '8px 0', borderTop: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 260px', minWidth: 0 }}>
                <strong style={{ fontSize: '0.875rem' }}>{n.title}</strong>
                <span style={{ display: 'block', fontSize: '0.8125rem', color: 'var(--text-700)', lineHeight: 1.45 }}>{n.words}</span>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <button type="button" onClick={() => onOpenBid(n.bidId)} style={press}>
                  Open the bid
                </button>
                {offersLost ? (
                  <button type="button" aria-expanded={lostOpen} onClick={() => setLostBidId((prev) => (prev === n.bidId ? null : n.bidId))} style={pressBlue}>
                    {MARK_LOST_LABEL}
                  </button>
                ) : null}
              </div>
            </div>
            {lostOpen ? <div style={{ marginTop: 6 }}>{renderMarkLost(n.bidId, () => setLostBidId(null))}</div> : null}
          </div>
        )
      })}
      {news.length > shown.length && (
        <button type="button" onClick={() => setOpen(true)} style={{ background: 'none', border: 0, padding: '8px 0 0', font: 'inherit', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-link)', cursor: 'pointer', textAlign: 'left', borderTop: '1px solid var(--border)' }}>
          See {news.length - shown.length} more ›
        </button>
      )}
    </section>
  )
}
