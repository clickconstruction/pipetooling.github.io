/**
 * The review ask as the office reads it (v2.5946, punch list #185 PR 4; the plan `to-dos/customer-reviews/README.md`).
 * A customer's answer on `/rate` lands in their thread as the app's line (v2.5934); this is what the office's own
 * screens say about it: the job's review line on the job window, the Needs you line for a low answer nobody has called
 * yet, and the month's count on Settings → What customers see → Reviews. Pure: rows in, words out. The reads and the
 * call's write are `ratingsOfficeIo.ts`.
 */
import { todayYmdInAppTz, APP_CALENDAR_TZ } from '../../utils/dateUtils'
import { CALL_AT_OR_BELOW } from './rating'

/** A `customer_ratings` row as the office reads it. */
export interface OfficeRating {
  id: string
  contactId: string | null
  jobId: string | null
  customerName: string
  askedAt: string
  openedAt: string | null
  answeredAt: string | null
  score: number | null
  words: string
  googlePressedAt: string | null
  calledAt: string | null
  callNote: string
}

/** A low answer is waited on this many days; after that the line leaves Needs you and stays on the job. */
export const LOW_RATING_WINDOW_DAYS = 30

const DAY_MS = 24 * 3600 * 1000

/** An instant as the app's calendar names its day: "Oct 28". */
export function ratingDay(iso: string | null | undefined): string {
  if (!iso) return ''
  const ms = Date.parse(iso)
  if (Number.isNaN(ms)) return ''
  return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: APP_CALENDAR_TZ })
}

export const starsWord = (n: number): string => `${n} ${n === 1 ? 'star' : 'stars'}`
/** "★★☆☆☆" for a score, for a line that has room for the shape. */
export const starsGlyphs = (n: number): string => '★'.repeat(Math.max(0, Math.min(5, n))) + '☆'.repeat(Math.max(0, 5 - Math.min(5, n)))

const firstName = (name: string): string => name.trim().split(/\s+/)[0] || 'The customer'

/** The newest ask among the rows: the one a line speaks of. */
export function newestRating(rows: readonly OfficeRating[]): OfficeRating | null {
  return [...rows].sort((a, b) => b.askedAt.localeCompare(a.askedAt))[0] ?? null
}

/** Whether an answer still waits on the office's call: three stars or fewer, not called yet. */
export const needsCall = (r: Pick<OfficeRating, 'answeredAt' | 'score' | 'calledAt'>): boolean => r.answeredAt != null && (r.score ?? 5) <= CALL_AT_OR_BELOW && r.calledAt == null

// ---------- the job's line ----------

export interface JobReviewLine {
  state: 'asked' | 'opened' | 'answered'
  /** The line's lead: "5 stars", "Asked Oct 28, not opened yet". */
  head: string
  score: number | null
  /** Their words, when they wrote any. */
  words: string | null
  /** The facts after the lead, each short: "Oct 28", "pressed Post it on Google", "called Oct 29". */
  facts: string[]
  /** An answer at three stars or fewer that nobody called: the line offers I called. */
  callOwed: boolean
  callNote: string | null
}

/** The job window's line for the job's newest ask, or null when the job was never asked. */
export function jobReviewLine(rows: readonly OfficeRating[]): JobReviewLine | null {
  const r = newestRating(rows)
  if (!r) return null
  const words = r.words.trim() || null
  if (!r.answeredAt || r.score == null) {
    const opened = r.openedAt != null
    return {
      state: opened ? 'opened' : 'asked',
      head: opened ? `Asked ${ratingDay(r.askedAt)}, opened ${ratingDay(r.openedAt)}, not answered` : `Asked ${ratingDay(r.askedAt)}, not opened yet`,
      score: null,
      words: null,
      facts: [],
      callOwed: false,
      callNote: null,
    }
  }
  const facts = [ratingDay(r.answeredAt)]
  if (r.googlePressedAt) facts.push('pressed Post it on Google')
  if (r.calledAt) facts.push(`called ${ratingDay(r.calledAt)}`)
  return { state: 'answered', head: starsWord(r.score), score: r.score, words, facts, callOwed: needsCall(r), callNote: r.callNote.trim() || null }
}

// ---------- Needs you ----------

export interface LowRatingsNeed {
  count: number
  /** The one to call first: the lowest score, then the oldest answer. */
  first: { ratingId: string; contactId: string | null; jobId: string | null; name: string; score: number; words: string | null } | null
}

/** The answers at three stars or fewer that nobody has called, inside the window. Null when there are none. */
export function lowRatingsNeed(rows: readonly OfficeRating[], now: Date = new Date()): LowRatingsNeed | null {
  const since = now.getTime() - LOW_RATING_WINDOW_DAYS * DAY_MS
  const owed = rows.filter((r) => needsCall(r) && Date.parse(r.answeredAt ?? '') >= since)
  if (!owed.length) return null
  const sorted = [...owed].sort((a, b) => (a.score ?? 5) - (b.score ?? 5) || (a.answeredAt ?? '').localeCompare(b.answeredAt ?? ''))
  const f = sorted[0]!
  return { count: owed.length, first: { ratingId: f.id, contactId: f.contactId, jobId: f.jobId, name: firstName(f.customerName), score: f.score ?? 0, words: f.words.trim() || null } }
}

/** The Needs you line's words: who, how many stars, and what to do. */
export function lowRatingsWords(need: LowRatingsNeed, jobWord: string | null = null): { title: string; detail: string } {
  const f = need.first
  if (need.count === 1 && f) {
    const on = jobWord ? ` on ${jobWord}` : ''
    return { title: `${f.name} left ${starsWord(f.score)}${on}`, detail: f.words ? `“${f.words.length > 90 ? `${f.words.slice(0, 89).trimEnd()}…` : f.words}” Call them today.` : 'Nobody has called yet. Call them today.' }
  }
  return { title: `${need.count} customers left three stars or fewer`, detail: f ? `${f.name} first, at ${starsWord(f.score)}. Nobody has called yet.` : 'Nobody has called yet.' }
}

// ---------- the month on Settings → What customers see → Reviews ----------

export interface ReviewsMonth {
  asked: number
  answered: number
  /** The average of this month's answers, to one place: 4.6. Null with none. */
  average: number | null
  googlePressed: number
  /** Answers at three stars or fewer, and how many of those were called. */
  low: number
  called: number
}

/** The first day of this month in the app's calendar: "2026-10-01". */
export function monthStartYmd(now: Date = new Date()): string {
  return `${todayYmdInAppTz(now).slice(0, 7)}-01`
}

/** This month's asks and answers, by the day each was asked or answered in the app's calendar. */
export function reviewsMonth(rows: readonly OfficeRating[], now: Date = new Date()): ReviewsMonth {
  const start = monthStartYmd(now)
  const inMonth = (iso: string | null) => (iso ? todayYmdInAppTz(new Date(iso)) >= start : false)
  const answered = rows.filter((r) => r.score != null && inMonth(r.answeredAt))
  const scores = answered.map((r) => r.score ?? 0)
  const low = answered.filter((r) => (r.score ?? 5) <= CALL_AT_OR_BELOW)
  return {
    asked: rows.filter((r) => inMonth(r.askedAt)).length,
    answered: answered.length,
    average: scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : null,
    googlePressed: answered.filter((r) => r.googlePressedAt != null).length,
    low: low.length,
    called: low.filter((r) => r.calledAt != null).length,
  }
}

/** The newest answers, for the block's list. */
export function recentAnswers(rows: readonly OfficeRating[], n = 5): OfficeRating[] {
  return rows.filter((r) => r.answeredAt && r.score != null).sort((a, b) => (b.answeredAt ?? '').localeCompare(a.answeredAt ?? '')).slice(0, n)
}

/** A link a dev set: an https address, else the field says why it will not save. */
export function googleLinkProblem(value: string): string | null {
  const v = value.trim()
  if (!v) return null
  if (!/^https:\/\/\S+$/i.test(v)) return 'The link starts with https:// and has no spaces. Copy it from Google Business Profile.'
  return null
}

export const REVIEWS_BLOCK_WORDS = {
  title: 'Reviews',
  hint: 'What a customer’s review page asks after a job, and what came back this month.',
  linkLabel: 'The company’s Google review link',
  linkHelp: 'In Google Business Profile, open Read reviews, then Get more reviews, and copy the link. While this is empty, the review page never mentions Google.',
  save: 'Save the link',
  saved: 'Saved. The review page uses it now.',
  readOnly: 'Only the owner or a dev changes the link.',
  none: 'No answers yet this month.',
  monthCap: 'This month',
}
