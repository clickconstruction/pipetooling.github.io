import type { BidSent, BidWins } from '../bidWins'
import { ESTIMATE_LOST_AFTER_DAYS, ESTIMATE_USUAL_ANSWER_DAYS, type EstimateSent, type EstimateWins } from '../estimateWins'
import { bidPath } from '../sales/salesDesk'
import { stageUsd } from '../stageFlow'

/**
 * What makes up each half of Market's worth (punch list #334, PR 4). The Market window opens on two amounts, what the
 * bids win a week and what the estimates sell a week. The owner: "I would like to be able to click on either of
 * these two sections and see a breakout of what makes it up".
 *
 * - **Bids**: a row for each size of bid. What went out a week in that size, the won rate that size is read at, and
 *   what that is worth a week. The rows add up to the amount on the tile.
 * - **Estimates**: how the won rate is made (approved, declined, passed over, no answer), then what went out a week
 *   and what that sells at the rate.
 *
 * Each opens in a window of its own over the Market window: "Those breakouts can be in an additional modal. One
 * modal for each."
 *
 * Then: "I would like to be able to expand any of those sections and see the specific bids that make it up and
 * specific estimates that make it up." So a row opens on the bids or the estimates behind it, by name, each a press
 * to that one. A size of bid opens on what was sent in the window, then every bid won, lost and unmarked that its
 * rate rests on.
 *
 * Nothing is counted here. Every figure is one the won-rate kernels (`bidWins.ts`, `estimateWins.ts`) already hold,
 * and the lists are the kernels' own members, so a breakout cannot disagree with the tile it opens under, nor a list
 * with the count beside it.
 *
 * Pure.
 */

/** One bid or one estimate, named. */
export type BreakoutItem = {
  key: string
  title: string
  /** "sent 10/12 · no mark". */
  detail: string
  amount: string
  /** The page that opens it; null when the row carries no id to open. */
  to: string | null
}

/** The things behind one count, largest first. */
export type BreakoutGroup = {
  key: string
  title: string
  /** "12 bids · $352k". */
  words: string
  items: BreakoutItem[]
}

export type BreakoutRow = {
  key: string
  label: string
  /** One cell under each column after the first. */
  cells: string[]
  /** A quiet line under the row's label. */
  note?: string
  /** The row that the others add up to, or the rate they make. */
  total?: boolean
  /** What the row opens on. Absent or empty: the row does not open. */
  groups?: BreakoutGroup[]
}

export type MarketBreakout = {
  key: 'bids' | 'estimates'
  title: string
  /** The first is the label's column. */
  columns: string[]
  rows: BreakoutRow[]
  /** Short sentences under the table: how it is counted, and what can make it wrong. */
  notes: string[]
}

/** How many a list shows before *Show all*. */
export const BREAKOUT_SHOWN = 5

const pct = (share: number): string => (share > 0 && share < 0.01 ? 'under 1%' : `${Math.round(share * 100)}%`)
const plural = (n: number, one: string, many: string): string => (n === 1 ? one : many)
const weeksWords = (weeks: number): string => `${Math.round(weeks)} ${plural(Math.round(weeks), 'week', 'weeks')}`
/** `10/12` this year, `10/12/25` for another. */
const dayWords = (ymd: string, todayYmd: string): string => {
  if (!/^\d{4}-\d{2}-\d{2}/.test(ymd)) return ymd
  const md = `${Number(ymd.slice(5, 7))}/${Number(ymd.slice(8, 10))}`
  return ymd.slice(0, 4) === todayYmd.slice(0, 4) ? md : `${md}/${ymd.slice(2, 4)}`
}

/** A bid's dollars as the won rate reads them: a won bid with no value of its own takes its job's. */
const bidUsd = (b: BidSent): number => {
  const own = Number.isFinite(b.usd) && b.usd > 0 ? b.usd : 0
  const isWon = b.outcome === 'won' || b.outcome === 'started_or_complete'
  return isWon && own === 0 && b.jobUsd != null && b.jobUsd > 0 ? b.jobUsd : own
}
const bidMark = (b: BidSent): string => (b.outcome === 'won' || b.outcome === 'started_or_complete' ? 'won' : b.outcome === 'lost' ? 'lost' : 'no mark')

function bidGroup(key: string, title: string, members: ReadonlyArray<number>, bids: ReadonlyArray<BidSent>, todayYmd: string, withMark: boolean): BreakoutGroup | null {
  const rows = members.map((i) => ({ i, b: bids[i] })).filter((x): x is { i: number; b: BidSent } => x.b != null)
  if (rows.length === 0) return null
  rows.sort((a, b) => bidUsd(b.b) - bidUsd(a.b))
  const usd = rows.reduce((s, x) => s + bidUsd(x.b), 0)
  return {
    key,
    title,
    words: `${rows.length} ${plural(rows.length, 'bid', 'bids')} · ${stageUsd(usd)}`,
    items: rows.map(({ i, b }) => ({
      key: b.id ?? `at-${i}`,
      title: b.name?.trim() || 'A bid with no name',
      detail: `sent ${dayWords(b.sentYmd, todayYmd)}${withMark ? ` · ${bidMark(b)}` : ''}`,
      amount: stageUsd(bidUsd(b)),
      to: b.id ? bidPath(b.id) : null,
    })),
  }
}

/**
 * The bids' half, a row a size. Null when no won rate reads yet. With the bids themselves handed in (the same list,
 * in the same order, the rate was built from), each size opens on the bids behind it.
 */
export function bidsBreakout(wins: BidWins | null | undefined, bids?: ReadonlyArray<BidSent> | null, todayYmd?: string | null): MarketBreakout | null {
  if (!wins || wins.wonPerWeekUsd == null) return null
  const rows: BreakoutRow[] = wins.sizes.map((s) => {
    const counts = `${s.won.count} won, ${s.lost.count} lost, ${s.noMark.count} with no mark.`
    const groups =
      bids && todayYmd
        ? [
            bidGroup('sent', `Sent in the last ${weeksWords(wins.window.weeks)}`, s.members.sent, bids, todayYmd, true),
            bidGroup('won', 'Won, behind the rate', s.members.won, bids, todayYmd, false),
            bidGroup('lost', 'Lost, behind the rate', s.members.lost, bids, todayYmd, false),
            bidGroup('noMark', 'No mark, behind the rate', s.members.noMark, bids, todayYmd, false),
          ].filter((g): g is BreakoutGroup => g != null)
        : []
    return {
      key: s.id,
      label: s.label,
      cells: [stageUsd(s.sentPerWeekUsd), s.usedRate != null ? pct(s.usedRate) : 'no rate', s.wonPerWeekUsd != null ? stageUsd(s.wonPerWeekUsd) : 'not read'],
      // A size with nothing won or lost has no rate of its own.
      note: s.rate == null && s.usedRate != null ? `${counts} Read at the rate for all bids.` : counts,
      ...(groups.length > 0 ? { groups } : {}),
    }
  })
  rows.push({ key: 'all', label: 'All bids', cells: [stageUsd(wins.window.sentPerWeekUsd), wins.windowRate != null ? pct(wins.windowRate) : 'no rate', stageUsd(wins.wonPerWeekUsd)], total: true })
  const notes = [`Sent a week is the bids sent over the last ${weeksWords(wins.window.weeks)}.`, 'The won rate is by dollars, over every bid ever sent in that size.', 'A bid counts as won or lost only when it is marked.']
  if (wins.noMark.count > 0) notes.push(`${wins.noMark.count} ${plural(wins.noMark.count, 'bid has', 'bids have')} no mark, for ${stageUsd(wins.noMark.usd)}. By age, ${stageUsd(wins.agedLostUsd)} of that counts as lost.`)
  if (wins.wonNoValue > 0) notes.push(`${wins.wonNoValue} won ${plural(wins.wonNoValue, 'bid has', 'bids have')} no dollar value, so won reads low.`)
  if (wins.leftOutCount > 0) notes.push(`${wins.leftOutCount} sent ${plural(wins.leftOutCount, 'bid is', 'bids are')} on what the Bridge leaves out, and ${plural(wins.leftOutCount, 'is', 'are')} not counted.`)
  if (wins.thin) notes.push('Few bids are marked won or lost so far, so the rates can swing.')
  return { key: 'bids', title: 'What the bids win a week', columns: ['Bid size', 'Sent a week', 'Won rate', 'Worth a week'], rows, notes }
}

function estimateGroup(key: string, title: string, members: ReadonlyArray<number>, estimates: ReadonlyArray<EstimateSent> | null | undefined, todayYmd: string | null | undefined): BreakoutGroup[] {
  if (!estimates || !todayYmd) return []
  const usdOf = (e: EstimateSent): number => (Number.isFinite(e.usd) && e.usd > 0 ? e.usd : 0)
  const rows = members.map((i) => ({ i, e: estimates[i] })).filter((x): x is { i: number; e: EstimateSent } => x.e != null)
  if (rows.length === 0) return []
  rows.sort((a, b) => usdOf(b.e) - usdOf(a.e))
  return [
    {
      key,
      title,
      words: `${rows.length} ${plural(rows.length, 'estimate', 'estimates')} · ${stageUsd(rows.reduce((s, x) => s + usdOf(x.e), 0))}`,
      items: rows.map(({ i, e }) => ({
        key: e.id ?? `at-${i}`,
        title: e.name?.trim() || (e.number != null ? `Estimate ${e.number}` : 'An estimate with no title'),
        detail: `${e.number != null ? `number ${e.number} · ` : ''}sent ${dayWords(e.sentYmd, todayYmd)}`,
        amount: stageUsd(usdOf(e)),
        to: e.number != null ? `/estimates/${e.number}` : null,
      })),
    },
  ]
}

/**
 * The estimates' half: how the won rate is made, then what it sells a week. Null when no won rate reads yet. With
 * the estimates themselves handed in (the same list, in the same order), each row opens on the estimates behind it,
 * and a last row lists what is still out.
 */
export function estimatesBreakout(wins: EstimateWins | null | undefined, estimates?: ReadonlyArray<EstimateSent> | null, todayYmd?: string | null): MarketBreakout | null {
  if (!wins || wins.coefficient == null || wins.soldPerWeekUsd == null) return null
  const tally = (key: keyof EstimateWins['members'], label: string, t: { count: number; usd: number }, note?: string): BreakoutRow => {
    const groups = estimateGroup(key, label, wins.members[key], estimates, todayYmd)
    return { key, label, cells: [String(t.count), stageUsd(t.usd)], ...(note ? { note } : {}), ...(groups.length > 0 ? { groups } : {}) }
  }
  const rows: BreakoutRow[] = [
    tally('won', 'Approved', wins.won),
    tally('declined', 'Declined', wins.declined),
    tally('notChosen', 'Passed over', wins.notChosen, 'The customer approved another estimate for the same address.'),
    tally('expired', 'No answer', wins.expired, `Sent over ${ESTIMATE_LOST_AFTER_DAYS} days ago.`),
    { key: 'rate', label: 'Won rate, by dollars', cells: ['', pct(wins.coefficient)], total: true },
  ]
  // What is still out is in no rate yet. It is listed so each one can be chased.
  if (wins.out.count > 0) rows.push(tally('out', 'Still out', wins.out, 'No answer yet. Not in the rate.'))
  const notes = [
    `${stageUsd(wins.window.sentPerWeekUsd)} of estimates went out a week over the last ${weeksWords(wins.window.weeks)}.`,
    `At ${pct(wins.coefficient)} that sells ${stageUsd(wins.soldPerWeekUsd)} a week.`,
  ]
  if (wins.out.count > 0) {
    notes.push(`${wins.out.count} ${plural(wins.out.count, 'estimate is', 'estimates are')} still out, for ${stageUsd(wins.out.usd)}.${wins.out.expectedUsd != null ? ` At ${pct(wins.coefficient)} that is ${stageUsd(wins.out.expectedUsd)}.` : ''}`)
    if (wins.agingOut.count > 0) {
      notes.push(`${wins.agingOut.count} of those ${plural(wins.agingOut.count, 'has', 'have')} waited over ${ESTIMATE_USUAL_ANSWER_DAYS} days, for ${stageUsd(wins.agingOut.usd)}.`)
      if (wins.coefficientIfAgedOut != null) notes.push(`If none of them signs, the won rate comes down to ${pct(wins.coefficientIfAgedOut)}.`)
    }
  }
  if (wins.thin) notes.push('Few estimates are approved or lost so far, so the rate can swing.')
  return { key: 'estimates', title: 'What the estimates sell a week', columns: ['Estimates', 'Count', 'Dollars'], rows, notes }
}

/** What a screen reader hears on a tile: the amount, its words, and what the press opens. */
export function breakoutPressLabel(value: string, words: string): string {
  return `${value} ${words}. Show what makes it up.`
}

/** What a screen reader hears on a row that opens. */
export function breakoutRowLabel(row: Pick<BreakoutRow, 'label' | 'groups'>, open: boolean): string {
  const n = (row.groups ?? []).reduce((s, g) => s + g.items.length, 0)
  return `${row.label}. ${open ? 'Close the list.' : `Show the ${n} behind it.`}`
}
