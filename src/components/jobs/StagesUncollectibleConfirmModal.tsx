/**
 * Uncollectible? / Put it back in Collections? (punch list #94, v2.4792).
 *
 * The same shape as StagesCollectionsConfirmModal: the reason draft stays controlled by the tab,
 * the confirm — set_job_uncollectible, Stripe's mark, the toast, the reload — stays in the tab as
 * `onConfirm`. z 780 so it paints over call mode (z 770). A reason is required when marking; the
 * window says where the job goes and what still works.
 */
import type { JobWithDetails } from '../../types/jobWithDetails'
import { UNCOLLECTIBLE_REASON_MIN } from '../../lib/setJobUncollectible'
import { formatUsdNoCents } from '../../lib/jobs/jobFormatting'

export type StagesUncollectibleConfirmTarget = { job: JobWithDetails; direction: 'mark' | 'unmark' }

function jobLabel(job: JobWithDetails): string {
  return `${(job.hcp_number ?? '').trim() || (job.click_number ?? '').trim() || '—'} · ${(job.job_name ?? '').trim() || 'Job'}`
}

export function StagesUncollectibleConfirmModal({
  confirm,
  reasonDraft,
  onReasonDraftChange,
  saving,
  onCancel,
  onConfirm,
  firmWarning = null,
}: {
  confirm: StagesUncollectibleConfirmTarget
  /** v2.4794: the words when the firm holds the account (`uncollectibleFirmWarning`); null = quiet. */
  firmWarning?: string | null
  reasonDraft: string
  onReasonDraftChange: (value: string) => void
  saving: boolean
  onCancel: () => void
  onConfirm: () => void | Promise<void>
}) {
  const open = Math.max(0, Number(confirm.job.revenue ?? 0) - Number(confirm.job.payments_made ?? 0))
  const marking = confirm.direction === 'mark'
  const reasonShort = reasonDraft.trim().length < UNCOLLECTIBLE_REASON_MIN
  const disabled = saving || (marking && reasonShort)
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 780, paddingTop: 'var(--app-top-chrome, 0px)' }}>
      <div role="dialog" aria-modal="true" aria-label={marking ? 'Mark the job Uncollectible' : 'Put the job back in Collections'} style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, minWidth: 320, maxWidth: 460 }}>
        <h2 style={{ margin: '0 0 1rem', fontSize: '1.25rem' }}>
          {marking ? `Uncollectible — ${jobLabel(confirm.job)}?` : `Put ${jobLabel(confirm.job)} back in Collections?`}
        </h2>
        <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          {marking
            ? `${formatUsdNoCents(open)} open. The job stays in Collections under Uncollectible, stamped with your reason, and leaves every total and the Lien desk. Nothing is deleted. Stripe's invoice is marked uncollectible too. If the money ever comes, Mark Paid clears the stamp.`
            : 'The stamp comes off, the job counts in Collections again and goes back on its lien clock.'}
        </p>
        {marking ? (
          <label style={{ display: 'block', margin: '0 0 1rem', fontSize: '0.875rem', color: 'var(--text-700)' }}>
            Why — this is stamped on the row for everyone to read
            <textarea
              value={reasonDraft}
              onChange={(e) => onReasonDraftChange(e.target.value)}
              placeholder="e.g. customer refused the bill, will not answer, not worth a suit"
              rows={3}
              autoFocus
              style={{ display: 'block', width: '100%', marginTop: '0.35rem', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, font: 'inherit', fontSize: '0.875rem', boxSizing: 'border-box', resize: 'vertical' }}
            />
            {reasonShort ? <span style={{ display: 'block', marginTop: '0.3rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>A short sentence at least.</span> : null}
          </label>
        ) : null}
        {marking && firmWarning ? (
          <p role="note" style={{ margin: '0 0 1rem', padding: '0.5rem 0.65rem', fontSize: '0.8125rem', color: 'var(--text-amber-800)', background: 'var(--bg-amber-tint)', border: '1px solid var(--border-amber)', borderRadius: 4 }}>
            {firmWarning}
          </p>
        ) : null}
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
            disabled={disabled}
            onClick={() => void onConfirm()}
            style={{
              padding: '0.5rem 1rem',
              background: disabled ? '#9ca3af' : marking ? '#b91c1c' : '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: 4,
              cursor: disabled ? 'not-allowed' : 'pointer',
            }}
          >
            {saving ? '…' : marking ? 'Mark Uncollectible' : 'Put it back'}
          </button>
        </div>
      </div>
    </div>
  )
}
