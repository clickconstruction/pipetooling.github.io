/**
 * Team review cadence kernel (v2.960): who is OVERDUE for the signed-in
 * reviewer's monthly-ish review. Everyone with Team access reviews everyone
 * else every N days (dev-set in Settings, default 30); a subject is overdue
 * when the reviewer has never reviewed them or hasn't touched their review in
 * more than N days. Feeds the Dashboard / Dispatch Inbox reminder banner.
 */
import type { RatableUser } from './teamMemberReviews'

export const DEFAULT_TEAM_REVIEW_CADENCE_DAYS = 30

const DAY_MS = 24 * 60 * 60 * 1000

/** Positive whole day count from app_settings value_num; anything else falls back to the default. */
export function parseTeamReviewCadenceDays(valueNum: number | null | undefined): number {
  if (valueNum == null || !Number.isFinite(valueNum)) return DEFAULT_TEAM_REVIEW_CADENCE_DAYS
  const days = Math.floor(valueNum)
  return days >= 1 ? days : DEFAULT_TEAM_REVIEW_CADENCE_DAYS
}

export type MyReviewStamp = {
  subject_user_id: string
  /** First-of-month ISO date. */
  review_month: string
  /** Last save of that month's review. */
  updated_at: string | null
}

function stampMs(stamp: MyReviewStamp): number {
  const fromUpdated = stamp.updated_at ? Date.parse(stamp.updated_at) : Number.NaN
  if (Number.isFinite(fromUpdated)) return fromUpdated
  const fromMonth = Date.parse(`${stamp.review_month}T00:00:00Z`)
  return Number.isFinite(fromMonth) ? fromMonth : 0
}

/**
 * Roster members the reviewer owes a review: never reviewed, or last touched
 * more than cadenceDays ago. Excludes the reviewer themself; preserves roster
 * order (so the deck order and the reminder agree).
 */
export function overdueReviewSubjects(
  roster: RatableUser[],
  myStamps: MyReviewStamp[],
  reviewerUserId: string,
  cadenceDays: number,
  now: Date,
): RatableUser[] {
  const lastBySubject = new Map<string, number>()
  for (const stamp of myStamps) {
    const ms = stampMs(stamp)
    const prev = lastBySubject.get(stamp.subject_user_id)
    if (prev == null || ms > prev) lastBySubject.set(stamp.subject_user_id, ms)
  }
  const cutoff = now.getTime() - cadenceDays * DAY_MS
  return roster.filter((user) => {
    if (user.id === reviewerUserId) return false
    const last = lastBySubject.get(user.id)
    return last == null || last < cutoff
  })
}

export type UpcomingReviewEntry = {
  user: RatableUser
  /** True: never reviewed by this reviewer (due now, no last date). */
  neverReviewed: boolean
  /** Epoch ms of the reviewer's last save for this person; null when never reviewed. */
  lastReviewedMs: number | null
  /** Whole days until their next review comes due; 0 or negative = due now. */
  dueInDays: number
  /** Epoch ms the review comes (or came) due; null when never reviewed. */
  dueAtMs: number | null
}

/**
 * The reviewer's full review schedule (v2.NNNN, the due-pill modal): every
 * roster member with when their next review is due, due-now people first,
 * then soonest first. Same last-save math as overdueReviewSubjects, so
 * `dueInDays <= 0` here agrees exactly with that function's due set.
 */
export function upcomingReviewSchedule(
  roster: RatableUser[],
  myStamps: MyReviewStamp[],
  reviewerUserId: string,
  cadenceDays: number,
  now: Date,
): UpcomingReviewEntry[] {
  const lastBySubject = new Map<string, number>()
  for (const stamp of myStamps) {
    const ms = stampMs(stamp)
    const prev = lastBySubject.get(stamp.subject_user_id)
    if (prev == null || ms > prev) lastBySubject.set(stamp.subject_user_id, ms)
  }
  const nowMs = now.getTime()
  const entries: UpcomingReviewEntry[] = []
  for (const user of roster) {
    if (user.id === reviewerUserId) continue
    const last = lastBySubject.get(user.id) ?? null
    if (last == null) {
      entries.push({ user, neverReviewed: true, lastReviewedMs: null, dueInDays: 0, dueAtMs: null })
      continue
    }
    const dueAtMs = last + cadenceDays * DAY_MS
    entries.push({
      user,
      neverReviewed: false,
      lastReviewedMs: last,
      dueInDays: Math.ceil((dueAtMs - nowMs) / DAY_MS),
      dueAtMs,
    })
  }
  // Due now first (never-reviewed ahead of long-overdue ties by staying stable
  // on roster order), then soonest due date.
  return entries.sort((a, b) => {
    const aDue = a.dueInDays <= 0 ? 0 : 1
    const bDue = b.dueInDays <= 0 ? 0 : 1
    if (aDue !== bDue) return aDue - bDue
    if (aDue === 0) return 0
    return a.dueInDays - b.dueInDays
  })
}

/**
 * Rate-deck "next due" hop (v2.1564): the first roster index AFTER fromIndex
 * (wrapping) whose user is in the due set — skipping fromIndex itself, so
 * saving a due card never lands back on it. Null when nobody else is due.
 */
export function nextDueIndexAfter(
  roster: RatableUser[],
  dueIds: ReadonlySet<string>,
  fromIndex: number,
): number | null {
  if (roster.length === 0 || dueIds.size === 0) return null
  for (let step = 1; step < roster.length; step++) {
    const i = (fromIndex + step + roster.length) % roster.length
    const user = roster[i]
    if (user && dueIds.has(user.id)) return i
  }
  return null
}
