import type { CSSProperties } from 'react'
import type { StripeInvoicePreviewSuccess } from '../../lib/stripeInvoicePreview'
import { StripeInvoiceLinesSummary } from './StripeInvoiceLinesSummary'
import { StripeInvoicePreviewMeta } from './StripeInvoicePreviewMeta'
import {
  buildStripeInvoiceEmailBody,
  buildStripeInvoiceSmsText,
} from '../../lib/stripeInvoiceShareCopy'

export type StripeBillPreSubmitPreviewProps = {
  customerName: string | null
  customerEmail: string | null
  jobName: string | null
  hcpNumber: string | null
  amountLabel: string
  dueDateYmd: string
  memo: string
  payUrlPlaceholder: string
  localLineDescription: string
  stripePreview: StripeInvoicePreviewSuccess | null
  stripePreviewLoading: boolean
  stripePreviewError: string | null
  /** When set, replaces the default “Enter amount…” idle hint (e.g. while RTB line is being ensured). */
  previewIdleHint?: string | null
}

const preStyle: CSSProperties = {
  margin: 0,
  whiteSpace: 'pre-wrap',
  fontFamily: 'ui-monospace, monospace',
  fontSize: '0.75rem',
  lineHeight: 1.45,
  color: '#374151',
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: 4,
  padding: '0.5rem 0.65rem',
  maxHeight: 140,
  overflow: 'auto',
}

const sectionTitle: CSSProperties = {
  fontSize: '0.75rem',
  fontWeight: 600,
  color: '#374151',
  margin: '0 0 0.35rem',
}

export function StripeBillPreSubmitPreview(p: StripeBillPreSubmitPreviewProps) {
  const copyBase = {
    customerName: p.customerName,
    payUrl: p.payUrlPlaceholder,
    amountLabel: p.amountLabel,
    jobName: p.jobName,
    hcpNumber: p.hcpNumber,
  }
  const emailText = buildStripeInvoiceEmailBody(copyBase)
  const smsText = buildStripeInvoiceSmsText(copyBase)

  return (
    <div
      style={{
        marginBottom: '1rem',
        padding: '0.75rem',
        borderRadius: 6,
        border: '1px solid #e5e7eb',
        background: '#f9fafb',
        fontSize: '0.8125rem',
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: '0.5rem', fontSize: '0.875rem', color: '#111827' }}>Preview</div>

      <div style={{ marginBottom: '0.65rem' }}>
        <div style={sectionTitle}>Invoice (Stripe)</div>
        <StripeInvoicePreviewMeta
          customerName={p.customerName}
          customerEmail={p.customerEmail}
          invoiceNumber={p.stripePreview?.invoice_number ?? null}
          dueYmd={p.dueDateYmd}
          memo={p.memo}
        />
        {p.stripePreviewLoading && <p style={{ margin: 0, color: '#6b7280', fontSize: '0.75rem' }}>Loading totals…</p>}
        {!p.stripePreviewLoading && p.stripePreviewError && (
          <p style={{ margin: '0 0 0.35rem', color: '#b45309', fontSize: '0.75rem' }}>
            Preview unavailable ({p.stripePreviewError}). Showing draft line below.
          </p>
        )}
        {!p.stripePreviewLoading && p.stripePreview && (
          <StripeInvoiceLinesSummary embedded showTitle={false} snapshot={p.stripePreview} />
        )}
        {!p.stripePreviewLoading && !p.stripePreview && !p.stripePreviewError && (
          <p style={{ margin: 0, color: '#6b7280', fontSize: '0.75rem' }}>
            {p.previewIdleHint?.trim() || 'Enter amount and due date to load preview.'}
          </p>
        )}
        <div style={{ marginTop: '0.35rem', fontSize: '0.72rem', color: '#6b7280' }}>
          Draft line: {p.localLineDescription}
        </div>
      </div>

      <div style={{ marginBottom: '0.65rem' }}>
        <div style={sectionTitle}>Payment link</div>
        <p style={{ margin: 0, fontSize: '0.72rem', color: '#6b7280' }}>
          The customer pay URL is created when you finalize the invoice in Stripe. Until then, use this placeholder in the
          messages below.
        </p>
        <pre style={{ ...preStyle, marginTop: '0.35rem' }}>{p.payUrlPlaceholder}</pre>
      </div>

      <div style={{ marginBottom: '0.65rem' }}>
        <div style={sectionTitle}>Email draft</div>
        <pre style={preStyle}>{emailText}</pre>
      </div>

      <div>
        <div style={sectionTitle}>SMS draft</div>
        <pre style={preStyle}>{smsText}</pre>
      </div>
    </div>
  )
}
