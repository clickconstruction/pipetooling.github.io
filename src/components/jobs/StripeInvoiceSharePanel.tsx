import type { CSSProperties } from 'react'
import { useToastContext } from '../../contexts/ToastContext'
import {
  buildStripeInvoiceEmailBody,
  buildStripeInvoiceEmailSubject,
  buildStripeInvoiceSmsText,
} from '../../lib/stripeInvoiceShareCopy'

export type StripeInvoiceSharePanelProps = {
  hostedInvoiceUrl: string
  stripeInvoiceId: string
  customerEmail: string | null
  customerName: string | null
  jobName: string | null
  hcpNumber: string | null
  /** e.g. "$1,234.56" */
  amountLabel: string
  /** Tighter layout for nested UIs */
  compact?: boolean
}

function shareCopyFromProps(p: StripeInvoiceSharePanelProps) {
  return {
    customerName: p.customerName,
    payUrl: p.hostedInvoiceUrl,
    amountLabel: p.amountLabel,
    jobName: p.jobName,
    hcpNumber: p.hcpNumber,
  }
}

async function copyText(text: string, showToast: (m: string, t?: 'info' | 'error' | 'success' | 'warning') => void, okMsg: string) {
  try {
    await navigator.clipboard.writeText(text)
    showToast(okMsg, 'success')
  } catch {
    showToast('Could not copy to clipboard', 'error')
  }
}

export function StripeInvoiceSharePanel(p: StripeInvoiceSharePanelProps) {
  const { showToast } = useToastContext()
  const url = p.hostedInvoiceUrl.trim()
  const dashUrl = `https://dashboard.stripe.com/invoices/${encodeURIComponent(p.stripeInvoiceId.trim())}`
  const pad = p.compact ? '0.35rem' : '0.5rem'
  const btnStyle: CSSProperties = {
    padding: `${pad} 0.65rem`,
    fontSize: p.compact ? '0.75rem' : '0.8125rem',
    borderRadius: 4,
    border: '1px solid #d1d5db',
    background: 'white',
    cursor: 'pointer',
    color: '#374151',
    fontWeight: 500,
  }

  return (
    <div
      style={{
        marginTop: p.compact ? 6 : 8,
        padding: p.compact ? '0.5rem' : '0.75rem',
        borderRadius: 6,
        border: '1px solid #e5e7eb',
        background: '#fafafa',
        fontSize: p.compact ? '0.75rem' : '0.8125rem',
      }}
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', alignItems: 'center' }}>
        <button
          type="button"
          onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
          style={{ ...btnStyle, borderColor: '#2563eb', color: '#1d4ed8' }}
        >
          Customer pay page
        </button>
        <button type="button" onClick={() => window.open(dashUrl, '_blank', 'noopener,noreferrer')} style={btnStyle}>
          Open in Stripe
        </button>
        <button
          type="button"
          onClick={() => void copyText(url, showToast, 'Payment link copied')}
          style={btnStyle}
        >
          Copy payment link
        </button>
        <button
          type="button"
          onClick={() =>
            void copyText(buildStripeInvoiceSmsText(shareCopyFromProps(p)), showToast, 'Text message draft copied — paste into SMS')
          }
          style={btnStyle}
        >
          Copy text for SMS
        </button>
      </div>
      {(p.customerEmail ?? '').trim() ? (
        <div style={{ marginTop: '0.5rem' }}>
          <button
            type="button"
            onClick={() => {
              const to = encodeURIComponent((p.customerEmail ?? '').trim())
              const subject = encodeURIComponent(buildStripeInvoiceEmailSubject(p.jobName))
              const body = encodeURIComponent(buildStripeInvoiceEmailBody(shareCopyFromProps(p)))
              window.location.href = `mailto:${to}?subject=${subject}&body=${body}`
            }}
            style={{
              ...btnStyle,
              borderColor: '#16a34a',
              color: '#15803d',
            }}
          >
            Send email…
          </button>
        </div>
      ) : (
        <p style={{ margin: '0.35rem 0 0', fontSize: '0.75rem', color: '#6b7280' }}>
          Add a customer email on the job to use “Send email…”
        </p>
      )}
    </div>
  )
}
