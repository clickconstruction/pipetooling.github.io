/**
 * Margin breakdown — the per-row dialog behind a Pricing grid row (Pricing decomposition
 * PR 2, v2.3547). Moved verbatim out of `BidsPricingTab` (region P3 of the map): a
 * self-contained snapshot payload, so the dialog never reads live engine state. The jump
 * chips (v2.2400) render only when the tab hands in `onJumpToTab`, which it does while a bid
 * is selected; the dialog closes itself before the jump.
 */
import type { CSSProperties } from 'react'
import { marginFlag } from '../../lib/bids/bidFormatting'
import { formatCurrency } from '../../lib/format'

export type PricingBreakdownRow = {
  /** The count row behind this line — the jump chips' landing key (v2.2400). */
  countRowId: string
  fixture: string
  count: number
  unitPrice: number
  isFixedPrice: boolean
  revenue: number
  materialsBeforeTax: number
  taxAmount: number
  taxPercent: number
  laborCost: number
  cost: number
  margin: number | null
  materialsFromTakeoff: number | null
}

export type PricingBreakdownJumpTab = 'counts' | 'takeoffs' | 'labor'

export function PricingMarginBreakdownModal({
  row,
  onClose,
  onJumpToTab,
}: {
  row: PricingBreakdownRow
  onClose: () => void
  /** Present while a bid is selected: land on this fixture's row on the Counts / Takeoffs / Labor tab. */
  onJumpToTab?: (tab: PricingBreakdownJumpTab, ref: { countRowId: string; fixture: string }) => void
}) {
  const b = row
  const profit = b.revenue - b.cost
  const marginPct = b.revenue > 0 ? (profit / b.revenue) * 100 : null
  const uncosted = b.materialsFromTakeoff == null || b.materialsFromTakeoff === 0
  const flag = marginFlag(marginPct)
  // Per-unit column only earns its space when the count actually multiplies something.
  const showPerUnit = b.count > 1
  const perUnit = (total: number) => (b.count > 0 ? total / b.count : total)
  const columnCount = showPerUnit ? 3 : 2
  const profitColor = profit < 0 ? 'var(--text-red-600)' : 'var(--text-green-600)'
  const band =
    flag === 'red' ?
      { bg: 'var(--bg-red-tint)', border: 'var(--border-red)', text: 'var(--text-red-800)' }
    : flag === 'yellow' ?
      { bg: 'var(--bg-amber-tint)', border: 'var(--border-amber-soft)', text: 'var(--text-amber-800)' }
    : flag === 'green' ?
      { bg: 'var(--bg-green-tint)', border: 'var(--border-green)', text: 'var(--text-green-800)' }
    : { bg: 'var(--bg-subtle)', border: 'var(--border)', text: undefined }
  const sectionLabelStyle: CSSProperties = {
    padding: '0.8rem 0 0.3rem',
    fontSize: '0.6875rem',
    fontWeight: 700,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    color: 'var(--text-faint)',
    textAlign: 'left',
  }
  const labelStyle: CSSProperties = { padding: '0.2rem 0', color: 'var(--text-muted)', textAlign: 'left' }
  const moneyStyle: CSSProperties = {
    padding: '0.2rem 0 0.2rem 1rem',
    textAlign: 'right',
    whiteSpace: 'nowrap',
  }
  const subtotalLabelStyle: CSSProperties = {
    padding: '0.35rem 0',
    fontWeight: 600,
    textAlign: 'left',
    borderTop: '1px solid var(--border)',
  }
  const subtotalMoneyStyle: CSSProperties = {
    ...moneyStyle,
    padding: '0.35rem 0 0.35rem 1rem',
    borderTop: '1px solid var(--border)',
  }
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pricing-breakdown-title"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={() => onClose()}
    >
      <div
        style={{
          background: 'var(--surface)',
          borderRadius: 8,
          padding: '1.1rem 1.4rem',
          minWidth: 340,
          maxWidth: 440,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '0.75rem' }}>
          <h2 id="pricing-breakdown-title" style={{ margin: 0, fontSize: '1rem' }}>
            Margin breakdown: {b.fixture}
          </h2>
          <span
            style={{
              fontSize: '0.72rem',
              color: 'var(--text-muted)',
              background: 'var(--bg-subtle)',
              borderRadius: 999,
              padding: '0.15rem 0.6rem',
              whiteSpace: 'nowrap',
            }}
          >
            {b.count} unit{b.count === 1 ? '' : 's'}
          </span>
        </div>

        {/* Jump chips: straight to the tabs this row's numbers come from. */}
        {onJumpToTab ? (
          <div style={{ display: 'flex', gap: '0.4rem', margin: '0.55rem 0 0.1rem' }}>
            {(
              [
                ['counts', '# Counts'],
                ['takeoffs', '📐 Takeoffs'],
                ['labor', '🛠 Labor'],
              ] as const
            ).map(([tab, label]) => (
              <button
                key={tab}
                type="button"
                onClick={() => {
                  onClose()
                  // v2.2400 (Wendi): land on this fixture's row over there — scroll + flash.
                  onJumpToTab(tab, { countRowId: b.countRowId, fixture: b.fixture })
                }}
                title={`Open this bid's ${label.slice(label.indexOf(' ') + 1)} tab and show this fixture's row`}
                style={{ font: 'inherit', fontSize: '0.72rem', fontWeight: 600, padding: '0.15rem 0.6rem', borderRadius: 999, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                {label}
              </button>
            ))}
          </div>
        ) : null}

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
          {showPerUnit && (
            <thead>
              <tr>
                <th />
                <th style={{ ...moneyStyle, fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-faint)', paddingTop: '0.5rem' }}>
                  Per unit
                </th>
                <th style={{ ...moneyStyle, fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-faint)', paddingTop: '0.5rem' }}>
                  {b.isFixedPrice ? 'Total' : `Total (× ${b.count})`}
                </th>
              </tr>
            </thead>
          )}
          <tbody>
            <tr>
              <td colSpan={columnCount} style={sectionLabelStyle}>Revenue</td>
            </tr>
            <tr>
              <td style={labelStyle}>Sale Price{b.isFixedPrice ? ' (fixed)' : ''}</td>
              {showPerUnit && (
                <td style={moneyStyle}>{b.isFixedPrice ? '—' : `$${formatCurrency(b.unitPrice)}`}</td>
              )}
              <td style={{ ...moneyStyle, fontWeight: 600 }}>${formatCurrency(b.revenue)}</td>
            </tr>
            {b.isFixedPrice && (
              <tr>
                <td colSpan={columnCount} style={{ padding: '0.1rem 0', color: 'var(--text-faint)', fontSize: '0.8125rem' }}>
                  Fixed price — not multiplied by count
                </td>
              </tr>
            )}
            <tr>
              <td colSpan={columnCount} style={sectionLabelStyle}>Our cost</td>
            </tr>
            <tr>
              <td style={labelStyle}>
                Materials {b.materialsFromTakeoff != null ? '(from Takeoffs)' : '(proportional)'}
              </td>
              {showPerUnit && <td style={moneyStyle}>${formatCurrency(perUnit(b.materialsBeforeTax))}</td>}
              <td style={moneyStyle}>${formatCurrency(b.materialsBeforeTax)}</td>
            </tr>
            {b.taxAmount > 0 && (
              <tr>
                <td style={labelStyle}>Tax ({b.taxPercent}%)</td>
                {showPerUnit && <td style={moneyStyle}>${formatCurrency(perUnit(b.taxAmount))}</td>}
                <td style={moneyStyle}>${formatCurrency(b.taxAmount)}</td>
              </tr>
            )}
            <tr>
              <td style={{ ...labelStyle, paddingBottom: '0.45rem' }}>Labor</td>
              {showPerUnit && (
                <td style={{ ...moneyStyle, paddingBottom: '0.45rem' }}>${formatCurrency(perUnit(b.laborCost))}</td>
              )}
              <td style={{ ...moneyStyle, paddingBottom: '0.45rem' }}>${formatCurrency(b.laborCost)}</td>
            </tr>
            <tr>
              <td style={subtotalLabelStyle}>Our cost</td>
              {showPerUnit && <td style={subtotalMoneyStyle}>${formatCurrency(perUnit(b.cost))}</td>}
              <td style={{ ...subtotalMoneyStyle, fontWeight: 600 }}>${formatCurrency(b.cost)}</td>
            </tr>
            <tr>
              <td style={subtotalLabelStyle}>Profit</td>
              {showPerUnit && (
                <td style={{ ...subtotalMoneyStyle, color: profitColor }}>${formatCurrency(perUnit(profit))}</td>
              )}
              <td style={{ ...subtotalMoneyStyle, fontWeight: 600, color: profitColor }}>
                ${formatCurrency(profit)}
              </td>
            </tr>
          </tbody>
        </table>

        <div
          style={{
            marginTop: '1rem',
            padding: '0.6rem 0.9rem',
            background: band.bg,
            border: `1px solid ${band.border}`,
            borderRadius: 6,
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: '1rem',
            color: band.text,
          }}
        >
          <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>
            Margin <span style={{ fontWeight: 400, fontSize: '0.75rem' }}>(Profit ÷ Revenue)</span>
          </span>
          <span style={{ fontSize: '1.1rem', fontWeight: 700 }}>
            {marginPct != null ? `${marginPct.toFixed(1)}%` : '—'}
          </span>
        </div>

        {uncosted && (
          <p
            style={{
              margin: '1rem 0 0',
              padding: '0.6rem 0.75rem',
              background: 'var(--bg-amber-tint)',
              border: '1px solid var(--border-amber-soft)',
              borderRadius: 6,
              fontSize: '0.8125rem',
              color: 'var(--text-amber-800)',
            }}
          >
            This fixture has no Takeoffs cost, so the grid shows “—” for its margin. The figures
            above use only the costs entered so far — the real margin will be lower once you add this
            fixture’s parts in Takeoffs.
          </p>
        )}

        <button
          type="button"
          onClick={() => onClose()}
          style={{ marginTop: '1rem', padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', width: '100%' }}
        >
          Close
        </button>
      </div>
    </div>
  )
}
