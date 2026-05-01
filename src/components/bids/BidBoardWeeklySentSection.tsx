import { useId, useMemo, useState, type CSSProperties } from 'react'
import { buildBidBoardWeeklySentPivot, type BidBoardWeekSentSummary } from '../../lib/bidBoardWeeklySentStats'
import type { BidWithBuilder } from '../../types/bidWithBuilder'
import { BidBoardWeeklySentCellModal } from './BidBoardWeeklySentCellModal'
import { formatDollarsAsThousandsK } from '../../lib/format'
import { APP_CALENDAR_TZ, formatScheduleDispatchWeekNavLabel } from '../../utils/dateUtils'

const thBase: CSSProperties = {
  padding: '0.375rem 0.75rem',
  textAlign: 'left',
  borderBottom: '1px solid #e5e7eb',
  fontSize: '0.8125rem',
}

const thWeek: CSSProperties = {
  ...thBase,
  textAlign: 'center',
  verticalAlign: 'bottom',
  minWidth: '6.5rem',
}

const stickyCorner: CSSProperties = {
  ...thBase,
  position: 'sticky',
  left: 0,
  zIndex: 3,
  background: '#f9fafb',
  boxShadow: '1px 0 0 #e5e7eb',
}

const stickyOutcomes: CSSProperties = {
  padding: '0.35rem 0.75rem',
  textAlign: 'left',
  borderBottom: '1px solid #e5e7eb',
  fontSize: '0.75rem',
  fontWeight: 600,
  color: '#374151',
  position: 'sticky',
  left: 0,
  zIndex: 3,
  background: '#f9fafb',
  boxShadow: '1px 0 0 #e5e7eb',
}

const stickyRowHeader: CSSProperties = {
  padding: '0.375rem 0.75rem',
  fontSize: '0.875rem',
  textAlign: 'left',
  borderBottom: '1px solid #e5e7eb',
  position: 'sticky',
  left: 0,
  zIndex: 2,
  background: '#fff',
  boxShadow: '1px 0 0 #e5e7eb',
}

export function BidBoardWeeklySentSection({
  weeks,
  bids,
}: {
  weeks: BidBoardWeekSentSummary[]
  bids: BidWithBuilder[]
}) {
  const headingId = useId()
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [cellModal, setCellModal] = useState<{
    weekLabel: string
    estimatorDisplayName: string
    bidIds: string[]
  } | null>(null)

  const pivot = useMemo(() => buildBidBoardWeeklySentPivot(weeks), [weeks])

  return (
    <div style={{ marginTop: '1.5rem' }}>
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
          id={headingId}
          style={{ fontSize: '1rem', fontWeight: 600, margin: 0, textAlign: 'center' }}
        >
          Weekly bids sent
        </h3>
        <div style={{ display: 'flex', justifyContent: 'flex-end', minWidth: 0 }}>
          <button
            type="button"
            onClick={() => setDetailsOpen((v) => !v)}
            aria-expanded={detailsOpen}
            aria-controls={`${headingId}-weekly-sent-details`}
            style={{
              padding: 0,
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              color: '#6b7280',
              fontSize: '0.8125rem',
              textDecoration: 'underline',
            }}
          >
            {detailsOpen ? 'Hide details' : 'Details'}
          </button>
        </div>
      </div>
      <div
        id={`${headingId}-weekly-sent-details`}
        hidden={!detailsOpen}
        style={{ marginTop: detailsOpen ? '0.35rem' : 0, marginBottom: detailsOpen ? '0.75rem' : 0 }}
      >
        <p style={{ margin: 0, color: '#6b7280', fontSize: '0.8125rem' }}>
          One table: each <strong>column</strong> is a week (newest first). Each <strong>row</strong> is an estimator;
          each cell is one value: <strong>$</strong> in <strong>thousands</strong> with <strong>K</strong>, a hyphen,
          then <strong>sent</strong> count (e.g. <strong>$625K-3</strong>, <strong>$0-0</strong>). Dollars are the sum
          of <strong>bid value</strong> for that week (e.g. $625,073 → <strong>$625K</strong>). Empty weeks for that
          person show <strong>$0-0</strong>. Sent means the bid has a <strong>bid date sent</strong>.{' '}
          <strong>Click</strong> a non-zero cell to list the bids in that week for that estimator, then open a bid’s
          preview. Weeks run Sunday
          through Saturday ({APP_CALENDAR_TZ}). The <strong>Outcomes</strong> row shows <strong>Won</strong> and{' '}
          <strong>Lost</strong> counts only (<strong>W</strong> · <strong>L</strong>). <strong>Haven’t heard back</strong>{' '}
          is still computed per week (same rules as the Scoreboard; Won includes <strong>Started or complete</strong>) but
          is not shown in that row—use each cell’s <strong>accessible name</strong> to hear all three counts.
        </p>
      </div>

      {weeks.length === 0 ? (
        <p style={{ margin: 0, color: '#6b7280', fontSize: '0.875rem' }}>No sent bids in this view.</p>
      ) : (
        <div
          style={{
            border: '1px solid #e5e7eb',
            borderRadius: 4,
            overflowX: 'auto',
          }}
        >
          <table
            aria-labelledby={headingId}
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              minWidth: Math.max(480, 140 + pivot.weeks.length * 112),
            }}
          >
            <thead style={{ background: '#f9fafb' }}>
              <tr>
                <th scope="col" style={stickyCorner}>
                  Estimator
                </th>
                {pivot.weeks.map((w) => (
                  <th
                    key={w.weekStart}
                    scope="col"
                    style={thWeek}
                    id={`${headingId}-wk-${w.weekStart}`}
                  >
                    {formatScheduleDispatchWeekNavLabel(w.weekStart, w.weekEnd)}
                  </th>
                ))}
              </tr>
              <tr>
                <td style={stickyOutcomes}>Outcomes</td>
                {pivot.weeks.map((w) => {
                  const label = formatScheduleDispatchWeekNavLabel(w.weekStart, w.weekEnd)
                  return (
                    <td
                      key={`o-${w.weekStart}`}
                      style={{
                        padding: '0.35rem 0.5rem',
                        borderBottom: '1px solid #e5e7eb',
                        fontSize: '0.75rem',
                        color: '#4b5563',
                        textAlign: 'center',
                        verticalAlign: 'top',
                        lineHeight: 1.35,
                      }}
                      aria-label={`Outcomes for ${label}: Won ${w.won}, Lost ${w.lost}, Have not heard back ${w.haventHeardBack}`}
                    >
                      <span title="Won">W</span> {w.won}
                      <span aria-hidden> · </span>
                      <span title="Lost">L</span> {w.lost}
                    </td>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {pivot.rows.map((row) => (
                <tr key={row.estimatorKey} style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <th scope="row" style={stickyRowHeader}>
                    {row.displayName}
                  </th>
                  {pivot.weeks.map((w) => {
                    const cell = row.byWeek[w.weekStart] ?? { sentCount: 0, sentDollars: 0, bidIds: [] }
                    const weekLabel = formatScheduleDispatchWeekNavLabel(w.weekStart, w.weekEnd)
                    const dollarsK = formatDollarsAsThousandsK(cell.sentDollars)
                    const compact = `${dollarsK}-${cell.sentCount}`
                    const cellAriaLabel = `${row.displayName}, ${weekLabel}: ${cell.sentCount} sent, ${dollarsK}`
                    const drillable = cell.sentCount > 0
                    return (
                      <td
                        key={`${row.estimatorKey}-${w.weekStart}`}
                        headers={`${headingId}-wk-${w.weekStart}`}
                        aria-label={drillable ? undefined : cellAriaLabel}
                        style={{
                          padding: '0.375rem 0.5rem',
                          fontSize: '0.875rem',
                          textAlign: 'right',
                          verticalAlign: 'middle',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {drillable ? (
                          <button
                            type="button"
                            aria-label={`${cellAriaLabel}. Open list of bids.`}
                            onClick={() =>
                              setCellModal({
                                weekLabel,
                                estimatorDisplayName: row.displayName,
                                bidIds: cell.bidIds,
                              })
                            }
                            style={{
                              margin: 0,
                              padding: 0,
                              border: 'none',
                              background: 'none',
                              cursor: 'pointer',
                              font: 'inherit',
                              color: 'inherit',
                              textAlign: 'right',
                              width: '100%',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {compact}
                          </button>
                        ) : (
                          compact
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <BidBoardWeeklySentCellModal
        open={cellModal != null}
        onClose={() => setCellModal(null)}
        weekLabel={cellModal?.weekLabel ?? ''}
        estimatorDisplayName={cellModal?.estimatorDisplayName ?? ''}
        bidIds={cellModal?.bidIds ?? []}
        bids={bids}
      />
    </div>
  )
}
