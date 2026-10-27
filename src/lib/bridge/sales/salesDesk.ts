/**
 * The Sales desk (punch list #192, v2.5932): the chase, in expected dollars.
 * The one question: of everything asked, what will actually become work, and
 * which call this week protects the most of it? Every number is the ask times
 * that asker's own decided win rate, aged to zero past twice their answer
 * pace, so the open pile reads as its honest expected dollars. The chase
 * ranks askers by the expected dollars a call protects, with a flip to open
 * dollars so the inversion is visible; the decided asks fold into a funnel by
 * loss category with the unreasoned losses named. Nothing records here.
 * Pure: no React, no Supabase. Every sentence it prints is held to the
 * plain-words rule in `salesDesk.test.ts`.
 */
import { AWAITING_DAYS } from '../demandPace'
import { stageUsd } from '../stageFlow'
import { BID_LOSS_CATEGORIES, isBidLossCategoryKey, type BidLossCategoryKey } from '../../bidLossCategories'

/** Owner call (punch list #192): fewer decided bids than this and the asker's rate falls back to the window's win share; default 5. */
export const SALES_RATE_MIN_DECIDED = 5
/** Owner call (punch list #192): expected dollars fade linearly to zero between the asker's answer pace and this multiple of it; default 2. */
export const SALES_AGING_PACE_MULTIPLE = 2
/** Owner call (punch list #192): the answer pace assumed for an asker with none on record; default 45 days. */
export const SALES_NO_PACE_DAYS = 45
/** Owner call (punch list #192): the span the per-asker win rate and answer pace read, in days; default 365. */
export const SALES_DECIDED_DAYS = 365
/** The askers drawn by name before the rest fold into Everyone else. */
export const SALES_NAMED_ROWS = 6
/** The asker a bid with no GC folds into. */
export const SALES_NO_GC_NAME = 'No GC on the bid'

export const BID_BOARD_PATH = '/bids?tab=bid-board'
export const ESTIMATES_PATH = '/estimates'
export const bidPath = (bidId: string): string => `${BID_BOARD_PATH}&bidId=${bidId}`

/** A bid sent and not yet decided, not yet a job. */
export type SalesOpenBid = {
  id: string
  bidNumber: string | null
  projectName: string | null
  gcBuilderId: string | null
  customerId: string | null
  /** The bid's value; the agreed value once there is one. */
  usd: number
  /** `bid_date_sent`, the day the ask went out. */
  sentYmd: string
  nextFollowupYmd: string | null
  nextFollowupReason: string | null
  lastContactYmd: string | null
}

/** A bid marked won or lost inside the decided span. */
export type SalesDecidedBid = {
  id: string
  gcBuilderId: string | null
  usd: number
  sentYmd: string | null
  outcome: 'won' | 'lost'
  /** `outcome_at`, the day the office recorded the answer. */
  outcomeYmd: string
  lossCategory: string | null
  lossReason: string | null
}

/** An estimate sent and not yet answered. */
export type SalesOpenEstimate = {
  id: string
  title: string
  sentYmd: string
  usd: number
  customerId: string | null
}

export type SalesDeskInput = {
  todayYmd: string
  openBids: SalesOpenBid[]
  decidedBids: SalesDecidedBid[]
  /** GC id → name (`bids_gc_builders`). */
  gcNames: ReadonlyMap<string, string>
  openEstimates: SalesOpenEstimate[]
  /** The window's win share by value (`marketWinShare`), the rate for an asker with few decided bids; null when nothing was sent. */
  fallbackRate: number | null
  /** The window's estimate win share by value; null when no estimate was sent. */
  estimateShare: number | null
}

export type SalesPileBid = SalesOpenBid & {
  name: string
  ageDays: number
  /** Days past the asker's answer pace; 0 inside it. */
  pastDays: number
  /** 1 inside the pace, fading to 0 at the multiple of it. */
  aging: number
  expectedUsd: number
}

export type SalesAsker = {
  key: string
  gcBuilderId: string | null
  name: string
  isGc: boolean
  bids: SalesPileBid[]
  openUsd: number
  expectedUsd: number
  decided: { count: number; won: number; wonUsd: number; lostUsd: number }
  rate: number
  rateSource: 'own' | 'window' | 'none'
  paceDays: number
  paceSource: 'own' | 'assumed'
  deadWeight: boolean
  state: 'inside' | 'past' | 'dead'
  /** The most days any of its asks is past the pace. */
  pastDays: number
  /** The past-pace bid a call re-arms the most of: the biggest value times rate. */
  callBid: SalesPileBid | null
}

export type SalesRowState = { kind: 'inside' | 'past' | 'dead' | 'aging'; label: string }

/** One row of the chase: an asker, Everyone else, or The estimates. */
export type SalesDeskRow = {
  key: string
  kind: 'asker' | 'rest' | 'estimates'
  name: string
  /** `2 bids · GC`, a label. */
  meta: string
  openUsd: number
  /** `2 of 5 · 22%`, a label. */
  winsLabel: string
  /** `answers in about 19 d, as recorded`, a label. */
  paceLabel: string
  expectedUsd: number
  /** The asker's rate, for the flip note; null on the folded row. */
  rate: number | null
  state: SalesRowState
  story: string[]
  say: string | null
  move: string
  door: { label: string; to: string }
  pastPace: boolean
}

export type SalesTile = { head: string; value: string; words: string; tone: 'red' | 'amber' | 'green' | 'plain' }

export type SalesLegendEntry = { key: 'protected' | 'risk' | 'evaporating' | 'dead'; label: string; usd: number; words: string }

export type SalesFunnelLine = { key: BidLossCategoryKey | 'won' | 'none'; label: string; count: number; usd: number }

export type SalesFunnel = {
  won: { count: number; usd: number }
  lost: { count: number; usd: number }
  /** Won first, then each loss category with a count, then the losses with no reason. */
  lines: SalesFunnelLine[]
  noReason: { count: number; usd: number }
  words: string[]
  /** The blind spot, null when every loss carries a reason. */
  blind: string | null
}

export type SalesDesk = {
  todayYmd: string
  pile: { bids: number; bidsUsd: number; estimates: number; estimatesUsd: number; askedUsd: number; expectedUsd: number }
  offPile: { bids: number; usd: number; words: string | null }
  askers: SalesAsker[]
  /** The rows in the desk's own order: by expected dollars, biggest first. */
  rows: SalesDeskRow[]
  bar: { protectedUsd: number; atRiskUsd: number; evaporatingUsd: number; deadOpenUsd: number }
  legend: SalesLegendEntry[]
  tiles: [SalesTile, SalesTile, SalesTile]
  /** `$3.3M asked · worth about $485k`, a label line. */
  headline: string
  verdict: string
  ruleLines: string[]
  calls: { count: number; usd: number }
  thins: { noValueBids: number; noReasonLosses: number }
  funnel: SalesFunnel
  /** The median answer pace over every decided bid, the pace the estimates fade at. */
  companyPaceDays: number
  companyPaceSource: 'own' | 'assumed'
  howItReads: string
}

const DAY_MS = 86_400_000
const daysBetween = (fromYmd: string, toYmd: string): number => Math.round((Date.parse(`${toYmd}T00:00:00Z`) - Date.parse(`${fromYmd}T00:00:00Z`)) / DAY_MS)
const plural = (n: number, one: string, many: string): string => (n === 1 ? one : many)
const pct = (rate: number): string => `${Math.round(rate * 100)}%`

/** A name as a sentence can hold it: the glue a bid's title may carry becomes a comma or a space. */
export function plainName(name: string): string {
  return name
    .replace(/\s*[—;]\s*/g, ', ')
    .replace(/\s*\(\s*/g, ' ')
    .replace(/\s*\)\s*/g, ' ')
    .replace(/·/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s+,/g, ',')
    .trim()
    .replace(/,$/, '')
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1 ? (sorted[mid] as number) : ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2
}

/** 1 while the ask is inside the pace, fading linearly to 0 at `SALES_AGING_PACE_MULTIPLE` times it. */
export function salesAging(ageDays: number, paceDays: number): number {
  if (!(paceDays > 0)) return ageDays <= 0 ? 1 : 0
  if (ageDays <= paceDays) return 1
  const end = paceDays * SALES_AGING_PACE_MULTIPLE
  if (ageDays >= end) return 0
  return 1 - (ageDays - paceDays) / (end - paceDays)
}

const bidName = (b: Pick<SalesOpenBid, 'projectName' | 'bidNumber'>): string => plainName(b.projectName?.trim() || b.bidNumber?.trim() || 'a bid')

type AskerFacts = Pick<SalesAsker, 'decided' | 'rate' | 'rateSource' | 'paceDays' | 'paceSource' | 'deadWeight'>

function askerFacts(decided: SalesDecidedBid[], fallbackRate: number | null): AskerFacts {
  let won = 0
  let wonUsd = 0
  let lostUsd = 0
  let silent = true
  const paces: number[] = []
  for (const d of decided) {
    if (d.outcome === 'won') {
      won += 1
      wonUsd += d.usd
      silent = false
    } else {
      lostUsd += d.usd
      if (d.lossCategory !== 'no_answer') silent = false
    }
    if (d.sentYmd) paces.push(Math.max(0, daysBetween(d.sentYmd, d.outcomeYmd)))
  }
  const count = decided.length
  const enough = count >= SALES_RATE_MIN_DECIDED
  const own = wonUsd + lostUsd > 0 ? wonUsd / (wonUsd + lostUsd) : 0
  const rate = enough ? own : (fallbackRate ?? 0)
  const rateSource: AskerFacts['rateSource'] = enough ? 'own' : fallbackRate != null ? 'window' : 'none'
  const pace = median(paces)
  return {
    decided: { count, won, wonUsd, lostUsd },
    rate,
    rateSource,
    paceDays: pace != null ? Math.round(pace) : SALES_NO_PACE_DAYS,
    paceSource: pace != null ? 'own' : 'assumed',
    deadWeight: enough && won === 0 && silent,
  }
}

function askerRow(a: SalesAsker, opts: { leaderByExpected: SalesAsker | null; biggestOpen: SalesAsker | null; bestRate: SalesAsker | null }): SalesDeskRow {
  const bids = a.bids
  const n = bids.length
  const story: string[] = bids.map((b) => {
    const head = b.usd > 0 ? `${b.name}, ${stageUsd(b.usd)}, ${b.ageDays} ${plural(b.ageDays, 'day', 'days')} out.` : `${b.name}, no value, ${b.ageDays} ${plural(b.ageDays, 'day', 'days')} out.`
    return b.pastDays > 0 ? `${head} ${b.pastDays} past their pace.` : head
  })
  if (a.deadWeight) story.push(`${a.decided.count} asks these 12 months, no answer on any.`)
  const biggestExpected = [...bids].sort((x, y) => y.expectedUsd - x.expectedUsd)[0] ?? null
  const biggest = bids[0] ?? null
  let say: string | null = null
  if (a.deadWeight) say = 'Not a bid call, a relationship call. Are we ever in the running, or are we pricing their paperwork?'
  else if (opts.biggestOpen === a && opts.leaderByExpected && opts.leaderByExpected !== a) say = `Biggest open dollars on the desk. At ${pct(a.rate)} they buy less expected than ${opts.leaderByExpected.name}.`
  else if (a.state === 'past' && n > 1 && biggestExpected && biggestExpected.expectedUsd > 0) say = `Deciding ${biggestExpected.name} alone moves ${stageUsd(biggestExpected.expectedUsd)} of expected.`
  else if (a.state === 'past' && opts.bestRate === a) say = 'Best win rate on the desk, and the ask is aging.'
  else if (a.state === 'inside' && a.paceSource === 'own') say = `An answer takes about ${a.paceDays} days here, as recorded. Calling early spends goodwill.`
  const move = a.deadWeight ? 'Decide the relationship, not the bid.' : a.callBid ? `Call ${a.name} about ${a.callBid.name}.` : 'Leave them.'
  const doorBid = a.callBid ?? (n === 1 ? biggest : null)
  const door = doorBid ? { label: 'Open the bid ›', to: bidPath(doorBid.id) } : { label: 'Open the bids ›', to: BID_BOARD_PATH }
  const winsLabel = a.deadWeight
    ? `0 of ${a.decided.count} · never answered`
    : a.rateSource === 'own'
      ? `${a.decided.won} of ${a.decided.count} · ${pct(a.rate)}`
      : a.rateSource === 'window'
        ? `${a.decided.count === 0 ? 'no decided bids' : `${a.decided.won} of ${a.decided.count}`} · the window's ${pct(a.rate)}`
        : `${a.decided.won} of ${a.decided.count} · no win share to read`
  const paceLabel = a.deadWeight ? '' : a.paceSource === 'own' ? `answers in about ${a.paceDays} d, as recorded` : `no pace on record, ${SALES_NO_PACE_DAYS} d assumed`
  const state: SalesRowState = a.deadWeight ? { kind: 'dead', label: 'dead weight' } : a.state === 'past' ? { kind: 'past', label: `${a.pastDays} d past pace` } : { kind: 'inside', label: 'inside pace' }
  return {
    key: a.key,
    kind: 'asker',
    name: a.name,
    meta: `${n} ${plural(n, 'bid', 'bids')}${a.isGc ? ' · GC' : ''}`,
    openUsd: a.openUsd,
    winsLabel,
    paceLabel,
    expectedUsd: a.expectedUsd,
    rate: a.rate,
    state,
    story,
    say,
    move,
    door,
    pastPace: a.state === 'past',
  }
}

function restRow(folded: SalesAsker[]): SalesDeskRow | null {
  if (folded.length === 0) return null
  const bids = folded.flatMap((a) => a.bids)
  const n = bids.length
  const past = bids.filter((b) => b.pastDays > 0).length
  const openUsd = folded.reduce((s, a) => s + a.openUsd, 0)
  const expectedUsd = folded.reduce((s, a) => s + a.expectedUsd, 0)
  return {
    key: 'rest',
    kind: 'rest',
    name: 'Everyone else',
    meta: `${n} ${plural(n, 'bid', 'bids')}`,
    openUsd,
    winsLabel: 'their own paces',
    paceLabel: '',
    expectedUsd,
    rate: null,
    state: past > 0 ? { kind: 'past', label: `${past} past pace` } : { kind: 'inside', label: 'inside pace' },
    story: [past > 0 ? `${n} smaller ${plural(n, 'bid', 'bids')}, ${past} past ${plural(past, 'its', 'their')} asker's pace.` : `${n} smaller ${plural(n, 'bid', 'bids')}, none past ${plural(n, 'its', 'their')} asker's pace this week.`],
    say: null,
    move: past > 0 ? `Decide the ${past} on the Bid Board.` : 'Nothing this week.',
    door: { label: 'Open the Bid Board ›', to: BID_BOARD_PATH },
    pastPace: past > 0,
  }
}

function estimatesRow(estimates: SalesOpenEstimate[], share: number | null, paceDays: number, todayYmd: string): { row: SalesDeskRow; expectedUsd: number } | null {
  if (estimates.length === 0) return null
  const n = estimates.length
  const openUsd = estimates.reduce((s, e) => s + e.usd, 0)
  let expectedUsd = 0
  let oldest = 0
  let sentToday = 0
  for (const e of estimates) {
    const age = Math.max(0, daysBetween(e.sentYmd, todayYmd))
    oldest = Math.max(oldest, age)
    if (age === 0) sentToday += 1
    expectedUsd += e.usd * (share ?? 0) * salesAging(age, paceDays)
  }
  const customers = new Set(estimates.map((e, i) => e.customerId ?? `est-${i}`)).size
  const story = [`${n} sent and not answered. The oldest is ${oldest} ${plural(oldest, 'day', 'days')} out.`, 'Small asks win on speed.']
  const move = sentToday > 0 ? `${sentToday} went out today. Answer the next request the same day.` : 'Answer the next request the same day.'
  return {
    expectedUsd,
    row: {
      key: 'estimates',
      kind: 'estimates',
      name: 'The estimates',
      meta: `${customers} ${plural(customers, 'customer', 'customers')}`,
      openUsd,
      winsLabel: share != null ? `${pct(share)} by value` : 'no share to read',
      paceLabel: `fade at the company's ${paceDays} d pace`,
      expectedUsd,
      rate: share,
      state: { kind: 'aging', label: 'aging daily' },
      story,
      say: null,
      move,
      door: { label: 'Open Estimates ›', to: ESTIMATES_PATH },
      pastPace: false,
    },
  }
}

function buildFunnel(decided: SalesDecidedBid[]): SalesFunnel {
  let wonCount = 0
  let wonUsd = 0
  let lostCount = 0
  let lostUsd = 0
  const byCat = new Map<BidLossCategoryKey, { count: number; usd: number }>()
  for (const c of BID_LOSS_CATEGORIES) byCat.set(c.key, { count: 0, usd: 0 })
  const none = { count: 0, usd: 0 }
  for (const d of decided) {
    if (d.outcome === 'won') {
      wonCount += 1
      wonUsd += d.usd
      continue
    }
    lostCount += 1
    lostUsd += d.usd
    if (isBidLossCategoryKey(d.lossCategory)) {
      const line = byCat.get(d.lossCategory) as { count: number; usd: number }
      line.count += 1
      line.usd += d.usd
    } else {
      none.count += 1
      none.usd += d.usd
    }
  }
  const lines: SalesFunnelLine[] = [{ key: 'won', label: 'Won', count: wonCount, usd: wonUsd }]
  for (const c of BID_LOSS_CATEGORIES) {
    const v = byCat.get(c.key) as { count: number; usd: number }
    if (v.count > 0) lines.push({ key: c.key, label: c.label, count: v.count, usd: v.usd })
  }
  if (none.count > 0) lines.push({ key: 'none', label: 'No reason recorded', count: none.count, usd: none.usd })
  const words = [`Won ${stageUsd(wonUsd)} on ${wonCount} ${plural(wonCount, 'bid', 'bids')}. Lost ${stageUsd(lostUsd)} on ${lostCount} ${plural(lostCount, 'bid', 'bids')}.`]
  const top = lines.filter((l) => l.key !== 'won' && l.key !== 'none').sort((a, b) => b.usd - a.usd)
  if (top.length >= 2) words.push(`Most lost to ${plainName(top[0]!.label)}, ${stageUsd(top[0]!.usd)}, then ${plainName(top[1]!.label)}, ${stageUsd(top[1]!.usd)}.`)
  else if (top.length === 1) words.push(`Every reasoned loss went to ${plainName(top[0]!.label)}, ${stageUsd(top[0]!.usd)}.`)
  const blind = none.count > 0 ? `${none.count} ${plural(none.count, 'loss carries', 'losses carry')} no reason, so this strip under-reads.` : null
  return { won: { count: wonCount, usd: wonUsd }, lost: { count: lostCount, usd: lostUsd }, lines, noReason: none, words, blind }
}

export function buildSalesDesk(input: SalesDeskInput): SalesDesk {
  const { todayYmd, fallbackRate } = input
  const decidedByAsker = new Map<string, SalesDecidedBid[]>()
  for (const d of input.decidedBids) {
    const key = d.gcBuilderId ?? 'none'
    const list = decidedByAsker.get(key) ?? []
    list.push(d)
    decidedByAsker.set(key, list)
  }
  const factsByAsker = new Map<string, AskerFacts>()
  const factsFor = (key: string): AskerFacts => {
    let f = factsByAsker.get(key)
    if (!f) {
      f = askerFacts(decidedByAsker.get(key) ?? [], fallbackRate)
      factsByAsker.set(key, f)
    }
    return f
  }

  // The pile: open bids inside the awaiting window; older ones leave it and are counted apart.
  const askerMap = new Map<string, SalesAsker>()
  let offBids = 0
  let offUsd = 0
  let noValueBids = 0
  for (const b of input.openBids) {
    const age = Math.max(0, daysBetween(b.sentYmd, todayYmd))
    if (age > AWAITING_DAYS) {
      offBids += 1
      offUsd += b.usd
      continue
    }
    if (!(b.usd > 0)) noValueBids += 1
    const key = b.gcBuilderId ?? 'none'
    let a = askerMap.get(key)
    if (!a) {
      const f = factsFor(key)
      a = { key, gcBuilderId: b.gcBuilderId, name: b.gcBuilderId ? plainName(input.gcNames.get(b.gcBuilderId) ?? 'A GC with no name on record') : SALES_NO_GC_NAME, isGc: !!b.gcBuilderId, bids: [], openUsd: 0, expectedUsd: 0, ...f, state: 'inside', pastDays: 0, callBid: null }
      askerMap.set(key, a)
    }
    const pastDays = Math.max(0, age - a.paceDays)
    const aging = a.deadWeight ? 0 : salesAging(age, a.paceDays)
    const expectedUsd = a.deadWeight ? 0 : b.usd * a.rate * aging
    a.bids.push({ ...b, name: bidName(b), ageDays: age, pastDays, aging, expectedUsd })
    a.openUsd += b.usd
    a.expectedUsd += expectedUsd
    a.pastDays = Math.max(a.pastDays, pastDays)
  }
  const askers = [...askerMap.values()]
  for (const a of askers) {
    a.bids.sort((x, y) => y.usd - x.usd)
    a.state = a.deadWeight ? 'dead' : a.pastDays > 0 ? 'past' : 'inside'
    if (a.state === 'past') a.callBid = a.bids.filter((b) => b.pastDays > 0).sort((x, y) => y.usd * a.rate - x.usd * a.rate || y.usd - x.usd)[0] ?? null
  }
  askers.sort((x, y) => y.expectedUsd - x.expectedUsd || y.openUsd - x.openUsd)

  // The company pace: the median answer over every decided bid, the pace the estimates fade at.
  const allPaces = input.decidedBids.filter((d) => d.sentYmd).map((d) => Math.max(0, daysBetween(d.sentYmd as string, d.outcomeYmd)))
  const companyPace = median(allPaces)
  const companyPaceDays = companyPace != null ? Math.round(companyPace) : SALES_NO_PACE_DAYS

  // The rows: the top askers by expected dollars, every dead-weight asker by name, the rest folded, the estimates apart.
  const live = askers.filter((a) => !a.deadWeight)
  const dead = askers.filter((a) => a.deadWeight)
  const named = live.slice(0, SALES_NAMED_ROWS)
  const folded = live.slice(SALES_NAMED_ROWS)
  const leaderByExpected = live[0] ?? null
  const biggestOpen = [...live].sort((x, y) => y.openUsd - x.openUsd)[0] ?? null
  const bestRate = live.filter((a) => a.rateSource === 'own').sort((x, y) => y.rate - x.rate)[0] ?? null
  const rowOpts = { leaderByExpected, biggestOpen, bestRate }
  const est = estimatesRow(input.openEstimates, input.estimateShare, companyPaceDays, todayYmd)
  const rest = restRow(folded)
  const rows: SalesDeskRow[] = [...named.map((a) => askerRow(a, rowOpts)), ...(rest ? [rest] : []), ...(est ? [est.row] : []), ...dead.map((a) => askerRow(a, rowOpts))]
  rows.sort((x, y) => y.expectedUsd - x.expectedUsd || y.openUsd - x.openUsd)

  // The bar, by expected dollars; dead weight is a dashed sliver with its open dollars in the legend.
  let protectedUsd = 0
  let atRiskUsd = 0
  let deadOpenUsd = 0
  for (const a of askers) {
    if (a.deadWeight) {
      deadOpenUsd += a.openUsd
      continue
    }
    for (const b of a.bids) {
      if (b.pastDays > 0) atRiskUsd += b.expectedUsd
      else protectedUsd += b.expectedUsd
    }
  }
  const evaporatingUsd = est?.expectedUsd ?? 0
  const calls = named.filter((a) => a.state === 'past').length
  const bidsInPile = askers.reduce((s, a) => s + a.bids.length, 0)
  const bidsUsd = askers.reduce((s, a) => s + a.openUsd, 0)
  const estimatesUsd = input.openEstimates.reduce((s, e) => s + e.usd, 0)
  const askedUsd = bidsUsd + estimatesUsd
  const expectedUsd = protectedUsd + atRiskUsd + evaporatingUsd
  const funnel = buildFunnel(input.decidedBids)
  const noReason = funnel.noReason.count

  const legend: SalesLegendEntry[] = [
    { key: 'protected', label: 'Protected', usd: protectedUsd, words: "Inside the asker's answer pace. Leave them." },
    { key: 'risk', label: 'At risk', usd: atRiskUsd, words: "Past the asker's pace. The chase list below, biggest first." },
    { key: 'evaporating', label: 'Evaporating', usd: evaporatingUsd, words: 'The aging estimates. Answer speed is the lever.' },
    {
      key: 'dead',
      label: 'Dead weight, $0',
      usd: deadOpenUsd,
      words: dead.length === 0 ? 'No asker on the pile has gone silent on every bid.' : dead.length === 1 ? `${dead[0]!.name} never answers and holds ${stageUsd(deadOpenUsd)} open.` : `${dead.length} askers never answer and hold ${stageUsd(deadOpenUsd)} open.`,
    },
  ]
  const tiles: [SalesTile, SalesTile, SalesTile] = [
    { head: 'What the pile is worth', value: `≈ ${stageUsd(expectedUsd)}`, words: `Open dollars flatter the pile. Say the ${stageUsd(expectedUsd)}, never the ${stageUsd(askedUsd)}.`, tone: 'plain' },
    { head: 'At risk, the calls', value: `${stageUsd(atRiskUsd)} on ${calls} ${plural(calls, 'call', 'calls')}`, words: "Past the asker's own answer pace. A call re-arms the ask or decides it.", tone: calls > 0 ? 'amber' : 'green' },
    {
      head: 'What thins the reading',
      value: `${noValueBids} + ${noReason}`,
      words: `${noValueBids} ${plural(noValueBids, 'bid rides', 'bids ride')} at $0 value and ${noReason} ${plural(noReason, 'loss carries', 'losses carry')} no reason. Both thin every share below.`,
      tone: noValueBids + noReason > 0 ? 'red' : 'green',
    },
  ]
  const verdict = calls > 0 ? `${calls} ${plural(calls, 'call', 'calls')} this week ${plural(calls, 'protects', 'protect')} ${stageUsd(atRiskUsd)} of it.` : "No ask is past its asker's pace this week."
  const offWords = offBids > 0 ? `${stageUsd(offUsd)} more on ${offBids} ${plural(offBids, 'bid', 'bids')} sits past the ${AWAITING_DAYS}-day window, off this pile and off the bar.` : null

  const howItReads = [
    `An asker's win rate and answer pace come from their decided bids, the last ${Math.round(SALES_DECIDED_DAYS / 30)} months.`,
    'The rate is won dollars over won and lost dollars.',
    'The pace is the median of outcome_at less bid_date_sent, as recorded.',
    'That is the day the office recorded the answer, not the day the GC spoke.',
    fallbackRate != null ? `Fewer than ${SALES_RATE_MIN_DECIDED} decided bids falls back to the window's ${pct(fallbackRate)} win share.` : `Fewer than ${SALES_RATE_MIN_DECIDED} decided bids falls back to the window's win share, which nothing sent can give yet.`,
    'Expected is the bid value times that rate.',
    `It fades to zero past ${SALES_AGING_PACE_MULTIPLE} times the asker's pace.`,
    `An asker with no pace on record is read at ${SALES_NO_PACE_DAYS} days.`,
    'The aging rule is an owner call.',
    `An ask's age counts from bid_date_sent. After ${AWAITING_DAYS} days it leaves this pile.`,
    'The funnel reads outcome, outcome_at and loss_category, with loss_reason on each bid.',
    `Estimates read sent_at and total_cents. They fade at the company's ${companyPaceDays} day pace, since no estimate pace is on record.`,
    'Nothing records here.',
    'Answers land where the app keeps them: the bid outcome with its reason, next_followup_on and last_contact.',
    'The week’s call rides the lit link’s desk above, not here.',
  ].join(' ')

  return {
    todayYmd,
    pile: { bids: bidsInPile, bidsUsd, estimates: input.openEstimates.length, estimatesUsd, askedUsd, expectedUsd },
    offPile: { bids: offBids, usd: offUsd, words: offWords },
    askers,
    rows,
    bar: { protectedUsd, atRiskUsd, evaporatingUsd, deadOpenUsd },
    legend,
    tiles,
    headline: `${stageUsd(askedUsd)} asked · worth about ${stageUsd(expectedUsd)}`,
    verdict,
    ruleLines: ['Every number below is expected dollars.', "That is the ask times the asker's own decided win rate.", 'It fades to zero past twice their answer pace.'],
    calls: { count: calls, usd: atRiskUsd },
    thins: { noValueBids, noReasonLosses: noReason },
    funnel,
    companyPaceDays,
    companyPaceSource: companyPace != null ? 'own' : 'assumed',
    howItReads,
  }
}

/** The muted sub-line under the verdict: the card's counts and paces, as sentences. */
export function salesSubLines(desk: Pick<SalesDesk, 'pile'>, paces: { soldPerWeekUsd: number | null; fieldPerWeekUsd: number | null }): string[] {
  const p = desk.pile
  const lines = [`${p.bids} ${plural(p.bids, 'bid', 'bids')}, ${stageUsd(p.bidsUsd)}.`, `${p.estimates} ${plural(p.estimates, 'estimate', 'estimates')}, ${stageUsd(p.estimatesUsd)}.`]
  if (paces.soldPerWeekUsd != null && paces.fieldPerWeekUsd != null) lines.push(`Sold ${stageUsd(paces.soldPerWeekUsd)} a week against the field's ${stageUsd(paces.fieldPerWeekUsd)}.`)
  else if (paces.soldPerWeekUsd != null) lines.push(`Sold ${stageUsd(paces.soldPerWeekUsd)} a week.`)
  else lines.push('Sold: not readable until Build reads.')
  return lines
}

export type SalesSortKey = 'expected' | 'open'

/** The rows by the chosen dollars, biggest first. */
export function sortSalesRows(rows: ReadonlyArray<SalesDeskRow>, by: SalesSortKey): SalesDeskRow[] {
  return [...rows].sort((x, y) => (by === 'open' ? y.openUsd - x.openUsd || y.expectedUsd - x.expectedUsd : y.expectedUsd - x.expectedUsd || y.openUsd - x.openUsd))
}

export function salesSortButtonLabel(by: SalesSortKey): string {
  return by === 'open' ? 'Ranked by open dollars · press for expected dollars' : 'Ranked by expected dollars · press to see it by open dollars'
}

/** The note under the flip: who leads by open dollars when expected dollars disagree; null while the flip is off. */
export function salesFlipNote(rows: ReadonlyArray<SalesDeskRow>, by: SalesSortKey): string | null {
  if (by !== 'open' || rows.length === 0) return null
  const byOpen = sortSalesRows(rows, 'open')[0] as SalesDeskRow
  const byExpected = sortSalesRows(rows, 'expected')[0] as SalesDeskRow
  if (byOpen.key === byExpected.key) return `By open dollars ${byOpen.name} leads, and so it does by expected dollars.`
  const why = byOpen.rate != null && byOpen.kind === 'asker' ? `The ${pct(byOpen.rate)} win share says otherwise.` : 'The expected dollars say otherwise.'
  return `By open dollars ${byOpen.name} leads. ${why} Press again.`
}

export const SALES_OFF_PILE_DOOR = { label: 'Decide them on the Bid Board ›', to: BID_BOARD_PATH }
export const SALES_BLIND_DOOR = { label: 'Name them on the Bid Board ›', to: BID_BOARD_PATH }
