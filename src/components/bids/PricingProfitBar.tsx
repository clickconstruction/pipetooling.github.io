/**
 * Bids → Pricing: "Where the profit lives" (v2.2353) — the profit bar of region P2 of
 * `docs/BIDS_PRICING_LABOR_TABS_ARCHITECTURE.md`. The JSX moved out of `BidsPricingTab` as it
 * was. The four values come from `usePricingProfitBar` (the tab calls it, so a pin outlives
 * the card); the words and the pinned card's cells are `lib/bids/profitBarLegend`.
 */
import { formatCurrency } from '../../lib/format'
import {
  buildProfitLegend,
  clampTooltipLeft,
  formatProfitShare,
  pinnedProfitSlice,
  profitBarDetailStats,
  profitConcentrationWarning,
  type ProfitBarRow,
  type ProfitConcentrationLike,
} from '../../lib/bids/profitBarLegend'
import type { PricingProfitBarState } from '../../hooks/usePricingProfitBar'

export function PricingProfitBar({
  bar,
  conc,
  rows,
  concColors,
  marginColor,
  onJumpToRow,
}: {
  bar: PricingProfitBarState
  /** `profitConcentration` over the Workbench's effective rows. */
  conc: ProfitConcentrationLike
  rows: ReadonlyArray<ProfitBarRow>
  /** The slice palette; slice N and chip N share colour N. */
  concColors: readonly string[]
  marginColor: (m: number | null) => string
  /** Clears the grid's filters, flashes the row and scrolls to it. */
  onJumpToRow: (rowId: string) => void
}) {
  const { wbBarHover, setWbBarHover, wbBarTipLeft, setWbBarTipLeft, wbBarPinnedId, setWbBarPinnedId, wbLegendCollapsed, toggleLegend } = bar
  const legend = buildProfitLegend(conc.segments)
  const hoverSeg = wbBarHover != null ? conc.segments[wbBarHover] : null
  const pinned = pinnedProfitSlice(conc.segments, rows, wbBarPinnedId)
  const warning = profitConcentrationWarning(conc)
  const hoverSlice = (i: number, el: HTMLElement) => {
    const track = el.closest('[data-profit-bar-track]') as HTMLElement | null
    setWbBarHover(i)
    if (track) setWbBarTipLeft(clampTooltipLeft(el.offsetLeft + el.offsetWidth / 2, track.offsetWidth, 130))
  }
  const statCell = (label: string, value: string, color?: string) => (
    <div key={label}>
      <div style={{ fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>{label}</div>
      <div style={{ fontSize: '0.86rem', fontWeight: 600, color: color ?? 'var(--text-strong)', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    </div>
  )
  return (
    <div data-profit-bar style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '0.7rem 0.9rem', marginTop: '0.9rem' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>Where the profit lives</span>
        {warning ? (
          <span style={{ fontSize: '0.78rem', color: 'var(--text-amber-700)' }}>
            {warning}
          </span>
        ) : null}
        {conc.totalProfit > 0 ? (
          <button
            type="button"
            onClick={toggleLegend}
            style={{ marginLeft: 'auto', font: 'inherit', fontSize: '0.72rem', color: 'var(--text-muted)', border: 'none', background: 'none', cursor: 'pointer', padding: '0 0.2rem' }}
          >
            {wbLegendCollapsed ? 'Show legend ▸' : 'Hide legend ▾'}
          </button>
        ) : null}
      </div>
      <div data-profit-bar-track style={{ position: 'relative', marginTop: '0.45rem' }} onMouseLeave={() => setWbBarHover(null)}>
        <div style={{ display: 'flex', height: 16, borderRadius: 6, overflow: 'hidden' }}>
          {conc.totalProfit <= 0 ? (
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>No profit yet — price some rows.</span>
          ) : (
            conc.segments.map((s, i) => (
              <button
                key={s.id}
                type="button"
                aria-label={`${s.label}: $${formatCurrency(s.profit)} profit (${formatProfitShare(s.share)} of job) — click for details`}
                onMouseEnter={(e) => hoverSlice(i, e.currentTarget)}
                onFocus={(e) => hoverSlice(i, e.currentTarget)}
                onBlur={() => setWbBarHover(null)}
                onClick={() => setWbBarPinnedId((cur) => (cur === s.id ? null : s.id))}
                style={{
                  width: `${s.share * 100}%`,
                  minWidth: 2,
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  background: concColors[i % concColors.length],
                  opacity: wbBarHover == null || wbBarHover === i ? 1 : 0.35,
                  transform: wbBarHover === i ? 'scaleY(1.25)' : undefined,
                  transition: 'opacity 120ms ease, transform 120ms ease',
                }}
              />
            ))
          )}
        </div>
        {hoverSeg ? (
          <div
            role="tooltip"
            style={{ position: 'absolute', bottom: 'calc(100% + 8px)', left: wbBarTipLeft, transform: 'translateX(-50%)', background: 'var(--text-strong)', color: 'var(--surface)', borderRadius: 8, padding: '0.4rem 0.6rem', fontSize: '0.78rem', lineHeight: 1.35, whiteSpace: 'nowrap', boxShadow: '0 8px 20px rgba(0,0,0,0.25)', pointerEvents: 'none', zIndex: 20 }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700 }}>
              <span style={{ width: 9, height: 9, borderRadius: 3, flex: 'none', background: concColors[(wbBarHover ?? 0) % concColors.length] }} />
              {hoverSeg.label}
            </div>
            <div style={{ opacity: 0.75, fontVariantNumeric: 'tabular-nums' }}>
              ${formatCurrency(hoverSeg.profit)} profit · {formatProfitShare(hoverSeg.share)} of job
            </div>
          </div>
        ) : null}
      </div>
      {conc.totalProfit > 0 && !wbLegendCollapsed ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.15rem 0.35rem', marginTop: '0.4rem' }}>
          {legend.chips.map((c) => (
            <button
              key={c.id}
              type="button"
              onMouseEnter={(e) => {
                const track = (e.currentTarget.closest('[data-profit-bar]') as HTMLElement | null)?.querySelector('[data-profit-bar-track]') as HTMLElement | null
                const slice = track?.querySelectorAll('button')[c.colorIndex] as HTMLElement | undefined
                if (slice) hoverSlice(c.colorIndex, slice)
              }}
              onMouseLeave={() => setWbBarHover(null)}
              onClick={() => setWbBarPinnedId((cur) => (cur === c.id ? null : c.id))}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                font: 'inherit',
                fontSize: '0.72rem',
                color: wbBarHover === c.colorIndex || wbBarPinnedId === c.id ? 'var(--text-strong)' : 'var(--text-muted)',
                background: wbBarHover === c.colorIndex || wbBarPinnedId === c.id ? 'var(--bg-subtle)' : 'none',
                border: 'none',
                padding: '0.12rem 0.45rem',
                borderRadius: 999,
                cursor: 'pointer',
              }}
            >
              <span style={{ width: 8, height: 8, borderRadius: 3, flex: 'none', background: concColors[c.colorIndex % concColors.length] }} />
              <span style={{ fontWeight: 600 }}>{c.label}</span>
              <span style={{ fontVariantNumeric: 'tabular-nums', opacity: 0.85 }}>{formatProfitShare(c.share)}</span>
            </button>
          ))}
          {legend.moreCount > 0 ? (
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontStyle: 'italic', padding: '0.12rem 0.45rem' }}>+{legend.moreCount} more</span>
          ) : null}
        </div>
      ) : null}
      {pinned ? (
        <div role="region" aria-label={`Detail for ${pinned.segment.label}`} style={{ marginTop: '0.55rem', border: '1px solid var(--border-strong)', borderRadius: 8, background: 'var(--surface)', boxShadow: '0 10px 24px rgba(0,0,0,0.12)', padding: '0.6rem 0.8rem 0.7rem', maxWidth: '32rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, flex: 'none', background: concColors[pinned.index % concColors.length] }} />
            <b style={{ fontSize: '0.85rem', color: 'var(--text-strong)' }}>{pinned.segment.label}</b>
            {pinned.row.bookEntryName != null ? (
              <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-blue-700)', background: 'var(--bg-blue-tint)', padding: '0.1rem 0.5rem', borderRadius: 999, letterSpacing: '0.02em' }}>
                {pinned.row.bookEntryName}
              </span>
            ) : null}
            <button
              type="button"
              onClick={() => setWbBarPinnedId(null)}
              aria-label="Close line item detail"
              style={{ marginLeft: 'auto', border: 'none', background: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.95rem', lineHeight: 1, padding: '0 0.2rem' }}
            >
              ✕
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(6.5rem, 1fr))', gap: '0.5rem 1rem', marginTop: '0.55rem' }}>
            {profitBarDetailStats(pinned.row, pinned.segment, formatCurrency).map((s) => statCell(s.label, s.value, s.byMargin ? marginColor(pinned.row.effMargin) : undefined))}
          </div>
          <div style={{ marginTop: '0.6rem' }}>
            <button
              type="button"
              onClick={() => onJumpToRow(pinned.segment.id)}
              style={{ font: 'inherit', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-link)', border: '1px solid var(--border-strong)', background: 'none', borderRadius: 6, padding: '0.22rem 0.6rem', cursor: 'pointer' }}
            >
              ↑ Jump to row in worksheet
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
