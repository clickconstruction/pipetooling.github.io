import type { TermsWarning } from '../../lib/customerPaymentTerms'

/**
 * The payment-terms bar on New Bid / New Job ("Their Word" PR 4): amber for a
 * warning (deposit required, no-new-work standing, a promise broken right
 * now), red for a stop (winding down, no-new-work with a broken promise).
 * Carries the customer's record line and the office's note so the decision
 * made on Customer review follows the customer onto the screen where the
 * office would otherwise say yes by habit. Renders nothing without a warning.
 */
export default function CustomerTermsBar({ warning, onEditTerms }: { warning: TermsWarning | null; onEditTerms?: () => void }) {
  if (!warning) return null
  const stop = warning.severity === 'stop'
  return (
    <div
      role="status"
      data-testid="customer-terms-bar"
      style={{
        display: 'grid',
        gridTemplateColumns: 'auto 1fr auto',
        gap: 10,
        alignItems: 'center',
        margin: '0.5rem 0 0.75rem',
        padding: '0.5rem 0.75rem',
        border: `1px solid ${stop ? 'var(--border-red)' : 'var(--border-amber)'}`,
        background: stop ? 'var(--bg-red-tint)' : 'var(--bg-amber-tint)',
        color: stop ? 'var(--text-red-700)' : 'var(--text-amber-800)',
        borderRadius: 8,
        fontSize: '0.8125rem',
      }}
    >
      <span aria-hidden style={{ fontSize: '1.1rem' }}>{stop ? '⛔' : '⚠'}</span>
      <span style={{ minWidth: 0 }}>
        <strong>{warning.headline}</strong>
        {warning.detail ? <span style={{ opacity: 0.9 }}> · {warning.detail}</span> : null}
        {warning.note ? <span style={{ display: 'block', color: 'var(--text-muted)', marginTop: 2 }}>“{warning.note}”</span> : null}
      </span>
      {onEditTerms ? (
        <button
          type="button"
          onClick={onEditTerms}
          style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem', border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-base)', borderRadius: 6, cursor: 'pointer', whiteSpace: 'nowrap' }}
        >
          Terms
        </button>
      ) : null}
    </div>
  )
}
