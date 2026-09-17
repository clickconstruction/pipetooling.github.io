/**
 * "Are you sure?" — the plain send-back confirm for Waiting / Ready to Bill / Billed (Stages
 * tab decomposition PR 5, v2.3535). Moved verbatim out of `JobsStagesTab.tsx`; the tab owns
 * the `updateJobStatus` call and passes `busy` for the target job.
 */
export type StagesSendBackSimpleTarget = { id: string; toStatus: 'waiting' | 'ready_to_bill' | 'billed' }

export function StagesSendBackSimpleConfirmModal({
  target,
  busy,
  onCancel,
  onConfirm,
}: {
  target: StagesSendBackSimpleTarget
  busy: boolean
  onCancel: () => void
  onConfirm: () => void | Promise<void>
}) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
      <div style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, minWidth: 320, maxWidth: 400 }}>
        <h2 style={{ margin: '0 0 1rem', fontSize: '1.25rem' }}>Are you sure?</h2>
        <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          {target.toStatus === 'waiting'
            ? 'This will move the job back to Waiting.'
            : target.toStatus === 'ready_to_bill'
              ? 'This will move the job back to Ready to Bill.'
              : 'This will move the job back to Billed Awaiting Payment.'}
        </p>
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
            disabled={busy}
            onClick={() => void onConfirm()}
            style={{
              padding: '0.5rem 1rem',
              background: !busy ? '#3b82f6' : '#9ca3af',
              color: 'white',
              border: 'none',
              borderRadius: 4,
              cursor: !busy ? 'pointer' : 'not-allowed',
            }}
          >
            {busy ? '…' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  )
}
