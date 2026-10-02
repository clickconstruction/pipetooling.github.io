/**
 * A bid's materials at today's book (v2.4395): the line on Takeoffs, with Refresh prices, and
 * the one-line note on Pricing. Both draw `takeoffPriceDrift` and report; the writes stay in the
 * Takeoffs tab (`updateTakeoffRoughPartLine`). A sent bid keeps the prices it was sent with until
 * someone presses Revise on Pricing (`pricingLock.ts`), so its line shows the gap only.
 */
import type { CSSProperties } from 'react'
import { formatCurrency } from '../../lib/format'
import type { PricingLockState } from '../../lib/bids/pricingLock'
import { gapWords, movedWords, type TakeoffDrift } from '../../lib/bids/takeoffPriceDrift'

const pctText = (share: number) => `${share < 0 ? '▼' : '▲'} ${(Math.abs(share) * 100).toFixed(1)}%`
const btnPrimary: CSSProperties = { minHeight: 40, padding: '0 0.9rem', borderRadius: 8, border: '1px solid #2563eb', background: '#2563eb', color: '#fff', font: 'inherit', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }

function WrongPrices({ drift }: { drift: TakeoffDrift }) {
  if (drift.wrong.length === 0) return null
  const first = drift.wrong[0]!
  return (
    <div role="note" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', border: '1px solid var(--border-amber)', background: 'var(--bg-amber-tint)', borderRadius: 10, padding: '0.6rem 0.8rem', fontSize: '0.8125rem', color: 'var(--text-amber-900)' }}>
      <div style={{ flex: '1 1 18rem', minWidth: 0 }}>
        <strong>{drift.wrong.length === 1 ? '1 price looks wrong, so it is left out.' : `${drift.wrong.length} prices look wrong, so they are left out.`}</strong>{' '}
        {first.partName} at {first.houseName} reads ${formatCurrency(first.today)}. It was ${formatCurrency(first.priced)} on this takeoff.
      </div>
      <a href="/materials?tab=parts-book" style={{ color: 'var(--text-amber-900)', fontWeight: 600, whiteSpace: 'nowrap' }}>Fix it in Materials</a>
    </div>
  )
}

/** Takeoffs: how many book prices moved, what they add up to, and Refresh prices (or why not yet). */
export function TakeoffPriceDriftLine({
  drift,
  lock,
  sentDay,
  refreshing,
  onRefresh,
}: {
  drift: TakeoffDrift
  lock: PricingLockState
  /** The day the bid was sent, as the lock chip says it ("Jul 7"); null when not sent. */
  sentDay: string | null
  refreshing: boolean
  onRefresh: () => void
}) {
  const n = drift.moved.length
  if (n === 0 && drift.wrong.length === 0) return null
  return (
    <section aria-label="Materials at today’s book" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', margin: '0 0 0.9rem' }}>
      {n > 0 ? (
        <div style={{ border: '1px solid var(--border-blue)', background: 'var(--bg-blue-tint)', borderRadius: 10, padding: '0.6rem 0.8rem', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 18rem', minWidth: 0, fontSize: '0.875rem' }}>
              {movedWords(n)} At today’s book these materials cost{' '}
              <strong style={{ color: drift.gap < 0 ? 'var(--text-blue-700)' : 'var(--text-orange-700)' }}>{gapWords(drift.gap)}</strong>{' '}
              <span style={{ color: 'var(--text-muted)' }}>({pctText(drift.share)})</span>.
            </div>
            {lock === 'locked' ? (
              <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                {sentDay ? `Sent ${sentDay}.` : 'Sent.'} Press Revise on Pricing to refresh them.
              </span>
            ) : (
              <button type="button" style={btnPrimary} disabled={refreshing} onClick={onRefresh}>
                {refreshing ? 'Refreshing…' : 'Refresh prices'}
              </button>
            )}
          </div>
          <details>
            <summary style={{ cursor: 'pointer', fontSize: '0.8125rem', color: 'var(--text-link)' }}>See the {n === 1 ? 'line' : `${n} lines`}</summary>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem', marginTop: '0.4rem' }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '0.3rem 0.5rem' }}>Part</th>
                    <th style={{ padding: '0.3rem 0.5rem' }}>House</th>
                    <th style={{ padding: '0.3rem 0.5rem', textAlign: 'right' }}>Qty</th>
                    <th style={{ padding: '0.3rem 0.5rem', textAlign: 'right' }}>Priced</th>
                    <th style={{ padding: '0.3rem 0.5rem', textAlign: 'right' }}>Today</th>
                    <th style={{ padding: '0.3rem 0.5rem', textAlign: 'right' }}>Change</th>
                  </tr>
                </thead>
                <tbody>
                  {drift.moved.map((m) => (
                    <tr key={m.lineId} style={{ borderTop: '1px solid var(--border)', fontVariantNumeric: 'tabular-nums' }}>
                      <td style={{ padding: '0.3rem 0.5rem', overflowWrap: 'anywhere' }}>{m.partName}</td>
                      <td style={{ padding: '0.3rem 0.5rem' }}>{m.houseName}</td>
                      <td style={{ padding: '0.3rem 0.5rem', textAlign: 'right' }}>{Number(m.quantity.toFixed(2))}</td>
                      <td style={{ padding: '0.3rem 0.5rem', textAlign: 'right' }}>${formatCurrency(m.priced)}</td>
                      <td style={{ padding: '0.3rem 0.5rem', textAlign: 'right' }}>${formatCurrency(m.today)}</td>
                      <td style={{ padding: '0.3rem 0.5rem', textAlign: 'right', fontWeight: 700, color: m.change < 0 ? 'var(--text-blue-700)' : 'var(--text-orange-700)' }}>
                        {m.change < 0 ? '▼' : '▲'} ${formatCurrency(Math.abs(m.change))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>Refresh prices updates the lines priced from the book. Prices you typed stay as they are.</div>
          </details>
        </div>
      ) : null}
      <WrongPrices drift={drift} />
    </section>
  )
}

/** Pricing: the same gap in one line, where the margin is set, with the way to Takeoffs. */
export function PricingMaterialsTodayNote({ drift, onSeeTakeoffs }: { drift: TakeoffDrift | null; onSeeTakeoffs: () => void }) {
  if (!drift || (drift.moved.length === 0 && drift.wrong.length === 0)) return null
  return (
    <div data-testid="pricing-materials-today" style={{ marginTop: '0.4rem', fontSize: '0.74rem', fontVariantNumeric: 'tabular-nums', color: 'var(--text-muted)' }}>
      {drift.moved.length > 0 ? (
        <>
          Materials at today’s book:{' '}
          <strong style={{ color: drift.gap < 0 ? 'var(--text-blue-700)' : 'var(--text-orange-700)' }}>{gapWords(drift.gap)}</strong> ({pctText(drift.share)}).{' '}
        </>
      ) : null}
      {drift.wrong.length > 0 ? <>{drift.wrong.length === 1 ? '1 price that looks wrong is left out.' : `${drift.wrong.length} prices that look wrong are left out.`} </> : null}
      <button type="button" onClick={onSeeTakeoffs} style={{ font: 'inherit', padding: 0, border: 'none', background: 'none', color: 'var(--text-link)', textDecoration: 'underline', cursor: 'pointer' }}>
        See Takeoffs
      </button>
    </div>
  )
}
