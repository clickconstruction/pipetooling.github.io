import { unlinkLeavesStripeBillUntouched } from '../../lib/jobs/jobFormPaymentPredicates'
import type { PaymentRow } from '../../lib/jobs/jobFormTypes'
import { normalizeJobsLedgerStatus } from '../../lib/jobsLedgerStatusPipeline'

type EditingJob = Parameters<typeof unlinkLeavesStripeBillUntouched>[1]

export type JobFormMercuryUnlinkConfirmProps = {
  /** The payment line the confirm is about; null = closed. */
  rowId: string | null
  payments: PaymentRow[]
  editing: EditingJob
  /** The line whose unlink is in flight, if any — buttons and the backdrop stay put while it runs. */
  busyRowId: string | null
  onCancel: () => void
  onConfirm: () => void
  zIndex: number
}

/**
 * "Unlink and remove?" — the confirm before a payment line leaves the job and its bank deposit
 * (§18 of the Job form map): the double-count warning, the Stripe-untouched note when it applies,
 * the demote-to-Billed note on a Paid job. Out of the shell whole (v2.3872); the RPC stays there.
 */
export function JobFormMercuryUnlinkConfirm({ rowId, payments, editing, busyRowId, onCancel, onConfirm, zIndex }: JobFormMercuryUnlinkConfirmProps) {
  return (
    <>
    {rowId && (
      <div
        style={{
          position: 'fixed',
          padding: 'calc(1rem + env(safe-area-inset-top, 0px)) 1rem calc(1rem + env(safe-area-inset-bottom, 0px))',
          inset: 0,
          background: 'rgba(0,0,0,0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex,
        }}
        onClick={() => {
          if (busyRowId) return
          onCancel()
        }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="job-form-unlink-mercury-confirm-title"
          style={{
            background: 'var(--surface)',
            padding: '1.5rem',
            borderRadius: 8,
            minWidth: 360,
            maxWidth: 520,
            maxHeight: 'min(90vh, 100%)',
            overflow: 'auto',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <h2
            id="job-form-unlink-mercury-confirm-title"
            style={{ margin: '0 0 0.75rem', fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-strong)' }}
          >
            Unlink and remove?
          </h2>
          <div style={{ fontSize: '0.875rem', color: 'var(--text-700)', lineHeight: 1.5 }}>
            <p style={{ margin: '0 0 0.75rem' }}>
              Remove this payment line from the job and unlink it from the bank deposit? The bank transaction will
              show those funds as available again in Jobs → Stages → Accounts Receivable.
            </p>
            <p
              style={{
                margin:
                  normalizeJobsLedgerStatus(editing?.status) === 'paid' ? '0 0 0.75rem' : '0 0 1rem',
              }}
            >
              Only do this to fix a mistaken link or payment. Applying the same deposit again without fixing data
              could double-count.
            </p>
            {(() => {
              const unlinkRow = payments.find((r) => r.id === rowId) ?? null
              return unlinkRow && unlinkLeavesStripeBillUntouched(unlinkRow, editing) ? (
                <p style={{ margin: '0 0 1rem', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                  This bill went out through Stripe, and Stripe never recorded this payment — its pay link still asks
                  for the full amount, so there is nothing to reverse there. A deposit the bank returned is marked
                  returned in Accounts Receivable as it leaves.
                </p>
              ) : null
            })()}
            {normalizeJobsLedgerStatus(editing?.status) === 'paid' ? (
              <p style={{ margin: '0 0 1rem', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                This job is Paid: if a balance remains after removing this payment, it will move back to Billed on
                Stages.
              </p>
            ) : null}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={() => {
                if (busyRowId) return
                onCancel()
              }}
              disabled={Boolean(busyRowId)}
              style={{
                padding: '0.5rem 1rem',
                background: 'var(--bg-muted)',
                border: '1px solid var(--border-strong)',
                borderRadius: 6,
                cursor: busyRowId ? 'not-allowed' : 'pointer',
                fontSize: '0.875rem',
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={Boolean(busyRowId)}
              style={{
                padding: '0.5rem 1rem',
                background: busyRowId ? '#9ca3af' : '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: 6,
                cursor: busyRowId ? 'not-allowed' : 'pointer',
                fontSize: '0.875rem',
                fontWeight: 500,
              }}
            >
              {busyRowId === rowId ? 'Removing…' : 'Unlink and remove'}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  )
}
