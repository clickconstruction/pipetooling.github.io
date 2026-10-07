import { useMemo } from 'react'
import { useCustomerProfileModal } from '../../contexts/CustomerProfileModalContext'
import { customerTimelineSearchMatches } from '../../lib/customers/customerTimelineSearch'

/**
 * Jobs → Pipeline (punch list #97, PR 3): when the search names one to three customers, a chip
 * for each opens that customer's timeline. Nothing shows for a short or broad search.
 */
export default function StagesCustomerTimelineChips({ query, customers }: { query: string; customers: ReadonlyArray<{ id: string; name: string | null; archived_at?: string | null }> }) {
  const profile = useCustomerProfileModal()
  const matches = useMemo(() => customerTimelineSearchMatches(query, customers), [query, customers])
  if (!profile || matches.length === 0) return null
  return (
    <div role="group" aria-label="Customer timelines" data-testid="stages-customer-timeline-chips" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '0.75rem 0 0', alignItems: 'center' }}>
      {matches.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => profile.openCustomerProfile(c.id, { view: 'timeline' })}
          title={`Open ${(c.name ?? '').trim()}'s timeline: every job, bill, payment and crew day`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            border: '1px solid var(--border-indigo-soft)',
            borderRadius: 9999,
            padding: '3px 12px',
            background: 'var(--surface)',
            color: 'var(--text-link)',
            fontSize: '0.8rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {(c.name ?? '').trim()} · timeline ›
        </button>
      ))}
    </div>
  )
}
