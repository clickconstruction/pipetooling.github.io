/**
 * The Project Board's bidding price as a bar (punch list #217, gc-messages-5, a prototype). Today a
 * bidding row says its price in prose three times: *$612,400 + ?*, *so far, with 2 holes*, *about
 * $1.42M with every trade in*, and the heading adds the rows up as *priced so far* with no mark that
 * a hole counts $0 and a budget counts as a quote. This kernel turns the same facts into one bar
 * per row: the quoted trades solid, our budget hatched, each hole's estimate dashed, general
 * conditions with contingency and fee grey, the full length what the price comes to once every
 * trade is in (`priceStanding.likely`). Pure: it reads `proposalTotals` and `priceStanding` and
 * returns fractions of a width and the words under the bar; `GcBoardPriceBar` draws them.
 */
import { carriedAmount } from './bids'
import { aboutMoney, isHole, priceStanding, type TradeStanding, type TradeStandingRow } from './priceStanding'
import type { GcProject, GcState } from './types'
import { money } from './words'

export type BoardPriceBarKind = 'quoted' | 'budget' | 'hole' | 'overhead'

export type BoardPriceBarSegment = {
  kind: BoardPriceBarKind
  amount: number
  /** Of the bar's full length. */
  fraction: number
  /** The number inside the segment: `$612k`, `≈ $180k`. */
  label: string
  /** The hover. */
  title: string
}

export type BoardPriceBarLegend = {
  kind: BoardPriceBarKind
  /** `quoted · 5 trades`, `holes · Concrete, Roofing · from the lowest good quote`. */
  words: string
}

export type BoardPriceBar = {
  /** The bar's full length: the price once every trade is in, or the price so far with no hole. */
  total: number
  soFar: number
  likely: number
  holes: number
  segments: BoardPriceBarSegment[]
  legend: BoardPriceBarLegend[]
  /** The two short lines under the row's figure: what the figure is, and what it comes to. */
  lines: { first: string; second: string | null }
  /** One sentence for the hover and the screen reader. */
  words: string
}

/** The price card's groups each segment opens on: a segment is a door to the trades it draws. */
export const BAR_STANDINGS: Record<BoardPriceBarKind, TradeStanding[]> = {
  quoted: ['real', 'gap', 'ranOut'],
  budget: ['guess'],
  hole: ['pick', 'waiting', 'notAsked', 'ownBid'],
  overhead: [],
}

/** `$612k`, `$1.42M`, `$980`: an amount for a glance inside a segment. */
export function glanceMoney(n: number): string {
  const v = Math.abs(n)
  if (v >= 1_000_000) return `$${(Math.round(v / 10_000) / 100).toFixed(2)}M`
  if (v >= 1_000) return `$${Math.round(v / 1_000).toLocaleString('en-US')}k`
  return money(v)
}

/** Where a hole's estimate came from, in the legend's words. */
export function holeEstimateWords(row: TradeStandingRow): string {
  if (row.standing === 'pick') return 'the lowest good quote'
  if (row.standing === 'ownBid') return 'our own figure'
  return 'our budget'
}

function listWords(names: string[]): string {
  if (names.length <= 1) return names[0] ?? ''
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

function tradesWords(n: number): string {
  return `${n} ${n === 1 ? 'trade' : 'trades'}`
}

function frac(amount: number, scale: number): number {
  return scale > 0 ? Math.max(0, Math.min(1, amount / scale)) : 0
}

/**
 * The bar for one bidding row. Null when nothing is priced or estimated yet (no trade, every
 * figure zero), so the row keeps its figure alone. `moneyShown` false (outside the money team): the
 * overhead has no words, since the reader's state carries none, and the lines say *trades so far*.
 */
export function boardPriceBar(state: GcState, project: GcProject, opts: { moneyShown?: boolean } = {}): BoardPriceBar | null {
  const moneyShown = opts.moneyShown ?? true
  const p = priceStanding(state, project)
  const rows = p.rows
  const quotedRows = rows.filter((r) => BAR_STANDINGS.quoted.includes(r.standing))
  const budgetRows = rows.filter((r) => r.standing === 'guess')
  const holeRows = rows.filter((r) => isHole(r.standing))
  const quoted = quotedRows.reduce((t, r) => t + (carriedAmount(r.pkg) ?? 0), 0)
  const budget = budgetRows.reduce((t, r) => t + (carriedAmount(r.pkg) ?? 0), 0)
  const holes = holeRows.reduce((t, r) => t + (r.estimate ?? 0), 0)
  const total = Math.max(p.likely, p.soFar)
  if (!(total > 0)) return null
  const overhead = Math.max(0, total - quoted - budget - holes)

  const segments: BoardPriceBarSegment[] = []
  const legend: BoardPriceBarLegend[] = []
  if (quoted > 0) {
    const gaps = quotedRows.filter((r) => r.standing === 'gap').length
    const ranOut = quotedRows.filter((r) => r.standing === 'ranOut').length
    segments.push({ kind: 'quoted', amount: quoted, fraction: frac(quoted, total), label: glanceMoney(quoted), title: `${money(quoted)} quoted on ${tradesWords(quotedRows.length)}` })
    legend.push({
      kind: 'quoted',
      words: [`quoted · ${tradesWords(quotedRows.length)}`, gaps > 0 ? `${gaps} with a cost missing` : '', ranOut > 0 ? `${ranOut} ran out` : ''].filter(Boolean).join(' · '),
    })
  }
  if (budget > 0) {
    segments.push({ kind: 'budget', amount: budget, fraction: frac(budget, total), label: glanceMoney(budget), title: `${money(budget)} is our budget on ${tradesWords(budgetRows.length)}, counted as if quoted` })
    legend.push({ kind: 'budget', words: `our budget · ${budgetRows.length === 1 ? '1 trade carrying ours' : `${budgetRows.length} trades carrying ours`}` })
  }
  if (holeRows.length > 0) {
    const sources = new Set(holeRows.map(holeEstimateWords))
    const names =
      sources.size === 1
        ? `${holeRows.map((r) => r.pkg.trade).join(', ')} · from ${[...sources][0]}`
        : holeRows.map((r) => `${r.pkg.trade} from ${holeEstimateWords(r)}`).join(', ')
    if (holes > 0) {
      segments.push({ kind: 'hole', amount: holes, fraction: frac(holes, total), label: `≈ ${glanceMoney(holes)}`, title: `${money(holes)} estimated for ${tradesWords(holeRows.length)} with no number yet; the price counts ${holeRows.length === 1 ? 'it' : 'them'} as $0` })
    }
    legend.push({ kind: 'hole', words: `${holeRows.length === 1 ? 'hole' : 'holes'} · ${names}` })
  }
  if (overhead > 0) {
    segments.push({ kind: 'overhead', amount: overhead, fraction: frac(overhead, total), label: glanceMoney(overhead), title: moneyShown ? `${money(overhead)} of general conditions, contingency ${p.contingencyPct}% and fee ${p.feePct}%` : `${money(overhead)} on top of the trades` })
    if (moneyShown) {
      const parts = [p.generalConditions > 0 ? `GC ${money(p.generalConditions)}` : '', p.contingencyPct > 0 ? `contingency ${p.contingencyPct}%` : '', p.feePct > 0 ? `fee ${p.feePct}%` : ''].filter(Boolean)
      legend.push({ kind: 'overhead', words: parts.join(' + ') || 'general conditions and fee' })
    }
  }

  const holesN = holeRows.length
  const allReal = quotedRows.length === rows.length && quotedRows.every((r) => r.standing === 'real') && rows.length > 0
  const first = allReal
    ? moneyShown
      ? 'quoted · we stand behind it'
      : 'every trade quoted'
    : [
        moneyShown ? 'so far' : 'trades so far',
        holesN > 0 ? `with ${holesN} ${holesN === 1 ? 'hole' : 'holes'}` : '',
        budgetRows.length > 0 ? `our budget on ${budgetRows.length}` : '',
      ]
        .filter(Boolean)
        .join(', ')
  const second = holesN > 0 ? `${aboutMoney(p.likely)} with every trade in` : null

  const words = [
    `${money(p.soFar)} ${moneyShown ? 'priced' : 'in trades'} so far.`,
    quoted > 0 ? `${money(quoted)} quoted on ${tradesWords(quotedRows.length)}.` : '',
    budget > 0 ? `Our budget stands in for ${listWords(budgetRows.map((r) => r.pkg.trade))}.` : '',
    holesN > 0 ? `${listWords(holeRows.map((r) => r.pkg.trade))} ${holesN === 1 ? 'has' : 'have'} no number yet and ${holesN === 1 ? 'counts' : 'count'} as $0; ${aboutMoney(p.likely)} with every trade in.` : '',
  ]
    .filter(Boolean)
    .join(' ')

  return { total, soFar: p.soFar, likely: p.likely, holes: holesN, segments, legend, lines: { first, second }, words }
}

/**
 * Whether a section's bars say anything its figures do not (the read of the real board, 2026-10-30: one
 * bidding job, one trade, one solid part). A bar with one segment and no hole is the number drawn
 * again; the bars draw only when some row in the section has a hole, our budget, or the overhead to
 * show, so a row with every trade quoted reads as plain against its neighbours and never alone.
 */
export function boardBarsSaySomething(bars: ReadonlyArray<BoardPriceBar | null>): boolean {
  return bars.some((b) => b !== null && (b.segments.length > 1 || b.holes > 0))
}

/**
 * The Bidding heading's money, with the bars on: *$977,823 priced so far · about $1.9M with every
 * trade in*. The second figure only when a row has a hole; empty with no job.
 */
export function boardSectionBarWords(bars: ReadonlyArray<BoardPriceBar | null>): string {
  const drawn = bars.filter((b): b is BoardPriceBar => b !== null)
  if (drawn.length === 0) return ''
  const soFar = drawn.reduce((t, b) => t + b.soFar, 0)
  const likely = drawn.reduce((t, b) => t + b.likely, 0)
  if (!(soFar > 0) && !(likely > 0)) return ''
  const holes = drawn.some((b) => b.holes > 0)
  return holes ? `${money(soFar)} priced so far · ${aboutMoney(likely)} with every trade in` : `${money(soFar)} priced so far`
}
