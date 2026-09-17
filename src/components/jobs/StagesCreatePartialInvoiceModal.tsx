/**
 * Create partial invoice — the amount dialog (Stages tab decomposition PR 7, v2.3537).
 *
 * Moved verbatim out of `JobsStagesTab.tsx` (modal tail, region 6 of the map). The tab keeps
 * the amount string, the on-blur re-clamp (`reclampedPartialInvoiceInput`), the decision
 * (`planPartialInvoice`) and every write; page-global `error` is shown here and cleared by
 * the tab (map quirk 4). `job` is the row the dialog was opened for.
 */
import { formatCurrency } from '../../lib/jobs/jobFormatting'
import { jobPartialInvoiceRemainingDollars } from '../../lib/jobsStagesBoard'
import { effectiveJobLedgerNumber } from '../../lib/ledgerDisplayPrefixes'
import type { JobWithDetails } from '../../types/jobWithDetails'

export function StagesCreatePartialInvoiceModal({
  job,
  amount,
  onAmountChange,
  onAmountBlur,
  error,
  creating,
  onCancel,
  onCreate,
}: {
  job: JobWithDetails
  amount: string
  onAmountChange: (value: string) => void
  onAmountBlur: () => void
  /** The page-global error line (also written by the create path). */
  error: string | null
  creating: boolean
  onCancel: () => void
  onCreate: () => void | Promise<void>
}) {
  return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
        <div style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, width: 'min(480px, calc(100vw - 2rem))', maxWidth: 480 }}>
          <h2 style={{ margin: '0 0 1rem', fontSize: '1.25rem' }}>Create partial invoice</h2>
          <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>{effectiveJobLedgerNumber(job.hcp_number, job.click_number) || '—'} · {job.job_name ?? '—'}</p>
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ marginBottom: '0.5rem', fontSize: '0.875rem' }}>Remaining: ${formatCurrency(jobPartialInvoiceRemainingDollars(job))}</div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
              Amount ($)
              <input
                type="number"
                min={0}
                step={0.01}
                value={amount}
                onChange={(e) => onAmountChange(e.target.value)}
                onBlur={onAmountBlur}
                placeholder="0"
                style={{ width: '100%', marginTop: 4, padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.875rem' }}
              />
            </label>
            {error && <p style={{ color: 'var(--text-red-700)', fontSize: '0.8125rem', marginTop: '0.5rem' }}>{error}</p>}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
            <button type="button" onClick={onCancel} style={{ padding: '0.5rem 1rem', border: '1px solid var(--border-strong)', background: 'var(--surface)', borderRadius: 4, cursor: 'pointer' }}>Cancel</button>
            <button type="button" disabled={creating || !(parseFloat(amount) > 0)} onClick={() => void onCreate()} style={{ padding: '0.5rem 1rem', background: creating || !(parseFloat(amount) > 0) ? '#9ca3af' : '#16a34a', color: 'white', border: 'none', borderRadius: 4, cursor: creating || !(parseFloat(amount) > 0) ? 'not-allowed' : 'pointer' }}>{creating ? '…' : 'Create invoice'}</button>
          </div>
        </div>
      </div>
  )
}
