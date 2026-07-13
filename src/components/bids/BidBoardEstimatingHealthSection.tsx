import { Fragment, useEffect, useMemo, useState } from 'react'
import type { Bid } from '../../types/bids'
import type { BidWithBuilder } from '../../types/bidWithBuilder'
import { resolveBidLedgerPrefix } from '../../lib/ledgerDisplayPrefixes'
import type { useLedgerPrefixMap } from '../../contexts/LedgerDisplayPrefixContext'
import { buildBidBoardWeeklySentSummaries } from '../../lib/bidBoardWeeklySentStats'
import {
  computeBidBoardStaffOutcomeStatsByRole,
  staffOutcomeDrilldownMetricLabel,
  filterBidsForStaffOutcomeDrilldown,
  sortStaffOutcomeDrilldownBids,
  BID_BOARD_STAFF_MIN_BIDS,
  type StaffOutcomeDrilldownState,
} from '../../lib/bids/bidBoardStaffOutcomes'
import { formatBidValueShort, formatDateYYMMDDParts } from '../../lib/bids/bidFormatting'
import { BidBoardWeeklySentSection } from './BidBoardWeeklySentSection'
import { BidBoardWeeklyEstimatorLaborDevSection } from './BidBoardWeeklyEstimatorLaborDevSection'
import { BidBoardEstimatingHealthWonPctSliders } from './BidBoardEstimatingHealthSliders'
import { StaffOutcomeDrilldownCountCell } from './StaffOutcomeDrilldownCountCell'
import { BidBoardBidNumberMark } from './BidBoardBidNumberMark'

type BidBoardEstimatingHealthSectionProps = {
  staffOutcomeByRole: ReturnType<typeof computeBidBoardStaffOutcomeStatsByRole>
  weeklySentSummaries: ReturnType<typeof buildBidBoardWeeklySentSummaries>
  filteredBids: BidWithBuilder[]
  isDev: boolean
  ledgerPrefixMap: ReturnType<typeof useLedgerPrefixMap>
}

export function BidBoardEstimatingHealthSection({
  staffOutcomeByRole,
  weeklySentSummaries,
  filteredBids,
  isDev,
  ledgerPrefixMap,
}: BidBoardEstimatingHealthSectionProps) {
  const [scoreboardDetailsExpanded, setScoreboardDetailsExpanded] = useState(false)
  const [staffOutcomeDrilldown, setStaffOutcomeDrilldown] = useState<StaffOutcomeDrilldownState | null>(null)

  const staffOutcomeDrilldownBids = useMemo(() => {
    if (!staffOutcomeDrilldown) return []
    return sortStaffOutcomeDrilldownBids(
      filterBidsForStaffOutcomeDrilldown(filteredBids, staffOutcomeDrilldown)
    )
  }, [staffOutcomeDrilldown, filteredBids])

  useEffect(() => {
    if (!staffOutcomeDrilldown) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setStaffOutcomeDrilldown(null)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [staffOutcomeDrilldown])

  return (
    <Fragment>
      <BidBoardWeeklySentSection weeks={weeklySentSummaries} bids={filteredBids} />
      {isDev && <BidBoardWeeklyEstimatorLaborDevSection weeks={weeklySentSummaries} />}
      <div style={{ marginTop: '1.5rem' }}>
        <h3
          id="bid-board-estimating-health-heading"
          style={{ fontSize: '1rem', fontWeight: 600, margin: '0 0 0.35rem 0' }}
        >
          Estimating Health
        </h3>
        <div style={{ margin: '0 0 0.625rem 0', border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden' }}>
          <table
            aria-label="Won percent bands for interpreting the Won % column"
            style={{ width: '100%', borderCollapse: 'collapse' }}
          >
            <tbody>
              <tr style={{ background: 'var(--bg-subtle)' }}>
                {(['0% – 20%', '20% – 40%', '40% – 60%', '60% – 80%', '80% – 100%'] as const).map((label, i) => (
                  <th
                    key={label}
                    scope="col"
                    style={{
                      padding: '0.375rem 0.35rem',
                      textAlign: 'center',
                      borderBottom: '1px solid var(--border)',
                      ...(i < 4 ? { borderRight: '1px solid var(--border)' } : {}),
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: 'var(--text-700)',
                    }}
                  >
                    {label}
                  </th>
                ))}
              </tr>
              <tr>
                {(
                  [
                    'Charging too Much',
                    "We're full on work",
                    'Balanced',
                    "We're hungry for work",
                    'Charging too little',
                  ] as const
                ).map((label, i) => (
                  <td
                    key={i}
                    style={{
                      padding: '0.375rem 0.35rem',
                      textAlign: 'center',
                      ...(i < 4 ? { borderRight: '1px solid var(--border)' } : {}),
                      fontSize: '0.75rem',
                      color: 'var(--text-600)',
                      verticalAlign: 'top',
                      lineHeight: 1.25,
                    }}
                  >
                    {label}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        <BidBoardEstimatingHealthWonPctSliders stats={staffOutcomeByRole} />
        <div style={{ margin: '0 0 0.75rem 0' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr auto 1fr',
              alignItems: 'center',
              marginBottom: '0.35rem',
            }}
          >
            <div aria-hidden style={{ minWidth: 0 }} />
            <h3
              id="bid-board-staff-outcomes-heading"
              style={{ fontSize: '1rem', fontWeight: 600, margin: 0, textAlign: 'center' }}
            >
              Scoreboard
            </h3>
            <div style={{ display: 'flex', justifyContent: 'flex-end', minWidth: 0 }}>
              <button
                type="button"
                onClick={() => setScoreboardDetailsExpanded((v) => !v)}
                aria-expanded={scoreboardDetailsExpanded}
                aria-controls="bid-board-scoreboard-details"
                style={{
                  padding: 0,
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  fontSize: '0.8125rem',
                  textDecoration: 'underline',
                }}
              >
                {scoreboardDetailsExpanded ? 'Hide details' : 'Details'}
              </button>
            </div>
          </div>
          <div
            id="bid-board-scoreboard-details"
            hidden={!scoreboardDetailsExpanded}
            style={{ marginTop: scoreboardDetailsExpanded ? '0.35rem' : 0 }}
          >
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
              Only people with {BID_BOARD_STAFF_MIN_BIDS} or more bids in that role are listed. Counts reflect the filtered bid
              list above. The Not yet won or lost column counts sent bids still open (same as that board section; unsent bids are
              not included). Won % uses decided bids only (Won + Lost). Each role is counted separately. Counts greater than zero
              are clickable to list matching bids. Sent is bids with a sent date in that role (same as Not yet won or lost + Won
              # + Lost #).
            </p>
          </div>
        </div>
        {!staffOutcomeByRole.estimatorsHadAnyAssignment &&
        !staffOutcomeByRole.accountManagersHadAnyAssignment ? (
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            No estimator or account manager assigned on these bids.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div>
              <h4
                id="bid-board-staff-est-heading"
                style={{ fontSize: '0.9375rem', fontWeight: 600, margin: '0 0 0.5rem 0' }}
              >
                Estimators
              </h4>
              {staffOutcomeByRole.estimators.length === 0 ? (
                <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                  {staffOutcomeByRole.estimatorsHadAnyAssignment
                    ? `No estimators with ${BID_BOARD_STAFF_MIN_BIDS} or more bids in this list.`
                    : 'No estimators assigned on these bids.'}
                </p>
              ) : (
                <div style={{ border: '1px solid var(--border)', borderRadius: 4, overflow: 'auto' }}>
                  <table
                    aria-labelledby="bid-board-staff-est-heading"
                    style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}
                  >
                    <thead style={{ background: 'var(--bg-subtle)' }}>
                      <tr>
                        <th
                          scope="col"
                          style={{
                            padding: '0.375rem 0.75rem',
                            textAlign: 'left',
                            borderBottom: '1px solid var(--border)',
                            fontSize: '0.8125rem',
                          }}
                        >
                          Name
                        </th>
                        <th
                          scope="col"
                          style={{
                            padding: '0.375rem 0.75rem',
                            textAlign: 'right',
                            borderBottom: '1px solid var(--border)',
                            fontSize: '0.8125rem',
                          }}
                          title="Bids with a sent date (sum of Not yet won or lost, Won #, and Lost #)"
                        >
                          Sent
                        </th>
                        <th
                          scope="col"
                          style={{
                            padding: '0.375rem 0.75rem',
                            textAlign: 'right',
                            borderBottom: '1px solid var(--border)',
                            fontSize: '0.6875rem',
                            lineHeight: 1.25,
                          }}
                          title="Sent bids not yet won or lost (excludes unsent)"
                        >
                          Not yet<br />
                          won or lost
                        </th>
                        <th
                          scope="col"
                          style={{
                            padding: '0.375rem 0.75rem',
                            textAlign: 'right',
                            borderBottom: '1px solid var(--border)',
                            fontSize: '0.8125rem',
                          }}
                        >
                          Won #
                        </th>
                        <th
                          scope="col"
                          style={{
                            padding: '0.375rem 0.75rem',
                            textAlign: 'right',
                            borderBottom: '1px solid var(--border)',
                            fontSize: '0.8125rem',
                          }}
                        >
                          Lost #
                        </th>
                        <th
                          scope="col"
                          style={{
                            padding: '0.375rem 0.75rem',
                            textAlign: 'right',
                            borderBottom: '1px solid var(--border)',
                            fontSize: '0.8125rem',
                          }}
                        >
                          Won %
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {staffOutcomeByRole.estimators.map((row) => {
                        const decided = row.won + row.lost
                        const wonPct =
                          decided === 0 ? '—' : `${((100 * row.won) / decided).toFixed(1)}%`
                        const sent = row.notYetWonOrLost + row.won + row.lost
                        return (
                          <tr key={`est-${row.userId}`} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td style={{ padding: '0.375rem 0.75rem', fontSize: '0.875rem' }}>
                              {row.displayName}
                            </td>
                            <StaffOutcomeDrilldownCountCell
                              count={sent}
                              userId={row.userId}
                              displayName={row.displayName}
                              role="estimator"
                              metric="sent"
                              onOpen={setStaffOutcomeDrilldown}
                            />
                            <StaffOutcomeDrilldownCountCell
                              count={row.notYetWonOrLost}
                              userId={row.userId}
                              displayName={row.displayName}
                              role="estimator"
                              metric="notYetWonOrLost"
                              onOpen={setStaffOutcomeDrilldown}
                            />
                            <StaffOutcomeDrilldownCountCell
                              count={row.won}
                              userId={row.userId}
                              displayName={row.displayName}
                              role="estimator"
                              metric="won"
                              onOpen={setStaffOutcomeDrilldown}
                            />
                            <StaffOutcomeDrilldownCountCell
                              count={row.lost}
                              userId={row.userId}
                              displayName={row.displayName}
                              role="estimator"
                              metric="lost"
                              onOpen={setStaffOutcomeDrilldown}
                            />
                            <td
                              style={{
                                padding: '0.375rem 0.75rem',
                                fontSize: '0.875rem',
                                textAlign: 'right',
                              }}
                            >
                              {wonPct}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div>
              <h4
                id="bid-board-staff-am-heading"
                style={{ fontSize: '0.9375rem', fontWeight: 600, margin: '0 0 0.5rem 0' }}
              >
                Account managers
              </h4>
              {staffOutcomeByRole.accountManagers.length === 0 ? (
                <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                  {staffOutcomeByRole.accountManagersHadAnyAssignment
                    ? `No account managers with ${BID_BOARD_STAFF_MIN_BIDS} or more bids in this list.`
                    : 'No account managers assigned on these bids.'}
                </p>
              ) : (
                <div style={{ border: '1px solid var(--border)', borderRadius: 4, overflow: 'auto' }}>
                  <table
                    aria-labelledby="bid-board-staff-am-heading"
                    style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}
                  >
                    <thead style={{ background: 'var(--bg-subtle)' }}>
                      <tr>
                        <th
                          scope="col"
                          style={{
                            padding: '0.375rem 0.75rem',
                            textAlign: 'left',
                            borderBottom: '1px solid var(--border)',
                            fontSize: '0.8125rem',
                          }}
                        >
                          Name
                        </th>
                        <th
                          scope="col"
                          style={{
                            padding: '0.375rem 0.75rem',
                            textAlign: 'right',
                            borderBottom: '1px solid var(--border)',
                            fontSize: '0.8125rem',
                          }}
                          title="Bids with a sent date (sum of Not yet won or lost, Won #, and Lost #)"
                        >
                          Sent
                        </th>
                        <th
                          scope="col"
                          style={{
                            padding: '0.375rem 0.75rem',
                            textAlign: 'right',
                            borderBottom: '1px solid var(--border)',
                            fontSize: '0.6875rem',
                            lineHeight: 1.25,
                          }}
                          title="Sent bids not yet won or lost (excludes unsent)"
                        >
                          Not yet<br />
                          won or lost
                        </th>
                        <th
                          scope="col"
                          style={{
                            padding: '0.375rem 0.75rem',
                            textAlign: 'right',
                            borderBottom: '1px solid var(--border)',
                            fontSize: '0.8125rem',
                          }}
                        >
                          Won #
                        </th>
                        <th
                          scope="col"
                          style={{
                            padding: '0.375rem 0.75rem',
                            textAlign: 'right',
                            borderBottom: '1px solid var(--border)',
                            fontSize: '0.8125rem',
                          }}
                        >
                          Lost #
                        </th>
                        <th
                          scope="col"
                          style={{
                            padding: '0.375rem 0.75rem',
                            textAlign: 'right',
                            borderBottom: '1px solid var(--border)',
                            fontSize: '0.8125rem',
                          }}
                        >
                          Won %
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {staffOutcomeByRole.accountManagers.map((row) => {
                        const decided = row.won + row.lost
                        const wonPct =
                          decided === 0 ? '—' : `${((100 * row.won) / decided).toFixed(1)}%`
                        const sent = row.notYetWonOrLost + row.won + row.lost
                        return (
                          <tr key={`am-${row.userId}`} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td style={{ padding: '0.375rem 0.75rem', fontSize: '0.875rem' }}>
                              {row.displayName}
                            </td>
                            <StaffOutcomeDrilldownCountCell
                              count={sent}
                              userId={row.userId}
                              displayName={row.displayName}
                              role="account_manager"
                              metric="sent"
                              onOpen={setStaffOutcomeDrilldown}
                            />
                            <StaffOutcomeDrilldownCountCell
                              count={row.notYetWonOrLost}
                              userId={row.userId}
                              displayName={row.displayName}
                              role="account_manager"
                              metric="notYetWonOrLost"
                              onOpen={setStaffOutcomeDrilldown}
                            />
                            <StaffOutcomeDrilldownCountCell
                              count={row.won}
                              userId={row.userId}
                              displayName={row.displayName}
                              role="account_manager"
                              metric="won"
                              onOpen={setStaffOutcomeDrilldown}
                            />
                            <StaffOutcomeDrilldownCountCell
                              count={row.lost}
                              userId={row.userId}
                              displayName={row.displayName}
                              role="account_manager"
                              metric="lost"
                              onOpen={setStaffOutcomeDrilldown}
                            />
                            <td
                              style={{
                                padding: '0.375rem 0.75rem',
                                fontSize: '0.875rem',
                                textAlign: 'right',
                              }}
                            >
                              {wonPct}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {staffOutcomeDrilldown && (
        <div
          role="presentation"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.45)',
            zIndex: 2100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
          onClick={() => setStaffOutcomeDrilldown(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="bid-board-staff-drilldown-title"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--surface)',
              borderRadius: 8,
              maxWidth: 1100,
              width: '100%',
              maxHeight: '90vh',
              overflow: 'auto',
              boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
              padding: '1rem 1.25rem',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: '1rem',
                marginBottom: '0.75rem',
              }}
            >
              <h3 id="bid-board-staff-drilldown-title" style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600 }}>
                {staffOutcomeDrilldown.staffDisplayName} — {staffOutcomeDrilldownMetricLabel(staffOutcomeDrilldown.metric)} (
                {staffOutcomeDrilldownBids.length} bids)
              </h3>
              <button
                type="button"
                onClick={() => setStaffOutcomeDrilldown(null)}
                style={{
                  padding: '0.35rem 0.75rem',
                  background: 'var(--bg-muted)',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 4,
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                Close
              </button>
            </div>
            {staffOutcomeDrilldownBids.length === 0 ? (
              <p style={{ margin: 0, color: 'var(--text-muted)' }}>No bids in this group.</p>
            ) : (
              <div style={{ overflow: 'auto', border: '1px solid var(--border)', borderRadius: 4 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
                  <thead style={{ background: 'var(--bg-subtle)' }}>
                    <tr>
                      <th
                        scope="col"
                        style={{
                          padding: '0.5rem 0.75rem',
                          textAlign: 'left',
                          borderBottom: '1px solid var(--border)',
                          fontSize: '0.8125rem',
                        }}
                      >
                        Bid #
                      </th>
                      <th
                        scope="col"
                        style={{
                          padding: '0.5rem 0.75rem',
                          textAlign: 'left',
                          borderBottom: '1px solid var(--border)',
                          fontSize: '0.8125rem',
                        }}
                      >
                        GC/Builder
                      </th>
                      <th
                        scope="col"
                        style={{
                          padding: '0.5rem 0.75rem',
                          textAlign: 'left',
                          borderBottom: '1px solid var(--border)',
                          fontSize: '0.8125rem',
                        }}
                      >
                        Project name
                      </th>
                      <th
                        scope="col"
                        style={{
                          padding: '0.5rem 0.75rem',
                          textAlign: 'left',
                          borderBottom: '1px solid var(--border)',
                          fontSize: '0.8125rem',
                        }}
                      >
                        Address
                      </th>
                      <th
                        scope="col"
                        style={{
                          padding: '0.5rem 0.75rem',
                          textAlign: 'right',
                          borderBottom: '1px solid var(--border)',
                          fontSize: '0.8125rem',
                        }}
                      >
                        Bid
                      </th>
                      <th
                        scope="col"
                        style={{
                          padding: '0.5rem 0.75rem',
                          textAlign: 'center',
                          borderBottom: '1px solid var(--border)',
                          fontSize: '0.8125rem',
                        }}
                      >
                        Bid date
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {staffOutcomeDrilldownBids.map((bid) => {
                      const num = (bid as { bid_number?: string | null }).bid_number?.trim()
                      const pref = num ? resolveBidLedgerPrefix((bid as Bid).service_type_id, ledgerPrefixMap) : 'B'
                      const gc = bid.customers?.name ?? bid.bids_gc_builders?.name ?? '—'
                      const parts = formatDateYYMMDDParts(bid.bid_due_date)
                      return (
                        <tr key={bid.id} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '0.5rem 0.75rem', fontSize: '0.875rem', whiteSpace: 'nowrap' }}>
                            {num ? <BidBoardBidNumberMark bidPrefix={pref} bidNumber={num} /> : '—'}
                          </td>
                          <td style={{ padding: '0.5rem 0.75rem', fontSize: '0.875rem' }}>{gc}</td>
                          <td style={{ padding: '0.5rem 0.75rem', fontSize: '0.875rem' }}>
                            {bid.project_name ?? '—'}
                          </td>
                          <td style={{ padding: '0.5rem 0.75rem', fontSize: '0.875rem' }}>{bid.address ?? '—'}</td>
                          <td
                            style={{
                              padding: '0.5rem 0.75rem',
                              fontSize: '0.875rem',
                              textAlign: 'right',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {formatBidValueShort(bid.bid_value != null ? Number(bid.bid_value) : null)}
                          </td>
                          <td style={{ padding: '0.5rem 0.75rem', fontSize: '0.875rem', textAlign: 'center' }}>
                            {parts ? (
                              <div style={{ lineHeight: 1.25 }}>
                                <div>{parts.date}</div>
                                <div>{parts.bracket}</div>
                              </div>
                            ) : (
                              '—'
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </Fragment>
  )
}
