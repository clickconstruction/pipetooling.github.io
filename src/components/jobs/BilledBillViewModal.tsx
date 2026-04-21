import { useAuth } from '../../hooks/useAuth'
import { HostedStripeBillPanel, type InvoiceWithJobForBillView } from './HostedStripeBillPanel'

export type { InvoiceWithJobForBillView }

export default function BilledBillViewModal({
  invoice,
  onClose,
  onAfterStripeDetailsLoaded,
  onAfterOobUnwindSuccess,
  overlayZIndex = 60,
}: {
  invoice: InvoiceWithJobForBillView | null
  onClose: () => void
  /** After `get-stripe-invoice-details` succeeds (memo backfill committed server-side). */
  onAfterStripeDetailsLoaded?: () => void
  onAfterOobUnwindSuccess?: () => void | Promise<void>
  overlayZIndex?: number
}) {
  const { role } = useAuth()
  const inv = invoice
  const job = inv?.job
  const subtitle = job ? `${job.hcp_number ?? '—'} · ${job.job_name ?? '—'}` : '—'
  const stripeId = (inv?.stripe_invoice_id ?? '').trim()
  const isStripeHosted = Boolean(inv && stripeId && (inv?.hosted_invoice_url ?? '').trim())

  if (!invoice || !job) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: overlayZIndex,
      }}
    >
      <div
        style={{
          background: 'white',
          padding: '1.5rem',
          borderRadius: 8,
          minWidth: 420,
          maxWidth: 520,
          maxHeight: '90vh',
          overflow: 'auto',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
            marginBottom: '0.5rem',
            flexWrap: 'wrap',
          }}
        >
          <h2 style={{ margin: 0, fontSize: '1.25rem', lineHeight: 1.3 }}>View bill</h2>
          {isStripeHosted && stripeId && role === 'dev' ? (
            <button
              type="button"
              title="Open this invoice in Stripe Dashboard"
              onClick={() =>
                window.open(
                  `https://dashboard.stripe.com/invoices/${encodeURIComponent(stripeId)}`,
                  '_blank',
                  'noopener,noreferrer',
                )
              }
              style={{
                flexShrink: 0,
                padding: '0.35rem 0.65rem',
                fontSize: '0.75rem',
                borderRadius: 4,
                border: '1px solid #d1d5db',
                background: 'white',
                cursor: 'pointer',
                color: '#374151',
                fontWeight: 500,
              }}
            >
              Open in Stripe
            </button>
          ) : null}
        </div>
        <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: '#6b7280' }}>{subtitle}</p>

        <HostedStripeBillPanel
          invoice={invoice}
          onAfterStripeDetailsLoaded={onAfterStripeDetailsLoaded}
          onAfterOobUnwindSuccess={onAfterOobUnwindSuccess}
        />

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '0.5rem 1rem',
              border: '1px solid #d1d5db',
              background: 'white',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: '0.875rem',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
