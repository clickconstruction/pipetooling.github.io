/**
 * The Workbench's margin as two bars (punch list #217, bids-2, a prototype). Today the Pricing
 * strip is four tiles (Revenue, Profit, Margin, Multiple) and up to five caveat sentences under
 * them: the margin the bid went out at, labor at a default crew rate, revenue on rows with no cost,
 * labor from another version's counts, and what today's book would price the materials at. This
 * kernel turns the same facts into two bars on one scale, the way the Legal desk draws a claim
 * (`moneyBars.ts`): a revenue bar with the sent figure and today's book as a hatched sliver, and a
 * cost bar in its parts — labor, materials, the book's drift hatched, the other direct costs, a
 * dashed stretch for the revenue on rows with no cost, the margin as the rest — with the stamped
 * margin a ghost mark and every caveat a legend line with its door. Pure: it reads the strip's own
 * inputs and returns fractions of a width and words; `WorkbenchBarsView` draws them.
 */
import { formatSentOn } from './sentVsToday'

export type WorkbenchBarsInput = {
  /** The strip's Revenue: every row's price × count at today's book, a pending solve included. */
  revenue: number
  /** `bids.bid_date_sent` and `bids.bid_value`, the figure the customer was quoted. Null: not sent. */
  sent: { on: string; value: number } | null
  /** The Workbench's cost breakdown: labor, materials before tax, the tax on them, and the whole. */
  cost: { labor: number; materials: number; tax: number; total: number }
  /** The labor rate the cost reads, and where it came from (`effectiveLaborRate`). */
  rate: { value: number | null; source: 'override' | 'company' | 'none' }
  /** Revenue on priced rows with no cost, and how many rows: the margin counts it as profit. */
  noCost: { revenue: number; rows: number }
  /** What today's book would add to the materials (`takeoffPriceDrift`): the gap, the moved lines, the prices that look wrong. Null: not read. */
  drift: { gap: number; moved: number; wrong: number } | null
  /** Labor's hours follow another version's counts (`laborCountsOutOfStep`). */
  laborOutOfStep: boolean
  /** The margin kept on the bid (`bids.priced_*`); frozen at send. Null: none yet. */
  stamp: { pct: number; revenueUsd: number; costUsd: number; uncostedUsd: number; rateSet: boolean } | null
  currentYear: number
}

export type WorkbenchBarSegmentKind = 'sent' | 'today' | 'short' | 'labor' | 'materials' | 'drift' | 'other' | 'nocost' | 'margin'
export type WorkbenchBarSegment = { key: string; kind: WorkbenchBarSegmentKind; amount: number; fraction: number; label: string; title: string }
export type WorkbenchBarMark = { key: string; kind: 'sent' | 'stamp'; label: string; fraction: number }
export type WorkbenchBar = { key: 'revenue' | 'cost'; caption: string; total: number; segments: WorkbenchBarSegment[]; marks: WorkbenchBarMark[] }

/** Where a legend line's door goes: Labor's rate, the Takeoffs tab, the rows with no cost, the Labor tab. */
export type WorkbenchDoor = 'laborRate' | 'takeoffs' | 'noCostRows' | 'labor'
export type WorkbenchLegendItem = {
  key: string
  swatch: WorkbenchBarSegmentKind | 'none'
  words: string
  /** `guess`: a default or a stand-in the reader should know about; `warn`: the cost may be wrong. */
  tone: 'plain' | 'guess' | 'warn'
  door: { kind: WorkbenchDoor; words: string } | null
}

export type WorkbenchBars = {
  /** The width both bars share: the largest of revenue, the sent figure and the cost with the book's drift. */
  scale: number
  bars: WorkbenchBar[]
  legend: WorkbenchLegendItem[]
  /** The labor-on-other-counts chip, apart from the legend. */
  warn: WorkbenchLegendItem | null
  /** The live margin, revenue over cost; null with no revenue. */
  margin: number | null
  /** One sentence for the hover and the screen reader. */
  words: string
}

const round2 = (n: number): number => Math.round(n * 100) / 100
const usd0 = (n: number): string => `$${Math.round(Math.abs(n)).toLocaleString('en-US')}`
const signed0 = (n: number): string => `${n < 0 ? '−' : '+'}${usd0(n)}`
const pct0 = (n: number): string => `${Math.round(n * 100)}%`

function frac(amount: number, scale: number): number {
  return scale > 0 ? Math.max(0, Math.min(1, amount / scale)) : 0
}

/** `$35.76/h`: a rate for the legend. */
export function rateWords(rate: number): string {
  return `$${rate.toFixed(2)}/h`
}

export function workbenchBars(input: WorkbenchBarsInput): WorkbenchBars | null {
  const revenue = round2(Math.max(0, input.revenue))
  const sent = input.sent && input.sent.value > 0.004 ? { on: input.sent.on, value: round2(input.sent.value) } : null
  const cost = { labor: round2(Math.max(0, input.cost.labor)), materials: round2(Math.max(0, input.cost.materials)), tax: round2(Math.max(0, input.cost.tax)), total: round2(Math.max(0, input.cost.total)) }
  const gap = input.drift ? round2(input.drift.gap) : 0
  const scale = round2(Math.max(revenue, sent?.value ?? 0, cost.total + Math.max(0, gap)))
  if (!(scale > 0.004)) return null
  const sentOn = sent ? formatSentOn(sent.on, input.currentYear) : ''

  // --- Revenue ------------------------------------------------------------
  const rev: WorkbenchBarSegment[] = []
  const revMarks: WorkbenchBarMark[] = []
  let revCaption: string
  if (sent) {
    const delta = round2(revenue - sent.value)
    if (Math.abs(delta) <= 0.01) {
      rev.push({ key: 'sent', kind: 'sent', amount: sent.value, fraction: frac(sent.value, scale), label: `${usd0(sent.value)} sent ${sentOn}`, title: `Sent ${sentOn} at ${usd0(sent.value)}; the book still prices it there` })
      revCaption = `Revenue · ${usd0(sent.value)} sent ${sentOn} · the book still prices it there`
    } else if (delta > 0) {
      rev.push({ key: 'sent', kind: 'sent', amount: sent.value, fraction: frac(sent.value, scale), label: `${usd0(sent.value)} sent ${sentOn}`, title: `Sent ${sentOn} at ${usd0(sent.value)}, the figure the customer was quoted` })
      rev.push({ key: 'today', kind: 'today', amount: delta, fraction: frac(delta, scale), label: signed0(delta), title: `The book prices it at ${usd0(revenue)} today, ${usd0(delta)} more than sent` })
      revMarks.push({ key: 'sent', kind: 'sent', label: `sent ${sentOn} · ${usd0(sent.value)}`, fraction: frac(sent.value, scale) })
      revCaption = `Revenue · ${usd0(sent.value)} sent ${sentOn} · ${usd0(revenue)} at today’s book`
    } else {
      rev.push({ key: 'today', kind: 'today', amount: revenue, fraction: frac(revenue, scale), label: `${usd0(revenue)} at today’s book`, title: `The book prices it at ${usd0(revenue)} today, ${usd0(delta)} less than sent` })
      rev.push({ key: 'short', kind: 'short', amount: -delta, fraction: frac(-delta, scale), label: signed0(delta), title: `Sent ${sentOn} at ${usd0(sent.value)}; the book prices it ${usd0(delta)} lower today` })
      revMarks.push({ key: 'sent', kind: 'sent', label: `sent ${sentOn} · ${usd0(sent.value)}`, fraction: frac(sent.value, scale) })
      revCaption = `Revenue · ${usd0(sent.value)} sent ${sentOn} · ${usd0(revenue)} at today’s book`
    }
  } else {
    rev.push({ key: 'today', kind: 'today', amount: revenue, fraction: frac(revenue, scale), label: usd0(revenue), title: `Revenue at today’s book, ${usd0(revenue)}` })
    revCaption = `Revenue · ${usd0(revenue)}`
  }

  // --- Our cost -------------------------------------------------------------
  const seg: WorkbenchBarSegment[] = []
  const other = round2(Math.max(0, cost.total - cost.labor - cost.materials - cost.tax))
  const rateNote = input.rate.source === 'company' && input.rate.value != null ? ` at the crew rate, ${rateWords(input.rate.value)}, until Labor has one of its own` : input.rate.source === 'none' ? ', with no labor rate set' : input.rate.value != null ? ` at ${rateWords(input.rate.value)}` : ''
  if (cost.labor > 0.004) seg.push({ key: 'labor', kind: 'labor', amount: cost.labor, fraction: frac(cost.labor, scale), label: `labor ${usd0(cost.labor)}`, title: `Labor ${usd0(cost.labor)}${rateNote}` })
  const mat = round2(cost.materials + cost.tax)
  if (mat > 0.004) seg.push({ key: 'materials', kind: 'materials', amount: mat, fraction: frac(mat, scale), label: `materials ${usd0(mat)}`, title: cost.tax > 0.004 ? `Materials ${usd0(cost.materials)} and ${usd0(cost.tax)} of tax on them` : `Materials ${usd0(cost.materials)}` })
  if (gap > 0.004) seg.push({ key: 'drift', kind: 'drift', amount: gap, fraction: frac(gap, scale), label: signed0(gap), title: `Today’s book adds ${usd0(gap)} to the materials; Takeoffs shows each line` })
  if (other > 0.004) seg.push({ key: 'other', kind: 'other', amount: other, fraction: frac(other, scale), label: `other ${usd0(other)}`, title: `Driving, travel, equipment, permits, subcontractors, waste and other direct costs, ${usd0(other)}` })
  const room = round2(revenue - cost.total)
  const noCost = round2(Math.max(0, Math.min(input.noCost.revenue, room)))
  if (noCost > 0.004 && input.noCost.rows > 0) seg.push({ key: 'nocost', kind: 'nocost', amount: noCost, fraction: frac(noCost, scale), label: 'no cost', title: `${usd0(input.noCost.revenue)} of revenue on ${input.noCost.rows} ${input.noCost.rows === 1 ? 'row' : 'rows'} with no cost; the margin counts it as profit` })
  const margin = revenue > 0.004 ? (revenue - cost.total) / revenue : null
  const rest = round2(room - noCost)
  if (rest > 0.004 && margin != null) seg.push({ key: 'margin', kind: 'margin', amount: rest, fraction: frac(rest, scale), label: `margin ${pct0(margin)}`, title: `${usd0(rest)} left after every cost${noCost > 0.004 ? ' and the rows with no cost' : ''}; the margin is ${pct0(margin)} of revenue` })
  const costMarks: WorkbenchBarMark[] = []
  if (input.stamp && revenue > 0.004) {
    const at = round2(revenue * (1 - input.stamp.pct / 100))
    costMarks.push({ key: 'stamp', kind: 'stamp', label: `${sent ? 'went out at' : 'kept at'} ${Math.round(input.stamp.pct)}%`, fraction: frac(at, scale) })
  }
  const costShare = revenue > 0.004 ? cost.total / revenue : null
  const costCaption =
    costShare == null
      ? `Our cost · ${usd0(cost.total)}`
      : room < -0.004
        ? `Our cost · ${usd0(cost.total)} · ${usd0(-room)} over revenue`
        : `Our cost · ${usd0(cost.total)} · ${pct0(costShare)} of revenue · margin ${pct0(margin ?? 0)}`

  // --- The legend: each caveat on the part it touches, with its door ----------
  const legend: WorkbenchLegendItem[] = []
  if (input.rate.source === 'company' && input.rate.value != null) {
    legend.push({ key: 'labor', swatch: 'labor', words: `labor · at the crew rate ${rateWords(input.rate.value)} · a default`, tone: 'guess', door: { kind: 'laborRate', words: 'set Labor’s rate' } })
  } else if (input.rate.source === 'none') {
    legend.push({ key: 'labor', swatch: 'labor', words: 'labor · no rate, so labor counts as $0', tone: 'guess', door: { kind: 'laborRate', words: 'set Labor’s rate' } })
  } else if (cost.labor > 0.004) {
    legend.push({ key: 'labor', swatch: 'labor', words: `labor · ${usd0(cost.labor)}${input.rate.value != null ? ` at ${rateWords(input.rate.value)}` : ''}`, tone: 'plain', door: null })
  }
  if (mat > 0.004 || gap !== 0) {
    const drift = input.drift
    const parts = [`materials · ${usd0(mat)}`]
    if (drift && Math.abs(gap) > 0.004) parts.push(`${signed0(gap)} at today’s book`)
    if (drift && drift.wrong > 0) parts.push(`${drift.wrong} ${drift.wrong === 1 ? 'price that looks wrong' : 'prices that look wrong'} left out`)
    legend.push({ key: 'materials', swatch: 'materials', words: parts.join(' · '), tone: 'plain', door: drift && (Math.abs(gap) > 0.004 || drift.wrong > 0) ? { kind: 'takeoffs', words: 'Takeoffs' } : null })
  }
  if (input.noCost.rows > 0 && input.noCost.revenue > 0.004) {
    legend.push({ key: 'nocost', swatch: 'nocost', words: `no cost · ${usd0(input.noCost.revenue)} on ${input.noCost.rows} ${input.noCost.rows === 1 ? 'row' : 'rows'}`, tone: 'guess', door: { kind: 'noCostRows', words: 'the rows' } })
  }
  if (input.stamp) {
    legend.push({ key: 'margin', swatch: 'margin', words: `margin · ${sent ? 'went out at' : 'kept on the bid at'} ${Math.round(input.stamp.pct)}% · ${usd0(input.stamp.costUsd)} cost on ${usd0(input.stamp.revenueUsd)}`, tone: 'plain', door: null })
  } else if (margin != null) {
    legend.push({ key: 'margin', swatch: 'margin', words: `margin · ${pct0(margin)}`, tone: 'plain', door: null })
  }
  const warn: WorkbenchLegendItem | null = input.laborOutOfStep ? { key: 'laborOutOfStep', swatch: 'none', words: 'labor on last version’s counts', tone: 'warn', door: { kind: 'labor', words: 'Labor' } } : null

  const words = [
    `Revenue ${usd0(revenue)} at today’s book${sent ? `, sent ${sentOn} at ${usd0(sent.value)}` : ''}.`,
    costShare == null ? `Our cost ${usd0(cost.total)}.` : `Our cost ${usd0(cost.total)}, ${pct0(costShare)} of revenue.`,
    margin != null ? `Margin ${pct0(margin)}${input.stamp ? `, ${sent ? 'went out' : 'kept'} at ${Math.round(input.stamp.pct)}%` : ''}.` : '',
    input.laborOutOfStep ? 'Labor’s hours follow another version’s counts.' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return {
    scale,
    bars: [
      { key: 'revenue', caption: revCaption, total: Math.max(revenue, sent?.value ?? 0), segments: rev, marks: revMarks },
      { key: 'cost', caption: costCaption, total: cost.total, segments: seg, marks: costMarks },
    ],
    legend,
    warn,
    margin,
    words,
  }
}
