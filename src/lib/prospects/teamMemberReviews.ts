/**
 * Team → Review kernel (v2.948): pure logic for the monthly team-member
 * review deck (Rate) and the everyone-sees-everyone aggregate (Reflect).
 * One team_member_reviews row per (subject, reviewer, month).
 */
import { AUTH_USER_ROLE_SECTION_ORDER } from '../usersTabRosterRoleSections'

export type TeamMemberReviewRow = {
  id: string
  subject_user_id: string
  reviewer_user_id: string
  /** First-of-month ISO date in company time, e.g. "2026-07-01". */
  review_month: string
  rating_ability: number | null
  rating_drive: number | null
  rating_integrity: number | null
  comment_ability: string | null
  comment_drive: string | null
  comment_integrity: string | null
}

export type RatableUser = { id: string; name: string | null; role: string }

export type RecentJobRow = { user_id: string; job_ledger_id: string; job_display: string; last_worked_date: string }

const ROLE_RANK = new Map<string, number>(AUTH_USER_ROLE_SECTION_ORDER.map((r, i) => [r, i]))

/** Rate-deck order: People → Users role-section order, then name; unknown roles last. */
export function orderUsersForRating(users: RatableUser[]): RatableUser[] {
  return [...users].sort((a, b) => {
    const ra = ROLE_RANK.get(a.role) ?? AUTH_USER_ROLE_SECTION_ORDER.length
    const rb = ROLE_RANK.get(b.role) ?? AUTH_USER_ROLE_SECTION_ORDER.length
    if (ra !== rb) return ra - rb
    return (a.name ?? '').localeCompare(b.name ?? '', undefined, { sensitivity: 'base' })
  })
}

/** First of the current month as YYYY-MM-01 in the given IANA time zone. */
export function currentReviewMonth(timeZone: string, now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit' }).formatToParts(now)
  const year = parts.find((p) => p.type === 'year')?.value ?? '1970'
  const month = parts.find((p) => p.type === 'month')?.value ?? '01'
  return `${year}-${month}-01`
}

/** "July 2026" from "2026-07-01" (no time zone math — the string is already company-local). */
export function formatReviewMonthLabel(reviewMonth: string): string {
  const [y, m] = reviewMonth.split('-')
  const monthIndex = Number(m) - 1
  const names = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  return `${names[monthIndex] ?? reviewMonth} ${y ?? ''}`.trim()
}

/** Each reviewer's newest review of the subject, newest month first (ties broken by reviewer id for stability). */
export function latestReviewsByReviewer(reviews: TeamMemberReviewRow[], subjectUserId: string): TeamMemberReviewRow[] {
  const latest = new Map<string, TeamMemberReviewRow>()
  for (const r of reviews) {
    if (r.subject_user_id !== subjectUserId) continue
    const prev = latest.get(r.reviewer_user_id)
    if (!prev || r.review_month > prev.review_month) latest.set(r.reviewer_user_id, r)
  }
  return [...latest.values()].sort(
    (a, b) => b.review_month.localeCompare(a.review_month) || a.reviewer_user_id.localeCompare(b.reviewer_user_id),
  )
}

/** The signed-in reviewer's newest review of the subject, or null. */
export function myLatestReview(
  reviews: TeamMemberReviewRow[],
  subjectUserId: string,
  reviewerUserId: string,
): TeamMemberReviewRow | null {
  return latestReviewsByReviewer(reviews, subjectUserId).find((r) => r.reviewer_user_id === reviewerUserId) ?? null
}

export type SubjectAverages = {
  ability: number | null
  drive: number | null
  integrity: number | null
  reviewerCount: number
}

/** Cross-reviewer averages over each reviewer's LATEST review; per-dimension null when nobody rated it. */
export function averageLatestRatings(latest: TeamMemberReviewRow[]): SubjectAverages {
  const avg = (values: Array<number | null>): number | null => {
    const rated = values.filter((v): v is number => v != null)
    if (rated.length === 0) return null
    return Math.round(rated.reduce((sum, v) => sum + v, 0) / rated.length)
  }
  return {
    ability: avg(latest.map((r) => r.rating_ability)),
    drive: avg(latest.map((r) => r.rating_drive)),
    integrity: avg(latest.map((r) => r.rating_integrity)),
    reviewerCount: latest.length,
  }
}

/** RPC rows grouped per subject user, preserving the RPC's newest-first order. */
export function recentJobsByUser(rows: RecentJobRow[]): Map<string, RecentJobRow[]> {
  const map = new Map<string, RecentJobRow[]>()
  for (const row of rows) {
    const list = map.get(row.user_id)
    if (list) list.push(row)
    else map.set(row.user_id, [row])
  }
  return map
}

/** Whether the reviewer already saved a review of the subject for the given month. */
export function hasMonthReview(
  reviews: TeamMemberReviewRow[],
  subjectUserId: string,
  reviewerUserId: string,
  reviewMonth: string,
): boolean {
  return reviews.some(
    (r) => r.subject_user_id === subjectUserId && r.reviewer_user_id === reviewerUserId && r.review_month === reviewMonth,
  )
}

/**
 * Index of the next roster member the reviewer hasn't rated this month,
 * searching forward from fromIndex+1 with wrap-around (fromIndex itself is
 * checked last). Null when everyone is rated.
 */
export function nextUnratedIndex(
  roster: RatableUser[],
  reviews: TeamMemberReviewRow[],
  reviewerUserId: string,
  reviewMonth: string,
  fromIndex: number,
): number | null {
  for (let step = 1; step <= roster.length; step++) {
    const i = (fromIndex + step) % roster.length
    const user = roster[i]
    if (user && !hasMonthReview(reviews, user.id, reviewerUserId, reviewMonth)) return i
  }
  return null
}

/** All of a subject's reviews, newest month first then reviewer id — the Reflect history list. */
export function subjectReviewHistory(reviews: TeamMemberReviewRow[], subjectUserId: string): TeamMemberReviewRow[] {
  return reviews
    .filter((r) => r.subject_user_id === subjectUserId)
    .sort((a, b) => b.review_month.localeCompare(a.review_month) || a.reviewer_user_id.localeCompare(b.reviewer_user_id))
}
