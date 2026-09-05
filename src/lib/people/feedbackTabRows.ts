/**
 * People → Feedback, one row per person (v2.2835). Folds the deck's eligibility state, the
 * crew ratings, the office ratings, and the open-words count into a single row so the tab can
 * be one table instead of three pills and a modal. Pure: no React, no Supabase.
 */
import { computeTeamFeedbackEligibilityDetail, type TeamFeedbackSettingsRow, type TeamFeedbackUserStateRow } from '../teamFeedback'
import { summarizeCrewSubject, type CrewSubjectSummary, type SourcedReviewRow } from './crewReview'

export type DeckState =
  | { kind: 'off' }
  /** Eligible at the next clock-out. `never` when no cycle has ever been dealt or skipped. */
  | { kind: 'due'; never: boolean }
  | { kind: 'done'; at: string; skipped: boolean }
  | { kind: 'snoozed'; until: string }

export type FeedbackUser = { id: string; name: string | null; role: string }

export type WordsSubmission = {
  id: string
  reviewer_user_id: string
  created_at: string
  open_fix_improve: string | null
  open_safety_tools: string | null
  open_training: string | null
  open_anything: string | null
}

export type FeedbackPersonRow = {
  userId: string
  name: string
  role: string
  deck: DeckState
  crew: CrewSubjectSummary
  wordsCount: number
  lastWordsAt: string | null
  /** Clocked approved time on a job inside the window: the people the deck can ever be dealt to. */
  clocksOut: boolean
}

export type RowFilter = 'clocks_out' | 'due' | 'words' | 'everyone'

export function submissionHasWords(s: WordsSubmission): boolean {
  return [s.open_fix_improve, s.open_safety_tools, s.open_training, s.open_anything].some((v) => v != null && v.trim() !== '')
}

/** The Deck chip's state for one person under the current settings. */
export function deckStateFor(settings: TeamFeedbackSettingsRow | null, state: TeamFeedbackUserStateRow | null, nowMs: number): DeckState {
  const d = computeTeamFeedbackEligibilityDetail(settings, state, nowMs)
  if (d.reason === 'disabled') return { kind: 'off' }
  if (d.reason === 'snoozed') return { kind: 'snoozed', until: state?.snooze_until ?? new Date(nowMs).toISOString() }
  if (d.reason === 'cadence') {
    const completed = state?.last_completed_at ? new Date(state.last_completed_at).getTime() : 0
    const skipped = state?.last_skipped_at ? new Date(state.last_skipped_at).getTime() : 0
    const skippedLast = skipped > completed
    return { kind: 'done', at: new Date(Math.max(completed, skipped)).toISOString(), skipped: skippedLast }
  }
  const never = !state?.last_completed_at && !state?.last_skipped_at && !state?.last_prompt_at
  return { kind: 'due', never }
}

/** "3d ago" / "today" / "41d ago". */
export function daysAgoLabel(iso: string, nowMs: number): string {
  const days = Math.floor((nowMs - new Date(iso).getTime()) / 86_400_000)
  if (days <= 0) return 'today'
  return `${days}d ago`
}

/** "Sep 12" in the viewer's locale. */
export function shortDateLabel(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function deckStateLabel(deck: DeckState, nowMs: number): string {
  switch (deck.kind) {
    case 'off':
      return 'Off'
    case 'due':
      return deck.never ? 'Never dealt · due' : 'Due now'
    case 'snoozed':
      return `Snoozed → ${shortDateLabel(deck.until)}`
    case 'done':
      return `${deck.skipped ? 'Skipped' : 'Done'} · ${daysAgoLabel(deck.at, nowMs)}`
  }
}

/** Sort weight: what needs a look comes first. */
const DECK_ORDER: Record<DeckState['kind'], number> = { due: 0, snoozed: 1, done: 2, off: 3 }

export function buildFeedbackRows(input: {
  users: FeedbackUser[]
  states: ReadonlyMap<string, TeamFeedbackUserStateRow>
  settings: TeamFeedbackSettingsRow | null
  reviews: SourcedReviewRow[]
  submissions: WordsSubmission[]
  /** `list_team_member_recent_jobs` rows: any user with a recent last_worked_date clocks out. */
  recentJobs: Array<{ user_id: string; last_worked_date: string }>
  nowMs: number
  clockWindowDays?: number
}): FeedbackPersonRow[] {
  const { users, states, settings, reviews, submissions, recentJobs, nowMs, clockWindowDays = 90 } = input
  const cutoff = nowMs - clockWindowDays * 86_400_000
  const clocks = new Set<string>()
  for (const j of recentJobs) {
    if (new Date(j.last_worked_date).getTime() >= cutoff) clocks.add(j.user_id)
  }
  const words = new Map<string, { count: number; last: string | null }>()
  for (const s of submissions) {
    if (!submissionHasWords(s)) continue
    const cur = words.get(s.reviewer_user_id) ?? { count: 0, last: null }
    cur.count += 1
    if (!cur.last || s.created_at > cur.last) cur.last = s.created_at
    words.set(s.reviewer_user_id, cur)
  }
  const rows: FeedbackPersonRow[] = users.map((u) => {
    const w = words.get(u.id)
    return {
      userId: u.id,
      name: (u.name ?? '').trim() || 'Unnamed',
      role: u.role,
      deck: deckStateFor(settings, states.get(u.id) ?? null, nowMs),
      crew: summarizeCrewSubject(reviews, u.id),
      wordsCount: w?.count ?? 0,
      lastWordsAt: w?.last ?? null,
      clocksOut: clocks.has(u.id),
    }
  })
  return rows.sort((a, b) => DECK_ORDER[a.deck.kind] - DECK_ORDER[b.deck.kind] || a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
}

export function filterFeedbackRows(rows: FeedbackPersonRow[], filter: RowFilter, search: string): FeedbackPersonRow[] {
  const q = search.trim().toLowerCase()
  return rows.filter((r) => {
    if (q && !r.name.toLowerCase().includes(q) && !r.role.toLowerCase().includes(q)) return false
    switch (filter) {
      case 'clocks_out':
        // Anyone the deck could be dealt to, plus anyone who already has a rating or words.
        return r.clocksOut || r.crew.crewRaterCount > 0 || r.wordsCount > 0
      case 'due':
        return r.deck.kind === 'due'
      case 'words':
        return r.wordsCount > 0
      case 'everyone':
        return true
    }
  })
}

export type FeedbackFilterCounts = Record<RowFilter, number>

export function feedbackFilterCounts(rows: FeedbackPersonRow[]): FeedbackFilterCounts {
  return {
    clocks_out: filterFeedbackRows(rows, 'clocks_out', '').length,
    due: filterFeedbackRows(rows, 'due', '').length,
    words: filterFeedbackRows(rows, 'words', '').length,
    everyone: rows.length,
  }
}

export type FeedbackStats = { dueNow: number | null; ratedThisMonth: number; wordsThisMonth: number }

/** The strip's three numbers. `dueNow` is null when the feature is off (nobody is due). */
export function feedbackStats(rows: FeedbackPersonRow[], reviews: SourcedReviewRow[], submissions: WordsSubmission[], reviewMonth: string, enabled: boolean): FeedbackStats {
  const rated = new Set<string>()
  for (const r of reviews) if (r.source === 'crew' && r.review_month === reviewMonth) rated.add(r.subject_user_id)
  const monthPrefix = reviewMonth.slice(0, 7)
  const wordsThisMonth = submissions.filter((s) => submissionHasWords(s) && s.created_at.slice(0, 7) === monthPrefix).length
  return {
    dueNow: enabled ? rows.filter((r) => r.deck.kind === 'due').length : null,
    ratedThisMonth: rated.size,
    wordsThisMonth,
  }
}

/** Device-local read marker for the words feed. */
export const FEEDBACK_WORDS_READ_AT_KEY = 'people.feedbackWordsReadAt.v1'

export function unreadWordsCount(submissions: WordsSubmission[], readAtIso: string | null): number {
  return submissions.filter((s) => submissionHasWords(s) && (!readAtIso || s.created_at > readAtIso)).length
}

export function roleLabel(role: string): string {
  switch (role) {
    case 'master_technician':
      return 'Master Technician'
    case 'dev':
      return 'Dev'
    case 'assistant':
      return 'Assistant'
    case 'helpers':
      return 'Helper'
    case 'subcontractor':
      return 'Subcontractor'
    case 'superintendent':
      return 'Superintendent'
    case 'estimator':
      return 'Estimator'
    case 'controller':
      return 'Controller'
    case 'primary':
      return 'Primary'
    default:
      return role
  }
}
