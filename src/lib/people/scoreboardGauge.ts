/**
 * Team Scoreboard gauge kernel (v2.1312): band math for the two-bar
 * traffic-light gauges on People → Scoreboard.
 *
 * A gauge is a vertical bar with red/yellow/green bands. Direction decides
 * which end is green: 'higher' puts green at the top (profit ratio — more
 * revenue per cost dollar is better); 'lower' puts green at the bottom
 * (office cost per field dollar — less support cost is better).
 *
 * All outputs are positions and band names — never dollars. The office-facing
 * surface renders ONLY what this kernel returns plus counts/hours the role can
 * already see; the dollar inputs stay server-side (see the RPC plan in the
 * component header).
 */

export type GaugeBand = 'green' | 'yellow' | 'red'
export type GaugeDirection = 'higher' | 'lower'

export type GaugeConfig = {
  /** Bottom of the bar/scale. */
  min: number
  /** Top of the bar/scale. */
  max: number
  /** Boundary between red and yellow (in gauge units). */
  redBelow: number
  /** Boundary between yellow and green (in gauge units). */
  greenAbove: number
  /** Which numeric end is good. 'higher': value >= greenAbove is green. 'lower': value <= greenAbove is green. */
  direction: GaugeDirection
}

/** Which band a value falls in, honoring direction. */
export function gaugeBand(value: number, cfg: GaugeConfig): GaugeBand {
  if (cfg.direction === 'higher') {
    if (value >= cfg.greenAbove) return 'green'
    if (value >= cfg.redBelow) return 'yellow'
    return 'red'
  }
  if (value <= cfg.greenAbove) return 'green'
  if (value <= cfg.redBelow) return 'yellow'
  return 'red'
}

/**
 * Needle position as % from the TOP of the bar (0 = top, 100 = bottom),
 * clamped to the scale. Numeric max always renders at the top of the bar
 * regardless of direction — direction changes band placement, not axis
 * orientation (both demo bars read max-at-top).
 */
export function gaugeNeedleTopPct(value: number, cfg: GaugeConfig): number {
  const span = cfg.max - cfg.min
  if (span <= 0) return 50
  const clamped = Math.min(cfg.max, Math.max(cfg.min, value))
  return ((cfg.max - clamped) / span) * 100
}

/**
 * The three band segments as {topPct, heightPct, band} from the top of the
 * bar, derived from the same config the needle uses so they can never drift.
 */
export function gaugeBandSegments(cfg: GaugeConfig): Array<{ topPct: number; heightPct: number; band: GaugeBand }> {
  const greenEdge = gaugeNeedleTopPct(cfg.greenAbove, cfg)
  const redEdge = gaugeNeedleTopPct(cfg.redBelow, cfg)
  if (cfg.direction === 'higher') {
    // green on top, red at bottom
    return [
      { topPct: 0, heightPct: greenEdge, band: 'green' },
      { topPct: greenEdge, heightPct: redEdge - greenEdge, band: 'yellow' },
      { topPct: redEdge, heightPct: 100 - redEdge, band: 'red' },
    ]
  }
  // 'lower': red on top, green at bottom
  return [
    { topPct: 0, heightPct: redEdge, band: 'red' },
    { topPct: redEdge, heightPct: greenEdge - redEdge, band: 'yellow' },
    { topPct: greenEdge, heightPct: 100 - greenEdge, band: 'green' },
  ]
}

/** How far the value sits from the green boundary, in gauge units (0 when already green). */
export function gaugeDistanceToGreen(value: number, cfg: GaugeConfig): number {
  if (gaugeBand(value, cfg) === 'green') return 0
  return Math.abs(cfg.greenAbove - value)
}

/** "N of M weeks green" over a band history (for the bonus banner). */
export function greenWeekCount(weeks: readonly GaugeBand[]): { green: number; total: number } {
  return { green: weeks.filter((w) => w === 'green').length, total: weeks.length }
}
