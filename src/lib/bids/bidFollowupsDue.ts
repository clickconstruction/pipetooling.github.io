/**
 * Call-again days across the app (v2.4426, punch list #80): which promised calls are due, for
 * the Dashboard's Needs You card, and which days to draw on the Calendar.
 *
 * Only a day somebody PICKED counts here (`bids.next_followup_on` still standing). The
 * seven-day default orders the Call queue and reminds nobody: it would be ninety cards.
 *
 * Pure module. Callers pass today's civil day in the app's time zone.
 */

import { followupDayStands } from './bidNextFollowup'

/** A bid row as these readers need it. */
export type BidFollowupRow = {
  id: string
  project_name: string | null
  bid_value: number | null
  bid_date_sent: string | null
  outcome: string | null
  last_contact: string | null
  next_followup_on: string | null
  adopted_into_bid_id?: string | null
  /** The builder's display name (customer, else the legacy GC builder). */
  builderName: string | null
}

/** A sent bid with no answer whose own call-again day still stands. */
export function bidHasStandingDay(b: BidFollowupRow): b is BidFollowupRow & { next_followup_on: string } {
  if (b.outcome != null || !b.bid_date_sent || b.adopted_into_bid_id) return false
  return followupDayStands(b.next_followup_on, b.last_contact)
}

export type BidFollowupsDue = {
  /** Promised calls due today or already missed. */
  count: number
  /** Of those, the ones whose day has passed. */
  overdueCount: number
  /** Dollars pending on them. */
  value: number
  /** Builder names, most overdue first, each once. */
  names: string[]
}

/** The promised calls that are due. Null when there are none: the card does not show. */
export function bidFollowupsDue(rows: readonly BidFollowupRow[], todayYmd: string): BidFollowupsDue | null {
  const due = rows.filter(bidHasStandingDay).filter((b) => b.next_followup_on <= todayYmd)
  if (due.length === 0) return null
  due.sort((a, b) => (a.next_followup_on < b.next_followup_on ? -1 : a.next_followup_on > b.next_followup_on ? 1 : 0))
  const names: string[] = []
  for (const b of due) {
    const name = (b.builderName ?? '').trim() || (b.project_name ?? '').trim()
    if (name && !names.includes(name)) names.push(name)
  }
  return {
    count: due.length,
    overdueCount: due.filter((b) => b.next_followup_on < todayYmd).length,
    value: due.reduce((sum, b) => sum + (typeof b.bid_value === 'number' && Number.isFinite(b.bid_value) ? b.bid_value : 0), 0),
    names,
  }
}

/** "City of Riverton · Hilltop Builders · 2 more": up to `max` names, then how many are left. */
export function followupNamesLine(names: readonly string[], max = 3): string {
  if (names.length <= max) return names.join(' · ')
  return `${names.slice(0, max).join(' · ')} · ${names.length - max} more`
}

export type BidFollowupCalendarItem = {
  bidId: string
  /** The day the call is promised for (YYYY-MM-DD). */
  dateKey: string
  /** "City of Riverton · City re-pipe": the builder, then the project. */
  title: string
}

/** One Calendar entry per bid with a standing day, on that day (a missed day stays where it was). */
export function bidFollowupCalendarItems(rows: readonly BidFollowupRow[]): BidFollowupCalendarItem[] {
  return rows.filter(bidHasStandingDay).map((b) => ({
    bidId: b.id,
    dateKey: b.next_followup_on,
    title: [(b.builderName ?? '').trim(), (b.project_name ?? '').trim()].filter(Boolean).join(' · ') || 'Bid follow-up',
  }))
}
