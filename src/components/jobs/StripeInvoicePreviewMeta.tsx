import type { CSSProperties } from 'react'

const labelCell: CSSProperties = {
  padding: '0.15rem 0.75rem 0.15rem 0',
  verticalAlign: 'top',
  color: '#6b7280',
  fontSize: '0.72rem',
  fontWeight: 500,
  whiteSpace: 'nowrap',
}

const valueCell: CSSProperties = {
  padding: '0.15rem 0',
  verticalAlign: 'top',
  fontSize: '0.75rem',
  color: '#111827',
  wordBreak: 'break-word',
}

export type StripeInvoicePreviewMetaProps = {
  customerName: string | null
  customerEmail: string | null
  /** Stripe invoice number without # prefix; shown as #… when set */
  invoiceNumber: string | null
  dueYmd?: string | null
  memo?: string | null
  footer?: string | null
}

export function StripeInvoicePreviewMeta(p: StripeInvoicePreviewMetaProps) {
  const name = (p.customerName ?? '').trim() || '—'
  const email = (p.customerEmail ?? '').trim()
  const invRaw = (p.invoiceNumber ?? '').trim()
  const inv = invRaw ? `#${invRaw}` : '—'
  const due = (p.dueYmd ?? '').trim()
  const memo = (p.memo ?? '').trim()
  const footer = (p.footer ?? '').trim()

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '0.5rem' }}>
      <tbody>
        <tr>
          <td style={labelCell}>To</td>
          <td style={valueCell}>
            {name}
            {email ? (
              <>
                <br />
                <span style={{ color: '#4b5563', fontSize: '0.72rem' }}>{email}</span>
              </>
            ) : null}
          </td>
        </tr>
        <tr>
          <td style={labelCell}>Invoice</td>
          <td style={valueCell}>{inv}</td>
        </tr>
        {due ? (
          <tr>
            <td style={labelCell}>Due</td>
            <td style={valueCell}>{due}</td>
          </tr>
        ) : null}
        {memo ? (
          <tr>
            <td style={labelCell}>Memo</td>
            <td style={valueCell}>{memo}</td>
          </tr>
        ) : null}
        {footer ? (
          <tr>
            <td style={labelCell}>Footer</td>
            <td style={valueCell}>{footer}</td>
          </tr>
        ) : null}
      </tbody>
    </table>
  )
}
