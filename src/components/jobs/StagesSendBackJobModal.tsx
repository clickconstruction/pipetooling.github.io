/**
 * Send Job Back / Send back — the job send-back confirm (Stages tab decomposition PR 6,
 * v2.3536). Moved verbatim out of `JobsStagesTab.tsx` (modal tail, region 6 of the map).
 *
 * Everything it reads is the tab's: the target (with the v2.2601 billing context that drives
 * the stage-billed framing), the shared attestation checkbox (JOBS_STAGES_TAB map, quirk "`sendBackChecked` is shared"), the collect-payment
 * notice and the last status-event line, the required reason for RTB → Working (v2.2065) and
 * `busy`. The confirm — the Stripe void prep on Billed → RTB, `updateJobStatus`, the reason
 * note — stays in the tab as `onConfirm`.
 */
import { DELETE_DRAFT_BILL_LABEL } from '../../lib/deleteDraftBillLabel'
import { formatCurrency } from '../../lib/jobs/jobFormatting'
import { SEND_BACK_REWORK_REASON, SEND_BACK_STAGE_BILLED_REASON, type SendBackJobBillingContext } from '../../lib/jobs/jobSendBackContext'
import { sendBackReasonError } from '../../lib/jobs/jobSendBackNote'
import SendBackReasonField from './SendBackReasonField'

export type StagesSendBackJobTarget = {
  id: string
  hcpNumber: string
  jobName: string
  toStatus: 'working' | 'ready_to_bill'
  rtbDraftCount: number
  /** v2.2601: set on RTB → Working send-backs; drives the stage-billed framing. */
  billing?: SendBackJobBillingContext
}

export function StagesSendBackJobModal({
  target,
  checked,
  onCheckedChange,
  needsAttestation,
  collectPaymentNotice,
  statusEventLine,
  reason,
  onReasonChange,
  busy,
  onCancel,
  onConfirm,
}: {
  target: StagesSendBackJobTarget
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  /** Whether this send-back voids something and so needs the attestation (tab-computed). */
  needsAttestation: boolean
  collectPaymentNotice: string | null
  statusEventLine: string | null
  reason: string
  onReasonChange: (reason: string) => void
  busy: boolean
  onCancel: () => void
  onConfirm: () => void | Promise<void>
}) {
  return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
        <div style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, width: 'min(480px, calc(100vw - 2rem))', maxWidth: 480 }}>
          <h2 style={{ margin: '0 0 1rem', fontSize: '1.25rem' }}>{target.toStatus === 'working' ? 'Send Job Back' : 'Send back'}</h2>
          <p style={{ margin: '0 0 1rem', fontSize: '0.875rem' }}>
            {target.toStatus === 'ready_to_bill'
              ? 'This will move the job back to Ready to Bill.'
              : target.billing?.stageBilledContinues
                ? `The job returns to Working. ${
                    target.billing.billedCount === 1
                      ? 'Its billed line stays billed'
                      : `Its ${target.billing.billedCount} billed lines stay billed`
                  } ($${formatCurrency(target.billing.billedTotalDollars)}).${
                    target.rtbDraftCount > 0
                      ? ' The unsent remainder draft is removed and comes back automatically the next time the job is ready to bill.'
                      : ''
                  }`
                : target.rtbDraftCount > 0
                ? `This will move the job back to Assigned Jobs (Working). ${
                    target.rtbDraftCount === 1
                      ? `This will also remove 1 Ready to Bill draft bill (same as ${DELETE_DRAFT_BILL_LABEL.replace('\u00A0', ' ')}).`
                      : `This will also remove ${target.rtbDraftCount} Ready to Bill draft bills (same as ${DELETE_DRAFT_BILL_LABEL.replace('\u00A0', ' ')}).`
                  }`
                : 'This will move the job back to Assigned Jobs (Working).'}
          </p>
          <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            {target.hcpNumber} · {target.jobName}
          </p>
          {target.toStatus === 'working' && collectPaymentNotice != null && (
            <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: 'var(--text-amber-800)' }}>{collectPaymentNotice}</p>
          )}
          {statusEventLine != null && (
            <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              {statusEventLine}
            </p>
          )}
          {target.toStatus === 'ready_to_bill' && (
            <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: 'var(--text-amber-800)' }}>
              Billed lines on this job will be removed (Stripe invoices voided first where applicable). Lines with recorded payments block send back until adjusted. Paid Stripe invoices block until resolved in Stripe.
            </p>
          )}
          {needsAttestation && (
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => onCheckedChange(e.target.checked)}
                  style={{ marginTop: 4 }}
                />
                <span>I am going to call the Subcontractor and explain why I am voiding this bill and another will have to be issued</span>
              </label>
            </div>
          )}
          {target.toStatus === 'working' && target.billing?.stageBilledContinues && (
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
              {[SEND_BACK_STAGE_BILLED_REASON, SEND_BACK_REWORK_REASON].map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => onReasonChange(r)}
                  aria-pressed={reason === r}
                  style={{
                    font: 'inherit',
                    fontSize: '0.8rem',
                    padding: '0.25rem 0.75rem',
                    borderRadius: 999,
                    border: reason === r ? '1px solid #3b82f6' : '1px solid var(--border-strong)',
                    background: reason === r ? 'var(--bg-blue-tint)' : 'var(--bg-subtle)',
                    color: 'var(--text-strong)',
                    cursor: 'pointer',
                  }}
                >
                  {r}
                </button>
              ))}
            </div>
          )}
          {target.toStatus === 'working' && (
            <SendBackReasonField
              value={reason}
              onChange={onReasonChange}
              disabled={busy}
            />
          )}
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
              disabled={
                (needsAttestation && !checked) ||
                (target.toStatus === 'working' && sendBackReasonError(reason) != null) ||
                busy
              }
              onClick={() => void onConfirm()}
              style={{
                padding: '0.5rem 1rem',
                background:
                  (!needsAttestation || checked) && !busy ? '#3b82f6' : '#9ca3af',
                color: 'white',
                border: 'none',
                borderRadius: 4,
                cursor:
                  (!needsAttestation || checked) && !busy
                    ? 'pointer'
                    : 'not-allowed',
              }}
            >
              {busy ? '…' : target.toStatus === 'working' ? 'Send Job Back' : 'Send back'}
            </button>
          </div>
        </div>
      </div>
  )
}
