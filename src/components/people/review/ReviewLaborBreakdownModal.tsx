import { formatCurrency } from '../../../lib/format'
import type { ReviewLaborContributor } from '../../../lib/people/reviewPersonTypes'
import { stripAddressZipState } from './reviewFormat'

/** Which job the contributors window is about, and whether it shows labor or profit shares. */
export type ReviewLaborBreakdownContext = {
  mode: 'labor' | 'profit'
  jobId: string | null
  jobName: string
  jobAddress: string
  jobNumberLabel: string
  totalLaborOnJob: number
  revenueBeforeOverhead: number
  userPersonName: string
}

/**
 * People → Review → Jobs Worked: the Labor contributors / Profit shares window a Labor or Profit
 * cell opens (punch list #46 row 8, the Review map's step 7, rides with step 6; v2.4909). Moved
 * verbatim from PeopleReviewTab: the job's contributor rows come in as `rows` and closing goes
 * through `onClose`. The tab keeps the context state, which its person loader also resets.
 */
export function ReviewLaborBreakdownModal({
  ctx,
  rows,
  onClose,
}: {
  ctx: ReviewLaborBreakdownContext
  rows: ReviewLaborContributor[]
  onClose: () => void
}) {
  const sumOfRows = rows.reduce((s, r) => s + r.laborCost, 0)
  const sumHours = rows.reduce((s, r) => s + r.hours, 0)
  const denom = ctx.totalLaborOnJob > 0 ? ctx.totalLaborOnJob : sumOfRows
  const headerLabel = [ctx.jobNumberLabel, ctx.jobName].filter(Boolean).join(' · ') || (ctx.mode === 'profit' ? 'Profit breakdown' : 'Labor breakdown')
  const isProfit = ctx.mode === 'profit'
  const profitNegative = ctx.revenueBeforeOverhead < 0
  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 800, paddingTop: 'var(--app-top-chrome, 0px)' }}
    >
      <div role="dialog" aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, minWidth: 480, maxWidth: '92vw', maxHeight: 'min(85vh, 100%)', overflow: 'auto' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '0.75rem' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.125rem' }}>{isProfit ? 'Profit shares by person' : 'Labor contributors'}</h3>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-700)', marginTop: '0.25rem' }}>{headerLabel}</div>
            {ctx.jobAddress ? (
              <div style={{ fontSize: '0.8em', color: 'var(--text-muted)', marginTop: '0.1rem' }}>{stripAddressZipState(ctx.jobAddress) || ctx.jobAddress}</div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ padding: '0.25rem', border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.25rem', lineHeight: 1, color: 'var(--text-muted)' }}
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
          {isProfit ? (
            <>
              Total profit on this job (revenue before overhead): <strong style={{ color: profitNegative ? 'var(--text-red-700)' : 'var(--text-strong)' }}>${Math.round(ctx.revenueBeforeOverhead).toLocaleString('en-US')}</strong>
              <div style={{ fontSize: '0.95em', color: 'var(--text-faint)', marginTop: '0.15rem' }}>
                Allocated by each person's share of total labor (${Math.round(denom).toLocaleString('en-US')}{sumHours > 0 ? ` · ${sumHours.toFixed(2)} hrs` : ''}).
              </div>
            </>
          ) : (
            <>Total labor on this job (everyone, all time): <strong style={{ color: 'var(--text-strong)' }}>${Math.round(denom).toLocaleString('en-US')}</strong>{sumHours > 0 ? ` · ${sumHours.toFixed(2)} hrs` : ''}</>
          )}
        </div>
        {rows.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>No labor recorded for this job.</p>
        ) : (
          <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 4 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead style={{ background: 'var(--bg-subtle)' }}>
                <tr>
                  <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Person</th>
                  <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>Hours</th>
                  <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>Labor</th>
                  <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>Share</th>
                  {isProfit && (
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>Profit slice</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const isYou = ctx.userPersonName && r.personName === ctx.userPersonName
                  const ratio = denom > 0 ? r.laborCost / denom : 0
                  const pct = Math.round(ratio * 100)
                  const profitSlice = ratio * ctx.revenueBeforeOverhead
                  const sourceLabel = (() => {
                    const parts: string[] = []
                    if (r.subLaborCost > 0) parts.push('sub')
                    if (r.crewLaborCost > 0) parts.push('crew')
                    return parts.join(' + ')
                  })()
                  return (
                    <tr
                      key={r.personName}
                      style={{ borderBottom: '1px solid var(--border)', background: isYou ? 'var(--bg-amber-100)' : undefined }}
                    >
                      <td style={{ padding: '0.5rem 0.75rem' }}>
                        <div style={{ fontWeight: isYou ? 600 : 400 }}>
                          {r.personName}
                          {isYou ? <span style={{ marginLeft: '0.4rem', fontSize: '0.75em', color: 'var(--text-amber-800)', fontWeight: 600 }}>(you)</span> : null}
                        </div>
                        {sourceLabel ? <div style={{ fontSize: '0.75em', color: 'var(--text-faint)' }}>{sourceLabel}</div> : null}
                      </td>
                      <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>{r.hours > 0 ? r.hours.toFixed(2) : '—'}</td>
                      <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>{r.laborCost > 0 ? `$${formatCurrency(r.laborCost)}` : '—'}</td>
                      <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', color: 'var(--text-muted)' }}>{denom > 0 && r.laborCost > 0 ? `${pct}%` : '—'}</td>
                      {isProfit && (
                        <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: isYou ? 600 : 400, color: profitSlice >= 0 ? undefined : '#b91c1c' }}>
                          {Math.abs(profitSlice) >= 0.5 ? `$${formatCurrency(profitSlice)}` : '—'}
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderTop: '2px solid var(--border)', fontWeight: 600 }}>Total</td>
                  <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderTop: '2px solid var(--border)', fontWeight: 600 }}>{sumHours > 0 ? sumHours.toFixed(2) : '—'}</td>
                  <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderTop: '2px solid var(--border)', fontWeight: 600 }}>{sumOfRows > 0 ? `$${formatCurrency(sumOfRows)}` : '—'}</td>
                  <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderTop: '2px solid var(--border)', color: 'var(--text-muted)' }}>
                    {denom > 0 ? `${Math.round((sumOfRows / denom) * 100)}%` : '—'}
                  </td>
                  {isProfit && (
                    <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderTop: '2px solid var(--border)', fontWeight: 600, color: ctx.revenueBeforeOverhead >= 0 ? undefined : '#b91c1c' }}>
                      {Math.abs(ctx.revenueBeforeOverhead) >= 0.5 ? `$${formatCurrency(denom > 0 ? (sumOfRows / denom) * ctx.revenueBeforeOverhead : 0)}` : '—'}
                    </td>
                  )}
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        {Math.abs(sumOfRows - ctx.totalLaborOnJob) > 1 && ctx.totalLaborOnJob > 0 && (
          <p style={{ marginTop: '0.75rem', fontSize: '0.75em', color: 'var(--text-faint)' }}>
            Per-person rows total ${formatCurrency(sumOfRows)}; the job header showed ${formatCurrency(ctx.totalLaborOnJob)}. The two should match — a small gap usually means a sub-labor card without an assignee or a crew row outside the 2-year lookback window.
          </p>
        )}
      </div>
    </div>
  )
}
