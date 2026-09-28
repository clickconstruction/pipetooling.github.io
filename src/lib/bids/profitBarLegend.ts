// Pure helpers for the Workbench "Where the profit lives" bar: the color-keyed
// legend, the hover tooltip, and the click-pinned detail card (v2.2353).

export type ProfitLegendSegment = { id: string; label: string; profit: number; share: number }

export type ProfitLegendChip = {
  id: string
  label: string
  share: number
  /** Index into the segment palette — chip color must match the bar slice. */
  colorIndex: number
}

export const PROFIT_BAR_MAX_CHIPS = 12

/**
 * Legend chips mirror the bar's segment order (profit desc), so chip N is
 * always slice N. The long tail past maxChips collapses to a "+N more" count.
 */
export function buildProfitLegend(
  segments: ProfitLegendSegment[],
  maxChips: number = PROFIT_BAR_MAX_CHIPS,
): { chips: ProfitLegendChip[]; moreCount: number } {
  const chips = segments.slice(0, maxChips).map((s, i) => ({ id: s.id, label: s.label, share: s.share, colorIndex: i }))
  return { chips, moreCount: Math.max(0, segments.length - chips.length) }
}

/** "<1%" below one percent, whole percents otherwise — never "0%" for a real slice. */
export function formatProfitShare(share: number): string {
  const pct = share * 100
  if (pct > 0 && pct < 1) return '<1%'
  return `${Math.round(pct)}%`
}

/**
 * Horizontal center for the hover tooltip, clamped so it never hangs past
 * either end of the bar. `mid` is the hovered slice's center in px.
 */
export function clampTooltipLeft(mid: number, barWidth: number, halfTipWidth: number): number {
  if (barWidth <= halfTipWidth * 2) return barWidth / 2
  return Math.max(halfTipWidth, Math.min(barWidth - halfTipWidth, mid))
}

/* ---- The pinned detail card, the concentration warning, the legend's fold (PricingProfitBar) ---- */

/** A Workbench row as the bar's detail card reads it: effective price and margin, previews included. */
export type ProfitBarRow = {
  id: string
  count: number
  cost: number
  effUnit: number | null
  effRevenue: number
  effMargin: number | null
  /** The price-book entry the row is assigned to, by name; null when it has none. */
  bookEntryName: string | null
}

export type ProfitConcentrationLike = { segments: ProfitLegendSegment[]; top2Share: number | null; totalProfit: number }

/** Above this share of the job's profit in the top two rows, the bar warns. */
export const PROFIT_TOP2_WARN_SHARE = 0.6

/** "⚠ 72% of profit sits in A + B — …", or null at or under 60 % or with fewer than two slices. */
export function profitConcentrationWarning(conc: ProfitConcentrationLike): string | null {
  if (conc.top2Share == null || conc.top2Share <= PROFIT_TOP2_WARN_SHARE || conc.segments.length < 2) return null
  return `⚠ ${Math.round(conc.top2Share * 100)}% of profit sits in ${conc.segments[0]?.label} + ${conc.segments[1]?.label} — a VE cut there guts the job.`
}

/**
 * The pinned slice with its Workbench row. The pin is a count-row id, so it survives a
 * re-solve; it shows only while that row still has a slice (positive profit) and a row.
 */
export function pinnedProfitSlice(
  segments: ReadonlyArray<ProfitLegendSegment>,
  rows: ReadonlyArray<ProfitBarRow>,
  pinnedId: string | null,
): { index: number; segment: ProfitLegendSegment; row: ProfitBarRow } | null {
  const index = pinnedId != null ? segments.findIndex((s) => s.id === pinnedId) : -1
  const segment = index >= 0 ? segments[index] : null
  const row = segment ? rows.find((r) => r.id === segment.id) : null
  return segment && row ? { index, segment, row } : null
}

export type ProfitDetailStat = { label: string; value: string; /** Profit and Margin take the margin's colour. */ byMargin: boolean }

/** The detail card's eight cells. `money` formats dollars without the sign. */
export function profitBarDetailStats(row: ProfitBarRow, segment: ProfitLegendSegment, money: (n: number) => string): ProfitDetailStat[] {
  return [
    { label: 'Qty', value: String(row.count), byMargin: false },
    { label: 'Unit cost', value: row.cost > 0 ? `$${money(row.cost / row.count)}` : 'no cost', byMargin: false },
    { label: 'Sale / unit', value: row.effUnit != null ? `$${money(row.effUnit)}` : '—', byMargin: false },
    { label: 'Revenue', value: `$${money(row.effRevenue)}`, byMargin: false },
    { label: 'Cost', value: row.cost > 0 ? `$${money(row.cost)}` : '—', byMargin: false },
    { label: 'Profit', value: `$${money(segment.profit)}`, byMargin: true },
    { label: 'Margin', value: row.effMargin != null ? `${Math.round(row.effMargin * 100)}%` : '—', byMargin: true },
    { label: 'Share of job profit', value: formatProfitShare(segment.share), byMargin: false },
  ]
}

export const PROFIT_LEGEND_COLLAPSED_KEY = 'wbProfitLegendCollapsed_v1'

/** The legend's fold is a device preference; a device that cannot say reads as open. */
export function readProfitLegendCollapsed(storage: Pick<Storage, 'getItem'> | null | undefined): boolean {
  try {
    return storage?.getItem(PROFIT_LEGEND_COLLAPSED_KEY) === '1'
  } catch {
    return false
  }
}

export function writeProfitLegendCollapsed(storage: Pick<Storage, 'setItem'> | null | undefined, collapsed: boolean): void {
  try {
    storage?.setItem(PROFIT_LEGEND_COLLAPSED_KEY, collapsed ? '1' : '0')
  } catch {
    /* private browsing */
  }
}
