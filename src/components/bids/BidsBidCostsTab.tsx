import { useMemo, useState } from 'react'
import type { BidWithBuilder, EstimatorUser } from '../../types/bidWithBuilder'
import type { TeamLaborBidRow } from '../../utils/teamLabor'
import { formatBidNameWithValue } from '../../lib/bids/bidFormatting'
import { formatCurrency, decimalHoursToHhMm } from '../../lib/format'

const BID_COSTS_UNSENT_LABEL = 'Unsent / Working Bids'

type BidsBidCostsTabProps = {
  bids: BidWithBuilder[]
  teamLaborData: TeamLaborBidRow[]
  onSelectBid: (bid: BidWithBuilder) => void
}

export function BidsBidCostsTab({ bids, teamLaborData, onSelectBid }: BidsBidCostsTabProps) {
  const [bidCostsSectionOpen, setBidCostsSectionOpen] = useState({ unsent: true, pending: true, won: true, startedOrComplete: true, lost: false })

  function toggleBidCostsSection(key: 'unsent' | 'pending' | 'won' | 'startedOrComplete' | 'lost') {
    setBidCostsSectionOpen((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const teamLaborByBidId = useMemo(
    () => new Map(teamLaborData.map((r) => [r.bidId, r])),
    [teamLaborData]
  )

  const bidCostsUnsent = useMemo(
    () =>
      bids.filter(
        (b) =>
          !b.bid_date_sent &&
          b.outcome !== 'won' &&
          b.outcome !== 'lost' &&
          b.outcome !== 'started_or_complete' &&
          !b.working_board_archived_at
      ),
    [bids]
  )
  const bidCostsPending = useMemo(
    () => bids.filter((b) => b.bid_date_sent && b.outcome !== 'won' && b.outcome !== 'lost' && b.outcome !== 'started_or_complete'),
    [bids]
  )
  const bidCostsWon = useMemo(() => bids.filter((b) => b.outcome === 'won'), [bids])
  const bidCostsStartedOrComplete = useMemo(() => bids.filter((b) => b.outcome === 'started_or_complete'), [bids])
  const bidCostsLost = useMemo(() => bids.filter((b) => b.outcome === 'lost'), [bids])

  function formatBidCostsPeople(breakdown: Array<{ personName: string; hours: number }>): string {
    if (!breakdown?.length) return '—'
    return breakdown
      .sort((a, b) => b.hours - a.hours)
      .map((b) => `${b.personName} (${decimalHoursToHhMm(b.hours)})`)
      .join(', ')
  }

  return (
    <div>
      <h2 style={{ margin: '0 0 1rem', fontSize: '1.25rem' }}>Bid Costs</h2>
      <p style={{ margin: '0 0 1rem', color: '#6b7280', fontSize: '0.875rem' }}>Team labor (clocked) by bid outcome. People and hours from approved clock sessions with a bid selected.</p>

      {[
        { key: 'unsent' as const, label: BID_COSTS_UNSENT_LABEL, bids: bidCostsUnsent },
        { key: 'pending' as const, label: 'Not yet won or lost', bids: bidCostsPending },
        { key: 'won' as const, label: 'Won', bids: bidCostsWon },
        { key: 'startedOrComplete' as const, label: 'Started or Complete', bids: bidCostsStartedOrComplete },
        { key: 'lost' as const, label: 'Lost', bids: bidCostsLost },
      ].map(({ key, label, bids: sectionBids }) => (
        <div key={key}>
          <button
            type="button"
            onClick={() => toggleBidCostsSection(key)}
            aria-expanded={bidCostsSectionOpen[key]}
            style={{ margin: '1.5rem 0 0.5rem', fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', padding: 0, border: 'none', background: 'none', cursor: 'pointer', color: 'inherit' }}
          >
            <span aria-hidden>{bidCostsSectionOpen[key] ? '\u25BC' : '\u25B6'}</span>
            {label} ({sectionBids.length})
          </button>
          {bidCostsSectionOpen[key] && (
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ background: '#f9fafb' }}>
                  <tr>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Project / GC</th>
                    <th style={{ padding: '0.75rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>Plan Pages</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Account Man</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Estimator</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>People (clocked)</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Total cost</th>
                  </tr>
                </thead>
                <tbody>
                  {sectionBids.length === 0 ? (
                    <tr><td colSpan={6} style={{ padding: '0.75rem', color: '#6b7280' }}>No bids in this group</td></tr>
                  ) : (
                    sectionBids.map((bid) => {
                      const laborRow = teamLaborByBidId.get(bid.id)
                      return (
                        <tr
                          key={bid.id}
                          onClick={() => onSelectBid(bid)}
                          style={{ borderBottom: '1px solid #e5e7eb', cursor: 'pointer' }}
                        >
                          <td style={{ padding: '0.75rem' }}>{formatBidNameWithValue(bid)}</td>
                          <td style={{ padding: '0.75rem', textAlign: 'center' }}>{bid.plan_pages?.trim() ?? '—'}</td>
                          <td style={{ padding: '0.75rem' }}>
                            {(() => {
                              const am = bid.account_manager as EstimatorUser | null
                              return am ? (am.name || am.email) : '—'
                            })()}
                          </td>
                          <td style={{ padding: '0.75rem' }}>
                            {(() => {
                              const est = bid.estimator
                              const estimatorNorm = est == null ? null : Array.isArray(est) ? est[0] ?? null : est
                              return estimatorNorm ? (estimatorNorm.name || estimatorNorm.email) : '—'
                            })()}
                          </td>
                          <td style={{ padding: '0.75rem' }}>{formatBidCostsPeople(laborRow?.breakdown ?? [])}</td>
                          <td style={{ padding: '0.75rem', textAlign: 'right' }}>{laborRow ? `$${formatCurrency(laborRow.bidCost)}` : '—'}</td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
