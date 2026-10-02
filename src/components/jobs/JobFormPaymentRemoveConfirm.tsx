import { formatCurrency } from '../../lib/jobs/jobFormMoney'

/** What the confirm shows before a payment line leaves the job: the line, the job total, the remainder now and after. */
export type PaymentRemovePreview = { rowAmt: number; jobTotal: number; currentRem: number; newRem: number }

export type JobFormPaymentRemoveConfirmProps = {
  open: boolean
  preview: PaymentRemovePreview | null
  /** True when the remove writes through the RPC at once; false when the line only leaves the form and autosave carries the change. */
  confirmsPersistedRpc: boolean
  busy: boolean
  onCancel: () => void
  onConfirm: () => void
  zIndex: number
}

/**
 * "Remove payment?" — the job form's inline confirm (§16 of the Job form map), out of the shell
 * whole (v2.3872). The open flag, the preview math and the RPC stay the shell's; this draws them.
 */
export function JobFormPaymentRemoveConfirm({ open, preview, confirmsPersistedRpc, busy, onCancel, onConfirm, zIndex }: JobFormPaymentRemoveConfirmProps) {
  return (
    <>
    {open && (
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
          if (!busy) onCancel()
        }}
      >
        <div role="dialog" aria-modal="true"
          style={{
            background: 'var(--surface)',
            padding: '1.5rem',
            borderRadius: 8,
            minWidth: 360,
            maxWidth: 480,
            maxHeight: 'min(90vh, 100%)',
            overflow: 'auto',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <h2 style={{ margin: '0 0 0.75rem', fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-strong)' }}>Remove payment?</h2>
          {preview ? (
            <div style={{ fontSize: '0.875rem', color: 'var(--text-700)', lineHeight: 1.5 }}>
              <p style={{ margin: '0 0 0.75rem' }}>
                This removes a payment of{' '}
                <strong style={{ fontVariantNumeric: 'tabular-nums' }}>${formatCurrency(preview.rowAmt)}</strong> from this job.
              </p>
              <p style={{ margin: '0 0 0.75rem', color: 'var(--text-muted)' }}>
                {confirmsPersistedRpc ? (
                  <>
                    This updates the database immediately (payments recorded on this job and any linked invoice status).
                  </>
                ) : (
                  <>
                    This payment line was only just typed. It leaves the form now, and the job saves the change by itself in a moment.
                  </>
                )}
              </p>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem', marginBottom: '1rem' }}>
                <tbody>
                  <tr>
                    <td style={{ padding: '0.35rem 0', color: 'var(--text-muted)' }}>Job total</td>
                    <td style={{ padding: '0.35rem 0', textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                      ${formatCurrency(preview.jobTotal)}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: '0.35rem 0', color: 'var(--text-muted)' }}>Remaining ($) now</td>
                    <td style={{ padding: '0.35rem 0', textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                      ${formatCurrency(preview.currentRem)}
                    </td>
                  </tr>
                  <tr style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '0.35rem 0', fontWeight: 600, color: 'var(--text-strong)' }}>Remaining ($) after removal</td>
                    <td style={{ padding: '0.35rem 0', textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: 'var(--text-strong)' }}>
                      ${formatCurrency(preview.newRem)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : (
            <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>This payment line is no longer available.</p>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={() => {
                if (!busy) onCancel()
              }}
              style={{
                padding: '0.5rem 1rem',
                background: 'var(--bg-muted)',
                border: '1px solid var(--border-strong)',
                borderRadius: 6,
                cursor: busy ? 'not-allowed' : 'pointer',
                fontSize: '0.875rem',
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={!preview || busy}
              style={{
                padding: '0.5rem 1rem',
                background: !preview || busy ? '#9ca3af' : '#b91c1c',
                color: 'white',
                border: 'none',
                borderRadius: 6,
                cursor: !preview || busy ? 'not-allowed' : 'pointer',
                fontSize: '0.875rem',
                fontWeight: 500,
              }}
            >
              {busy ? 'Removing…' : 'Remove payment'}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  )
}
