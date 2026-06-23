import { useCallback, useState } from 'react'
import { FileSpreadsheet } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { showAiaG702G703 } from '../../lib/aiaG702G703Eligibility'
import { effectiveJobLedgerNumber } from '../../lib/ledgerDisplayPrefixes'
import AiaG702G703Modal from './AiaG702G703Modal'
import { HostedStripeBillPanel, type InvoiceWithJobForBillView } from './HostedStripeBillPanel'

export type { InvoiceWithJobForBillView }

export default function BilledBillViewModal({
  invoice,
  onClose,
  onAfterStripeDetailsLoaded,
  onAfterOobUnwindSuccess,
  onAfterVoidStripeInvoiceSuccess,
  overlayZIndex = 60,
}: {
  invoice: InvoiceWithJobForBillView | null
  onClose: () => void
  /** After `get-stripe-invoice-details` succeeds (memo backfill committed server-side). */
  onAfterStripeDetailsLoaded?: () => void
  onAfterOobUnwindSuccess?: () => void | Promise<void>
  /**
   * After hosted Stripe void/remove succeeds; runs before `onClose` (e.g. refresh Stages cache).
   */
  onAfterVoidStripeInvoiceSuccess?: () => void | Promise<void>
  overlayZIndex?: number
}) {
  const { role } = useAuth()
  const [aiaOpen, setAiaOpen] = useState(false)

  const handleVoidStripeSuccess = useCallback(async () => {
    await onAfterVoidStripeInvoiceSuccess?.()
    onClose()
  }, [onAfterVoidStripeInvoiceSuccess, onClose])

  const inv = invoice
  const job = inv?.job
  const subtitle = job ? `${effectiveJobLedgerNumber(job.hcp_number, job.click_number) || '—'} · ${job.job_name ?? '—'}` : '—'
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            {showAiaG702G703(role, job, inv) ? (
              <button
                type="button"
                onClick={() => setAiaOpen(true)}
                title="AIA G702-G703"
                aria-label="Open AIA G702-G703 workbook generator"
                style={{
                  flexShrink: 0,
                  padding: '0.25rem',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#16a34a',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <FileSpreadsheet size={16} aria-hidden />
              </button>
            ) : null}
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
        </div>
        <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: '#6b7280' }}>{subtitle}</p>

        <HostedStripeBillPanel
          invoice={invoice}
          onAfterStripeDetailsLoaded={onAfterStripeDetailsLoaded}
          onAfterOobUnwindSuccess={onAfterOobUnwindSuccess}
          onAfterVoidStripeInvoiceSuccess={handleVoidStripeSuccess}
          voidConfirmOverlayZIndex={overlayZIndex + 1}
          viewBillOnClose={onClose}
        />

        <AiaG702G703Modal
          open={aiaOpen}
          onClose={() => setAiaOpen(false)}
          job={job}
          hcpForFilename={job.hcp_number ?? ''}
        />
      </div>
    </div>
  )
}
