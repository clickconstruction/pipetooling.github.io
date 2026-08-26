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
