/**
 * Bids → Pricing: "This number vs your history" — the history block of region P2 of
 * `docs/BIDS_PRICING_LABOR_TABS_ARCHITECTURE.md`. The JSX moved out of `BidsPricingTab` as it
 * was; what it draws is decided by `lib/bids/pricingMarginHistory`. Renders nothing until
 * there are three past bids won or lost on price.
 */
import { marginHistoryScaleLeft, pricingMarginHistoryView } from '../../lib/bids/pricingMarginHistory'
import type { BidPricingHistoryRow } from '../../types/database-functions'

export function PricingMarginHistory({
  history,
  currentBidId,
  currentMargin,
  gcCustomerId,
}: {
  /** `usePricingMarginHistory`'s rows; null while loading. */
  history: readonly BidPricingHistoryRow[] | null
  currentBidId: string | null | undefined
  /** The Workbench's effective margin, a fraction — previews included. */
  currentMargin: number | null
  gcCustomerId: string | null
}) {
  const view = pricingMarginHistoryView({ history, currentBidId, currentMargin, gcCustomerId })
  if (!view) return null
  const { won, lostPrice, tabMarks, verdict, tabsMatched, gcTabs } = view
  const cur = currentMargin
  const x = marginHistoryScaleLeft
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '0.7rem 1rem 0.85rem', marginBottom: '0.9rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '1rem', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>This number vs your history <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(estimated margins from cost estimates)</span></span>
        {verdict ? <span style={{ fontSize: '0.78rem', fontWeight: 600, color: verdict.color }}>{verdict.text}</span> : null}
      </div>
      <div style={{ position: 'relative', height: tabMarks.length > 0 ? 56 : 46, marginTop: '0.5rem' }}>
        <div style={{ position: 'absolute', top: 18, height: 10, borderRadius: 999, left: 0, width: '100%', background: 'var(--bg-muted)' }} />
        {won.map((h) => (
          <span key={h.bid_id} title={`Won: ${h.project_name ?? '—'} at ~${Math.round(h.m * 100)}%`} style={{ position: 'absolute', top: 20, width: 7, height: 7, borderRadius: 999, transform: 'translateX(-50%)', background: 'var(--text-green-600)', left: x(h.m * 100) }} />
        ))}
        {lostPrice.map((h) => (
          <span key={h.bid_id} title={`Lost on price: ${h.project_name ?? '—'} at ~${Math.round(h.m * 100)}%`} style={{ position: 'absolute', top: 20, width: 7, height: 7, borderRadius: 999, transform: 'translateX(-50%)', background: 'var(--text-red-700)', left: x(h.m * 100) }} />
        ))}
        {tabMarks.map((t, i) => (
          <span
            key={`tab-${i}`}
            title={`Tab low on ${t.label}: ~${Math.round(t.matchPct)}% would have matched it`}
            style={{ position: 'absolute', top: 27, fontSize: '0.72rem', color: 'var(--text-amber-700)', transform: 'translateX(-50%)', left: x(t.matchPct), cursor: 'default' }}
          >
            {'▽'}
          </span>
        ))}
        {[20, 30, 40, 50, 60].map((a) => (
          <span key={a} style={{ position: 'absolute', top: tabMarks.length > 0 ? 44 : 34, fontSize: '0.62rem', color: 'var(--text-muted)', transform: 'translateX(-50%)', left: x(a) }}>{a}%</span>
        ))}
        {cur != null ? (
          <span style={{ position: 'absolute', top: 2, transform: 'translateX(-50%)', textAlign: 'center', left: x(cur * 100), transition: 'left 0.15s' }}>
            <span style={{ display: 'block', fontSize: '0.66rem', fontWeight: 700 }}>{Math.round(cur * 100)}%</span>
            <span style={{ display: 'block', width: 0, height: 0, borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderTop: '9px solid var(--text-strong)', margin: '0 auto' }} />
          </span>
        ) : null}
      </div>
      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
        <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: 999, background: 'var(--text-green-600)', margin: '0 0.25rem 0 0' }} />won bids
        <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: 999, background: 'var(--text-red-700)', margin: '0 0.25rem 0 0.7rem' }} />lost on price · ▼ this pricing
        {tabMarks.length > 0 ? <span style={{ color: 'var(--text-amber-700)' }}> · {'▽'} margin to match a recorded tab low</span> : null}
      </div>
      {tabsMatched != null && cur != null ? (
        <p style={{ margin: '0.4rem 0 0', fontSize: '0.78rem', color: 'var(--text-700)' }}>
          At {Math.round(cur * 100)}%, this number would have matched or beaten the low on{' '}
          <strong>{tabsMatched} of {tabMarks.length}</strong> recorded tab
          {tabMarks.length === 1 ? '' : 's'}.
          {gcTabs ? (
            <span style={{ color: 'var(--text-muted)' }}>
              {' '}This GC's {gcTabs.count} tabs needed {gcTabs.lowPct}–{gcTabs.highPct}% to match the low.
            </span>
          ) : null}
        </p>
      ) : null}
    </div>
  )
}
