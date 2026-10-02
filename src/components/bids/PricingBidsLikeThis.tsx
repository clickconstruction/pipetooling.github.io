/**
 * Bids → Pricing: "Bids like this" (v2.4418; it was "This number vs your history") — the
 * record block of region P2 of `docs/BIDS_PRICING_LABOR_TABS_ARCHITECTURE.md`. One line when
 * folded: bids this size, this GC, and where the margin stands. Unfolded: what happened to
 * the bids this size, the ones decided on our number by name, and the estimated-margin scale.
 * What it draws is decided by `lib/bids/bidsLikeThis`; it renders nothing when that is null.
 */
import type { CSSProperties } from 'react'

import { useBidsLikeThisFold } from '../../hooks/useBidsLikeThisFold'
import { bidsLikeThisView, formatCompactDollars, type LikeThisChip, type LikeThisTally, type LikeThisTone } from '../../lib/bids/bidsLikeThis'
import { marginHistoryScaleLeft } from '../../lib/bids/pricingMarginHistory'
import type { BidPricingHistoryRow } from '../../types/database-functions'

const TONE: Record<LikeThisTone, { background: string; color: string }> = {
  good: { background: 'var(--bg-green-tint)', color: 'var(--text-green-800)' },
  bad: { background: 'var(--bg-red-tint)', color: 'var(--text-red-800)' },
  warn: { background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)' },
  neutral: { background: 'var(--bg-muted)', color: 'var(--text-700)' },
}
const WON = 'var(--text-green-600)'
const LOST_PRICE = 'var(--text-red-700)'
const GC_LOST = 'var(--border-400)'
const OTHER = 'var(--bg-200)'

const caption: CSSProperties = { fontSize: '0.74rem', color: 'var(--text-muted)' }

function Chip({ chip, title }: { chip: LikeThisChip; title?: string }) {
  return <span title={title} style={{ ...TONE[chip.tone], fontSize: '0.75rem', fontWeight: 600, padding: '0.14rem 0.55rem', borderRadius: 999, fontVariantNumeric: 'tabular-nums' }}>{chip.text}</span>
}

/** One bar for a tally: won, lost on price, the GC lost the project, the rest — and the key under it. */
function OutcomeBar({ tally }: { tally: LikeThisTally }) {
  const segments = [
    { key: 'won', count: tally.won, color: WON, label: 'won' },
    { key: 'price', count: tally.lostPrice, color: LOST_PRICE, label: 'lost on price' },
    { key: 'gc', count: tally.gcLost, color: GC_LOST, label: 'the GC lost the project' },
    { key: 'other', count: tally.other, color: OTHER, label: 'other', title: tally.otherReasons.map((r) => `${r.count} ${r.label}`).join(' · ') },
  ].filter((s) => s.count > 0)
  return (
    <>
      <div style={{ display: 'flex', height: 12, gap: 2, borderRadius: 4, overflow: 'hidden', marginTop: '0.3rem' }}>
        {segments.map((s) => (
          <div key={s.key} style={{ flex: `${s.count} 1 0`, minWidth: 4, background: s.color }} />
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.15rem 0.85rem', marginTop: '0.3rem', fontSize: '0.74rem', color: 'var(--text-700)' }}>
        {segments.map((s) => (
          <span key={s.key} title={s.title || undefined}>
            <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: s.color, marginRight: '0.3rem' }} />
            {s.count} {s.label}
          </span>
        ))}
      </div>
    </>
  )
}

export function PricingBidsLikeThis({
  history,
  currentBidId,
  currentPrice,
  currentMargin,
  gcCustomerId,
  gcName,
}: {
  /** `usePricingMarginHistory`'s rows; null while loading. */
  history: readonly BidPricingHistoryRow[] | null
  currentBidId: string | null | undefined
  /** The Workbench's effective revenue — previews included. */
  currentPrice: number | null
  /** The Workbench's effective margin, a fraction — previews included. */
  currentMargin: number | null
  gcCustomerId: string | null
  /** The GC's name as the bid shows it; "This GC" without one. */
  gcName?: string | null
}) {
  const { expanded, toggle } = useBidsLikeThisFold()
  const view = bidsLikeThisView({ history, currentBidId, currentPrice, currentMargin, gcCustomerId, gcName })
  if (!view) return null
  const { size, gc, margin } = view
  const cur = currentMargin
  const x = (pct: number) => (margin ? marginHistoryScaleLeft(pct, margin.scale) : '0%')
  const dots = margin ? margin.won.length + margin.lostPrice.length : 0
  return (
    <div data-testid="pricing-bids-like-this" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, marginBottom: '0.9rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem 0.5rem', flexWrap: 'wrap', padding: '0.45rem 0.8rem' }}>
        <span style={{ fontSize: '0.85rem', fontWeight: 700, marginRight: '0.15rem' }} title="What happened to decided bids like this one: the same size, the same GC, and where this margin stands against them">
          Bids like this
        </span>
        {size ? <Chip chip={size.chip} /> : null}
        {gc ? <Chip chip={gc.chip} title={gcName ?? undefined} /> : null}
        {margin?.chip ? <Chip chip={margin.chip} /> : null}
        <span style={{ flex: '1 1 0' }} />
        <button
          type="button"
          onClick={toggle}
          aria-expanded={expanded}
          style={{ font: 'inherit', fontSize: '0.75rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.16rem 0.55rem', borderRadius: 999, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', cursor: 'pointer', flex: '0 0 auto' }}
        >
          {expanded ? 'Hide' : size ? `Compare ${size.tally.total} bid${size.tally.total === 1 ? '' : 's'}` : 'Compare'}
          <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>{expanded ? '▾' : '▸'}</span>
        </button>
      </div>
      {expanded ? (
        <div style={{ borderTop: '1px solid var(--border)', padding: '0.65rem 0.8rem 0.8rem', display: 'grid', gap: '0.85rem' }}>
          {size ? (
            <div>
              <div style={caption}>
                What happened to {size.tally.total} decided bid{size.tally.total === 1 ? '' : 's'} between {formatCompactDollars(size.low)} and {formatCompactDollars(size.high)}
              </div>
              <OutcomeBar tally={size.tally} />
              <div style={{ ...caption, marginTop: '0.75rem' }}>
                {size.rows.length > 0 ? 'Won or lost on price, closest in size first' : 'None of these was won or lost on price.'}
              </div>
              {size.rows.map((r, i) => (
                <div
                  key={r.bidId}
                  style={{ maxWidth: '46rem', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto auto', gap: '0.15rem 0.75rem', alignItems: 'baseline', padding: '0.28rem 0', fontSize: '0.8rem', borderTop: i === 0 ? 'none' : '1px solid var(--border)' }}
                >
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', overflowWrap: 'anywhere' }} title={r.name}>{r.name}</span>
                    {r.tabNote ? <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-amber-700)' }}>{r.tabNote}</span> : null}
                  </span>
                  <span style={{ fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>${Math.round(r.value).toLocaleString('en-US')}</span>
                  <span style={{ color: r.outcome === 'won' ? WON : LOST_PRICE, fontWeight: 600, whiteSpace: 'nowrap' }}>{r.outcome === 'won' ? 'won' : 'lost on price'}</span>
                </div>
              ))}
              {size.moreRows > 0 ? <div style={{ ...caption, marginTop: '0.2rem' }}>and {size.moreRows} more</div> : null}
            </div>
          ) : null}
          {gc?.sentence ? <div style={{ fontSize: '0.8rem', color: 'var(--text-700)' }}>{gc.sentence}</div> : null}
          {margin ? (
            <div>
              <div style={caption}>
                Estimated margin, for past bids with a usable cost estimate
                {margin.thin ? <span style={{ ...TONE.neutral, marginLeft: '0.45rem', padding: '0.08rem 0.45rem', borderRadius: 999, fontWeight: 600 }}>Thin evidence</span> : null}
              </div>
              <div style={{ position: 'relative', height: margin.tabMarks.length > 0 ? 56 : 46, marginTop: '0.35rem' }}>
                <div style={{ position: 'absolute', top: 18, height: 10, borderRadius: 999, left: 0, width: '100%', background: 'var(--bg-muted)' }} />
                {margin.won.map((h) => (
                  <span key={h.bid_id} title={`Won: ${h.project_name ?? '—'} at ~${Math.round(h.m * 100)}%`} style={{ position: 'absolute', top: 20, width: 7, height: 7, borderRadius: 999, transform: 'translateX(-50%)', background: WON, left: x(h.m * 100) }} />
                ))}
                {margin.lostPrice.map((h) => (
                  <span key={h.bid_id} title={`Lost on price: ${h.project_name ?? '—'} at ~${Math.round(h.m * 100)}%`} style={{ position: 'absolute', top: 20, width: 7, height: 7, borderRadius: 999, transform: 'translateX(-50%)', background: LOST_PRICE, left: x(h.m * 100) }} />
                ))}
                {margin.tabMarks.map((t, i) => (
                  <span
                    key={`tab-${i}`}
                    title={`Tab low on ${t.label}: ~${Math.round(t.matchPct)}% would have matched it`}
                    style={{ position: 'absolute', top: 27, fontSize: '0.72rem', color: 'var(--text-amber-700)', transform: 'translateX(-50%)', left: x(t.matchPct), cursor: 'default' }}
                  >
                    {'▽'}
                  </span>
                ))}
                {margin.scale.ticks.map((a) => (
                  // the end ticks sit inside the bar's ends instead of hanging half outside the card
                  <span key={a} style={{ position: 'absolute', top: margin.tabMarks.length > 0 ? 44 : 34, fontSize: '0.62rem', color: 'var(--text-muted)', transform: a === margin.scale.min ? 'none' : a === margin.scale.max ? 'translateX(-100%)' : 'translateX(-50%)', left: x(a) }}>{a}%</span>
                ))}
                {cur != null ? (
                  <span style={{ position: 'absolute', top: 2, transform: 'translateX(-50%)', textAlign: 'center', left: x(cur * 100), transition: 'left 0.15s' }}>
                    <span style={{ display: 'block', fontSize: '0.66rem', fontWeight: 700 }}>{Math.round(cur * 100)}%</span>
                    <span style={{ display: 'block', width: 0, height: 0, borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderTop: '9px solid var(--text-strong)', margin: '0 auto' }} />
                  </span>
                ) : null}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: 999, background: WON, margin: '0 0.25rem 0 0' }} />won bids
                <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: 999, background: LOST_PRICE, margin: '0 0.25rem 0 0.7rem' }} />lost on price · ▼ this pricing
                {margin.tabMarks.length > 0 ? <span style={{ color: 'var(--text-amber-700)' }}> · {'▽'} margin to match a recorded tab low</span> : null}
              </div>
              {margin.verdict ? <p style={{ margin: '0.4rem 0 0', fontSize: '0.78rem', color: 'var(--text-700)' }}>{margin.verdict.sentence}</p> : null}
              {margin.tabsMatched != null && cur != null ? (
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.78rem', color: 'var(--text-700)' }}>
                  At {Math.round(cur * 100)}%, this number would have matched or beaten the low on{' '}
                  <strong>{margin.tabsMatched} of {margin.tabMarks.length}</strong> recorded tab
                  {margin.tabMarks.length === 1 ? '' : 's'}.
                  {margin.gcTabs ? (
                    <span style={{ color: 'var(--text-muted)' }}>
                      {' '}This GC's {margin.gcTabs.count} tabs needed {margin.gcTabs.lowPct}–{margin.gcTabs.highPct}% to match the low.
                    </span>
                  ) : null}
                </p>
              ) : null}
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                {dots} of the {margin.decidedOnNumber} bids won or lost on price have a usable cost estimate.
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
