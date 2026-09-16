/**
 * The won bid's Submittals chip (Submittals stage 4b, v2.3488): under the Job block of a
 * won bid, one line that says where the submittal stands — *Submittals · Rev 2 · shared
 * · waiting on Dana W.* — and is a door to the Submittals tab for that bid. Reads the
 * bid's newest revision, its room and the people; draws nothing while loading, and a
 * dashed *none yet* when the bid has no submittal.
 */
import type { CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'

import { describeBidSubmittal } from '../../lib/submittals/bidSubmittalSummary'
import { useBidSubmittalSummary } from '../../hooks/useBidSubmittalSummary'

const chip: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: '0.3rem', borderRadius: 6, padding: '0.05rem 0.5rem', fontSize: '0.72rem', fontWeight: 600, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', cursor: 'pointer', font: 'inherit' }

export function BidSubmittalChip({ bidId }: { bidId: string }) {
  const navigate = useNavigate()
  const { loaded, summary } = useBidSubmittalSummary(bidId)
  if (!loaded) return null
  const tone: CSSProperties = summary == null ? { borderStyle: 'dashed', color: 'var(--text-muted)', fontWeight: 500 } : summary.sentBack > 0 ? { background: 'var(--bg-red-tint)', color: 'var(--text-red-700)', borderColor: 'var(--bg-red-tint)' } : summary.status === 'shared' ? { background: 'var(--bg-blue-tint)', color: 'var(--text-blue-700)', borderColor: 'var(--bg-blue-tint)' } : {}
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', fontSize: '0.78rem' }} data-testid="bid-submittal-chip">
      <span style={{ color: 'var(--text-muted)' }}>Submittals</span>
      <button type="button" onClick={() => navigate(`/bids?tab=submittals&bidId=${encodeURIComponent(bidId)}`)} style={{ ...chip, ...tone }} title="Open the Submittals tab for this bid">
        {summary ? describeBidSubmittal(summary) : '· none yet'}
      </button>
    </div>
  )
}
