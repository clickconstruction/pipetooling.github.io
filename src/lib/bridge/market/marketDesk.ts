/**
 * The Market desk (punch list #192, v2.5931): the intake over the relationship
 * book, behind the Bridge's Market card. One question: is enough work being
 * asked of us to keep the field fed, and who actually feeds us? A strip of
 * asks by value over the last MARKET_DESK_WEEKS pay weeks, one row per GC by
 * what the relationship pays (feeding, fading, new name, dead weight), the
 * narrowing verdict, the pricing-spend verdict, and an honest panel on what
 * the desk cannot see. It reads and opens doors; nothing records here.
 *
 * Every sentence a first-timer reads comes from this file and is held to the
 * plain-words rule (`marketDesk.test.ts` runs `plainWordsFailures` over all of
 * them). Pure: no React, no Supabase.
 */
import { payWeekContaining } from '../../payWeekAnchor'
import { ymdAddDays } from '../../../utils/dateUtils'
import { stageUsd } from '../stageFlow'

/** Owner call (punch list #192): the strip and the book read this many pay weeks back, the current week included; default 26. */
export const MARKET_DESK_WEEKS = 26
/** Owner call (punch list #192): a GC is fading when its asks this quarter are under this share of its quarterly norm over the span; default 0.5. */
export const MARKET_FADING_SHARE = 0.5
/** Owner call (punch list #192): dead weight is at least this many priced bids in the span with nothing won and nothing answered; default 6. */
export const MARKET_DEAD_WEIGHT_BIDS = 6
/** Owner call (punch list #192): a new name is a GC whose first-ever bid is inside this many days; default 91. */
export const MARKET_NEW_NAME_DAYS = 91
/** A quarter of the span in pay weeks: the tiles' "this quarter", the book's bars and the fading rule read it. */
export const MARKET_QUARTER_WEEKS = 13
/** The book shows this many rows before it folds the rest into one line. */
export const MARKET_BOOK_ROWS = 8

export type MarketDeskBid = {
  id: string
  createdYmd: string | null
  sentYmd: string | null
  /** The bid's value; the agreed value once there is one. */
  usd: number
  outcome: string | null
  outcomeYmd: string | null
  /** The day a job was created from the bid, if one was. */
  jobCreatedYmd: string | null
  /**
   * The asker's id: the bid's customer_id when the bid has a customer, else its gc_builder_id, else null.
   * The bid form stores the GC as the bid's customer and leaves gc_builder_id null (`bidFormPayload.ts`),
   * so the book keys on the customer; `marketAskerId` is the one rule. The name stays from v2.5931.
   */
  gcId: string | null
  projectName: string | null
}

export type MarketDeskEstimate = {
  id: string
  createdYmd: string
  sentYmd: string | null
  status: string
  usd: number
  acceptedYmd: string | null
  updatedYmd: string | null
}

/** A GC's bids over its whole record, answered and won by the bid's own outcome: the read behind "never answered". */
export type MarketLifetime = { bids: number; answered: number; won: number }

export type MarketDeskInput = {
  todayYmd: string
  /** The Market card's window start: the headline's pace averages the asks since it, the way the card does. */
  windowStart: string
  bids: MarketDeskBid[]
  estimates: MarketDeskEstimate[]
  /** Names by asker id, in one map: the customers' names for the bids' customer ids, the GC list's for the rest. */
  gcNames: ReadonlyMap<string, string>
  /** Every GC's first-ever bid day, over all bids on record: the new-name read. Keyed by `marketAskerId`. */
  firstBidYmdByGc: ReadonlyMap<string, string>
  /** Every GC's bids on record by the bid's own outcome, the "never answered" read. Absent, a dead-weight GC's words stay with the span. */
  lifetimeByGc?: ReadonlyMap<string, MarketLifetime>
  /** The window's win share by value (`marketWinShare`); null until something was sent. */
  winShare: number | null
  /** Dollars a week the field builds; null until Build reads. */
  fieldPerWeekUsd: number | null
  dayLabel?: (ymd: string) => string
}

export type MarketWeek = {
  start: string
  end: string
  gcUsd: number
  customerUsd: number
  totalUsd: number
  asks: number
  /** "Oct 25" */
  label: string
  /** "Week of Oct 25: $39k asked, $25k from GCs, $14k from customers" */
  ariaLabel: string
  isCurrent: boolean
}

export type MarketRowState = 'feeding' | 'fading' | 'new name' | 'dead weight'

export type MarketQuarter = {
  /** "Last quarter" / "This quarter so far" */
  label: string
  askedUsd: number
  asks: number
  wonUsd: number
  answered: number
  current: boolean
  /** "$42k" / "awaiting" / "—" */
  wonWords: string
}

export type MarketRow = {
  key: string
  name: string
  kind: 'gc' | 'no-gc' | 'customers'
  /** A label line: "GC · last ask Oct 22" or "GC · 10 weeks quiet". */
  desc: string
  state: MarketRowState
  quarters: MarketQuarter[]
  askedUsd: number
  asks: number
  wonUsd: number
  wonCount: number
  answered: number
  /** Bids in the span with a value on them. */
  pricedBids: number
  zeroBids: number
  /** The lifetime read says this GC has never answered a bid. False when the read is absent or shows an answer. */
  neverAnswered: boolean
  /** "$1.1M · 19 bids" */
  askedWords: string
  /** "$118k" or "—" */
  paysWords: string
  detLine: string
  door: { href: string; label: string }
  lastAskYmd: string | null
}

export type MarketTile = { head: string; value: string; delta: string | null; deltaTone: 'red' | 'green' | 'plain'; words: string }

export type MarketHeader = { headline: string; subLine: string; feedUsd: number | null }

export type MarketDesk = {
  spanStart: string
  weeks: MarketWeek[]
  /** The Market card's pace: asks a week over its window. */
  askedPerWeekUsd: number
  /** What feeding the field takes a week asked: the field's pace over the win share. Null when either is missing. */
  feedUsd: number | null
  /** Why the feed line is missing, when it is. */
  feedMissing: string | null
  emptyWeeksNote: string | null
  legend: { gc: string; customers: string }
  headline: string
  verdict: string
  subLine: string
  tiles: [MarketTile, MarketTile, MarketTile]
  rows: MarketRow[]
  restLine: string | null
  pricingSpend: string[]
  zeroBids: { count: number; words: string } | null
  cannotSee: string
  howItReads: string
  recordedLine: string
}

const DAY_MS = 86_400_000
const defaultDayLabel = (ymd: string): string => new Date(`${ymd}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
const monthLabel = (ymd: string): string => new Date(`${ymd}T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', timeZone: 'UTC' })
const daysBetween = (a: string, b: string): number => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY_MS)
const plural = (n: number, one: string, many: string): string => (n === 1 ? one : many)
const pct = (n: number): string => `${Math.round(n * 100)}%`

export const MARKET_CANNOT_SEE = 'Courting, reputation, invites that die before a bid exists. A GC enters the book at their first invite and not before. This page shows where relationship time pays and where it burns. It cannot make the calls.'

export const MARKET_RECORDED_LINE = 'No plan is recorded here. The week’s call stays with the lit link above.'

const NO_GC_KEY = 'no-gc'
const CUSTOMERS_KEY = 'customers'

type Ask = { ymd: string; usd: number; source: 'gc' | 'customer' }

/** A bid is won when it is marked won, marked started or complete (the Sales card's rule, `demandPace.ts`), or a job was created from it. */
export function bidWon(b: Pick<MarketDeskBid, 'outcome' | 'jobCreatedYmd'>): boolean {
  return b.outcome === 'won' || b.outcome === 'started_or_complete' || !!b.jobCreatedYmd
}

/** A bid is answered when it is won or marked lost. */
export function bidAnswered(b: Pick<MarketDeskBid, 'outcome' | 'jobCreatedYmd'>): boolean {
  return bidWon(b) || b.outcome === 'lost'
}

/**
 * The asker behind a bid: its customer when it has one, else its gc_builder_id, else null (the no-GC row).
 * The bid form writes the GC as the bid's customer, so the customer comes first; the GC list is the fallback.
 */
export function marketAskerId(b: { customerId: string | null; gcBuilderId: string | null }): string | null {
  return b.customerId ?? b.gcBuilderId ?? null
}

/** One bid on record, as the first-bids read returns it: who asked, when, and the bid's own outcome. */
export type MarketRecordBid = { customerId: string | null; gcBuilderId: string | null; createdYmd: string | null; outcome: string | null }

/**
 * Every asker's first-ever bid day and its bids on record by the bid's own outcome, folded by `marketAskerId`:
 * the new-name and never-answered reads. No job rows here, so a bid that became a job without the won mark
 * stays unanswered. A bid with no asker is skipped; a bid with no created day counts in the record but not the first day.
 */
export function foldMarketRecord(rows: ReadonlyArray<MarketRecordBid>): { firstBidYmdByGc: Map<string, string>; lifetimeByGc: Map<string, MarketLifetime> } {
  const firstBidYmdByGc = new Map<string, string>()
  const lifetimeByGc = new Map<string, MarketLifetime>()
  for (const r of rows) {
    const id = marketAskerId(r)
    if (!id) continue
    const life = lifetimeByGc.get(id) ?? { bids: 0, answered: 0, won: 0 }
    const mark = { outcome: r.outcome, jobCreatedYmd: null }
    life.bids += 1
    if (bidAnswered(mark)) life.answered += 1
    if (bidWon(mark)) life.won += 1
    lifetimeByGc.set(id, life)
    if (!r.createdYmd) continue
    const have = firstBidYmdByGc.get(id)
    if (!have || r.createdYmd < have) firstBidYmdByGc.set(id, r.createdYmd)
  }
  return { firstBidYmdByGc, lifetimeByGc }
}

function median(values: number[]): number | null {
  if (!values.length) return null
  const s = [...values].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? (s[mid] as number) : ((s[mid - 1] as number) + (s[mid] as number)) / 2
}

/** The headline and its sub-line from what the page already knows, so the header draws before the desk's reads land. */
export function marketHeader(args: { askedPerWeekUsd: number; winShare: number | null; fieldPerWeekUsd: number | null }): MarketHeader {
  const { askedPerWeekUsd, winShare, fieldPerWeekUsd } = args
  const converts = winShare != null ? askedPerWeekUsd * winShare : null
  const feedUsd = winShare != null && winShare > 0 && fieldPerWeekUsd != null && fieldPerWeekUsd > 0 ? fieldPerWeekUsd / winShare : null
  let headline = `About ${stageUsd(askedPerWeekUsd)} a week asked`
  if (converts != null && fieldPerWeekUsd != null) headline += converts >= fieldPerWeekUsd ? ', enough for the field' : ', short of the field'
  const parts: string[] = []
  if (converts != null) parts.push(`That is worth about ${stageUsd(converts)} a week at the ${pct(winShare as number)} win share.`)
  else parts.push('The win share is not readable yet. Nothing was sent in the window.')
  if (fieldPerWeekUsd != null) parts.push(`The field builds ${stageUsd(fieldPerWeekUsd)} a week.`)
  else parts.push('The field’s pace is not readable yet.')
  if (feedUsd != null) parts.push(`Feeding it takes about ${stageUsd(feedUsd)} a week asked, or a better share.`)
  return { headline, subLine: parts.join(' '), feedUsd }
}

/** The one bold sentence under the headline: this week's move, from the fading GCs and the GC with the most $0 bids. */
export function marketVerdict(rows: ReadonlyArray<Pick<MarketRow, 'kind' | 'name' | 'state' | 'zeroBids'>>): string {
  const fading = rows.filter((r) => r.kind === 'gc' && r.state === 'fading')
  const zero = rows.filter((r) => r.kind === 'gc' && r.zeroBids > 0).sort((a, b) => b.zeroBids - a.zeroBids)[0] ?? null
  const clauses: string[] = []
  if (fading.length === 1) clauses.push(`call ${(fading[0] as MarketRow).name}`)
  else if (fading.length > 1) clauses.push(`call the ${fading.length} quiet GCs`)
  if (zero) clauses.push(`put a value on ${zero.name}’s ${zero.zeroBids === 1 ? 'bid' : `${zero.zeroBids} bids`}`)
  if (!clauses.length) return 'The asks are steady. Keep the book warm.'
  const move = clauses.join(' and ')
  return `${move.charAt(0).toUpperCase()}${move.slice(1)}. That is this week’s lever.`
}

export function buildMarketDesk(input: MarketDeskInput): MarketDesk {
  const { todayYmd, windowStart, gcNames, firstBidYmdByGc, lifetimeByGc, winShare, fieldPerWeekUsd } = input
  const dayLabel = input.dayLabel ?? defaultDayLabel
  const current = payWeekContaining(todayYmd)
  const spanStart = ymdAddDays(current.start, -7 * (MARKET_DESK_WEEKS - 1))
  const weekIndex = (ymd: string): number => Math.floor(daysBetween(spanStart, ymd) / 7)
  const inSpan = (ymd: string | null): ymd is string => !!ymd && ymd >= spanStart && ymd <= todayYmd

  // The cells: one per pay week over the span, the last one the current week.
  const cells = Array.from({ length: MARKET_DESK_WEEKS }, (_, i): MarketWeek => {
    const start = ymdAddDays(spanStart, 7 * i)
    return { start, end: ymdAddDays(start, 6), gcUsd: 0, customerUsd: 0, totalUsd: 0, asks: 0, label: dayLabel(start), ariaLabel: '', isCurrent: i === MARKET_DESK_WEEKS - 1 }
  })
  const asks: Ask[] = []
  for (const b of input.bids) if (inSpan(b.createdYmd)) asks.push({ ymd: b.createdYmd, usd: b.usd, source: 'gc' })
  for (const e of input.estimates) if (inSpan(e.createdYmd)) asks.push({ ymd: e.createdYmd, usd: e.usd, source: 'customer' })
  for (const a of asks) {
    const c = cells[weekIndex(a.ymd)]
    if (!c) continue
    if (a.source === 'gc') c.gcUsd += a.usd
    else c.customerUsd += a.usd
    c.totalUsd += a.usd
    c.asks += 1
  }
  for (const c of cells) c.ariaLabel = `Week of ${c.label}: ${stageUsd(c.totalUsd)} asked${c.isCurrent ? ' so far' : ''}, ${stageUsd(c.gcUsd)} from GCs, ${stageUsd(c.customerUsd)} from customers`

  // The card's pace: the asks since the window start over its weeks, the way `demandPace.ts` counts them.
  const windowWeeks = Math.max(1, daysBetween(windowStart, todayYmd) / 7)
  let windowUsd = 0
  for (const b of input.bids) if (b.createdYmd && b.createdYmd >= windowStart && b.createdYmd <= todayYmd) windowUsd += b.usd
  for (const e of input.estimates) if (e.createdYmd >= windowStart && e.createdYmd <= todayYmd) windowUsd += e.usd
  const askedPerWeekUsd = windowUsd / windowWeeks
  const header = marketHeader({ askedPerWeekUsd, winShare, fieldPerWeekUsd })
  const feedMissing = header.feedUsd != null ? null : winShare == null || !(winShare > 0) ? 'The feed line needs the win share. Nothing was won in the window yet.' : 'The feed line needs the field’s pace. Build has not read yet.'

  const emptyWeeks = cells.filter((c) => !c.isCurrent && c.totalUsd === 0).length
  const emptyWeeksNote = emptyWeeks > 0 ? `${emptyWeeks} empty ${plural(emptyWeeks, 'week', 'weeks')} since ${monthLabel(spanStart)}.` : null
  const gcTotal = cells.reduce((s, c) => s + c.gcUsd, 0)
  const customerTotal = cells.reduce((s, c) => s + c.customerUsd, 0)
  const legend = { gc: `GC asks ${stageUsd(gcTotal)} in ${MARKET_DESK_WEEKS} weeks.`, customers: `Customer requests ${stageUsd(customerTotal)}.` }

  // The quarters: the span cut into MARKET_QUARTER_WEEKS-week quarters, the last one this quarter so far.
  const quarterCount = Math.max(1, Math.ceil(MARKET_DESK_WEEKS / MARKET_QUARTER_WEEKS))
  const quarterOf = (ymd: string): number => Math.max(0, quarterCount - 1 - Math.floor((MARKET_DESK_WEEKS - 1 - weekIndex(ymd)) / MARKET_QUARTER_WEEKS))
  const quarterLabel = (q: number): string => (q === quarterCount - 1 ? 'This quarter so far' : q === quarterCount - 2 ? 'Last quarter' : `${quarterCount - 1 - q} quarters back`)
  const thisQ = quarterCount - 1

  // The book: one row per GC that asked in the span, a row for bids with no GC, a row for the customers' estimates.
  type Acc = { key: string; name: string; kind: MarketRow['kind']; quarters: MarketQuarter[]; askedUsd: number; asks: number; wonUsd: number; wonCount: number; answered: number; zeroBids: number; lastAskYmd: string | null; pricedBids: number; paceDays: number[] }
  const acc = new Map<string, Acc>()
  const rowFor = (key: string, name: string, kind: MarketRow['kind']): Acc => {
    let r = acc.get(key)
    if (!r) {
      r = { key, name, kind, quarters: Array.from({ length: quarterCount }, (_, q) => ({ label: quarterLabel(q), askedUsd: 0, asks: 0, wonUsd: 0, answered: 0, current: q === thisQ, wonWords: '—' })), askedUsd: 0, asks: 0, wonUsd: 0, wonCount: 0, answered: 0, zeroBids: 0, lastAskYmd: null, pricedBids: 0, paceDays: [] }
      acc.set(key, r)
    }
    return r
  }
  const gcKey = (b: MarketDeskBid): string => (b.gcId ? `gc:${b.gcId}` : NO_GC_KEY)
  const gcName = (b: MarketDeskBid): string => (b.gcId ? gcNames.get(b.gcId) ?? 'A GC with no name on record' : 'No GC on the bid')
  for (const b of input.bids) {
    // Answer days come from every answered bid in the read, so a GC's pace rests on more than the span's asks.
    if (bidAnswered(b) && b.sentYmd && b.outcomeYmd) {
      const d = daysBetween(b.sentYmd, b.outcomeYmd)
      if (d >= 0) rowFor(gcKey(b), gcName(b), b.gcId ? 'gc' : 'no-gc').paceDays.push(d)
    }
    if (!inSpan(b.createdYmd)) continue
    const r = rowFor(gcKey(b), gcName(b), b.gcId ? 'gc' : 'no-gc')
    const q = r.quarters[quarterOf(b.createdYmd)] as MarketQuarter
    const won = bidWon(b)
    const answered = bidAnswered(b)
    r.askedUsd += b.usd
    r.asks += 1
    q.askedUsd += b.usd
    q.asks += 1
    if (won) {
      r.wonUsd += b.usd
      r.wonCount += 1
      q.wonUsd += b.usd
    }
    if (answered) {
      r.answered += 1
      q.answered += 1
    }
    if (b.usd > 0) r.pricedBids += 1
    if (!(b.usd > 0) && b.sentYmd) r.zeroBids += 1
    if (!r.lastAskYmd || b.createdYmd > r.lastAskYmd) r.lastAskYmd = b.createdYmd
  }
  for (const e of input.estimates) {
    if (!inSpan(e.createdYmd)) continue
    const r = rowFor(CUSTOMERS_KEY, 'Customers (estimates)', 'customers')
    const q = r.quarters[quarterOf(e.createdYmd)] as MarketQuarter
    const won = e.status === 'customer_accepted'
    const answered = won || e.status === 'declined'
    r.askedUsd += e.usd
    r.asks += 1
    q.askedUsd += e.usd
    q.asks += 1
    if (won) {
      r.wonUsd += e.usd
      r.wonCount += 1
      q.wonUsd += e.usd
    }
    if (answered) {
      r.answered += 1
      q.answered += 1
    }
    if (!r.lastAskYmd || e.createdYmd > r.lastAskYmd) r.lastAskYmd = e.createdYmd
  }

  const newNameFrom = ymdAddDays(todayYmd, -(MARKET_NEW_NAME_DAYS - 1))
  const stateOf = (r: Acc): MarketRowState => {
    const first = r.kind === 'gc' ? firstBidYmdByGc.get(r.key.slice(3)) ?? null : null
    if (first && first >= newNameFrom && first <= todayYmd) return 'new name'
    if (r.kind === 'gc' && r.pricedBids >= MARKET_DEAD_WEIGHT_BIDS && r.answered === 0) return 'dead weight'
    const thisQuarterUsd = (r.quarters[thisQ] as MarketQuarter).askedUsd
    const norm = r.askedUsd / quarterCount
    if (r.askedUsd - thisQuarterUsd > 0 && thisQuarterUsd < MARKET_FADING_SHARE * norm) return 'fading'
    return 'feeding'
  }
  const rows: MarketRow[] = [...acc.values()]
    .filter((r) => r.asks > 0)
    .map((r): MarketRow => {
      const state = stateOf(r)
      // A lifetime claim needs a lifetime read: only the whole record, read by the bid's own outcome, may say "ever".
      const neverAnswered = state === 'dead weight' && r.kind === 'gc' && lifetimeByGc?.get(r.key.slice(3))?.answered === 0
      const quietWeeks = r.lastAskYmd ? Math.floor(daysBetween(r.lastAskYmd, todayYmd) / 7) : null
      const who = r.kind === 'customers' ? 'estimates' : r.kind === 'no-gc' ? 'bids' : 'GC'
      const descParts = [who, quietWeeks != null && quietWeeks >= 4 ? `${quietWeeks} weeks quiet` : r.lastAskYmd ? `last ask ${dayLabel(r.lastAskYmd)}` : 'no ask on record']
      if (neverAnswered) descParts.push('has never answered a bid')
      if (r.zeroBids > 0) descParts.push(`${r.zeroBids} ${plural(r.zeroBids, 'bid rides', 'bids ride')} at $0`)
      for (const q of r.quarters) q.wonWords = q.asks === 0 ? '—' : q.wonUsd > 0 ? stageUsd(q.wonUsd) : q.answered < q.asks ? 'awaiting' : '$0'
      const det: string[] = []
      if (r.kind === 'customers') det.push('Small and many. Worked from the Estimates page, not from this book.')
      if (r.answered > 0) {
        det.push(`Won ${r.wonCount} of ${r.answered} answered.`)
        if (r.askedUsd > 0) det.push(`${pct(r.wonUsd / r.askedUsd)} by value.`)
      } else det.push('Nothing answered yet.')
      const paceDays = median(r.paceDays)
      if (paceDays != null) det.push(`Answers in about ${Math.round(paceDays)} days, as recorded.`)
      if (state === 'new name') {
        const first = firstBidYmdByGc.get(r.key.slice(3))
        det.push(`First bid ever on ${first ? dayLabel(first) : 'a day not on record'}. First answers say what the relationship is.`)
      } else if (state === 'dead weight') {
        det.push(neverAnswered ? `${r.pricedBids} priced bids in ${MARKET_DESK_WEEKS} weeks and no answer, ever.` : `${r.pricedBids} priced bids in ${MARKET_DESK_WEEKS} weeks, nothing won, nothing answered.`)
        det.push('Pricing them costs days the live GCs wait on.')
      } else if (state === 'fading' && quietWeeks != null && quietWeeks >= 4) det.push(`Quiet for ${quietWeeks} weeks.`)
      if (r.zeroBids > 0) det.push(`${r.zeroBids} ${plural(r.zeroBids, 'bid has', 'bids have')} no value yet. ${r.zeroBids === 1 ? 'It hides' : 'They hide'} what ${r.name} asks.`)
      if (r.lastAskYmd && !(quietWeeks != null && quietWeeks >= 4 && state === 'fading')) det.push(`Last ask ${dayLabel(r.lastAskYmd)}.`)
      return {
        key: r.key,
        name: r.name,
        kind: r.kind,
        desc: descParts.join(' · '),
        state,
        quarters: r.quarters,
        askedUsd: r.askedUsd,
        asks: r.asks,
        wonUsd: r.wonUsd,
        wonCount: r.wonCount,
        answered: r.answered,
        pricedBids: r.pricedBids,
        zeroBids: r.zeroBids,
        neverAnswered,
        askedWords: `${stageUsd(r.askedUsd)} · ${r.asks} ${r.kind === 'customers' ? plural(r.asks, 'request', 'requests') : plural(r.asks, 'bid', 'bids')}`,
        paysWords: r.wonUsd > 0 ? stageUsd(r.wonUsd) : '—',
        detLine: det.join(' '),
        door: r.kind === 'customers' ? { href: '/estimates', label: 'Open Estimates' } : { href: '/bids?tab=bid-board', label: 'Open their bids' },
        lastAskYmd: r.lastAskYmd,
      }
    })
  const STATE_ORDER: Record<MarketRowState, number> = { feeding: 0, 'new name': 1, fading: 2, 'dead weight': 3 }
  rows.sort((a, b) => STATE_ORDER[a.state] - STATE_ORDER[b.state] || b.askedUsd - a.askedUsd || a.name.localeCompare(b.name))
  // Beyond MARKET_BOOK_ROWS rows the small ones fold: the rows with the least asked, whatever their state, into one line.
  const keep = new Set([...rows].sort((a, b) => b.askedUsd - a.askedUsd || a.name.localeCompare(b.name)).slice(0, MARKET_BOOK_ROWS).map((r) => r.key))
  const shown = rows.filter((r) => keep.has(r.key))
  const rest = rows.filter((r) => !keep.has(r.key))
  let restLine: string | null = null
  if (rest.length) {
    const quiet = rest.filter((r) => r.state === 'fading' || r.state === 'dead weight').length
    const noun = rest.every((r) => r.kind === 'gc') ? 'GC' : 'source'
    const head = rest.length === 1 ? `1 smaller ${noun} holds the rest.` : `${rest.length} smaller ${noun}s hold the rest.`
    restLine = `${head} ${stageUsd(rest.reduce((s, r) => s + r.askedUsd, 0))} asked, ${stageUsd(rest.reduce((s, r) => s + r.wonUsd, 0))} won. ${quiet === 0 ? 'Steady, none quiet.' : `${quiet} of them ${plural(quiet, 'is', 'are')} quiet.`}`
  }

  // Tile 1: asked this quarter against last quarter.
  const quarterUsd = (q: number): number => [...acc.values()].reduce((s, r) => s + (r.quarters[q] as MarketQuarter).askedUsd, 0)
  const thisQuarterUsd = quarterUsd(thisQ)
  const lastQuarterUsd = quarterCount > 1 ? quarterUsd(thisQ - 1) : 0
  const tile1: MarketTile =
    lastQuarterUsd > 0
      ? { head: 'Asked of us, this quarter', value: stageUsd(thisQuarterUsd), delta: `${thisQuarterUsd >= lastQuarterUsd ? '▲' : '▼'} ${thisQuarterUsd >= lastQuarterUsd ? '+' : '−'}${Math.round((Math.abs(thisQuarterUsd - lastQuarterUsd) / lastQuarterUsd) * 100)}%`, deltaTone: thisQuarterUsd >= lastQuarterUsd ? 'green' : 'red', words: `Against ${stageUsd(lastQuarterUsd)} in the ${MARKET_QUARTER_WEEKS} weeks before. ${thisQuarterUsd >= lastQuarterUsd ? 'More is arriving.' : 'Less is arriving.'}` }
      : { head: 'Asked of us, this quarter', value: stageUsd(thisQuarterUsd), delta: null, deltaTone: 'plain', words: `Nothing was asked in the ${MARKET_QUARTER_WEEKS} weeks before.` }

  // Tile 2: the top three GCs' share of GC asks this quarter, against last quarter.
  const gcRows = rows.filter((r) => r.kind === 'gc')
  const shareOf = (q: number): { share: number | null; names: string[] } => {
    const total = gcRows.reduce((s, r) => s + (r.quarters[q] as MarketQuarter).askedUsd, 0)
    if (!(total > 0)) return { share: null, names: [] }
    const top = [...gcRows].sort((a, b) => (b.quarters[q] as MarketQuarter).askedUsd - (a.quarters[q] as MarketQuarter).askedUsd).slice(0, 3)
    return { share: top.reduce((s, r) => s + (r.quarters[q] as MarketQuarter).askedUsd, 0) / total, names: top.map((r) => r.name) }
  }
  const thisShare = shareOf(thisQ)
  const lastShare = quarterCount > 1 ? shareOf(thisQ - 1) : { share: null, names: [] }
  const nameList = (names: string[]): string => (names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`)
  const carryHead = thisShare.names.length === 3 ? 'Three GCs carry' : `${thisShare.names.length} ${plural(thisShare.names.length, 'GC carries', 'GCs carry')}`
  let tile2: MarketTile
  if (thisShare.share == null) tile2 = { head: 'Three GCs carry', value: '—', delta: null, deltaTone: 'plain', words: 'No GC asked this quarter.' }
  else {
    const narrowing = lastShare.share != null ? (thisShare.share > lastShare.share + 0.005 ? 'The book is narrowing.' : thisShare.share < lastShare.share - 0.005 ? 'The book is widening.' : 'The book holds its shape.') : 'No last quarter to read against.'
    tile2 = { head: carryHead, value: pct(thisShare.share), delta: lastShare.share != null ? `${thisShare.share >= lastShare.share ? '▲' : '▼'} from ${pct(lastShare.share)}` : null, deltaTone: lastShare.share != null ? (thisShare.share > lastShare.share + 0.005 ? 'red' : thisShare.share < lastShare.share - 0.005 ? 'green' : 'plain') : 'plain', words: `${nameList(thisShare.names)}. ${narrowing}` }
  }

  // Tile 3: new names this quarter against last quarter, the newest named.
  const lastNewFrom = ymdAddDays(newNameFrom, -MARKET_NEW_NAME_DAYS)
  const newThis: Array<{ id: string; ymd: string }> = []
  let newLast = 0
  for (const [id, ymd] of firstBidYmdByGc) {
    if (ymd >= newNameFrom && ymd <= todayYmd) newThis.push({ id, ymd })
    else if (ymd >= lastNewFrom && ymd < newNameFrom) newLast += 1
  }
  newThis.sort((a, b) => (a.ymd < b.ymd ? 1 : a.ymd > b.ymd ? -1 : 0))
  const newest = newThis[0] ?? null
  const tile3: MarketTile = {
    head: 'New names',
    value: `${newThis.length}`,
    delta: null,
    deltaTone: 'plain',
    words: `${newThis.length === 0 ? 'None this quarter.' : `${newThis.length} this quarter.`} Last quarter had ${newLast}. ${newest ? `${gcNames.get(newest.id) ?? 'A GC with no name on record'}, first invite ${dayLabel(newest.ymd)}. ` : ''}A new name is the only courting result the app can see.`,
  }

  const pricingSpend = rows.filter((r) => r.state === 'dead weight').map((r) => `${r.name} has taken ${r.pricedBids} priced bids for $0 won and ${r.neverAnswered ? 'no answer, ever' : `no answer in ${MARKET_DESK_WEEKS} weeks`}. Each one cost pricing days the live GCs waited on. Keep pricing them or stop. The book will show the answer either way.`)
  const zeroCount = rows.reduce((s, r) => s + r.zeroBids, 0)
  const zeroBids = zeroCount > 0 ? { count: zeroCount, words: zeroCount === 1 ? '1 bid rides at $0. It hides what its GC asks and thins the win share. Put the number on it.' : `${zeroCount} bids ride at $0. They hide what their GCs ask and thin the win share. Put the number on each.` } : null

  return {
    spanStart,
    weeks: cells,
    askedPerWeekUsd,
    feedUsd: header.feedUsd,
    feedMissing,
    emptyWeeksNote,
    legend,
    headline: header.headline,
    verdict: marketVerdict(rows),
    subLine: header.subLine,
    tiles: [tile1, tile2, tile3],
    rows: shown,
    restLine,
    pricingSpend,
    zeroBids,
    cannotSee: MARKET_CANNOT_SEE,
    howItReads: marketHowItReads(),
    recordedLine: MARKET_RECORDED_LINE,
  }
}

/** The footnote: how the desk reads, naming every column the figures rest on. */
export function marketHowItReads(): string {
  return [
    'How this reads: an ask is a bid opened or an estimate requested, at its value.',
    'It lands in the pay week it arrived.',
    'A bid counts from its created_at, drafts included, at agreed_value or else bid_value.',
    'An estimate counts from its created_at at total_cents.',
    `The span is the last ${MARKET_DESK_WEEKS} pay weeks, the current week included.`,
    `A quarter here is ${MARKET_QUARTER_WEEKS} of those weeks.`,
    'A bid is won when its outcome is won or started or complete, or when it became a job.',
    'A win counts at the bid’s value.',
    'An estimate is won when the customer accepted it.',
    'Answered is won or lost, read from outcome and outcome_at.',
    'Answer days are the median from bid_date_sent to outcome_at, the office’s recording day.',
    'The win share is the Market card’s own.',
    'Won and started work, divided by everything sent, these 8 weeks.',
    'Bids and estimates count together.',
    'Pays is what a source won in the span.',
    'A GC is the bid’s customer, by customer_id, named from the customer list.',
    'A bid with no customer falls back to its gc_builder_id, named from the GC list.',
    `Fading means asks this quarter under ${Math.round(MARKET_FADING_SHARE * 100)}% of the GC’s quarterly norm over the span.`,
    `Dead weight means ${MARKET_DEAD_WEIGHT_BIDS} or more priced bids in the span, nothing won, nothing answered.`,
    'Never answered reads every bid on record for the GC, by the bid’s own outcome.',
    `New name means a first ever bid inside the last ${MARKET_NEW_NAME_DAYS} days.`,
    'A bid rides at $0 when it was sent with no value.',
  ].join(' ')
}
