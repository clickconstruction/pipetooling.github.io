/**
 * The Subs lane's own rules (v2.5560, punch list #110, PR 2): what the bench needs, read from
 * the bench's own rule (`tradeBenches`, three dependable companies a trade), the queue filtered
 * to one trade and ordered by the biggest gap, which sources landed, and the double a caller is
 * about to type when the company is already on the bench.
 *
 * Everything here is pure; the page feeds it the bench and the lane's rows.
 */
import { BENCH_WANTED } from '../gc/bench'
import { parseTradesText, tradesText } from './prospectKinds'

export interface BenchNeed {
  trade: string
  /** Companies on the bench that would bid if asked (the bench's `dependable`). */
  dependable: number
  /** How many more the bench wants: `BENCH_WANTED - dependable`, never below zero. */
  short: number
  /** Subs in this lane's queue that name the trade. */
  toCall: number
  /** False for a trade only the subs name: nothing on the bench asks for it yet. */
  onBench: boolean
}

export function tradeKey(trade: string): string {
  return trade.trim().toLowerCase()
}

type SubRow = { trades: string[] | null; prospect_fit_status: string | null }

/** A sub still in the queue: no outcome yet. */
function inQueue(p: { prospect_fit_status: string | null }): boolean {
  return p.prospect_fit_status == null
}

/**
 * The strip over the Subs lane: the bench's trades, biggest gap first, each with how many to call;
 * then the trades only the subs name, so nothing typed is lost.
 */
export function benchNeeds(benches: readonly { trade: string; dependable: number }[], subs: readonly SubRow[]): BenchNeed[] {
  const toCall = new Map<string, { trade: string; n: number }>()
  for (const s of subs) {
    if (!inQueue(s)) continue
    for (const trade of s.trades ?? []) {
      const key = tradeKey(trade)
      if (!key) continue
      const cur = toCall.get(key)
      if (cur) cur.n += 1
      else toCall.set(key, { trade: trade.trim(), n: 1 })
    }
  }
  const seen = new Set<string>()
  const onBench: BenchNeed[] = benches.map((b) => {
    const key = tradeKey(b.trade)
    seen.add(key)
    return {
      trade: b.trade,
      dependable: b.dependable,
      short: Math.max(0, BENCH_WANTED - b.dependable),
      toCall: toCall.get(key)?.n ?? 0,
      onBench: true,
    }
  })
  onBench.sort((x, y) => y.short - x.short || y.toCall - x.toCall || x.trade.localeCompare(y.trade))
  const extra: BenchNeed[] = []
  for (const [key, v] of toCall) {
    if (seen.has(key)) continue
    extra.push({ trade: v.trade, dependable: 0, short: 0, toCall: v.n, onBench: false })
  }
  extra.sort((x, y) => y.toCall - x.toCall || x.trade.localeCompare(y.trade))
  return [...onBench, ...extra]
}

/** The strip's words for one trade. */
export function benchNeedWords(n: BenchNeed): { head: string; tail: string } {
  const toCall = `${n.toCall} to call`
  if (!n.onBench) return { head: 'not on the bench', tail: toCall }
  if (n.short === 0) return { head: `${n.dependable} on the bench`, tail: toCall }
  return { head: `${n.short} more`, tail: toCall }
}

/** The lane filtered to one trade (case-blind); null or blank keeps every sub. */
export function subsForTrade<T extends { trades: string[] | null }>(subs: readonly T[], trade: string | null | undefined): T[] {
  const key = trade ? tradeKey(trade) : ''
  if (!key) return [...subs]
  return subs.filter((s) => (s.trades ?? []).some((t) => tradeKey(t) === key))
}

/** The biggest gap among a sub's trades; zero when none of them is short. */
export function subGap(sub: { trades: string[] | null }, needs: readonly BenchNeed[]): number {
  let gap = 0
  for (const t of sub.trades ?? []) {
    const need = needs.find((n) => tradeKey(n.trade) === tradeKey(t))
    if (need && need.short > gap) gap = need.short
  }
  return gap
}

/**
 * By need: the trade with the biggest gap first, then never called, then the caller's order
 * (coldest first from the query). A stable sort, so ties keep their place.
 */
export function orderSubsByNeed<T extends { id: string; trades: string[] | null; created_at: string | null }>(
  subs: readonly T[],
  needs: readonly BenchNeed[],
  calledIds: ReadonlySet<string>,
): T[] {
  return subs
    .map((s, i) => ({ s, i, gap: subGap(s, needs), called: calledIds.has(s.id) ? 1 : 0 }))
    .sort((a, b) => b.gap - a.gap || a.called - b.called || a.i - b.i)
    .map((x) => x.s)
}

export interface SourceSuccess {
  source: string
  /** Rows that went well (On the bench, Asked us, Converted). */
  landed: number
  total: number
}

export const NO_SOURCE = 'No source'

/** Which sources land: every row of the lane by where we found them, most tried first. */
export function sourceSuccess(rows: readonly { source: string | null; prospect_fit_status: string | null }[]): SourceSuccess[] {
  const by = new Map<string, SourceSuccess>()
  for (const r of rows) {
    const source = (r.source ?? '').trim() || NO_SOURCE
    const key = source.toLowerCase()
    const cur = by.get(key) ?? { source, landed: 0, total: 0 }
    cur.total += 1
    if (r.prospect_fit_status === 'converted') cur.landed += 1
    by.set(key, cur)
  }
  return [...by.values()].sort((a, b) => b.total - a.total || b.landed - a.landed || a.source.localeCompare(b.source))
}

function digits(s: string | null | undefined): string {
  return (s ?? '').replace(/\D/g, '')
}

/**
 * A company already on the bench, by the same name (case-blind) or the same phone (seven digits
 * or more): the double New Prospect warns about. Null when there is none.
 */
export function benchDouble<T extends { name: string; phone: string | null }>(name: string, phone: string | null | undefined, companies: readonly T[]): T | null {
  const n = name.trim().toLowerCase()
  const d = digits(phone)
  for (const c of companies) {
    if (n && c.name.trim().toLowerCase() === n) return c
    if (d.length >= 7 && digits(c.phone) === d) return c
  }
  return null
}

/**
 * The bench's trade names not yet in the Trades box, for the picks under it (v2.5560): the strip
 * counts a sub by the bench's own spelling, so a pick beats a name typed by hand.
 */
export function tradesLeftToPick(choices: readonly string[], text: string): string[] {
  const have = new Set(parseTradesText(text).map(tradeKey))
  const out: string[] = []
  for (const choice of choices) {
    const key = tradeKey(choice)
    if (!key || have.has(key)) continue
    have.add(key)
    out.push(choice.trim())
  }
  return out
}

/** The Trades box's text with one more trade, in the bench's spelling. */
export function withTrade(text: string, trade: string): string {
  return tradesText(parseTradesText(`${text},${trade}`))
}

export const BY_NEED_NOTE = 'By need: the trade with the biggest gap first, then never called, then coldest.'

/** The bench's door into this lane, on one trade. */
export function subsLaneHref(trade: string | null): string {
  return trade ? `/prospects?tab=subs&trade=${encodeURIComponent(trade)}` : '/prospects?tab=subs'
}
