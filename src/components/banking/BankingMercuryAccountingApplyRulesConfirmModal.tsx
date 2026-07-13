import { useEffect } from 'react'

export type BankingMercuryAccountingApplyRulesConfirmModalProps = {
  open: boolean
  totalMatches: number
  capPerClick: number
  busy: boolean
  onCancel: () => void
  onConfirm: () => void
}

export function BankingMercuryAccountingApplyRulesConfirmModal({
  open,
  totalMatches,
  capPerClick,
  busy,
  onCancel,
  onConfirm,
}: BankingMercuryAccountingApplyRulesConfirmModalProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, busy, onCancel])

  if (!open) return null

  const willInsert = Math.min(totalMatches, capPerClick)
  const remaining = Math.max(0, totalMatches - capPerClick)
  const exceedsCap = totalMatches > capPerClick

  const title = 'Apply rules to transactions?'

  const handleBackdropMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (busy) return
    if (e.target === e.currentTarget) onCancel()
  }

  return (
    <div
      role="presentation"
      onMouseDown={handleBackdropMouseDown}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1260,
        padding: '1rem',
        boxSizing: 'border-box',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="banking-accounting-apply-rules-confirm-title"
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          background: 'var(--surface)',
          borderRadius: 10,
          maxWidth: 480,
          width: '100%',
          maxHeight: 'min(90vh, 640px)',
          overflow: 'auto',
          boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
          padding: '1.25rem',
          boxSizing: 'border-box',
        }}
      >
        <h2
          id="banking-accounting-apply-rules-confirm-title"
          style={{ margin: '0 0 0.75rem', fontSize: '1.1rem', fontWeight: 700 }}
        >
          {title}
        </h2>

        <p style={{ margin: '0 0 0.75rem', fontSize: '0.95rem', color: 'var(--text-slate-900)' }}>
          <strong>{totalMatches.toLocaleString()}</strong>{' '}
          {totalMatches === 1 ? 'transaction matches' : 'transactions match'} your rules.
        </p>

        {exceedsCap ? (
          <p style={{ margin: '0 0 0.75rem', fontSize: '0.875rem', color: 'var(--text-slate-600)', lineHeight: 1.5 }}>
            The first <strong>{capPerClick.toLocaleString()}</strong> will be created as pending suggestions for review.
            The remaining <strong>{remaining.toLocaleString()}</strong>{' '}
            {remaining === 1 ? 'stays unmatched' : 'stay unmatched'} until you approve some and click{' '}
            <strong>Apply rules</strong> again.
          </p>
        ) : (
          <p style={{ margin: '0 0 0.75rem', fontSize: '0.875rem', color: 'var(--text-slate-600)', lineHeight: 1.5 }}>
            <strong>{willInsert.toLocaleString()}</strong> pending{' '}
            {willInsert === 1 ? 'suggestion will be created' : 'suggestions will be created'} for review.
          </p>
        )}

        <p style={{ margin: '0 0 1.25rem', fontSize: '0.8rem', color: 'var(--text-slate-500)', lineHeight: 1.5 }}>
          You can approve them one-by-one in the Approvals section, or use <strong>Approve all</strong> to apply the
          suggested label to every pending row at once.
        </p>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            style={{
              padding: '0.5rem 1rem',
              background: 'var(--surface)',
              color: 'var(--text-strong)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              cursor: busy ? 'not-allowed' : 'pointer',
              fontWeight: 500,
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            style={{
              padding: '0.5rem 1rem',
              background: busy ? '#94a3b8' : '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              cursor: busy ? 'not-allowed' : 'pointer',
              fontWeight: 600,
            }}
          >
            {busy
              ? 'Creating…'
              : `Create ${willInsert.toLocaleString()} pending ${willInsert === 1 ? 'suggestion' : 'suggestions'}`}
          </button>
        </div>
      </div>
    </div>
  )
}
