/**
 * The Market window on the shared step frame (punch list #318, PR 3, drawn in
 * `to-dos/market-sales-won-rates/mockup.html`, section "1 · Market"): where Market stands, the two parts behind it, the won
 * rate for each bid size, up to three things to do this week, and how it is counted.
 *
 * It leads with what Market is worth at the won rates (`bidWins.ts`, `estimateWins.ts`: the owner's rules of
 * 2026-11-11), not with every dollar asked judged at one win share. Until the won rates are read it falls back to the
 * headline the window had before.
 *
 * Every figure comes off the models as a number: the field's pace from the page or the header, a source's quiet
 * weeks and the count of smaller sources from `marketDesk.ts`. Nothing is read back out of a sentence.
 *
 * *How this is counted* is held under `MARKET_COUNTED_MAX_WORDS`: the rules for a win here, then how the list reads
 * (`marketHowItReads`). The sentences behind this week's worth stay on the page's own *How Market's figure is counted*.
 *
 * Every sentence a person reads from this file is held to the plain-words rule by `marketStepWindow.test.ts`.
 * Pure: no React, no Supabase.
 */
import { BID_AGING, type BidWins, type MarketWorth } from '../bidWins'
import { ESTIMATE_LOST_AFTER_DAYS, type EstimateWins } from '../estimateWins'
import { stageUsd } from '../stageFlow'
import { MARKET_DESK_WEEKS, marketHowItReads, type MarketDesk, type MarketHeader } from './marketDesk'

export type MarketStepRow = {
  key: 'old-bids' | 'call' | 'value'
  title: string
  sub: string
  press: { label: string; to: string; primary?: boolean }
}

export type MarketStepFigure = { key: 'bids' | 'estimates'; value: string; words: string }

export type MarketStepBar = {
  id: string
  label: string
  /** Won by dollars in this size, 0 to 1; null when nothing is won or lost in it yet. */
  share: number | null
  /** "38%", or "—" with no share. */
  pct: string
}

export type MarketStepModel = {
  /** True when Market's worth at the won rates is known: the window leads with it and drops the one win share. */
  byWonRates: boolean
  headline: string
  line: string
  figures: MarketStepFigure[]
  bars: MarketStepBar[]
  rows: MarketStepRow[]
  /** Every source in the span, the folded small ones included; null while the desk reads. */
  sourceCount: number | null
  /** *How this is counted*: the rules for a win, then how the list of sources reads. */
  counted: MarketCountedSection[]
}

export type MarketCountedSection = { key: 'worth' | 'sources'; head: string; words: string }

/** *How this is counted* stays under this many words, heads and the closing line included (the owner, 2026-11-11). */
export const MARKET_COUNTED_MAX_WORDS = 200

export type MarketStepInput = {
  header: MarketHeader
  desk: MarketDesk | null
  worth?: MarketWorth | null
  bidWins?: BidWins | null
  estimateWins?: EstimateWins | null
  /** Dollars a week the field builds, when the page passes it; else the header's own figure. */
  fieldPerWeekUsd?: number | null
}

/** The words the window's folds print that are not a figure. */
export const MARKET_STEP_WORDS = {
  eyebrow: 'Market · what comes in to price',
  sizesHead: 'What we win, by the size of the bid',
  doHead: 'Do this week',
  nothingToDo: 'Nothing waiting on Market this week.',
  reading: 'Reading the sources and the asks by week…',
  sourcesNote: `Every source of asks in the last ${MARKET_DESK_WEEKS} weeks. The bars are asks by quarter, with this quarter dark. Press a row for its quarters and its door.`,
  asksNote: 'Every bid opened and estimate requested, by value. Blue is GCs and amber is customers. Press a week for its value.',
  feedLineNote: 'The dashed line is what feeding the field takes.',
} as const

const pct = (share: number): string => (share > 0 && share < 0.01 ? 'under 1%' : `${Math.round(share * 100)}%`)
const plural = (n: number, one: string, many: string): string => (n === 1 ? one : many)

/** Every source in the span: the rows the list shows and the smaller ones its last line folds. */
export function marketSourceCount(desk: Pick<MarketDesk, 'rows' | 'restCount'>): number {
  return desk.rows.length + desk.restCount
}

/** The error, in plain words: what could not be read, then the reason as it came. */
export function marketErrorWords(error: string): string {
  const reason = error.trim()
  return `The sources and the asks by week could not be read. ${reason}${/[.?!]$/.test(reason) ? '' : '.'}`
}

const AGING_WORDS = `With no mark it counts as ${[...BID_AGING]
  .reverse()
  .map((a) => `${pct(a.lostShare)} lost after ${a.afterDays} days`)
  .join(' and ')}.`

/** The owner's rules for a win (2026-11-11), as the headline and the list count them. */
const WON_RULES: string[] = [
  'A bid counts as won or lost only when it is marked.',
  AGING_WORDS,
  'Each bid is read at the won rate for bids its size.',
  'An estimate is lost when the customer declines it.',
  'It is also lost when the customer passes it over for another at the same address.',
  `It is also lost when the customer gives no answer for ${ESTIMATE_LOST_AFTER_DAYS} days.`,
]

/** *How this is counted*, in its two parts. With the won rates read it never names the one win share. */
export function marketCounted(byWonRates: boolean): MarketCountedSection[] {
  const lead = byWonRates ? ['Market is worth what the bids and estimates sent can be expected to win a week.'] : ['The won rates are not read yet.', 'Until they are, the headline judges the asks at one win share.']
  return [
    { key: 'worth', head: 'What Market is worth', words: [...lead, ...WON_RULES].join(' ') },
    { key: 'sources', head: 'The list of sources', words: marketHowItReads() },
  ]
}

/** Up to three things to do this week, the biggest first: mark the old bids, call the first quiet source, value the bids with none. */
export function marketStepRows(desk: Pick<MarketDesk, 'rows' | 'zeroBids'> | null, bidWins: Pick<BidWins, 'noMarkOld'> | null | undefined): MarketStepRow[] {
  const rows: MarketStepRow[] = []
  const oldDays = Math.max(...BID_AGING.map((a) => a.afterDays))
  const old = bidWins?.noMarkOld ?? null
  if (old && old.count > 0) {
    rows.push({
      key: 'old-bids',
      title: `Mark ${old.count} old ${plural(old.count, 'bid', 'bids')} won or lost`,
      sub: `Sent over ${oldDays} days ago, no mark. ${stageUsd(old.usd)}.`,
      press: { label: 'Open the Bid Board', to: '/bids?tab=bid-board', primary: true },
    })
  }
  if (desk) {
    const quiet = desk.rows.find((r) => r.kind === 'gc' && r.quietWeeks != null) ?? null
    const weeks = quiet?.quietWeeks ?? null
    if (quiet && weeks != null) {
      rows.push({
        key: 'call',
        title: `Call ${quiet.name}`,
        sub: `Quiet ${weeks} ${plural(weeks, 'week', 'weeks')}. ${stageUsd(quiet.askedUsd)} asked in the last ${MARKET_DESK_WEEKS} weeks.`,
        press: { label: quiet.door.label, to: quiet.door.href },
      })
    }
    if (desk.zeroBids && desk.zeroBids.count > 0) {
      rows.push({
        key: 'value',
        title: `Put a value on ${desk.zeroBids.count} ${plural(desk.zeroBids.count, 'bid', 'bids')}`,
        sub: 'A bid with no value counts for nothing.',
        press: { label: 'Open the bids', to: '/bids' },
      })
    }
  }
  return rows
}

export function buildMarketStep(input: MarketStepInput): MarketStepModel {
  const { header, desk } = input
  const worth = input.worth ?? null
  const bidWins = input.bidWins ?? null
  const estimateWins = input.estimateWins ?? null
  const field = input.fieldPerWeekUsd ?? header.fieldPerWeekUsd
  const worthUsd = worth?.perWeekUsd ?? null
  const byWonRates = worthUsd != null

  let headline: string
  let line: string
  if (worthUsd != null && field != null) {
    const gap = field - worthUsd
    headline = `Market is worth ${stageUsd(worthUsd)} a week. The field builds ${stageUsd(field)}.`
    line = gap > 0 ? `That is ${stageUsd(gap)} a week short of keeping the field busy.` : gap < 0 ? `That is ${stageUsd(-gap)} a week more than the field builds.` : 'That is what the field builds.'
  } else if (worthUsd != null) {
    headline = `Market is worth ${stageUsd(worthUsd)} a week.`
    line = 'The field’s pace is not read yet.'
  } else {
    // The headline the window had before. Its sub-line judges the asks at one win share, so only the field's figure shows.
    headline = desk ? desk.headline : header.headline
    line = field != null ? `The field builds ${stageUsd(field)} a week.` : 'The field’s pace is not read yet.'
  }

  const figures: MarketStepFigure[] = []
  if (bidWins) figures.push({ key: 'bids', value: bidWins.wonPerWeekUsd != null ? stageUsd(bidWins.wonPerWeekUsd) : '—', words: bidWins.wonPerWeekUsd != null && bidWins.windowRate != null ? `bids, at ${pct(bidWins.windowRate)} won` : 'bids, no won rate yet' })
  if (estimateWins) figures.push({ key: 'estimates', value: estimateWins.soldPerWeekUsd != null ? stageUsd(estimateWins.soldPerWeekUsd) : '—', words: estimateWins.soldPerWeekUsd != null && estimateWins.coefficient != null ? `estimates, at ${pct(estimateWins.coefficient)} won` : 'estimates, no won rate yet' })

  const bars: MarketStepBar[] = (bidWins?.sizes ?? []).map((s) => ({ id: s.id, label: s.label, share: s.rate != null ? Math.min(1, Math.max(0, s.rate)) : null, pct: s.rate != null ? pct(s.rate) : '—' }))

  return { byWonRates, headline, line, figures, bars, rows: marketStepRows(desk, bidWins), sourceCount: desk ? marketSourceCount(desk) : null, counted: marketCounted(byWonRates) }
}
