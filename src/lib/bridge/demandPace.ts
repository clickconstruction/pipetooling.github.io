/**
 * Market and Sales (link PR 4): the asks that came in and what went out and
 * came back, from the bids and the estimates, shaped into the stage-flow
 * kernel's inputs. Pure: the loader beside it (`loadDemandPace.ts`) reads the
 * rows. A bid is won when it is marked won, or marked started or complete,
 * and lost when it is marked lost. Nothing else decides: a job made from a bid
 * with no mark is still out (the owner's rule of 2026-11-11, punch list #318,
 * the one `bidWins.ts` counts by). Awaiting an answer is a bid or an estimate
 * sent in the last 90 days with no answer.
 *
 * The day a win is counted on is the day the answer was written down. Most
 * won bids carry no such day, so a marked bid without one takes the day its
 * job was made. That day only places the win in the window: the mark is what
 * makes it one. A won bid with neither day is in no week's count.
 */
import type { MarketStageInput, SalesStageInput } from './stageFlow'

export const AWAITING_DAYS = 90

export type DemandBid = {
  id: string
  createdYmd: string | null
  sentYmd: string | null
  /** The bid's value; the agreed value once there is one. */
  usd: number
  outcome: string | null
  outcomeYmd: string | null
  /** The job this bid became, if any, and the day it was created. It decides nothing: it dates a marked win that has no answer day, and gives a won bid with no value its dollars. */
  jobCreatedYmd: string | null
  jobUsd: number | null
}

export type DemandEstimate = {
  id: string
  createdYmd: string
  sentYmd: string | null
  status: string
  usd: number
  /** The day the customer accepted, when the app has it. */
  acceptedYmd: string | null
  /** The day the row last changed; stands in for the decline date. */
  updatedYmd: string | null
}

export type DemandInput = {
  windowStart: string
  todayYmd: string
  bids: DemandBid[]
  estimates: DemandEstimate[]
}

export type DemandReading = {
  market: MarketStageInput
  sales: Omit<SalesStageInput, 'soldPerWeekUsd'>
  /** Bids sent in the window with no value, for Fix the reading. */
  bidsNoValue: number
}

const inWindow = (ymd: string | null, start: string, end: string): boolean => !!ymd && ymd >= start && ymd <= end
const daysAgo = (ymd: string, n: number): string => new Date(Date.parse(`${ymd}T00:00:00Z`) - n * 86_400_000).toISOString().slice(0, 10)

export function buildDemand(input: DemandInput): DemandReading {
  const { windowStart: start, todayYmd: end } = input
  const weeks = Math.max(1, (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / (7 * 86_400_000))
  const awaitingFrom = daysAgo(end, AWAITING_DAYS)

  let bidsInvited = 0
  let bidsInvitedUsd = 0
  let bidsSentUsd = 0
  let bidsWonUsd = 0
  let bidsLostUsd = 0
  let awaitingBids = 0
  let awaitingBidsUsd = 0
  let bidsNoValue = 0
  for (const b of input.bids) {
    if (inWindow(b.createdYmd, start, end)) {
      bidsInvited += 1
      bidsInvitedUsd += b.usd
    }
    if (inWindow(b.sentYmd, start, end)) {
      bidsSentUsd += b.usd
      if (!(b.usd > 0)) bidsNoValue += 1
    }
    const won = b.outcome === 'won' || b.outcome === 'started_or_complete'
    const lost = b.outcome === 'lost'
    // A won bid with no value of its own takes its job's revenue, as `bidWins.ts` reads it.
    if (won && inWindow(b.outcomeYmd ?? b.jobCreatedYmd, start, end)) bidsWonUsd += b.usd > 0 ? b.usd : (b.jobUsd ?? 0)
    if (lost && inWindow(b.outcomeYmd, start, end)) bidsLostUsd += b.usd
    // Still out is no mark at all, whether or not a job was made from the bid.
    const open = !won && !lost
    if (open && b.sentYmd && b.sentYmd >= awaitingFrom && b.sentYmd <= end) {
      awaitingBids += 1
      awaitingBidsUsd += b.usd
    }
  }

  let estimatesRequested = 0
  let estimatesRequestedUsd = 0
  let estSentUsd = 0
  let estWonUsd = 0
  let estLostUsd = 0
  let awaitingEstimates = 0
  let awaitingEstimatesUsd = 0
  for (const e of input.estimates) {
    if (inWindow(e.createdYmd, start, end)) {
      estimatesRequested += 1
      estimatesRequestedUsd += e.usd
    }
    if (inWindow(e.sentYmd, start, end)) estSentUsd += e.usd
    if (e.status === 'customer_accepted' && inWindow(e.acceptedYmd ?? e.updatedYmd, start, end)) estWonUsd += e.usd
    if (e.status === 'declined' && inWindow(e.updatedYmd, start, end)) estLostUsd += e.usd
    if (e.status === 'sent' && e.sentYmd && e.sentYmd >= awaitingFrom && e.sentYmd <= end) {
      awaitingEstimates += 1
      awaitingEstimatesUsd += e.usd
    }
  }

  return {
    market: { bidsInvited, bidsInvitedUsd, estimatesRequested, estimatesRequestedUsd, weeks },
    sales: {
      bids: { sentUsd: bidsSentUsd, wonUsd: bidsWonUsd, lostUsd: bidsLostUsd },
      estimates: { sentUsd: estSentUsd, wonUsd: estWonUsd, lostUsd: estLostUsd },
      awaiting: { bids: awaitingBids, bidsUsd: awaitingBidsUsd, estimates: awaitingEstimates, estimatesUsd: awaitingEstimatesUsd },
    },
    bidsNoValue,
  }
}
