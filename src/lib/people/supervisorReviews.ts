/**
 * Supervision, PR 4 (to-dos/supervision): Rate my crew, pure.
 *
 * The monthly deck a supervisor works through: everyone they supervised on two or more
 * job-days that month (`get_supervisor_review_deck`), the three sliders each, written as
 * `team_member_reviews` rows with `source = 'supervisor'` — by name, one per subject,
 * reviewer and month, beside the office's rows on the Review stage. Nothing here is
 * anonymous and nothing is assigned: the deck is read off the schedule and the clock.
 */
import type { RatingKey, RatingValues } from '../../components/prospects/ratingDimensions'

export type SupervisorDeckPerson = { user_id: string; name: string | null; role: string | null; days: number; jobs: string[]; reviewed: boolean }

export type SupervisorDeckPayload = { supervisor: boolean; month: string; people: SupervisorDeckPerson[] }

export type SupervisorDeckCard = { userId: string; name: string; role: string | null; days: number; jobs: string[]; reviewed: boolean }

export type SupervisorReviewDraft = RatingValues & { comment_ability: string; comment_drive: string; comment_integrity: string }

export const EMPTY_SUPERVISOR_DRAFT: SupervisorReviewDraft = { rating_ability: null, rating_drive: null, rating_integrity: null, comment_ability: '', comment_drive: '', comment_integrity: '' }

export const SUPERVISOR_MIN_DAYS = 2

/** Cards in deck order: unrated first (most days together first), then the rated ones. */
export function buildSupervisorDeck(payload: SupervisorDeckPayload | null): SupervisorDeckCard[] {
  if (!payload || !payload.supervisor) return []
  const cards = (payload.people ?? [])
    .filter((p) => p.days >= SUPERVISOR_MIN_DAYS)
    .map((p) => ({ userId: p.user_id, name: (p.name ?? '').trim() || 'Unknown', role: p.role, days: p.days, jobs: p.jobs ?? [], reviewed: p.reviewed }))
  return cards.sort((a, b) => Number(a.reviewed) - Number(b.reviewed) || b.days - a.days || a.name.localeCompare(b.name))
}

/** "3 to rate" · "all 4 rated" · null when nobody qualifies. */
export function supervisorDeckSummary(cards: readonly SupervisorDeckCard[]): string | null {
  if (cards.length === 0) return null
  const left = cards.filter((c) => !c.reviewed).length
  return left === 0 ? `all ${cards.length} rated` : `${left} to rate`
}

/** "4 days together · J258 · Oak St, J291 · Elm Ct" */
export function supervisorCardContextLine(card: Pick<SupervisorDeckCard, 'days' | 'jobs'>): string {
  const days = `${card.days} day${card.days === 1 ? '' : 's'} together`
  return card.jobs.length ? `${days} · ${card.jobs.join(', ')}` : days
}

export function supervisorDraftHasContent(d: SupervisorReviewDraft): boolean {
  return d.rating_ability != null || d.rating_drive != null || d.rating_integrity != null || d.comment_ability.trim() !== '' || d.comment_drive.trim() !== '' || d.comment_integrity.trim() !== ''
}

export type SupervisorReviewRow = {
  subject_user_id: string
  reviewer_user_id: string
  review_month: string
  source: 'supervisor'
  rating_ability: number | null
  rating_drive: number | null
  rating_integrity: number | null
  comment_ability: string | null
  comment_drive: string | null
  comment_integrity: string | null
}

/** The upsert row for one card; conflicts on (subject, reviewer, month, source). */
export function supervisorReviewRow(draft: SupervisorReviewDraft, subjectUserId: string, reviewerUserId: string, reviewMonth: string): SupervisorReviewRow {
  return {
    subject_user_id: subjectUserId,
    reviewer_user_id: reviewerUserId,
    review_month: reviewMonth,
    source: 'supervisor',
    rating_ability: draft.rating_ability,
    rating_drive: draft.rating_drive,
    rating_integrity: draft.rating_integrity,
    comment_ability: draft.comment_ability.trim() || null,
    comment_drive: draft.comment_drive.trim() || null,
    comment_integrity: draft.comment_integrity.trim() || null,
  }
}

/** The next card after `from` that is not yet rated (wrapping, never `from` itself), or null when none is left. */
export function nextUnratedCard(cards: readonly SupervisorDeckCard[], ratedIds: ReadonlySet<string>, from: number): number | null {
  for (let step = 1; step < cards.length; step++) {
    const i = (from + step) % cards.length
    const c = cards[i]
    if (c && !c.reviewed && !ratedIds.has(c.userId)) return i
  }
  return null
}

export const SUPERVISOR_COMMENT_KEY: Record<RatingKey, 'comment_ability' | 'comment_drive' | 'comment_integrity'> = {
  rating_ability: 'comment_ability',
  rating_drive: 'comment_drive',
  rating_integrity: 'comment_integrity',
}
