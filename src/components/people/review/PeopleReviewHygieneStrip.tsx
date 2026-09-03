// Amber "what is skewing this period" strip for the Review tab — the same
// grammar as the Overhead tab's maintenance strip. Renders nothing when the
// period is clean.

import { Link } from 'react-router-dom'
import type { ReviewHygieneItem } from '../../../lib/people/reviewRanked'

export function PeopleReviewHygieneStrip({ items }: { items: ReviewHygieneItem[] }) {
  if (items.length === 0) return null
  return (
    <div
      role="status"
      style={{
        border: '1px solid var(--border-amber)',
        background: 'var(--bg-amber-tint)',
        borderRadius: 8,
        padding: '0.6rem 0.9rem',
        marginBottom: '0.75rem',
        display: 'grid',
        gap: 6,
      }}
    >
      <div style={{ fontWeight: 600, color: 'var(--text-amber-900)', fontSize: '0.85rem' }}>
        ⚠ Skewing this period's numbers
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '4px 18px', fontSize: '0.8rem', color: 'var(--text-700)' }}>
        {items.map((it) => (
          <div key={it.key}>
            <b style={{ color: 'var(--text-strong)' }}>{it.headline}</b> — {it.detail}
            {it.href && it.linkLabel && (
              <>
                {' '}
                <Link to={it.href} style={{ fontWeight: 600, textDecoration: 'none' }}>
                  {it.linkLabel} ›
                </Link>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
