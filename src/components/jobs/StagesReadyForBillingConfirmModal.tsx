/**
 * Ready to Bill — the double-checkbox confirm (Stages tab decomposition PR 5, v2.3535).
 *
 * Moved verbatim out of `JobsStagesTab.tsx` (modal tail, region 6 of the architecture map).
 * The two checkboxes stay controlled by the tab: the ham-mode path resets them when it skips
 * this dialog, so they are cross-region state. The tab owns the confirm (the billing-email
 * nudge, then `moveJobToReadyToBillWithStripePrep`) and passes `busy` for its job.
 */
export function StagesReadyForBillingConfirmModal({
  job,
  checked1,
  checked2,
  onChecked1Change,
  onChecked2Change,
  busy,
  onCancel,
  onConfirm,
}: {
  job: { id: string; hcpNumber: string; jobName: string }
  checked1: boolean
  checked2: boolean
  onChecked1Change: (checked: boolean) => void
  onChecked2Change: (checked: boolean) => void
  /** True while the tab's status update for this job is in flight. */
  busy: boolean
  onCancel: () => void
  onConfirm: () => void | Promise<void>
}) {
  const ready = checked1 && checked2 && !busy
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
      <div style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, width: 'min(480px, calc(100vw - 2rem))', maxWidth: 480 }}>
        <h2 style={{ margin: '0 0 1rem', fontSize: '1.25rem' }}>Ready to Bill</h2>
        <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          {job.hcpNumber} · {job.jobName}
        </p>
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', cursor: 'pointer', marginBottom: '0.75rem' }}>
            <input type="checkbox" checked={checked1} onChange={(e) => onChecked1Change(e.target.checked)} style={{ marginTop: 4 }} />
            <span>I have reported all the Job Parts I&apos;ve used</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', cursor: 'pointer' }}>
            <input type="checkbox" checked={checked2} onChange={(e) => onChecked2Change(e.target.checked)} style={{ marginTop: 4 }} />
            <span>The customer knows the work is done and is satisfied</span>
          </label>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
          <button type="button" onClick={onCancel} style={{ padding: '0.5rem 1rem', border: '1px solid var(--border-strong)', background: 'var(--surface)', borderRadius: 4, cursor: 'pointer' }}>Cancel</button>
          <button type="button" disabled={!ready} onClick={() => void onConfirm()} style={{ padding: '0.5rem 1rem', background: ready ? '#3b82f6' : '#9ca3af', color: 'white', border: 'none', borderRadius: 4, cursor: ready ? 'pointer' : 'not-allowed' }}>{busy ? '…' : 'Confirm'}</button>
        </div>
      </div>
    </div>
  )
}
