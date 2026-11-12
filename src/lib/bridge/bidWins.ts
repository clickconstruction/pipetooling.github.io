import { stageUsd } from './stageFlow'

/**
 * Bids after the won coefficient (punch list #318): what the bids we send can be expected to win,
 * in dollars a week.
 *
 * The owner's words, 2026-11-11, in the order he said them:
 * - "All I care about is the bids won in dollars, the same way we care about the estimates won in dollars. And we
 *   should use that to calculate a coefficient that allows us to signal the correct market amount."
 * - "It is lost until we mark it lost. And I don't think the bid should be counted as one until we marked IT WON".
 *   Read as: not lost until marked lost, not won until marked won. A job made from a bid decides nothing.
 * - On the mark *started or complete*: "Yes, count it won".
 * - "there is a 50% chance we lost the bid if we have not heard back in 90 days, and there is a 95% chance we lost
 *   the bid if we have not heard back within a hundred 80 days".
 * - On very large and very small bids: "I don't think we should count these. I think we should only count bids
 *   within Two standard deviations." Then, shown that the won rate falls with the size of the bid, he chose a rate
 *   for each size over a cut: "Okay, I like this."
 * - He also asked for one development's bids to be left out, and then for a list on the page of what is left out,
 *   by development, customer or address (`leftOut.ts`). That list is not shipped yet, so nothing is left out.
 *
 * So:
 * - **Won** is a bid marked won, or marked started or complete. Its dollars are the agreed value, else the bid's
 *   value, else the job's revenue when the bid carries none.
 * - **Lost** is a bid marked lost. A bid with no mark is part lost by its age: `BID_AGING`, half at 90 days and 95%
 *   at 180. It is never part won.
 * - **A rate for each size** (`BID_SIZES`): won dollars ÷ (won + lost dollars) among the bids of that size. A very
 *   large bid is read at the rate for very large bids, which is what an outlier rule was after, and nothing is
 *   thrown away. A size with nothing won or lost yet reads at the rate of all sizes together.
 * - **Won a week** is each size's dollars sent in the page's window, a week, times that size's rate, added up.
 * - **A bid on anything the Bridge leaves out** is in no count.
 *
 * The counts in a size are small, so the model carries them and the words say them. A bid never sent is no part of
 * this. Pure: the loader beside it (`loadBidWins.ts`) reads the rows.
 */

/** A bid with no mark, by the days since it was sent: the chance it is lost. The owner's two numbers. */
export const BID_AGING: ReadonlyArray<{ afterDays: number; lostShare: number }> = [
  { afterDays: 180, lostShare: 0.95 },
  { afterDays: 90, lostShare: 0.5 },
]
/** The sizes a bid is read by. Four is as fine as the counts support (read on the live rows, 2026-11-11). */
export const BID_SIZES: ReadonlyArray<{ id: string; label: string; underUsd: number }> = [
  { id: 'small', label: 'Under $10k', underUsd: 10_000 },
  { id: 'mid', label: '$10k to $50k', underUsd: 50_000 },
  { id: 'large', label: '$50k to $500k', underUsd: 500_000 },
  { id: 'giant', label: 'Over $500k', underUsd: Infinity },
]
/** Under this many won and lost bids the rates are too thin to lead with. */
export const BID_COEFFICIENT_MIN = 10

export type BidSent = {
  /** The day it was sent. */
  sentYmd: string
  /** 'won', 'lost', 'started_or_complete', or null while it waits. */
  outcome: string | null
  /** The agreed value, else the bid's value; 0 when the bid carries none. */
  usd: number
  /** True when a job was made from this bid. Kept for the words; it does not decide a win. */
  hasJob: boolean
  /** That job's revenue, when there is one: a won bid with no value of its own takes it. */
  jobUsd: number | null
  /** True for a bid on something the Bridge leaves out (`leftOut.ts`): in no count. */
  leftOut?: boolean
}

type Tally = { count: number; usd: number }

export type BidSizeWins = {
  id: string
  label: string
  won: Tally
  lost: Tally
  /** Sent with no mark, and the part of those dollars counted as lost by age. */
  noMark: Tally
  agedLostUsd: number
  /** Won by dollars in this size; null when nothing is won or lost in it. */
  rate: number | null
  /** The rate this size is read at: its own, or all sizes together when it has none. */
  usedRate: number | null
  /** Sent in the window, dollars a week, and what that wins at `usedRate`. */
  sentPerWeekUsd: number
  wonPerWeekUsd: number | null
}

export type BidWins = {
  /** Won by dollars over every size together: won ÷ (won + lost, the aged part included); null with nothing to read. */
  coefficient: number | null
  /** Won a week ÷ sent a week: the rate this window's mix of sizes works out to. */
  windowRate: number | null
  thin: boolean
  won: Tally
  /** Won bids that carry no dollars at all, so won reads low by them. */
  wonNoValue: number
  /** Marked lost. */
  lost: Tally
  /** Sent, with no mark. */
  noMark: Tally
  /** Of those, the ones sent 180 days ago or more. */
  noMarkOld: Tally
  /** The dollars of unmarked bids counted as lost by age. */
  agedLostUsd: number
  sizes: BidSizeWins[]
  /** Sent inside the window. */
  window: { count: number; usd: number; weeks: number; sentPerWeekUsd: number }
  wonPerWeekUsd: number | null
  /** Sent bids not counted because the Bridge leaves out their development, customer or address. */
  leftOutCount: number
  /** One short line for the pipe's Market row. */
  line: string
  /** The sentences behind the line, for a breakdown. */
  detail: string[]
}

const DAY = 86_400_000
const dayOf = (ymd: string): number => Date.parse(`${ymd}T00:00:00Z`)
/** A send day before this is a typing slip (the rows hold a year 0002), and the bid is left out. */
const EARLIEST = dayOf('2000-01-01')
const pct = (share: number): string => (share > 0 && share < 0.01 ? 'under 1%' : `${Math.round(share * 100)}%`)
const plural = (n: number, one: string, many: string): string => (n === 1 ? one : many)
const tally = (): Tally => ({ count: 0, usd: 0 })
const add = (t: Tally, usd: number): void => {
  t.count += 1
  t.usd += usd
}
const lostShareAt = (ageDays: number): number => BID_AGING.find((a) => ageDays >= a.afterDays)?.lostShare ?? 0
const sizeOf = (usd: number): number => BID_SIZES.findIndex((s) => usd < s.underUsd)

export function buildBidWins(input: { todayYmd: string; windowStart: string; bids: ReadonlyArray<BidSent> }): BidWins {
  const today = dayOf(input.todayYmd)
  const start = dayOf(input.windowStart)
  const weeks = Math.max(1, (today - start) / (7 * DAY))
  const oldDays = Math.max(...BID_AGING.map((a) => a.afterDays))
  const won = tally()
  const lost = tally()
  const noMark = tally()
  const noMarkOld = tally()
  const win = tally()
  const sizes = BID_SIZES.map((s) => ({ id: s.id, label: s.label, won: tally(), lost: tally(), noMark: tally(), agedLostUsd: 0, sentUsd: 0 }))
  let wonNoValue = 0
  let agedLostUsd = 0
  let leftOutCount = 0
  for (const b of input.bids) {
    const sent = dayOf(b.sentYmd)
    if (!Number.isFinite(sent) || sent > today || sent < EARLIEST) continue
    if (b.leftOut) {
      leftOutCount += 1
      continue
    }
    const bidUsd = Number.isFinite(b.usd) && b.usd > 0 ? b.usd : 0
    const isWon = b.outcome === 'won' || b.outcome === 'started_or_complete'
    const usd = isWon && bidUsd === 0 && b.jobUsd != null && b.jobUsd > 0 ? b.jobUsd : bidUsd
    const size = usd > 0 ? sizes[sizeOf(usd)] : undefined
    const age = Math.round((today - sent) / DAY)
    if (isWon) {
      if (usd === 0) wonNoValue += 1
      add(won, usd)
      if (size) add(size.won, usd)
    } else if (b.outcome === 'lost') {
      add(lost, usd)
      if (size) add(size.lost, usd)
    } else {
      const aged = usd * lostShareAt(age)
      add(noMark, usd)
      if (age >= oldDays) add(noMarkOld, usd)
      agedLostUsd += aged
      if (size) {
        add(size.noMark, usd)
        size.agedLostUsd += aged
      }
    }
    if (sent >= start) {
      add(win, usd)
      if (size) size.sentUsd += usd
    }
  }
  const rateOf = (w: number, l: number, aged: number): number | null => (w + l + aged > 0 ? w / (w + l + aged) : null)
  const coefficient = rateOf(won.usd, lost.usd, agedLostUsd)
  const decided = won.count + lost.count
  const thin = decided < BID_COEFFICIENT_MIN
  const sizeWins = sizes.map((s): BidSizeWins => {
    const rate = rateOf(s.won.usd, s.lost.usd, s.agedLostUsd)
    const usedRate = rate ?? coefficient
    const sentPerWeekUsd = s.sentUsd / weeks
    return { id: s.id, label: s.label, won: s.won, lost: s.lost, noMark: s.noMark, agedLostUsd: s.agedLostUsd, rate, usedRate, sentPerWeekUsd, wonPerWeekUsd: usedRate != null ? sentPerWeekUsd * usedRate : null }
  })
  const sentPerWeekUsd = win.usd / weeks
  const wonPerWeekUsd = coefficient != null ? sizeWins.reduce((sum, s) => sum + (s.wonPerWeekUsd ?? 0), 0) : null
  const windowRate = wonPerWeekUsd != null && sentPerWeekUsd > 0 ? wonPerWeekUsd / sentPerWeekUsd : null

  const line = wonPerWeekUsd != null ? `bids ${stageUsd(wonPerWeekUsd)}${windowRate != null ? ` at ${pct(windowRate)} won` : ''}${thin ? ', a thin count' : ''}` : 'bids: no won rate yet'
  const detail: string[] = []
  if (coefficient != null && wonPerWeekUsd != null) {
    detail.push(`Bids: ${stageUsd(sentPerWeekUsd)} went out a week over the last ${Math.round(weeks)} weeks.`)
    detail.push(`Each bid is read at the won rate for bids its size. That wins ${stageUsd(wonPerWeekUsd)} a week.`)
    for (const s of sizeWins) {
      const counts = `${s.won.count} won, ${s.lost.count} lost, ${s.noMark.count} with no mark.`
      detail.push(s.rate != null ? `${s.label}: ${pct(s.rate)} won by dollars. ${counts}` : `${s.label}: nothing won or lost yet, so it reads at ${pct(coefficient)}.`)
    }
    detail.push('A bid counts as won or lost only when it is marked.')
    detail.push(
      `With no mark it counts as ${[...BID_AGING]
        .reverse()
        .map((a) => `${pct(a.lostShare)} lost after ${a.afterDays} days`)
        .join(' and ')}.`,
    )
    if (noMark.count > 0) detail.push(`${noMark.count} ${plural(noMark.count, 'bid has', 'bids have')} no mark, for ${stageUsd(noMark.usd)}.`)
    if (noMarkOld.count > 0) detail.push(`${noMarkOld.count} of those ${plural(noMarkOld.count, 'was', 'were')} sent over ${oldDays} days ago, for ${stageUsd(noMarkOld.usd)}.`)
    if (wonNoValue > 0) detail.push(`${wonNoValue} won ${plural(wonNoValue, 'bid has', 'bids have')} no dollar value, so won reads low.`)
    if (leftOutCount > 0) detail.push(`${leftOutCount} sent ${plural(leftOutCount, 'bid is', 'bids are')} on what the Bridge leaves out, and ${plural(leftOutCount, 'is', 'are')} not counted.`)
    if (thin) detail.push(`Only ${decided} ${plural(decided, 'bid is', 'bids are')} marked won or lost so far, so the rates can swing.`)
  } else {
    detail.push('No bid is marked won or lost yet, so there is no won rate to use.')
  }
  return { coefficient, windowRate, thin, won, wonNoValue, lost, noMark, noMarkOld, agedLostUsd, sizes: sizeWins, window: { count: win.count, usd: win.usd, weeks, sentPerWeekUsd }, wonPerWeekUsd, leftOutCount, line, detail }
}

/**
 * The Market amount (the owner's "correct market amount"): what the asks coming in are worth a week once each kind is
 * read through its own won rate. Null when neither kind has one.
 */
export type MarketWorth = {
  perWeekUsd: number | null
  /** "worth $29k a week", for the Market row. */
  pace: string
  /** The two parts, one short line each. */
  parts: string[]
  /** Every sentence behind it: the bids, then the estimates. */
  detail: string[]
}

export function buildMarketWorth(bids: Pick<BidWins, 'wonPerWeekUsd' | 'line' | 'detail'> | null, estimates: { soldPerWeekUsd: number | null; line: string; detail: string[] } | null): MarketWorth {
  const b = bids?.wonPerWeekUsd ?? null
  const e = estimates?.soldPerWeekUsd ?? null
  const perWeekUsd = b == null && e == null ? null : (b ?? 0) + (e ?? 0)
  return {
    perWeekUsd,
    pace: perWeekUsd != null ? `worth ${stageUsd(perWeekUsd)} a week` : 'not read yet',
    parts: [bids?.line, estimates?.line].filter((x): x is string => !!x),
    detail: [...(bids?.detail ?? []), ...(estimates?.detail ?? [])],
  }
}
