/**
 * The Subs lane's stages (v2.5807, punch list #153, PR 1): the path a trade company walks from
 * the lane onto the bench, read from what the lane already records. The owner, 2026-10-23: the
 * page did not say "how someone can move off this page into some sort of list that we want to
 * call when we have jobs", and he pointed at Hiring's columns. The strip over the lane is that
 * path, To call → Called → Talked → On the bench → Quoted, the last two doors to Trade partners,
 * and the Prospect List groups the companies by trade in the needs panel's order, the trades a
 * set of plans needs first when a project is picked.
 *
 * A stage is never stored: a call logged moves a company to Called, an Answered to Talked,
 * Add to the bench ✓ onto the bench (`prospect_fit_status = 'converted'` with the company's id),
 * and the company's first quote on the bench to Quoted. Everything here is pure.
 */
import type { GcBookTrade, GcNeed, GcNeeds } from './gcNeeds'
import { daysUntil } from './gcLeadLane'
import { tradeKey } from './subsLane'

export type SubStage = 'to_call' | 'called' | 'talked' | 'on_bench' | 'quoted'
export type SubExit = 'cant_reach' | 'not_a_fit'

export const SUB_STAGES: readonly SubStage[] = ['to_call', 'called', 'talked', 'on_bench', 'quoted']
export const SUB_EXITS: readonly SubExit[] = ['cant_reach', 'not_a_fit']

export const SUB_STAGE_WORDS: Record<SubStage, string> = {
  to_call: 'To call',
  called: 'Called',
  talked: 'Talked',
  on_bench: 'On the bench',
  quoted: 'Quoted',
}

export const SUB_EXIT_WORDS: Record<SubExit, string> = {
  cant_reach: "Can't reach",
  not_a_fit: 'Not a fit',
}

/** What moves a company right, under the strip. Four short sentences, so a first-timer can follow. */
export const SUB_STRIP_SENTENCE =
  "Didn't Answer moves a company to Called. Answered moves it to Talked. Add to the bench ✓ puts it on the bench. Their first quote moves it to Quoted."

/** The bench's two stages live on Trade partners; the strip's boxes for them are doors there. */
export const TRADE_PARTNERS_HREF = '/gc?view=partners'

export function stageHref(stage: SubStage): string | null {
  return stage === 'on_bench' || stage === 'quoted' ? TRADE_PARTNERS_HREF : null
}

export type StageRow = { id: string; prospect_fit_status: string | null; converted_gc_company_id: string | null }

export interface StageIn {
  /** Prospects with a Didn't Answer or an Answered on record (the queue's own rule). */
  calledIds: ReadonlySet<string>
  /** Prospects with at least one Answered. */
  answeredIds: ReadonlySet<string>
  /** Bench companies with a quote in on any ask. */
  quotedCompanyIds: ReadonlySet<string>
}

/** Where one company stands on the path, or which exit it took. */
export function subStage(row: StageRow, inp: StageIn): SubStage | SubExit {
  if (row.prospect_fit_status === 'cant_reach') return 'cant_reach'
  if (row.prospect_fit_status === 'not_a_fit') return 'not_a_fit'
  if (row.prospect_fit_status === 'converted') {
    return row.converted_gc_company_id && inp.quotedCompanyIds.has(row.converted_gc_company_id) ? 'quoted' : 'on_bench'
  }
  if (inp.answeredIds.has(row.id)) return 'talked'
  if (inp.calledIds.has(row.id)) return 'called'
  return 'to_call'
}

export function isSubExit(stage: SubStage | SubExit): stage is SubExit {
  return stage === 'cant_reach' || stage === 'not_a_fit'
}

export interface StageCount {
  stage: SubStage
  n: number
}

/** The strip's five counts, in path order, and the exits folded under it. */
export function stageCounts(rows: readonly StageRow[], inp: StageIn): { stages: StageCount[]; exits: { exit: SubExit; n: number }[] } {
  const by = new Map<SubStage | SubExit, number>()
  for (const row of rows) {
    const s = subStage(row, inp)
    by.set(s, (by.get(s) ?? 0) + 1)
  }
  return {
    stages: SUB_STAGES.map((stage) => ({ stage, n: by.get(stage) ?? 0 })),
    exits: SUB_EXITS.map((exit) => ({ exit, n: by.get(exit) ?? 0 })),
  }
}

/** The chip's tone on a row: green while nobody has called, amber once called, blue once talked, violet on the bench. */
export type StageTone = 'green' | 'amber' | 'blue' | 'violet' | 'grey'

export function stageTone(stage: SubStage | SubExit): StageTone {
  switch (stage) {
    case 'to_call':
      return 'green'
    case 'called':
      return 'amber'
    case 'talked':
      return 'blue'
    case 'on_bench':
    case 'quoted':
      return 'violet'
    default:
      return 'grey'
  }
}

export function stageWords(stage: SubStage | SubExit): string {
  return isSubExit(stage) ? SUB_EXIT_WORDS[stage] : SUB_STAGE_WORDS[stage]
}

/**
 * What a row offers: Call now → while a call is still the next step, and Add to the bench ✓ beside
 * it once someone has talked to them. A company on the bench or out an exit offers neither.
 */
export function rowPress(stage: SubStage | SubExit): 'call' | 'call_or_bench' | null {
  if (stage === 'to_call' || stage === 'called') return 'call'
  if (stage === 'talked') return 'call_or_bench'
  return null
}

// ---------- the moment a set of plans lands: the For picker ----------

export interface PlansChoice {
  id: string
  name: string
  bidDue: string | null
  daysLeft: number | null
  /** The trades the project buys out, in the project's package order; our own trades left out. */
  trades: string[]
  /** The package behind each trade, by `tradeKey`, for the ask on landing. */
  packageByTrade: Record<string, string>
}

type PlansProject = {
  id: string
  name: string
  stage: string
  bidDue: string | null
  lostOn: string | null
  packages: readonly { id: string; trade: string; ours: boolean }[]
}

/**
 * The projects a set of plans could be for: out for a bid now, soonest due first, each with the
 * trades it buys out. A lost project is over, and one being built is past bidding.
 */
export function plansChoices(projects: readonly PlansProject[], todayYmd: string): PlansChoice[] {
  return projects
    .filter((p) => !p.lostOn && (p.stage === 'bidding' || p.stage === 'pursuing'))
    .map((p) => {
      const trades: string[] = []
      const packageByTrade: Record<string, string> = {}
      const seen = new Set<string>()
      for (const pkg of p.packages) {
        const key = tradeKey(pkg.trade)
        if (pkg.ours || !key || seen.has(key)) continue
        seen.add(key)
        trades.push(pkg.trade.trim())
        packageByTrade[key] = pkg.id
      }
      return { id: p.id, name: p.name, bidDue: p.bidDue, daysLeft: p.bidDue ? daysUntil(p.bidDue, todayYmd) : null, trades, packageByTrade }
    })
    .sort((a, b) => (a.daysLeft ?? 9999) - (b.daysLeft ?? 9999) || a.name.localeCompare(b.name))
}

/** The picker's line for one project: the name, when bids are due, how many trades it buys out. */
export function plansChoiceWords(c: PlansChoice): string {
  const due = !c.bidDue || c.daysLeft === null ? 'no due day' : c.daysLeft < 0 ? 'bids were due' : c.daysLeft === 0 ? 'bids due today' : c.daysLeft === 1 ? 'bids due tomorrow' : `bids due in ${c.daysLeft} days`
  const n = c.trades.length
  return `${c.name} · ${due} · ${n} ${n === 1 ? 'trade' : 'trades'} to buy out`
}

export const PLANS_PICKER_LABEL = 'For'
export const PLANS_PICKER_NONE = 'every trade'
/** The one-line hint beside the picker when nothing is picked. */
export const PLANS_PICKER_HINT = 'Pick the project a set of plans is for. Its trades come first.'

// ---------- the Prospect List by trade ----------

export interface TradeGroup<T> {
  trade: string
  subs: T[]
  /** The panel's row for the trade, when the bench or an ask knows it. */
  need: GcNeed | null
  /** The book's line for the trade, when nobody on the bench does it yet. */
  book: GcBookTrade | null
  /** True when the picked project needs the trade. */
  lit: boolean
}

/**
 * The lane grouped by trade in the needs panel's order (short of quotes, then the bench, then the
 * book), the picked project's trades first and lit. A sub that names two trades sits in both
 * groups; one that names none sits under `noTrade`. A trade nobody on the panel knows (typed by
 * hand on a sub) comes last, in name order.
 */
export function groupSubsByTrade<T extends { id: string; trades: string[] | null }>(
  subs: readonly T[],
  needs: Pick<GcNeeds, 'rows' | 'book'>,
  pickedTrades: readonly string[] | null,
): { groups: TradeGroup<T>[]; noTrade: T[] } {
  const picked = new Set((pickedTrades ?? []).map(tradeKey))
  const order: { trade: string; need: GcNeed | null; book: GcBookTrade | null }[] = [
    ...needs.rows.map((need) => ({ trade: need.trade, need, book: null })),
    ...needs.book.map((book) => ({ trade: book.trade, need: null, book })),
  ]
  const byKey = new Map<string, TradeGroup<T>>()
  for (const o of order) {
    const key = tradeKey(o.trade)
    if (!key || byKey.has(key)) continue
    byKey.set(key, { trade: o.trade, subs: [], need: o.need, book: o.book, lit: picked.has(key) })
  }
  const noTrade: T[] = []
  for (const s of subs) {
    const trades = (s.trades ?? []).map((t) => t.trim()).filter(Boolean)
    if (trades.length === 0) {
      noTrade.push(s)
      continue
    }
    for (const trade of trades) {
      const key = tradeKey(trade)
      let g = byKey.get(key)
      if (!g) {
        g = { trade, subs: [], need: null, book: null, lit: picked.has(key) }
        byKey.set(key, g)
      }
      if (!g.subs.some((x) => x.id === s.id)) g.subs.push(s)
    }
  }
  const known = new Set(order.map((o) => tradeKey(o.trade)))
  const groups = [...byKey.values()]
  const rank = (g: TradeGroup<T>) => order.findIndex((o) => tradeKey(o.trade) === tradeKey(g.trade))
  groups.sort((a, b) => {
    if (a.lit !== b.lit) return a.lit ? -1 : 1
    const ka = known.has(tradeKey(a.trade))
    const kb = known.has(tradeKey(b.trade))
    if (ka !== kb) return ka ? -1 : 1
    if (ka && kb) return rank(a) - rank(b)
    return a.trade.localeCompare(b.trade)
  })
  return { groups, noTrade }
}

export const NO_TRADE_GROUP = 'No trade named yet'

/** The words beside a group's name: the picked project's need, else the bench's line. */
export function groupHeadWords(g: Pick<TradeGroup<unknown>, 'need' | 'book' | 'lit'>, projectName: string | null): string {
  const parts: string[] = []
  if (g.lit && projectName) parts.push(`for ${projectName}`)
  if (g.need) {
    if (g.need.onBench === 0) parts.push('nobody on the bench')
    else parts.push(`${g.need.onBench} on the bench${g.need.benchShort > 0 ? `, wants ${g.need.benchShort} more` : ''}`)
    if (g.need.asks.length > 0) parts.push(`${g.need.asks.length === 1 ? 'an ask' : `${g.need.asks.length} asks`} short of quotes`)
  } else if (g.book) parts.push('nobody on the bench')
  return parts.join(' · ')
}

/** The deck's door on a group: the lane filtered to the trade, on Follow Up. */
export function callForTradeHref(trade: string, projectId: string | null): string {
  const params = new URLSearchParams({ tab: 'follow-up', kind: 'subs', trade })
  if (projectId) params.set('for', projectId)
  return `/prospects?${params.toString()}`
}
