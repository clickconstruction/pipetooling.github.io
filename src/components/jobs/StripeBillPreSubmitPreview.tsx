import type { CSSProperties } from 'react'
import type { StripeInvoicePreviewSuccess } from '../../lib/stripeInvoicePreview'
import { formatStripeCents } from '../../lib/stripeInvoicePreview'
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
        {p.stripePreviewLoading && <p style={{ margin: 0, color: '#6b7280', fontSize: '0.75rem' }}>Loading totals…</p>}
        {!p.stripePreviewLoading && p.stripePreviewError && (
          <p style={{ margin: '0 0 0.35rem', color: '#b45309', fontSize: '0.75rem' }}>
            Preview unavailable ({p.stripePreviewError}). Showing draft line below.
          </p>
        )}
        {!p.stripePreviewLoading && p.stripePreview && (() => {
          const sp = p.stripePreview
          return (
          <div style={{ fontSize: '0.75rem', color: '#374151' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                {sp.lines.map((line, i) => (
                  <tr key={i}>
                    <td style={{ padding: '0.25rem 0', verticalAlign: 'top', wordBreak: 'break-word' }}>
                      {line.description || '—'}
                    </td>
                    <td style={{ padding: '0.25rem 0', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {formatStripeCents(line.amount, sp.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ marginTop: '0.35rem', paddingTop: '0.35rem', borderTop: '1px solid #e5e7eb', fontWeight: 600 }}>
              Total due: {formatStripeCents(sp.amount_due, sp.currency)}
            </div>
          </div>
          )
        })()}
        {!p.stripePreviewLoading && !p.stripePreview && !p.stripePreviewError && (
          <p style={{ margin: 0, color: '#6b7280', fontSize: '0.75rem' }}>Enter amount and due date to load preview.</p>
        )}
        <div style={{ marginTop: '0.35rem', fontSize: '0.72rem', color: '#6b7280' }}>
          Draft line: {p.localLineDescription}
        </div>
      </div>

      <div style={{ marginBottom: '0.65rem' }}>
        <div style={sectionTitle}>Bill to</div>
        <div style={{ fontSize: '0.75rem', color: '#374151' }}>
          {(p.customerName ?? '').trim() || '—'}
          <br />
          {(p.customerEmail ?? '').trim() || '—'}
        </div>
        <div style={{ marginTop: '0.25rem', fontSize: '0.72rem', color: '#6b7280' }}>
          Due: {p.dueDateYmd || '—'}
          {p.memo.trim() ? (
            <>
              <br />
              Memo: {p.memo.trim()}
            </>
          ) : null}
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
