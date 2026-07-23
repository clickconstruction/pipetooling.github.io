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
