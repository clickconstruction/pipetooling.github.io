import { useEffect } from 'react'
import { derivedDiscountDollars, discountBillDescription, isDiscountRow } from '../../lib/jobs/discountLine'
import { formatCurrency } from '../../lib/jobs/jobFormMoney'
import type { FixtureRow } from '../../lib/jobs/jobFormTypes'
import { buildFixtureStripeLineDescriptionForStripe } from '../../lib/stripeInvoiceLineDescription'

export type JobFormStripeLinePreviewDialogProps = {
  open: boolean
  /** The named line items — the ones that become Stripe lines (the shell filters the blanks). */
  rows: FixtureRow[]
  onClose: () => void
  zIndex: number
}

/**
 * The Stripe line descriptions preview (§17 of the Job form map) — every named line item as the
 * one Stripe invoice line it becomes, a discount as its negative line. Out of the shell whole
 * (v2.3872), its Escape listener with it.
 */
export function JobFormStripeLinePreviewDialog({ open, rows, onClose, zIndex }: JobFormStripeLinePreviewDialogProps) {
  useEffect(() => {
    if (!open) return
    const onKeyDown = (ev: WindowEventMap['keydown']) => {
      if (ev.key === 'Escape') {
        ev.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])
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
        onClick={() => onClose()}
      >
        <div
          id="stripe-fixture-line-preview-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="stripe-fixture-line-preview-title"
          style={{
            background: 'var(--surface)',
            padding: '1.5rem',
            borderRadius: 8,
            minWidth: 320,
            maxWidth: 560,
            maxHeight: 'min(90vh, 100%)',
            overflow: 'auto',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <h2
            id="stripe-fixture-line-preview-title"
            style={{
              margin: '0 0 0.75rem',
              fontSize: '1.125rem',
              fontWeight: 600,
              color: 'var(--text-strong)',
              textAlign: 'center',
            }}
          >
            Stripe line descriptions
          </h2>
          {rows.length === 0 ? (
            <p style={{ margin: '0 0 1rem', fontSize: '0.8125rem', color: 'var(--text-muted)', textAlign: 'center' }}>
              No named line items yet.
            </p>
          ) : (
            rows.map((f) => (
              <div
                key={f.id}
                style={{
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                  fontSize: '0.875rem',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  padding: '0.75rem',
                  background: 'var(--bg-subtle)',
                  borderRadius: 6,
                  border: '1px solid var(--border)',
                  color: 'var(--text-strong)',
                  marginBottom: '0.5rem',
                }}
              >
                {isDiscountRow(f)
                  ? `${discountBillDescription(f.name, f.discount_pct)}    −$${formatCurrency(derivedDiscountDollars(rows, f))}`
                  : buildFixtureStripeLineDescriptionForStripe(f.name, f.line_description)}
              </div>
            ))
          )}
          <p
            style={{
              margin: '0.5rem 0 1rem',
              fontSize: '0.8125rem',
              color: 'var(--text-muted)',
              lineHeight: 1.5,
              textAlign: 'center',
            }}
          >
            One Stripe invoice line per line item: &quot;line item&quot; - &quot;scope notes&quot;. A discount prints as a negative line on every bill that carries the work it applies to.
          </p>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={() => onClose()}
              style={{
                padding: '0.5rem 1rem',
                fontSize: '0.875rem',
                fontWeight: 500,
                background: '#2563eb',
                color: 'white',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
              }}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  )
}
