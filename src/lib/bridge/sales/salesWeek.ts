/**
 * The Sales window's open view (punch list #318, PR 3, drawn in `to-dos/market-sales-won-rates/mockup.html`):
 * where Sales stands in one headline, what to do this week in up to three rows, why we lost in three lines, and the
 * words behind *How this is counted*.
 *
 * The headline reads the pile by the owner's rules of 2026-11-11 (`bidWins.ts`, `estimateWins.ts`, added up in
 * `salesWorth.ts`). The calls come from the window's own who-to-call list (`salesDesk.ts`), which still ranks each
 * asker by their own record: *How this is counted* prints the headline's rules from here, then the list's own rules
 * from the desk (`howItReads`), which say so in plain words.
 *
 * Pure: no React, no Supabase. Every sentence it writes is held to the plain-words rule in `salesWeek.test.ts`.
 */
import { stageUsd } from '../stageFlow'
import { BID_AGING, type BidWins } from '../bidWins'
import { ESTIMATE_LOST_AFTER_DAYS, type EstimateWins } from '../estimateWins'
import { BID_BOARD_PATH, type SalesDesk, type SalesFunnel, type SalesFunnelLine } from './salesDesk'
import type { SalesOutWorth } from './salesWorth'

/** The calls the open view leads with. */
export const SALES_WEEK_CALLS = 2
/** The reasons the open view prints before the rest wait behind their fold. */
export const SALES_WEEK_REASONS = 3

const plural = (n: number, one: string, many: string): string => (n === 1 ? one : many)
const pct = (share: number): string => (share > 0 && share < 0.01 ? 'under 1%' : `${Math.round(share * 100)}%`)
/** A door's words as a press holds them: the chevron a link carries is dropped. */
const pressWords = (label: string): string => label.replace(/\s*›\s*$/, '')

/** "$2.9M is out. At our won rates that is about $74k."; null until a read lands, and the window keeps its old headline. */
export function salesWeekHeadline(read: SalesOutWorth | null): string | null {
  if (!read) return null
  return `${stageUsd(read.outUsd)} is out. At our won rates that is about ${stageUsd(read.worthUsd)}.`
}

/** "We sold $21k a week. The field builds $33k."; null while sold is not read. */
export function salesWeekLine(paces: { soldPerWeekUsd: number | null; fieldPerWeekUsd: number | null }): string | null {
  if (paces.soldPerWeekUsd == null) return null
  const sold = `We sold ${stageUsd(paces.soldPerWeekUsd)} a week.`
  return paces.fieldPerWeekUsd != null ? `${sold} The field builds ${stageUsd(paces.fieldPerWeekUsd)}.` : sold
}

export type SalesWeekRow = {
  key: string
  kind: 'call' | 'mark'
  /** "Call Oak Hollow HOA", a few words and no full stop. */
  title: string
  /** "$212k bid. 27 days past their usual answer." */
  sub: string
  press: { label: string; to: string }
}

/**
 * Do this week: the askers on the who-to-call list who are past their usual answer, the biggest bid first, at most
 * `SALES_WEEK_CALLS`. Then the old bids with no mark, when there are any, since the won rates rest on the marks.
 */
export function salesWeekRows(desk: Pick<SalesDesk, 'rows' | 'askers'> | null, bidWins: Pick<BidWins, 'noMarkOld'> | null): SalesWeekRow[] {
  const rows: SalesWeekRow[] = []
  if (desk) {
    const calls = desk.rows
      .filter((r) => r.kind === 'asker' && r.pastPace)
      .map((r) => {
        const bid = desk.askers.find((a) => a.key === r.key)?.callBid ?? null
        return { row: r, usd: bid ? bid.usd : r.openUsd, pastDays: bid ? bid.pastDays : null }
      })
      .sort((x, y) => y.usd - x.usd || (y.pastDays ?? 0) - (x.pastDays ?? 0))
      .slice(0, SALES_WEEK_CALLS)
    for (const c of calls) {
      const money = c.usd > 0 ? `${stageUsd(c.usd)} bid.` : 'A bid with no value.'
      const late = c.pastDays != null ? `${c.pastDays} ${plural(c.pastDays, 'day', 'days')} past their usual answer.` : 'Past their usual answer.'
      rows.push({ key: `call-${c.row.key}`, kind: 'call', title: `Call ${c.row.name}`, sub: `${money} ${late}`, press: { label: pressWords(c.row.door.label), to: c.row.door.to } })
    }
  }
  const old = bidWins?.noMarkOld.count ?? 0
  if (old > 0) rows.push({ key: 'mark-old', kind: 'mark', title: `Mark ${old} old ${plural(old, 'bid', 'bids')} won or lost`, sub: 'The won rates rest on the marks.', press: { label: 'Open the Bid Board', to: BID_BOARD_PATH } })
  return rows
}

/** Said in place of the rows when nothing is past its answer and no old bid waits on a mark. */
export const SALES_WEEK_EMPTY = 'Nothing waiting on a call or a mark this week.'

export type SalesLostReason = {
  key: SalesFunnelLine['key']
  label: string
  usd: number
  count: number
  /** On the losses with no reason: "Name it on 5 bids", opening the one bid or the Bid Board. */
  door: { label: string; to: string } | null
}

/** Why we lost: the loss reasons of the decided funnel, the most dollars first, at most `limit`. Won is not a reason. */
export function salesLostReasons(funnel: Pick<SalesFunnel, 'lines' | 'noReasonBids'>, limit: number = SALES_WEEK_REASONS): SalesLostReason[] {
  return funnel.lines
    .filter((l) => l.key !== 'won' && l.count > 0)
    .sort((x, y) => y.usd - x.usd || y.count - x.count)
    .slice(0, limit)
    .map((l) => {
      if (l.key !== 'none') return { key: l.key, label: l.label, usd: l.usd, count: l.count, door: null }
      const only = l.count === 1 && funnel.noReasonBids.length === 1 ? funnel.noReasonBids[0] : undefined
      return { key: l.key, label: l.label, usd: l.usd, count: l.count, door: { label: `Name it on ${l.count} ${plural(l.count, 'bid', 'bids')}`, to: only ? only.door.to : BID_BOARD_PATH } }
    })
}

/**
 * *How this is counted*, the headline's part: the owner's rules of 2026-11-11, in plain words and with no column
 * names. Reads without the desk, so it opens while the reads are in flight. The list's own rules follow it on the
 * page, from the desk (`howItReads` in `salesDesk.ts`).
 */
export function salesHowCounted(bidWins: Pick<BidWins, 'thin' | 'won' | 'lost' | 'noMarkOld' | 'leftOutCount'> | null, estimateWins: Pick<EstimateWins, 'coefficient'> | null): string[] {
  const aging = [...BID_AGING]
    .sort((a, b) => a.afterDays - b.afterDays)
    .map((a) => `${pct(a.lostShare)} lost after ${a.afterDays} days`)
    .join(' and ')
  const oldDays = Math.max(...BID_AGING.map((a) => a.afterDays))
  const lines = [
    'Out is every sent bid with no mark, plus every estimate still out.',
    'A bid counts as won or lost only when it is marked.',
    `With no mark it counts as ${aging}.`,
    'A bid with no mark counts as out only for the part not yet counted as lost.',
    'Each bid is read at the won rate for bids its size.',
    'A size with nothing won or lost yet is read at the rate for all sizes together.',
    `An estimate is lost when the customer declines it or gives no answer for ${ESTIMATE_LOST_AFTER_DAYS} days.`,
    'It is also lost when the customer passes it over for another at the same address.',
    estimateWins?.coefficient != null ? `An estimate still out is read at the won rate for estimates, ${pct(estimateWins.coefficient)}.` : 'Estimates have no won rate yet, so the ones still out add nothing.',
  ]
  if (bidWins) {
    const marked = bidWins.won.count + bidWins.lost.count
    const old = bidWins.noMarkOld.count
    const left = bidWins.leftOutCount
    if (old > 0) lines.push(`${old} ${plural(old, 'bid', 'bids')} with no mark ${plural(old, 'was', 'were')} sent over ${oldDays} days ago.`)
    if (left > 0) lines.push(`${left} sent ${plural(left, 'bid is', 'bids are')} on what the Bridge leaves out. ${plural(left, 'It is', 'They are')} not counted.`)
    if (bidWins.thin) lines.push(`Only ${marked} ${plural(marked, 'bid is', 'bids are')} marked won or lost so far, so the rates can swing.`)
  }
  return lines
}
