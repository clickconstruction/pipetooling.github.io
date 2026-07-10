import { useEffect } from 'react'

/**
 * Confirm dialog for the tally "Mark payroll" action. Mirrors
 * `RemoveProjectSuperintendentConfirmModal` but with a purple non-destructive
 * confirm (payroll accent) plus a "Create rule…" shortcut that lets the dev
 * turn this one-off mark into an auto-mark rule seeded from the transaction.
 */
export function TallyMarkPayrollConfirmModal({
  open,
  busy,
  counterpartyName,
  bankDescription,
  amountLabel,
  postedLabel,
  onCancel,
  onConfirm,
  onCreateRule,
}: {
  open: boolean
  busy: boolean
  counterpartyName: string | null
  bankDescription: string | null
  amountLabel: string
  postedLabel: string | null
  onCancel: () => void
  onConfirm: () => void
  onCreateRule: () => void
}) {
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !busy) onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, busy, onCancel])

  if (!open) return null
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1150,
      }}
      onClick={() => {
        if (!busy) onCancel()
      }}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="tally-mark-payroll-title"
        style={{
          background: '#fff',
          borderRadius: 8,
          padding: '1.25rem',
          maxWidth: 440,
          width: '92%',
          boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="tally-mark-payroll-title" style={{ margin: '0 0 0.5rem', fontSize: '1.05rem' }}>
          Mark this transaction as payroll?
        </h2>
        <div style={{ margin: '0 0 0.75rem', fontSize: '0.875rem', lineHeight: 1.4 }}>
          <div style={{ fontWeight: 600, color: '#111827' }}>
            {counterpartyName?.trim() || '(no counterparty)'}
          </div>
          <div style={{ color: '#6b7280' }}>
            {amountLabel}
            {postedLabel ? ` · ${postedLabel}` : ''}
          </div>
          {bankDescription?.trim() ? (
            <div style={{ color: '#6b7280', fontSize: '0.8125rem' }}>{bankDescription}</div>
          ) : null}
        </div>
        <p style={{ margin: '0 0 1rem', color: '#374151', fontSize: '0.875rem', lineHeight: 1.4 }}>
          This resolves the transaction without allocating it to any job.
        </p>
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
          <button
            type="button"
            disabled={busy}
            onClick={onCreateRule}
            title="Open the payroll rules form pre-filled from this transaction"
            style={{
              marginRight: 'auto',
              padding: '0.45rem 1rem',
              fontSize: '0.875rem',
              background: '#fff',
              border: '1px solid #d1d5db',
              color: '#374151',
              borderRadius: 4,
              cursor: busy ? 'not-allowed' : 'pointer',
            }}
          >
            Create rule…
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            style={{
              padding: '0.45rem 1rem',
              fontSize: '0.875rem',
              background: '#f3f4f6',
              border: '1px solid #d1d5db',
              borderRadius: 4,
              cursor: busy ? 'not-allowed' : 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            style={{
              padding: '0.45rem 1rem',
              fontSize: '0.875rem',
              background: busy ? '#e5e7eb' : '#7c3aed',
              color: busy ? '#6b7280' : '#fff',
              border: 'none',
              borderRadius: 4,
              cursor: busy ? 'not-allowed' : 'pointer',
            }}
          >
            {busy ? 'Marking…' : 'Mark payroll'}
          </button>
        </div>
      </div>
    </div>
  )
}
