import { useState, type CSSProperties } from 'react'
import { NEWS_TITLE, type NewsItem } from '../../lib/research/bidPermitNews'

/**
 * Permit news on the Bid Board (punch list #307, PR 5): the strip above the sections. Each line
 * is one undecided bid whose address the city has news on, with one press: Open the bid. A
 * general plumbing permit that lists another name comes first. It marks no bid by itself.
 */
const FIRST = 4

const press: CSSProperties = { background: 'var(--surface)', color: 'var(--text-strong)', border: '1px solid var(--border-strong)', borderRadius: 6, padding: '6px 12px', fontSize: '0.8125rem', fontWeight: 600, minHeight: 34, cursor: 'pointer', whiteSpace: 'nowrap', font: 'inherit' }

export function BidBoardPermitNews({ news, onOpenBid }: { news: readonly NewsItem[]; onOpenBid: (bidId: string) => void }) {
  const [open, setOpen] = useState(false)
  if (news.length === 0) return null
  const shown = open ? news : news.slice(0, FIRST)
  return (
    <section aria-label={NEWS_TITLE} style={{ border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface)', padding: '10px 14px', display: 'grid', gap: 0 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 600, fontSize: '0.875rem', marginBottom: 4 }}>
        {NEWS_TITLE}
        <span style={{ display: 'inline-block', borderRadius: 999, padding: '1px 8px', fontSize: '0.72rem', fontWeight: 700, background: 'var(--bg-red-tint)', color: 'var(--text-red-700)' }}>{news.length}</span>
      </div>
      {shown.map((n) => (
        <div key={`${n.bidId}-${n.kind}`} style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', padding: '8px 0', borderTop: '1px solid var(--border)' }}>
          <div style={{ flex: '1 1 260px', minWidth: 0 }}>
            <strong style={{ fontSize: '0.875rem' }}>{n.title}</strong>
            <span style={{ display: 'block', fontSize: '0.8125rem', color: 'var(--text-700)', lineHeight: 1.45 }}>{n.words}</span>
          </div>
          <button type="button" onClick={() => onOpenBid(n.bidId)} style={press}>
            Open the bid
          </button>
        </div>
      ))}
      {news.length > shown.length && (
        <button type="button" onClick={() => setOpen(true)} style={{ background: 'none', border: 0, padding: '8px 0 0', font: 'inherit', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-link)', cursor: 'pointer', textAlign: 'left', borderTop: '1px solid var(--border)' }}>
          See {news.length - shown.length} more ›
        </button>
      )}
    </section>
  )
}
