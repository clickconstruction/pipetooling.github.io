/**
 * Capable of Being Billed — Breakdown (Stages tab decomposition, v2.3530).
 *
 * Moved verbatim out of `JobsStagesTab.tsx` (region 5 of the architecture map). The figures
 * come from `buildCapableToBillBreakdownRowsWithPlans` in the parent, which also owns the
 * View door (Edit Job with the reload callbacks) and the scroll to the Working section.
 */
import type { CapableToBillFigure } from '../../lib/jobs/capableToBillPlan'
import { formatCurrency } from '../../lib/jobs/jobFormatting'
import { effectiveJobLedgerNumber } from '../../lib/ledgerDisplayPrefixes'
import type { JobWithDetails } from '../../types/jobWithDetails'

export function StagesCapableToBillModal({
  rows,
  total,
  onView,
  onGoToWorking,
  onClose,
}: {
  rows: ReadonlyArray<CapableToBillFigure<JobWithDetails>>
  /** The Working header's total (plan jobs read their plan, the rest the formula). */
  total: number
  /** View → the parent opens Edit Job and closes this modal. */
  onView: (job: JobWithDetails) => void
  /** "take me to Job: Stages: Working" — the parent opens and scrolls the section. */
  onGoToWorking: () => void
  onClose: () => void
}) {
  return (
    <div role="dialog" aria-modal="true" aria-label="Capable of Being Billed — Breakdown" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
      <div style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, width: 'min(720px, calc(100vw - 2rem))', maxWidth: 720, maxHeight: '80vh', overflow: 'auto' }}>
        <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.25rem' }}>Capable of Being Billed — Breakdown</h2>
        <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          Jobs in Working with value not yet paid, billed, or queued to bill. Sorted by amount. A job split into stages reads its stage plan instead: the stages that passed inspection with nothing unbilled ahead of them, and the any-time rows that are done.
        </p>
        {rows.length === 0 ? (
          <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>No jobs with billable amount</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>Job</th>
                <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>%</th>
                <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>Done</th>
                <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>Paid</th>
                <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>Open bills</th>
                <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>To Bill</th>
                <th style={{ padding: '0.5rem 0.75rem', width: 80 }} />
              </tr>
            </thead>
            <tbody>
              {rows.map(({ job, toBill, valueCreated, openBilling, source, billableRows }) => (
                <tr key={job.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '0.5rem 0.75rem' }}>
                    <div>{job.job_name || '—'}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{effectiveJobLedgerNumber(job.hcp_number, job.click_number) || '—'}</div>
                    {source === 'plan' ? (
                      <div data-capable-plan-rows style={{ fontSize: '0.75rem', color: 'var(--text-amber-800)' }}>{billableRows.map((r) => r.why).join(' · ')}</div>
                    ) : null}
                  </td>
                  <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>{job.pct_complete != null ? `${job.pct_complete}%` : '—'}</td>
                  <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>{formatCurrency(valueCreated)}</td>
                  <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>{formatCurrency(Number(job.payments_made ?? 0))}</td>
                  <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', color: 'var(--text-muted)' }}>{openBilling > 0 ? formatCurrency(openBilling) : '—'}</td>
                  <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: 600 }}>{formatCurrency(toBill)}</td>
                  <td style={{ padding: '0.5rem 0.75rem' }}>
                    <button
                      type="button"
                      onClick={() => onView(job)}
                      style={{ padding: '0.25rem 0.5rem', fontSize: '0.8125rem', background: 'none', color: 'var(--text-link)', border: '1px solid #2563eb', borderRadius: 4, cursor: 'pointer' }}
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: '2px solid var(--border)', fontWeight: 600 }}>
                <td colSpan={5} style={{ padding: '0.5rem 0.75rem' }}>Total</td>
                <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>{formatCurrency(total)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        )}
        <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <button
            type="button"
            onClick={onGoToWorking}
            style={{ padding: '0.5rem 1rem', background: 'none', border: 'none', color: 'var(--text-link)', cursor: 'pointer', fontSize: '0.875rem', textDecoration: 'underline' }}
          >
            take me to Job: Stages: Working
          </button>
          <button type="button" onClick={onClose} style={{ padding: '0.5rem 1rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer' }}>Close</button>
        </div>
      </div>
    </div>
  )
}
