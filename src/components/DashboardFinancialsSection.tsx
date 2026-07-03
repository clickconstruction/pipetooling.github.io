import { useState } from 'react'
import { Link } from 'react-router-dom'
import { formatCurrency } from '../lib/format'
import { useDashboardFinancials } from '../hooks/useDashboardFinancials'
import type { FinancialBucket, FinancialItem } from '../lib/dashboardFinancials'

type CardKey = 'ar' | 'ap' | 'unbilled'

const CARD_META: Record<CardKey, { title: string; hint: string; linkTo: string; linkLabel: string }> = {
  ar: {
    title: 'Accounts Receivable',
    hint: 'Open balances on billed invoices and billed jobs — money owed to us.',
    linkTo: '/jobs?tab=stages',
    linkLabel: 'Open Jobs Stages',
  },
  ap: {
    title: 'Accounts Payable',
    hint: 'Unpaid supply-house invoices plus open payroll balances — money we owe.',
    linkTo: '/materials?tab=supply-houses',
    linkLabel: 'Open Supply Houses',
  },
  unbilled: {
    title: 'Not Billed Out',
    hint: 'Working and Ready-to-Bill jobs whose revenue is not yet on a billed customer invoice.',
    linkTo: '/jobs?tab=stages',
    linkLabel: 'Open Jobs Stages',
  },
}

function shortDate(ymd: string | null): string {
  if (!ymd) return '—'
  const d = new Date(ymd + 'T12:00:00')
  if (Number.isNaN(d.getTime())) return '—'
  return `${d.getMonth() + 1}/${d.getDate()}/${String(d.getFullYear()).slice(2)}`
}

function ItemsModal({
  cardKey,
  bucket,
  onClose,
}: {
  cardKey: CardKey
  bucket: FinancialBucket
  onClose: () => void
}) {
  const meta = CARD_META[cardKey]
  return (
    <div
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1100,
        padding: '1rem',
        boxSizing: 'border-box',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="dashboard-financials-modal-title"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose()
        }}
        style={{
          background: 'white',
          borderRadius: 8,
          maxWidth: 640,
          width: '100%',
          maxHeight: '85vh',
          overflow: 'auto',
          boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
        }}
      >
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <h3 id="dashboard-financials-modal-title" style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600 }}>
              {meta.title} — ${formatCurrency(bucket.total)}
            </h3>
            <p style={{ margin: '0.35rem 0 0', fontSize: '0.8125rem', color: '#6b7280' }}>
              {bucket.count} item{bucket.count === 1 ? '' : 's'} · {meta.hint}
            </p>
          </div>
          <Link to={meta.linkTo} style={{ fontSize: '0.8125rem', color: '#2563eb', whiteSpace: 'nowrap' }}>
            {meta.linkLabel} →
          </Link>
          <button
            type="button"
            onClick={onClose}
            title="Close"
            aria-label="Close"
            style={{ padding: '0.35rem 0.65rem', background: 'white', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer', fontSize: '0.875rem' }}
          >
            ×
          </button>
        </div>
        <div style={{ padding: '0.75rem 1.25rem 1rem' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                <th style={{ padding: '0.5rem 0.65rem', textAlign: 'left' }}>Item</th>
                <th style={{ padding: '0.5rem 0.65rem', textAlign: 'left' }}>Date</th>
                <th style={{ padding: '0.5rem 0.65rem', textAlign: 'right' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {bucket.items.map((item: FinancialItem) => (
                <tr key={item.key} style={{ borderBottom: '1px solid #f3f4f6', verticalAlign: 'top' }}>
                  <td style={{ padding: '0.45rem 0.65rem' }}>
                    {item.label}
                    {item.sublabel ? (
                      <span style={{ color: '#9ca3af', fontSize: '0.75rem' }}> · {item.sublabel}</span>
                    ) : null}
                  </td>
                  <td style={{ padding: '0.45rem 0.65rem', whiteSpace: 'nowrap' }}>{shortDate(item.dateYmd)}</td>
                  <td style={{ padding: '0.45rem 0.65rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                    ${formatCurrency(item.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: '2px solid #e5e7eb', fontWeight: 600 }}>
                <td style={{ padding: '0.5rem 0.65rem' }} colSpan={2}>
                  Total
                </td>
                <td style={{ padding: '0.5rem 0.65rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  ${formatCurrency(bucket.total)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  )
}

/** Dashboard "Financials" one-pager: AR / AP / Not billed cards with drill-down modals. */
export default function DashboardFinancialsSection() {
  const { data, loading, error } = useDashboardFinancials(true)
  const [openCard, setOpenCard] = useState<CardKey | null>(null)

  const cards: Array<{ key: CardKey; bucket: FinancialBucket; extra?: string }> = data
    ? [
        { key: 'ar', bucket: data.ar },
        {
          key: 'ap',
          bucket: data.ap,
          extra: `Supplies $${formatCurrency(data.ap.supplyTotal)} · Payroll $${formatCurrency(data.ap.payrollTotal)}`,
        },
        { key: 'unbilled', bucket: data.unbilled },
      ]
    : []

  return (
    <div style={{ margin: '0 0 1.5rem' }}>
      <h2 style={{ fontSize: '1.125rem', margin: '0 0 0.75rem' }}>Financials</h2>
      {error ? (
        <p style={{ margin: 0, color: '#b91c1c', fontSize: '0.875rem' }}>{error}</p>
      ) : loading || !data ? (
        <p style={{ margin: 0, color: '#6b7280', fontSize: '0.875rem' }}>Loading…</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
          {cards.map(({ key, bucket, extra }) => (
            <button
              key={key}
              type="button"
              onClick={() => setOpenCard(key)}
              title={`${CARD_META[key].hint} Click for the item list.`}
              style={{
                textAlign: 'left',
                background: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: 8,
                padding: '0.85rem 1rem',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.25rem',
              }}
            >
              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#6b7280' }}>{CARD_META[key].title}</span>
              <span style={{ fontSize: '1.35rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                ${formatCurrency(bucket.total)}
              </span>
              <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                {bucket.count} item{bucket.count === 1 ? '' : 's'}
                {bucket.oldestDateYmd ? ` · oldest ${shortDate(bucket.oldestDateYmd)}` : ''}
              </span>
              {extra ? <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>{extra}</span> : null}
            </button>
          ))}
        </div>
      )}
      {openCard && data ? (
        <ItemsModal cardKey={openCard} bucket={data[openCard]} onClose={() => setOpenCard(null)} />
      ) : null}
    </div>
  )
}
