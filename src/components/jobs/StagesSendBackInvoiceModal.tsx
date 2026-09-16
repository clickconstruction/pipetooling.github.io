/**
 * Send back / delete a bill line — the invoice send-back confirm (Stages tab decomposition
 * PR 6, v2.3536). Moved verbatim out of `JobsStagesTab.tsx` (modal tail, region 6 of the map).
 *
 * The attestation checkbox is shared with the job send-back dialog (map quirk 12), so it stays
 * controlled by the tab; so does the Stripe explainer flag, which the tab raises when a revert
 * fails on a Stripe-sent bill. The tab owns the confirm (delete or revert, behind its re-entry
 * lock) and passes `busy` for this bill.
 */
import { DELETE_DRAFT_BILL_LABEL } from '../../lib/deleteDraftBillLabel'
import type { InvoiceWithJob } from '../../lib/jobsStagesBoard'
import { effectiveJobLedgerNumber } from '../../lib/ledgerDisplayPrefixes'
import { invoiceNeedsStripeVoidForRevert } from '../../lib/voidStripeInvoiceForRevert'

export type StagesSendBackInvoiceTarget = { inv: InvoiceWithJob; action: 'delete' | 'revert' }

export function StagesSendBackInvoiceModal({
  target,
  checked,
  onCheckedChange,
  showStripeExplainer,
  busy,
  onCancel,
  onConfirm,
}: {
  target: StagesSendBackInvoiceTarget
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  /** Raised by the tab after a revert failed on a Stripe-sent bill. */
  showStripeExplainer: boolean
  busy: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
        <div style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, width: 'min(480px, calc(100vw - 2rem))', maxWidth: 480 }}>
          <h2 style={{ margin: '0 0 1rem', fontSize: '1.25rem' }}>{target.action === 'delete' ? DELETE_DRAFT_BILL_LABEL : 'Send back'}</h2>
          <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            {`Job ${effectiveJobLedgerNumber(target.inv.job.hcp_number, target.inv.job.click_number) || '—'} · ${target.inv.job.job_name || '—'} · $${Number(target.inv.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
          </p>
          {target.action === 'delete' && (
            <p style={{ margin: '0 0 1rem', fontSize: '0.875rem' }}>This will remove the invoice from Ready to Bill.</p>
          )}
          {target.action === 'revert' && invoiceNeedsStripeVoidForRevert(target.inv) && showStripeExplainer && (
            <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: 'var(--text-amber-800)' }}>
              This bill was sent via Stripe. We will void or remove the Stripe invoice so the customer cannot pay an unpaid bill. If it is already paid in Stripe, send back will fail until you resolve it there.
            </p>
          )}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={checked} onChange={(e) => onCheckedChange(e.target.checked)} style={{ marginTop: 4 }} />
              <span>I am going to call the Subcontractor and explain why I am voiding this bill and another will have to be issued</span>
            </label>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onCancel}
              style={{ padding: '0.5rem 1rem', border: '1px solid var(--border-strong)', background: 'var(--surface)', borderRadius: 4, cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!checked || busy}
              onClick={onConfirm}
              style={{ padding: '0.5rem 1rem', background: checked && !busy ? '#3b82f6' : '#9ca3af', color: 'white', border: 'none', borderRadius: 4, cursor: checked && !busy ? 'pointer' : 'not-allowed' }}
            >
              {busy ? '…' : target.action === 'delete' ? DELETE_DRAFT_BILL_LABEL : 'Send back'}
            </button>
          </div>
        </div>
      </div>
  )
}
