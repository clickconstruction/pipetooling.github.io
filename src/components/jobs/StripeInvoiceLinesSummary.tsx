import type { CSSProperties } from 'react'
import type { StripeInvoiceLinesSnapshot } from '../../lib/stripeInvoicePreview'
import { formatStripeCents } from '../../lib/stripeInvoicePreview'

const sectionTitle: CSSProperties = {
  fontSize: '0.75rem',
  fontWeight: 600,
  color: 'var(--text-700)',
  margin: '0 0 0.35rem',
}

export type StripeInvoiceLinesSummaryProps = {
  snapshot: StripeInvoiceLinesSnapshot
  title?: string
  /** Match pre-submit preview card inner styling */
  embedded?: boolean
  /** When false, only the table + total are shown (parent supplies the section heading). */
  showTitle?: boolean
}

export function StripeInvoiceLinesSummary({
  snapshot,
  title = 'Invoice (Stripe)',
  embedded = false,
  showTitle = true,
}: StripeInvoiceLinesSummaryProps) {
  const sp = snapshot
  const inner = (
    <>
      {showTitle ? <div style={sectionTitle}>{title}</div> : null}
      <div style={{ fontSize: '0.75rem', color: 'var(--text-700)' }}>
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
        <div style={{ marginTop: '0.35rem', paddingTop: '0.35rem', borderTop: '1px solid var(--border)', fontWeight: 600 }}>
          Total due: {formatStripeCents(sp.amount_due, sp.currency)}
        </div>
      </div>
    </>
  )

  if (embedded) {
    return <div style={{ marginBottom: '0.65rem' }}>{inner}</div>
  }

  return (
    <div
      style={{
        padding: '0.75rem',
        borderRadius: 6,
        border: '1px solid var(--border)',
        background: 'var(--bg-subtle)',
        fontSize: '0.8125rem',
      }}
    >
      {inner}
    </div>
  )
}
