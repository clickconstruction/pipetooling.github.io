/**
 * The end-of-line labels on the Charges & Value chart (v2.6718, punch list #257's last walk): the cost,
 * true cost, cash position and value labels all sit at the last point's x, and each line drew its own
 * beside its own end, so on a site's chart the true cost label sat over the cash and cost labels and the
 * red label half under the source icons, and at 375 wide all three overlapped. This kernel places them
 * as one column: each label wants to sit just above or below its line's end, the column is spread so no
 * two overlap, it steps around the fixed marks at the last bucket (the icon row, the 💵, the 🚩), and it
 * stays inside the plot. Pure; `JobSummaryChargesTimelineChart.tsx` draws the result in one layer.
 */

export type EndLabelWant = {
  key: string
  /** The line's end, in pixels from the chart's top. */
  lineY: number
  /** Which side of the line the label wants: above it or below it. */
  side: 'above' | 'below'
}

export type FixedSpan = { top: number; bottom: number }

export type EndLabelLayout = {
  /** How tall one label is, the space it keeps from the next. */
  lineHeight: number
  /** The band the labels may use, from the top of the chart to the plot's floor. */
  top: number
  bottom: number
  /** The marks drawn at the last bucket that a label must not cross. */
  obstacles?: readonly FixedSpan[]
}

/** How far a label's centre sits from its line when nothing is in the way. */
export const END_LABEL_GAP = 10

const overlaps = (a: FixedSpan, b: FixedSpan) => a.top < b.bottom && b.top < a.bottom

function spanAt(center: number, h: number): FixedSpan {
  return { top: center - h / 2, bottom: center + h / 2 }
}

/**
 * The centre y of each label. The column is laid twice, once giving way downward and once upward past
 * the marks it would cross, and the laying that moves the labels least from where they want to sit wins:
 * at a busy chart's end a tall stack of icons is cleared by the near side, not always by going under it.
 * A label never swaps places with another: the one whose line ends higher stays higher.
 */
export function placeEndLabels(wants: readonly EndLabelWant[], layout: EndLabelLayout): Map<string, number> {
  const down = placeGivingWay(wants, layout)
  // The mirror: flip the chart upside down, lay the column the same way, flip the result back.
  const flipped = placeGivingWay(
    wants.map((w) => ({ key: w.key, lineY: -w.lineY, side: w.side === 'above' ? ('below' as const) : ('above' as const) })),
    { lineHeight: layout.lineHeight, top: -layout.bottom, bottom: -layout.top, obstacles: (layout.obstacles ?? []).map((b) => ({ top: -b.bottom, bottom: -b.top })) },
  )
  const up = new Map([...flipped].map(([k, y]) => [k, -y]))
  const wantOf = new Map(wants.map((w) => [w.key, w.side === 'above' ? w.lineY - END_LABEL_GAP : w.lineY + END_LABEL_GAP]))
  const moved = (placed: Map<string, number>) => [...placed].reduce((s, [k, y]) => s + Math.abs(y - (wantOf.get(k) ?? y)), 0)
  return moved(up) < moved(down) - 1e-9 ? up : down
}

/** One laying of the column: down past what it crosses, back up from the floor, down again from the top. */
function placeGivingWay(wants: readonly EndLabelWant[], layout: EndLabelLayout): Map<string, number> {
  const h = layout.lineHeight
  const blocks = layout.obstacles ?? []
  const items = wants
    .map((w) => ({ key: w.key, want: w.side === 'above' ? w.lineY - END_LABEL_GAP : w.lineY + END_LABEL_GAP }))
    .sort((a, b) => a.want - b.want)
  const y: number[] = []
  // Down: each label at its want, or just under the one before it, and never across a mark.
  for (let i = 0; i < items.length; i++) {
    let c = Math.max(items[i]!.want, layout.top + h / 2, i > 0 ? y[i - 1]! + h : -Infinity)
    c = clearBlocksDown(c, h, blocks)
    y.push(c)
  }
  // Up: the stack's bottom holds to the plot's floor; the ones above close up under it.
  const floor = layout.bottom - h / 2
  for (let i = items.length - 1; i >= 0; i--) {
    const limit = i === items.length - 1 ? floor : y[i + 1]! - h
    if (y[i]! > limit) y[i] = clearBlocksUp(limit, h, blocks)
  }
  // Down again, only if the stack now stands above the top: a plot too short for its labels overlaps at the floor rather than above the chart.
  for (let i = 0; i < items.length; i++) {
    const limit = i === 0 ? layout.top + h / 2 : y[i - 1]! + h
    if (y[i]! < limit) y[i] = limit
  }
  return new Map(items.map((it, i) => [it.key, y[i]!]))
}

function clearBlocksDown(center: number, h: number, blocks: readonly FixedSpan[]): number {
  let c = center
  // Each step clears one mark, so a pass over every mark and one more is always enough.
  for (let guard = 0; guard <= blocks.length; guard++) {
    const hit = blocks.find((b) => overlaps(spanAt(c, h), b))
    if (!hit) return c
    c = hit.bottom + h / 2
  }
  return c
}

function clearBlocksUp(center: number, h: number, blocks: readonly FixedSpan[]): number {
  let c = center
  // Each step clears one mark, so a pass over every mark and one more is always enough.
  for (let guard = 0; guard <= blocks.length; guard++) {
    const hit = blocks.find((b) => overlaps(spanAt(c, h), b))
    if (!hit) return c
    c = hit.top - h / 2
  }
  return c
}

/** A mark drawn on the chart with the x it spans, so the layer can tell which marks a label's text would reach across. */
export type ChartMark = FixedSpan & { x: number; halfWidth: number }

/** The marks whose x span touches the band the labels' text covers, `left` to `right`. */
export function marksWithin(marks: readonly ChartMark[], left: number, right: number): FixedSpan[] {
  return marks.filter((m) => m.x - m.halfWidth < right && left < m.x + m.halfWidth).map(({ top, bottom }) => ({ top, bottom }))
}

/** How wide a 13px bold label reads, near enough: seven pixels a character and a little slack. */
export function endLabelWidth(text: string): number {
  return text.length * 7 + 6
}

/** The band the source icons take at a bucket, as the chart draws them: 22px glyphs with their baseline at `iconRowY`. */
export function iconRowSpan(iconRowY: number): FixedSpan {
  return { top: iconRowY - 20, bottom: iconRowY + 4 }
}

/** Where the icon row's baseline sits over a point, as the chart's dot renderers put it. */
export function iconRowY(cy: number): number {
  return Math.max(24, cy - 12)
}

/** Where the 💵 marker's baseline sits over or under the cash line's point: under it when the point is near the floor. */
export function paymentMarkerY(cy: number): number {
  return cy > 190 ? cy - 16 : cy + 26
}
