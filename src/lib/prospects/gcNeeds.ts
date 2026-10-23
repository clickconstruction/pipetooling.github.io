/**
 * What GC mode needs right now, read from the caller's side (v2.5782, punch list #148): the Subs lane
 * opens on a panel, one row a trade, each row leading to the companies to call in the owner's order,
 * the bench first, then the prospects here, then Add a sub. The rows come from the bench as GC mode's
 * own `tradeBenches` reads it (every open ask short of quotes, with its project and its due day, and
 * every trade a company does), the lane's queue, and the scope book's trades, so the canvas is never
 * blank even before a project asks.
 *
 * Everything here is pure; the page feeds it the bench, the queue and our own trades.
 */
import { BENCH_WANTED, type TradeBench } from '../gc/bench'
import { BIDS_WANTED } from '../gc/bids'
import { TRADE_TEMPLATES } from '../gc/plans'
import { daysUntil, shortDay } from './gcLeadLane'
import { tradeKey } from './subsLane'

/** One open ask on one project, as the panel reads it. */
export interface GcAskIn {
  projectId: string
  projectName: string
  bids: number
  /** Quotes still missing against the two we want. */
  short: number
  bidDue: string | null
  daysLeft: number | null
  /** Companies on the bench asked on this project. */
  asked: number
  /** Companies on the bench not asked on this project yet. */
  unasked: number
}

/** One trade as the bench stands: who does it, who answers, and the asks out for it. */
export interface GcBenchIn {
  trade: string
  onBench: number
  dependable: number
  asks: GcAskIn[]
}

/** The bench as GC mode's `tradeBenches` gives it, narrowed to what the panel reads. */
export function gcBenchInput(benches: readonly TradeBench[]): GcBenchIn[] {
  return benches.map((b) => ({
    trade: b.trade,
    onBench: b.partners.length,
    dependable: b.dependable,
    asks: b.needs.map((need) => {
      const askedIds = new Set(need.pkg.invites.map((i) => i.partnerId))
      const unasked = b.partners.filter((p) => !askedIds.has(p.id)).length
      return {
        projectId: need.project.id,
        projectName: need.project.name,
        bids: need.bids,
        short: need.short,
        bidDue: need.project.bidDue,
        daysLeft: need.daysLeft,
        asked: askedIds.size,
        unasked,
      }
    }),
  }))
}

/** Why a trade is on the panel: an ask is short of quotes, a company does it, or only the book names it. */
export type GcNeedWhy = 'quotes' | 'bench' | 'book'

export interface GcNeed {
  trade: string
  why: GcNeedWhy
  /** The open asks short of quotes, soonest due first. Empty under `bench`. */
  asks: GcAskIn[]
  onBench: number
  dependable: number
  /** How many more the bench wants: three a trade, never below zero. */
  benchShort: number
  /** Subs in this lane's queue that name the trade. */
  toCall: number
  /** Companies on the bench not asked yet on the soonest short ask. Zero without an ask. */
  unasked: number
}

/** A trade nobody does yet: the scope book's, or one only a sub here names. */
export interface GcBookTrade {
  trade: string
  toCall: number
}

export interface GcNeeds {
  /** The rows, worst first: short of quotes, then short on the bench, then deep. */
  rows: GcNeed[]
  /** The folded line: trades nobody on the bench does, the book's order first, then the subs' own. */
  book: GcBookTrade[]
  /** Open asks short of quotes, across every row. */
  asksShort: number
  /** Projects with at least one ask short of quotes. */
  projectsShort: number
}

type SubRow = { trades: string[] | null; prospect_fit_status: string | null }

/** The scope book's trades, in the book's order. */
export const BOOK_TRADES: readonly string[] = TRADE_TEMPLATES.map((t) => t.trade)

function toCallByTrade(subs: readonly SubRow[]): Map<string, { trade: string; n: number }> {
  const out = new Map<string, { trade: string; n: number }>()
  for (const s of subs) {
    if (s.prospect_fit_status != null) continue
    for (const trade of s.trades ?? []) {
      const key = tradeKey(trade)
      if (!key) continue
      const cur = out.get(key)
      if (cur) cur.n += 1
      else out.set(key, { trade: trade.trim(), n: 1 })
    }
  }
  return out
}

function soonest(a: GcAskIn, b: GcAskIn): number {
  return (a.daysLeft ?? 9999) - (b.daysLeft ?? 9999) || b.short - a.short || a.projectName.localeCompare(b.projectName)
}

/**
 * The panel: every trade a company does or an ask is out for, worst first, then the trades nobody
 * does yet. Our own trades (the ones we self-perform) never show, since we do not buy them out.
 */
export function gcNeeds(benches: readonly GcBenchIn[], subs: readonly SubRow[], ownTrades: readonly string[] = [], bookTrades: readonly string[] = BOOK_TRADES): GcNeeds {
  const own = new Set(ownTrades.map(tradeKey))
  const toCall = toCallByTrade(subs)
  const rows: GcNeed[] = []
  const seen = new Set<string>()
  let asksShort = 0
  const projectsShort = new Set<string>()
  for (const b of benches) {
    const key = tradeKey(b.trade)
    if (!key || own.has(key) || seen.has(key)) continue
    const asks = b.asks.filter((a) => a.short > 0).sort(soonest)
    if (b.onBench === 0 && asks.length === 0) continue
    seen.add(key)
    asksShort += asks.length
    for (const a of asks) projectsShort.add(a.projectId)
    rows.push({
      trade: b.trade,
      why: asks.length > 0 ? 'quotes' : 'bench',
      asks,
      onBench: b.onBench,
      dependable: b.dependable,
      benchShort: Math.max(0, BENCH_WANTED - b.dependable),
      toCall: toCall.get(key)?.n ?? 0,
      unasked: asks[0]?.unasked ?? 0,
    })
  }
  rows.sort((x, y) => {
    if (x.why !== y.why) return x.why === 'quotes' ? -1 : 1
    const a = x.asks[0]
    const b = y.asks[0]
    if (x.why === 'quotes' && a && b) return soonest(a, b) || x.trade.localeCompare(y.trade)
    return y.benchShort - x.benchShort || y.toCall - x.toCall || x.trade.localeCompare(y.trade)
  })
  const book: GcBookTrade[] = []
  for (const trade of bookTrades) {
    const key = tradeKey(trade)
    if (!key || own.has(key) || seen.has(key)) continue
    seen.add(key)
    book.push({ trade, toCall: toCall.get(key)?.n ?? 0 })
  }
  const extra: GcBookTrade[] = []
  for (const [key, v] of toCall) {
    if (seen.has(key) || own.has(key)) continue
    seen.add(key)
    extra.push({ trade: v.trade, toCall: v.n })
  }
  extra.sort((x, y) => y.toCall - x.toCall || x.trade.localeCompare(y.trade))
  return { rows, book: [...book, ...extra], asksShort, projectsShort: projectsShort.size }
}

export type NeedTone = 'red' | 'amber' | 'green' | 'quiet'

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`
}

/** The ask's quotes: "1 of 2 quotes", red at none, amber while short, green when the two are in. */
export function quotesWords(ask: Pick<GcAskIn, 'bids' | 'short'>): { text: string; tone: NeedTone } {
  return { text: `${ask.bids} of ${BIDS_WANTED} quotes`, tone: ask.bids === 0 ? 'red' : ask.short > 0 ? 'amber' : 'green' }
}

/** The ask's day: "due Oct 24, tomorrow", red inside a week or past, quiet further out or unset. */
export function dueWords(bidDue: string | null, daysLeft: number | null): { text: string; tone: NeedTone } {
  if (!bidDue || daysLeft === null) return { text: 'no due day set', tone: 'quiet' }
  const day = shortDay(bidDue)
  if (daysLeft < 0) return { text: `bids were due ${day}`, tone: 'red' }
  if (daysLeft === 0) return { text: `due ${day}, today`, tone: 'red' }
  if (daysLeft === 1) return { text: `due ${day}, tomorrow`, tone: 'red' }
  return { text: `due ${day}, in ${daysLeft} days`, tone: daysLeft <= 7 ? 'red' : 'quiet' }
}

/** The ask's day from the calendar, for a page that has no `daysLeft` yet. */
export function dueWordsOn(bidDue: string | null, todayYmd: string): { text: string; tone: NeedTone } {
  return dueWords(bidDue, bidDue ? daysUntil(bidDue, todayYmd) : null)
}

/**
 * The row's bench line, as parts the page joins with a dot: who does the trade, who answers, who is
 * not asked yet on the soonest ask (or that everyone is), what the bench still wants, and who waits
 * here to call.
 */
export function benchLineParts(need: Pick<GcNeed, 'asks' | 'onBench' | 'dependable' | 'benchShort' | 'toCall' | 'unasked'>): string[] {
  const parts: string[] = []
  if (need.onBench === 0) parts.push('nobody on the bench')
  else {
    parts.push(`${need.onBench} on the bench${need.dependable < need.onBench ? `, ${need.dependable} answer` : ''}`)
    if (need.asks.length > 0) parts.push(need.unasked > 0 ? `${need.unasked} not asked yet` : 'everyone asked')
    else parts.push(need.benchShort > 0 ? `wants ${need.benchShort} more` : 'deep enough')
  }
  parts.push(`${need.toCall} to call here`)
  return parts
}

/** Which door is the best next press on a row: ask the bench, call the subs here, or add a sub. */
export function bestDoor(need: Pick<GcNeed, 'asks' | 'toCall' | 'unasked'>): 'ask' | 'call' | 'add' {
  if (need.asks.length > 0 && need.unasked > 0) return 'ask'
  if (need.toCall > 0) return 'call'
  return 'add'
}

/** The panel's head line: how short GC mode is right now. */
export function needsHeadWords(n: Pick<GcNeeds, 'asksShort' | 'projectsShort'>): string {
  if (n.asksShort > 0) return `${plural(n.asksShort, 'ask', 'asks')} short of quotes on ${plural(n.projectsShort, 'project', 'projects')}`
  return 'no ask is short of quotes'
}

/** The two numbers the panel holds GC mode to, as GC mode's own kernels set them. */
export const NEEDS_RULE = `${BIDS_WANTED} quotes on every ask, ${BENCH_WANTED} a trade on the bench`

/** The group headings over the rows. */
export const NEEDS_GROUP_WORDS: Record<GcNeedWhy, string> = {
  quotes: 'Short of quotes',
  bench: 'On the bench',
  book: 'Nobody does these yet',
}

/** Trade partners on one trade: the page scrolls to that trade's bench. */
export function tradePartnersHref(trade: string): string {
  return `/gc?view=partners&trade=${encodeURIComponent(trade)}`
}

/** The chip's words on the folded line: the trade, and how many wait here when any do. */
export function bookChipWords(t: GcBookTrade): string {
  return t.toCall > 0 ? `${t.trade} · ${t.toCall} to call` : t.trade
}
