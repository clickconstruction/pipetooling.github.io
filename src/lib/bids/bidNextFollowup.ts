/**
 * "Call again on …" (v2.4420, punch list #80) — when an open bid is due for its next call.
 *
 * One idea: every sent bid with no answer has a next day. It is, in this order:
 *   1. the bid's own day (`bids.next_followup_on`, rolled up from the contact log),
 *   2. else its builder's day (`customer_followup_prefs`: a snooze, or the call window's
 *      "Next follow-up"),
 *   3. else seven days after the last contact, the rule the Call queue always had.
 *
 * A picked day (1 or 2) is a promise: it parks the bid until then and is what the Dashboard,
 * the Calendar and the phone remind about. The seven-day default only orders the queue.
 *
 * A picked day is SPENT once a contact is logged on or after it: the call happened. An earlier
 * contact leaves it standing, so a call in November does not erase "January 5".
 *
 * Pure module: no React, no Supabase. Callers pass today's civil day in the app's time zone.
 */

import { bidNeedsChase, PENDING_CHASE_STALE_CONTACT_DAYS } from '../bidPendingChase'
import { calendarYmdInAppTzFromIso, formatWorkDateYmdWeekdayShortFriendly, ymdAddDays, ymdDaysBetween } from '../../utils/dateUtils'

export type FollowupReasonKey = 'budget' | 'owner_deciding' | 'not_awarded' | 'other'

/** What a parked bid waits on. Keys match the CHECK on `bids_submission_entries.next_followup_reason`. */
export const FOLLOWUP_REASONS: ReadonlyArray<{ key: FollowupReasonKey; label: string }> = [
  { key: 'budget', label: 'Their budget' },
  { key: 'owner_deciding', label: 'Owner deciding' },
  { key: 'not_awarded', label: 'Not awarded yet' },
  { key: 'other', label: 'Other' },
]

export function isFollowupReasonKey(value: unknown): value is FollowupReasonKey {
  return FOLLOWUP_REASONS.some((r) => r.key === value)
}

export function followupReasonLabel(key: string | null | undefined): string | null {
  return FOLLOWUP_REASONS.find((r) => r.key === key)?.label ?? null
}

export type FollowupQuickPickKey = 'next-week' | 'two-weeks' | 'next-month' | 'three-months'

export const FOLLOWUP_QUICK_PICKS: ReadonlyArray<{ key: FollowupQuickPickKey; label: string }> = [
  { key: 'next-week', label: 'Next week' },
  { key: 'two-weeks', label: '2 weeks' },
  { key: 'next-month', label: 'Next month' },
  { key: 'three-months', label: '3 months' },
]

const YMD = /^(\d{4})-(\d{2})-(\d{2})$/

/** `ymd` plus whole months, keeping the day of the month where the month has it (Jan 31 + 1 → Feb 28). */
function ymdAddMonths(ymd: string, months: number): string {
  const m = YMD.exec(ymd)
  if (!m) return ymd
  const y = Number(m[1])
  const mo = Number(m[2]) - 1 + months
  const d = Number(m[3])
  const lastDay = new Date(Date.UTC(y, mo + 1, 0)).getUTCDate()
  const out = new Date(Date.UTC(y, mo, Math.min(d, lastDay)))
  return `${out.getUTCFullYear()}-${String(out.getUTCMonth() + 1).padStart(2, '0')}-${String(out.getUTCDate()).padStart(2, '0')}`
}

/** A Saturday or Sunday moves to the Monday after: nobody answers the office phone on a weekend. */
export function followupWeekdayOnOrAfter(ymd: string): string {
  const m = YMD.exec(ymd)
  if (!m) return ymd
  const dow = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))).getUTCDay()
  return dow === 6 ? ymdAddDays(ymd, 2) : dow === 0 ? ymdAddDays(ymd, 1) : ymd
}

/** The day a quick pick means, counted from today and moved off a weekend. */
export function followupQuickPickYmd(pick: FollowupQuickPickKey, todayYmd: string): string {
  const raw =
    pick === 'next-week' ? ymdAddDays(todayYmd, 7)
    : pick === 'two-weeks' ? ymdAddDays(todayYmd, 14)
    : pick === 'next-month' ? ymdAddMonths(todayYmd, 1)
    : ymdAddMonths(todayYmd, 3)
  return followupWeekdayOnOrAfter(raw)
}

/** A day typed by hand must be a real day after today. */
export function followupDateIsPickable(ymd: string, todayYmd: string): boolean {
  if (!YMD.test(ymd)) return false
  const days = ymdDaysBetween(todayYmd, ymd)
  return days != null && days >= 1
}

/** "Tue, Jan 5", with the year when it is not this year: "Tue, Jan 5, 2027". */
export function followupDateLabel(ymd: string, todayYmd: string): string {
  const base = formatWorkDateYmdWeekdayShortFriendly(ymd)
  return ymd.slice(0, 4) === todayYmd.slice(0, 4) ? base : `${base}, ${ymd.slice(0, 4)}`
}

export type BidFollowupState =
  /** A picked day that has passed. */
  | 'overdue'
  /** A picked day that is today. */
  | 'due'
  /** A picked day still ahead: parked. */
  | 'later'
  /** No picked day and the last contact is stale (or there never was one). */
  | 'none'
  /** No picked day, contacted inside the last seven days. */
  | 'fresh'

export type BidFollowupSource = 'bid' | 'builder' | 'default'

export type BidFollowup = {
  state: BidFollowupState
  /** The day the bid is due. Null only for `none` with no contact at all. */
  dueYmd: string | null
  source: BidFollowupSource
  /** Days from today to `dueYmd`: negative = overdue by that many. Null when there is no day. */
  daysUntil: number | null
}

export type BidFollowupInput = {
  /** `bids.bid_date_sent`. */
  sentIso: string | null
  /** Effective last contact instant; null = never. */
  lastContactIso: string | null
  /** `bids.next_followup_on` (YYYY-MM-DD). */
  bidNextYmd?: string | null
  /** The builder's day: `customer_followup_prefs.snoozed_until`, else `next_followup_at`, as a civil day. */
  builderNextYmd?: string | null
}

/** The civil day of a contact, in the app's time zone; null for none. */
function contactYmd(lastContactIso: string | null): string | null {
  if (!lastContactIso) return null
  return calendarYmdInAppTzFromIso(lastContactIso) || null
}

/** A picked day stands until a contact is logged on or after it. */
export function followupDayStands(pickedYmd: string | null | undefined, lastContactIso: string | null): pickedYmd is string {
  if (!pickedYmd || !YMD.test(pickedYmd)) return false
  const contact = contactYmd(lastContactIso)
  return contact == null || pickedYmd > contact
}

/** Where one open bid stands today. */
export function resolveBidFollowup(input: BidFollowupInput, todayYmd: string, nowIso: string): BidFollowup {
  const picked: { ymd: string; source: BidFollowupSource } | null =
    followupDayStands(input.bidNextYmd, input.lastContactIso) ? { ymd: input.bidNextYmd, source: 'bid' }
    : followupDayStands(input.builderNextYmd, input.lastContactIso) ? { ymd: input.builderNextYmd, source: 'builder' }
    : null
  if (picked) {
    const daysUntil = ymdDaysBetween(todayYmd, picked.ymd) ?? 0
    return { state: daysUntil < 0 ? 'overdue' : daysUntil === 0 ? 'due' : 'later', dueYmd: picked.ymd, source: picked.source, daysUntil }
  }
  const contact = contactYmd(input.lastContactIso)
  const dueYmd = contact ? ymdAddDays(contact, PENDING_CHASE_STALE_CONTACT_DAYS) : null
  const stale = bidNeedsChase({ sentIso: input.sentIso ?? '', lastContactIso: input.lastContactIso }, nowIso)
  return { state: stale ? 'none' : 'fresh', dueYmd, source: 'default', daysUntil: dueYmd ? ymdDaysBetween(todayYmd, dueYmd) : null }
}

/** Does this bid belong on today's list? Overdue, due, or never given a day and gone quiet. */
export function followupNeedsCall(f: Pick<BidFollowup, 'state'>): boolean {
  return f.state === 'overdue' || f.state === 'due' || f.state === 'none'
}

/** The small tag on a card: "Due today", "3 d overdue", "Tue, Jan 5". Null when there is nothing to say. */
export function followupTag(f: BidFollowup, todayYmd: string): { label: string; tone: 'red' | 'amber' | 'blue' } | null {
  if (f.state === 'overdue') return { label: `${Math.abs(f.daysUntil ?? 0)} d overdue`, tone: 'red' }
  if (f.state === 'due') return { label: 'Due today', tone: 'amber' }
  if (f.state === 'later' && f.dueYmd) return { label: followupDateLabel(f.dueYmd, todayYmd), tone: 'blue' }
  return null
}

/**
 * The builder's day from its prefs row: a snooze still ahead wins (the builder is parked), else
 * the call window's promised follow-up. Both are instants; the day is the app's civil day.
 */
export function builderFollowupYmd(prefs: { next_followup_at?: string | null; snoozed_until?: string | null } | null | undefined, todayYmd: string): string | null {
  if (!prefs) return null
  const snooze = prefs.snoozed_until ? calendarYmdInAppTzFromIso(prefs.snoozed_until) : ''
  if (snooze && snooze > todayYmd) return snooze
  const next = prefs.next_followup_at ? calendarYmdInAppTzFromIso(prefs.next_followup_at) : ''
  return next || null
}

// --- What a tap writes -------------------------------------------------------

export type FollowupPick = {
  /** The day to call again; null = no pick (the seven-day default). */
  ymd: string | null
  personId: string | null
  /** For the log sentence only. */
  personName: string | null
  reason: FollowupReasonKey | null
}

export const EMPTY_FOLLOWUP_PICK: FollowupPick = { ymd: null, personId: null, personName: null, reason: null }

/** The log columns a pick writes. A pick with no day writes nothing: who and why belong to a day. */
export function followupEntryColumns(pick: FollowupPick): {
  next_followup_on: string | null
  next_followup_contact_person_id: string | null
  next_followup_reason: FollowupReasonKey | null
} {
  if (!pick.ymd) return { next_followup_on: null, next_followup_contact_person_id: null, next_followup_reason: null }
  return { next_followup_on: pick.ymd, next_followup_contact_person_id: pick.personId, next_followup_reason: pick.reason }
}

/** Where the plain sentence about the day starts in a log note. */
export const FOLLOWUP_NOTE_MARK = 'Call again '

/**
 * The plain sentence added to the log note, so every screen that prints the log says the day
 * without knowing the columns: "Call again Tue, Jan 5, 2027. Ask for J. Rayburn. Waiting on their budget."
 */
export function followupNoteSentence(pick: FollowupPick, todayYmd: string): string {
  if (!pick.ymd) return ''
  const parts = [`${FOLLOWUP_NOTE_MARK}${followupDateLabel(pick.ymd, todayYmd)}.`]
  if (pick.personName?.trim()) parts.push(`Ask for ${pick.personName.trim()}.`)
  const reason = followupReasonLabel(pick.reason)
  if (reason && pick.reason !== 'other') parts.push(`Waiting on ${reason.charAt(0).toLowerCase()}${reason.slice(1)}.`)
  return parts.join(' ')
}

/** A log note with its sentence about the day: what was said, then the day. */
export function withFollowupSentence(note: string, pick: FollowupPick, todayYmd: string): string {
  const sentence = followupNoteSentence(pick, todayYmd)
  const base = note.trim()
  if (!sentence) return base
  if (!base) return sentence
  return `${base}${/[.!?]$/.test(base) ? '' : '.'} ${sentence}`
}

/** What was said, without the sentence about the day: the "Last time" line prints the day itself. */
export function noteWithoutFollowupSentence(note: string | null | undefined): string {
  const text = (note ?? '').trim()
  const at = text.lastIndexOf(FOLLOWUP_NOTE_MARK)
  if (at < 0) return text
  return text.slice(0, at).trim()
}

/** The note a date change with no call writes (a note, not a contact). */
export function followupChangeNote(pick: FollowupPick, todayYmd: string): string {
  return pick.ymd ? `Date moved. ${followupNoteSentence(pick, todayYmd)}` : 'Call-again date removed.'
}

/** A contact entry with the pick folded in: the columns and the sentence. No day picked = the entry as it was. */
export function applyFollowupToEntry<E extends { notes: string }>(entry: E, pick: FollowupPick, todayYmd: string): E & Partial<ReturnType<typeof followupEntryColumns>> {
  if (!pick.ymd) return entry
  return { ...entry, notes: withFollowupSentence(entry.notes, pick, todayYmd), ...followupEntryColumns(pick) }
}

export type FollowupChangeEntry = {
  bid_id: string
  gc_customer_id: string | null
  /** Null on purpose: moving a date is a note, not a contact, so `last_contact` stays put. */
  contact_method: null
  notes: string
  occurred_at: string
  created_by: string
  next_followup_on: string | null
  next_followup_contact_person_id: string | null
  next_followup_reason: FollowupReasonKey | null
  next_followup_cleared: boolean
}

/** The log row for a date moved (or removed) with no call. */
export function buildFollowupChangeEntry(args: { bidId: string; userId: string; nowIso: string; gcCustomerId?: string | null; pick: FollowupPick; todayYmd: string }): FollowupChangeEntry {
  return {
    bid_id: args.bidId,
    gc_customer_id: args.gcCustomerId ?? null,
    contact_method: null,
    notes: followupChangeNote(args.pick, args.todayYmd),
    occurred_at: args.nowIso,
    created_by: args.userId,
    ...followupEntryColumns(args.pick),
    next_followup_cleared: !args.pick.ymd,
  }
}

export type BidFollowupColumns = {
  nextYmd: string | null
  personId: string | null
  reason: FollowupReasonKey | null
  entryId: string | null
}

/**
 * The bid's roll-up columns, read off a bid row. Tolerant on purpose: a row loaded before the
 * columns existed simply has no day.
 */
export function bidFollowupColumns(bid: unknown): BidFollowupColumns {
  const row = (bid ?? {}) as Record<string, unknown>
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v : null)
  const ymd = str(row.next_followup_on)
  if (!ymd || !YMD.test(ymd.slice(0, 10))) return { nextYmd: null, personId: null, reason: null, entryId: null }
  const reason = row.next_followup_reason
  return {
    nextYmd: ymd.slice(0, 10),
    personId: str(row.next_followup_contact_person_id),
    reason: isFollowupReasonKey(reason) ? reason : null,
    entryId: str(row.next_followup_entry_id),
  }
}
