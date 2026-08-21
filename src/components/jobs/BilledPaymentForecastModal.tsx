import { useMemo } from 'react'
import type { StageRow } from '../../lib/jobsStagesBoard'
import type { PaySpeedData, PromisedPayDate } from '../../lib/jobs/billedExpectedPay'
import { formatYmdMonthDay } from '../../lib/jobs/billedExpectedPay'
import {
  buildBilledPaymentForecast,
  type ForecastBucket,
  type ForecastRow,
} from '../../lib/jobs/billedPaymentForecast'
import { formatUsdNoCents } from '../../lib/jobs/jobFormatting'

/**
 * "Payment forecast" on the Billed Awaiting Payment header: open dollars
 * bucketed by expected payment date (bill date + customer pay speed — the
 * expected-pay chips' model). Past-expected money is the follow-up queue;
 * the week buckets are the cash-in forecast. Click a row to jump the board
 * to that bill (the aging chart's jump).
 */

function bucketTileColors(b: ForecastBucket): { bg: string; fg: string; border: string } {
  if (b.key === 'past' && b.rows.length > 0) {
    return { bg: 'var(--bg-red-tint)', fg: 'var(--text-red-600)', border: 'transparent' }
  }
  if (b.key === 'thisWeek' && b.rows.length > 0) {
    return { bg: 'var(--bg-blue-tint)', fg: 'var(--text-blue-800)', border: 'transparent' }
  }
  return { bg: 'var(--surface)', fg: 'var(--text-700)', border: 'var(--border)' }
}

function rowDateLabel(r: ForecastRow): { text: string; color: string } {
  if (!r.model) return { text: 'no history', color: 'var(--text-muted)' }
  if (r.model.source === 'promised') {
    return r.model.state === 'late'
      ? { text: `${r.model.daysLate}d past promise`, color: 'var(--text-red-600)' }
      : { text: `✓ ${formatYmdMonthDay(r.model.expectedYmd)}`, color: 'var(--text-green-800)' }
  }
  if (r.model.state === 'late') return { text: `${r.model.daysLate}d late`, color: 'var(--text-red-600)' }
  return { text: `~${formatYmdMonthDay(r.model.expectedYmd)}`, color: 'var(--text-blue-800)' }
}

export default function BilledPaymentForecastModal({
  rows,
  paySpeeds,
  promises,
  todayYmd,
  onClose,
  onOpenInvoice,
}: {
  rows: StageRow[]
  paySpeeds: PaySpeedData | null
  promises?: Record<string, PromisedPayDate> | null
  todayYmd: string
  onClose: () => void
  onOpenInvoice: (invoiceId: string) => void
}) {
  const forecast = useMemo(
    () => buildBilledPaymentForecast(rows, paySpeeds, todayYmd, promises),
    [rows, paySpeeds, todayYmd, promises],
  )
  const visibleBuckets = forecast.buckets.filter((b) => b.key !== 'unknown' || b.rows.length > 0)

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Billed Awaiting Payment payment forecast"
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--surface)', padding: '1.25rem 1.5rem', borderRadius: 8, width: 'min(880px, calc(100vw - 2rem))', maxHeight: '92vh', overflow: 'auto' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.125rem' }}>Payment forecast</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.25rem', color: 'var(--text-muted)', padding: 4 }}
          >
            ×
          </button>
        </div>
        <p style={{ margin: '0.25rem 0 0.9rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          Open billed dollars by expected payment date — the bill date plus each customer's median pay speed (last 12
          months). Click a row to jump to its bill on the board.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(125px, 1fr))', gap: '0.6rem' }}>
          {visibleBuckets.map((b) => {
            const c = bucketTileColors(b)
            return (
              <div key={b.key} style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 8, padding: '0.6rem 0.75rem', opacity: b.rows.length === 0 ? 0.55 : 1 }}>
                <div style={{ fontSize: '0.75rem', color: c.fg }}>{b.title}</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 650, color: c.fg, fontVariantNumeric: 'tabular-nums' }}>
                  {formatUsdNoCents(b.sum)}
                </div>
                <div style={{ fontSize: '0.72rem', color: c.fg }}>
                  {b.rows.length} {b.rows.length === 1 ? 'bill' : 'bills'}
                  {b.key === 'past' && b.rows.length > 0 ? ' · follow up' : ''}
                </div>
              </div>
            )
          })}
        </div>

        {visibleBuckets
          .filter((b) => b.rows.length > 0)
          .map((b) => (
            <div key={b.key} style={{ marginTop: '1rem' }}>
              <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-700)', borderBottom: '1px solid var(--border)', paddingBottom: '0.25rem' }}>
                {b.title} · {formatUsdNoCents(b.sum)}
              </div>
              {b.rows.map((r) => {
                const d = rowDateLabel(r)
                return (
                  <button
                    key={r.invoiceId}
                    type="button"
                    onClick={() => onOpenInvoice(r.invoiceId)}
                    title="Jump to this bill on the board"
                    style={{
                      display: 'flex',
                      width: '100%',
                      alignItems: 'baseline',
                      justifyContent: 'space-between',
                      gap: '0.75rem',
                      padding: '0.4rem 0.25rem',
                      border: 'none',
                      borderBottom: '1px solid var(--border)',
                      background: 'none',
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontSize: '0.8125rem',
                      color: 'inherit',
                    }}
                  >
                    <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.label}
                      {r.customerName ? <span style={{ color: 'var(--text-muted)' }}> · {r.customerName}</span> : null}
                      {r.model?.source === 'customer' ? (
                        <span style={{ color: 'var(--text-muted)' }}> · pays in ~{r.model.medianDays}d</span>
                      ) : r.model?.source === 'promised' ? (
                        <span style={{ color: 'var(--text-muted)' }}> · promised</span>
                      ) : r.model ? (
                        <span style={{ color: 'var(--text-muted)' }}> · company avg</span>
                      ) : null}
                    </span>
                    <span style={{ display: 'inline-flex', gap: '0.6rem', alignItems: 'baseline', flexShrink: 0 }}>
                      <span style={{ color: d.color, fontWeight: 600 }}>{d.text}</span>
                      <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{formatUsdNoCents(r.open)}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          ))}

        <p style={{ margin: '0.9rem 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          {forecast.rowCount} open {forecast.rowCount === 1 ? 'bill' : 'bills'} · {formatUsdNoCents(forecast.openTotal)} total
          {forecast.skippedNoMoney > 0 ? ` · ${forecast.skippedNoMoney} paid-to-zero ${forecast.skippedNoMoney === 1 ? 'row' : 'rows'} not shown` : ''}
          {paySpeeds == null ? ' · pay speeds unavailable — dates need the pay-speed lookup' : ''}
        </p>
      </div>
    </div>
  )
}
