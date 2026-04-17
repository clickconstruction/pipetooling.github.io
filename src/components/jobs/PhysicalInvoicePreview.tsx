import type { CSSProperties } from 'react'
import type { PhysicalInvoiceDocument } from '../../lib/physicalInvoiceDocument'

const metaLabel: CSSProperties = {
  padding: '0.15rem 0.75rem 0.15rem 0',
  verticalAlign: 'top',
  color: '#6b7280',
  fontSize: '0.72rem',
  fontWeight: 500,
  whiteSpace: 'nowrap',
}

const metaValue: CSSProperties = {
  padding: '0.15rem 0',
  verticalAlign: 'top',
  fontSize: '0.875rem',
  color: '#111827',
  wordBreak: 'break-word',
}

const heroAmount: CSSProperties = {
  fontSize: '1.35rem',
  fontWeight: 700,
  color: '#111827',
}

const tableHead: CSSProperties = {
  textAlign: 'left',
  fontSize: '0.65rem',
  fontWeight: 600,
  color: '#4b5563',
  padding: '0.35rem 0.25rem',
  borderBottom: '1px solid #e5e7eb',
  background: '#f9fafb',
}

const tableCell: CSSProperties = {
  fontSize: '0.78rem',
  padding: '0.35rem 0.25rem',
  borderBottom: '1px solid #f3f4f6',
  verticalAlign: 'top',
}

const lineItemDescCell: CSSProperties = {
  ...tableCell,
  padding: '0.45rem 0.25rem',
  verticalAlign: 'top',
  whiteSpace: 'pre-wrap',
}

const lineItemNumCell: CSSProperties = {
  ...tableCell,
  padding: '0.45rem 0.25rem',
  verticalAlign: 'middle',
  textAlign: 'right',
}

const lineItemsSectionTitleTh: CSSProperties = {
  ...tableHead,
  width: '48%',
  fontSize: '0.72rem',
  fontWeight: 600,
  color: '#374151',
  textAlign: 'left',
}

function LineItemsTable({
  title,
  rows,
  mergeTitleIntoHeader = false,
}: {
  title: string
  rows: Array<{ description: string; qty: number; unitPrice: number; amount: number }>
  mergeTitleIntoHeader?: boolean
}) {
  if (!rows.length) return null
  return (
    <div style={{ marginTop: '0.65rem' }}>
      {!mergeTitleIntoHeader ? (
        <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>{title}</div>
      ) : null}
      <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #e5e7eb' }}>
        <thead>
          <tr>
            <th style={mergeTitleIntoHeader ? lineItemsSectionTitleTh : { ...tableHead, width: '48%' }}>
              {mergeTitleIntoHeader ? title : 'Description'}
            </th>
            <th style={{ ...tableHead, textAlign: 'right', width: '10%' }}>Qty</th>
            <th style={{ ...tableHead, textAlign: 'right', width: '21%' }}>Unit</th>
            <th style={{ ...tableHead, textAlign: 'right', width: '21%' }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={`${title}-${i}`}>
              <td style={lineItemDescCell}>{r.description}</td>
              <td style={lineItemNumCell}>{r.qty}</td>
              <td style={lineItemNumCell}>
                {r.unitPrice.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
              </td>
              <td style={lineItemNumCell}>
                {r.amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function PhysicalInvoicePreview({ document: d }: { document: PhysicalInvoiceDocument }) {
  if (d.layout === 'detailed') {
    const issuer = (d.issuer.companyName ?? '').trim()
    const taglineTrim = (d.issuer.tagline ?? '').trim()
    const licenseTrim = (d.issuer.licenseLine ?? '').trim()
    const hasIssuerTail = Boolean(taglineTrim || licenseTrim)
    const hasLegal = Boolean(d.footer.trim())
    return (
      <div
        style={{
          background: '#f9fafb',
          border: '1px solid #e5e7eb',
          borderRadius: 8,
          padding: '0.75rem 1rem',
          marginBottom: '0.75rem',
        }}
      >
        <div
          style={{
            fontSize: '0.875rem',
            fontWeight: 600,
            color: '#111827',
            marginBottom: '0.65rem',
            textAlign: 'center',
          }}
        >
          Invoice (PDF preview)
        </div>
        {issuer ? (
          <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#111827', marginBottom: 6 }}>{issuer}</div>
        ) : null}
        <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#111827', marginBottom: '0.65rem' }}>INVOICE</div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 160px', minWidth: 0 }}>
            {d.narrativeTitle.trim() ? (
              <div style={{ fontSize: '0.875rem', color: '#111827', whiteSpace: 'pre-wrap', lineHeight: 1.35 }}>
                {d.narrativeTitle}
              </div>
            ) : null}
            {d.serviceAddress ? (
              <div
                style={{
                  marginTop: '0.35rem',
                  paddingTop: '0.35rem',
                  borderTop: '1px solid #e5e7eb',
                }}
              >
                <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                  SERVICE ADDRESS
                </div>
                <div style={{ fontSize: '0.8125rem', color: '#111827', whiteSpace: 'pre-wrap' }}>{d.serviceAddress}</div>
              </div>
            ) : null}
            {d.customerName || d.customerEmail || d.customerPhone ? (
              <div
                style={{
                  marginTop: '0.35rem',
                  paddingTop: '0.35rem',
                  borderTop: '1px solid #e5e7eb',
                }}
              >
                <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#374151', marginBottom: 4 }}>CONTACT</div>
                <div style={{ fontSize: '0.8125rem', color: '#111827' }}>{d.customerName}</div>
                {d.customerEmail ? <div style={{ fontSize: '0.8125rem', color: '#111827' }}>{d.customerEmail}</div> : null}
                {d.customerPhone ? <div style={{ fontSize: '0.8125rem', color: '#111827' }}>{d.customerPhone}</div> : null}
              </div>
            ) : null}
          </div>
          <div style={{ flex: '0 0 auto', minWidth: 140, alignSelf: 'flex-start' }}>
            <table
              style={{
                borderCollapse: 'collapse',
                fontSize: '0.72rem',
                width: 'max-content',
                maxWidth: '100%',
              }}
            >
              <tbody>
                <tr>
                  <td style={{ ...metaLabel, padding: '0.2rem 0.5rem 0.2rem 0' }}>Invoice</td>
                  <td style={{ ...metaValue, padding: '0.2rem 0' }}>{d.invoiceNumberDisplay}</td>
                </tr>
                <tr>
                  <td style={{ ...metaLabel, padding: '0.2rem 0.5rem 0.2rem 0' }}>Service date</td>
                  <td style={{ ...metaValue, padding: '0.2rem 0' }}>{d.serviceDateDisplay}</td>
                </tr>
                <tr>
                  <td style={{ ...metaLabel, padding: '0.2rem 0.5rem 0.2rem 0' }}>Payment terms</td>
                  <td style={{ ...metaValue, padding: '0.2rem 0' }}>{d.paymentTerms}</td>
                </tr>
                <tr>
                  <td style={{ ...metaLabel, padding: '0.2rem 0.5rem 0.2rem 0' }}>Due date</td>
                  <td style={{ ...metaValue, padding: '0.2rem 0' }}>{d.dueDateDisplay}</td>
                </tr>
                <tr>
                  <td
                    style={{
                      ...metaLabel,
                      padding: '0.35rem 0.5rem 0.2rem 0',
                      borderTop: '1px solid #000',
                    }}
                  >
                    Amount due
                  </td>
                  <td
                    style={{
                      ...metaValue,
                      padding: '0.35rem 0 0.2rem 0',
                      fontWeight: 700,
                      borderTop: '1px solid #000',
                    }}
                  >
                    {d.amountFormatted}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {(d.issuer.addressText ?? '').trim() || d.issuer.phone || d.issuer.email ? (
          <div style={{ marginTop: '0.65rem', fontSize: '0.78rem', color: '#374151', lineHeight: 1.35 }}>
            {(d.issuer.addressText ?? '').split('\n').map((line, i) => (
              <div key={i}>{line}</div>
            ))}
            {d.issuer.phone ? <div>{d.issuer.phone}</div> : null}
            {d.issuer.email ? <div>{d.issuer.email}</div> : null}
          </div>
        ) : null}

        <LineItemsTable title="Services" rows={d.serviceLines} mergeTitleIntoHeader />
        <LineItemsTable title="Materials" rows={d.materialLines} />

        <div style={{ marginTop: '0.5rem', fontSize: '0.8125rem', color: '#111827' }}>
          <strong>Subtotal:</strong> {d.subtotalFormatted}
        </div>
        <div style={{ marginTop: 4, fontSize: '0.8125rem', fontWeight: 600, color: '#111827' }}>
          Amount due: {d.amountFormatted}
        </div>

        {d.paymentHistory.length > 0 ? (
          <div style={{ marginTop: '0.65rem', paddingTop: '0.65rem', borderTop: '1px solid #e5e7eb' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#374151', marginBottom: 4 }}>Payment history</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
              <tbody>
                {d.paymentHistory.map((p, i) => (
                  <tr key={i}>
                    <td style={{ padding: '0.25rem 0', color: '#374151' }}>{p.dateDisplay}</td>
                    <td style={{ padding: '0.25rem 0', color: '#111827' }}>{p.method}</td>
                    <td style={{ padding: '0.25rem 0', textAlign: 'right' }}>{p.amountFormatted}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {d.memo ? (
          <div style={{ marginTop: '0.65rem', paddingTop: '0.65rem', borderTop: '1px solid #e5e7eb' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#374151', marginBottom: 4 }}>Memo</div>
            <div style={{ fontSize: '0.875rem', color: '#111827', whiteSpace: 'pre-wrap', lineHeight: 1.35 }}>{d.memo}</div>
          </div>
        ) : null}

        {hasIssuerTail || hasLegal ? (
          <div style={{ marginTop: '0.65rem' }}>
            {taglineTrim ? (
              <div
                style={{
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: '#111827',
                  whiteSpace: 'pre-wrap',
                  lineHeight: 1.35,
                  marginBottom: licenseTrim ? '0.35rem' : hasLegal ? '0.35rem' : 0,
                }}
              >
                {taglineTrim}
              </div>
            ) : null}
            {licenseTrim ? (
              <div
                style={{
                  fontSize: '0.8125rem',
                  color: '#111827',
                  whiteSpace: 'pre-wrap',
                  lineHeight: 1.35,
                  marginBottom: hasLegal ? '0.5rem' : 0,
                }}
              >
                {licenseTrim}
              </div>
            ) : null}
            {hasLegal ? (
              <>
                <div
                  style={{
                    width: '100%',
                    height: 3,
                    background: '#d1d5db',
                    borderRadius: 1,
                    marginBottom: '0.5rem',
                  }}
                  aria-hidden
                />
                <div style={{ fontSize: '0.875rem', color: '#111827', whiteSpace: 'pre-wrap', lineHeight: 1.35 }}>
                  {d.footer}
                </div>
              </>
            ) : null}
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div
      style={{
        background: '#f9fafb',
        border: '1px solid #e5e7eb',
        borderRadius: 8,
        padding: '0.75rem 1rem',
        marginBottom: '0.75rem',
      }}
    >
      <div
        style={{
          fontSize: '0.875rem',
          fontWeight: 600,
          color: '#111827',
          marginBottom: '0.65rem',
          textAlign: 'center',
        }}
      >
        Invoice (PDF preview)
      </div>
      <div style={{ textAlign: 'center', marginBottom: '0.65rem' }}>
        <span style={heroAmount}>{d.amountFormatted}</span>
        <span style={{ display: 'block', fontSize: '0.75rem', color: '#6b7280', marginTop: 4 }}>Amount due</span>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
        <tbody>
          <tr>
            <td style={metaLabel}>Bill to</td>
            <td style={metaValue}>{d.customerName}</td>
          </tr>
          <tr>
            <td style={metaLabel}>Email</td>
            <td style={metaValue}>{d.customerEmail || '—'}</td>
          </tr>
          <tr>
            <td style={metaLabel}>Job</td>
            <td style={metaValue}>{d.jobName}</td>
          </tr>
          <tr>
            <td style={metaLabel}>Job #</td>
            <td style={metaValue}>{d.hcpLabel}</td>
          </tr>
          <tr>
            <td style={metaLabel}>Invoice date</td>
            <td style={metaValue}>{d.invoiceDateDisplay}</td>
          </tr>
          <tr>
            <td style={metaLabel}>Due date</td>
            <td style={metaValue}>{d.dueDateDisplay}</td>
          </tr>
        </tbody>
      </table>
      {d.lineDescription.trim() ? (
        <div style={{ marginTop: '0.65rem', paddingTop: '0.65rem', borderTop: '1px solid #e5e7eb' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#374151', marginBottom: 4 }}>Description</div>
          <div style={{ fontSize: '0.875rem', color: '#111827', whiteSpace: 'pre-wrap', lineHeight: 1.35 }}>
            {d.lineDescription}
          </div>
        </div>
      ) : null}
      {d.memo ? (
        <div style={{ marginTop: '0.65rem', paddingTop: '0.65rem', borderTop: '1px solid #e5e7eb' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#374151', marginBottom: 4 }}>Memo</div>
          <div style={{ fontSize: '0.875rem', color: '#111827', whiteSpace: 'pre-wrap', lineHeight: 1.35 }}>{d.memo}</div>
        </div>
      ) : null}
      {d.footer ? (
        <div style={{ marginTop: '0.65rem' }}>
          <div
            style={{
              width: '100%',
              height: 3,
              background: '#d1d5db',
              borderRadius: 1,
              marginBottom: '0.5rem',
            }}
            aria-hidden
          />
          <div style={{ fontSize: '0.875rem', color: '#111827', whiteSpace: 'pre-wrap', lineHeight: 1.35 }}>{d.footer}</div>
        </div>
      ) : null}
    </div>
  )
}
