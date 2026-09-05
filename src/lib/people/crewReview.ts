/**
 * Crew reviews on the three bars (v2.2824): pure logic for the clock-out deck and the
 * dev Feedback tab. A crew member rates the teammates they shared jobs with (and their
 * lead) on Ability / Drive / Integrity, the same 0-100 dimensions the office uses in
 * Prospects → Team → Review. Rows land in team_member_reviews with source = 'crew'.
 *
 * No React, no Supabase here. `teamFeedback.ts` does the I/O.
 */
import { RATING_DEFS, type RatingKey } from '../../components/prospects/ratingDimensions'
import { averageLatestRatings, latestReviewsByReviewer, type TeamMemberReviewRow } from '../prospects/teamMemberReviews'

export type CrewReviewSource = 'office' | 'crew'

/** A team_member_reviews row once the `source` column exists. */
export type SourcedReviewRow = TeamMemberReviewRow & { source: CrewReviewSource }

/** One row from the `crew_review_teammates` RPC. */
export type CrewTeammate = {
  user_id: string
  name: string | null
  role: string
  days_together: number
  /** Up to three job labels, most recent first. */
  jobs: string[]
}

export type CrewDeckCard = {
  kind: 'teammate' | 'lead'
  user_id: string
  name: string
  role: string
  days_together: number
  jobs: string[]
}

export type CrewReviewDraft = {
  rating_ability: number | null
  rating_drive: number | null
  rating_integrity: number | null
  comment_ability: string
  comment_drive: string
  comment_integrity: string
}

export function emptyCrewDraft(): CrewReviewDraft {
  return {
    rating_ability: null,
    rating_drive: null,
    rating_integrity: null,
    comment_ability: '',
    comment_drive: '',
    comment_integrity: '',
  }
}

/** A card is worth saving when at least one bar was moved or one note typed. */
export function crewDraftHasContent(d: CrewReviewDraft): boolean {
  return (
    d.rating_ability != null ||
    d.rating_drive != null ||
    d.rating_integrity != null ||
    d.comment_ability.trim() !== '' ||
    d.comment_drive.trim() !== '' ||
    d.comment_integrity.trim() !== ''
  )
}

/**
 * The deck: teammates first (most days together first, as the RPC orders them), then the
 * lead when they are someone else and not already dealt. Anyone the rater already rated
 * this month (a crew row exists) is left out, so a 14-day cycle never asks twice about the
 * same person in one month. The rater is never dealt.
 */
export function buildCrewDeck(params: {
  meUserId: string
  teammates: CrewTeammate[]
  leadUserId: string | null
  ratedThisMonth: ReadonlySet<string>
}): CrewDeckCard[] {
  const { meUserId, teammates, leadUserId, ratedThisMonth } = params
  const cards: CrewDeckCard[] = []
  const seen = new Set<string>()
  const lead = leadUserId && leadUserId !== meUserId ? leadUserId : null
  for (const t of teammates) {
    if (t.user_id === meUserId || seen.has(t.user_id) || ratedThisMonth.has(t.user_id)) continue
    // Someone with no shared days is only here because they are the lead.
    if (t.days_together <= 0 && t.user_id !== lead) continue
    seen.add(t.user_id)
    cards.push({
      kind: t.user_id === lead ? 'lead' : 'teammate',
      user_id: t.user_id,
      name: (t.name ?? '').trim() || 'Teammate',
      role: t.role,
      days_together: t.days_together,
      jobs: t.jobs ?? [],
    })
  }
  // The lead card goes last, after the people you actually swung a wrench beside.
  cards.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'lead' ? 1 : -1))
  return cards
}

/** "3 days together · J1042 — Balcones, J1039 — Lamar" (jobs capped at two on the card). */
export function crewCardContextLine(card: CrewDeckCard): string {
  const parts: string[] = []
  if (card.kind === 'lead') parts.push('Your lead')
  if (card.days_together > 0) parts.push(`${card.days_together} day${card.days_together === 1 ? '' : 's'} together this cycle`)
  else if (card.kind === 'lead') parts.push('no shared jobs this cycle')
  const jobs = card.jobs.filter((j) => j.trim() !== '').slice(0, 2)
  if (jobs.length > 0) parts.push(jobs.join(', '))
  return parts.join(' · ')
}

/** The Insert row for a saved card. `review_month` is the first of the month in company time. */
export function crewDraftToRow(params: {
  draft: CrewReviewDraft
  subjectUserId: string
  reviewerUserId: string
  reviewMonth: string
}): {
  subject_user_id: string
  reviewer_user_id: string
  review_month: string
  source: 'crew'
  rating_ability: number | null
  rating_drive: number | null
  rating_integrity: number | null
  comment_ability: string | null
  comment_drive: string | null
  comment_integrity: string | null
} {
  const { draft, subjectUserId, reviewerUserId, reviewMonth } = params
  return {
    subject_user_id: subjectUserId,
    reviewer_user_id: reviewerUserId,
    review_month: reviewMonth,
    source: 'crew',
    rating_ability: draft.rating_ability,
    rating_drive: draft.rating_drive,
    rating_integrity: draft.rating_integrity,
    comment_ability: draft.comment_ability.trim() || null,
    comment_drive: draft.comment_drive.trim() || null,
    comment_integrity: draft.comment_integrity.trim() || null,
  }
}

// ---- Open words -----------------------------------------------------------------------------

/** The four headings on the last card; the first three are the prompts the old wizard asked. */
export const DEFAULT_OPEN_PROMPTS: readonly [string, string, string, string] = [
  'Something we should fix or improve',
  'Safety or tools',
  'Training you want',
  'Anything at all',
]

/** Four non-empty strings from `team_feedback_settings.open_prompts`, else the defaults. */
export function parseOpenPrompts(value: unknown): [string, string, string, string] {
  if (!Array.isArray(value) || value.length !== 4) return [...DEFAULT_OPEN_PROMPTS]
  const out: string[] = []
  for (const v of value) {
    if (typeof v !== 'string' || !v.trim()) return [...DEFAULT_OPEN_PROMPTS]
    out.push(v.trim())
  }
  return out as [string, string, string, string]
}

export type OpenWords = { fixImprove: string; safetyTools: string; training: string; anything: string }

export function emptyOpenWords(): OpenWords {
  return { fixImprove: '', safetyTools: '', training: '', anything: '' }
}

export function openWordsHaveContent(w: OpenWords): boolean {
  return [w.fixImprove, w.safetyTools, w.training, w.anything].some((s) => s.trim() !== '')
}

// ---- The dev Feedback tab --------------------------------------------------------------------

export type DimensionLane = {
  key: RatingKey
  short: string
  color: string
  crew: number | null
  office: number | null
  /** |crew − office| ≥ CREW_OFFICE_GAP when both are rated. */
  gap: boolean
}

export type CrewSubjectSummary = {
  subjectUserId: string
  crewRaterCount: number
  officeReviewerCount: number
  lanes: DimensionLane[]
  /** Dimensions where crew and office disagree by CREW_OFFICE_GAP or more. */
  gapDimensions: string[]
  /** Crew notes, newest month first: dimension short name, month, text. Dev-only content. */
  crewNotes: Array<{ short: string; month: string; text: string; reviewerUserId: string }>
}

/** Points of disagreement between the crew lane and the office lane worth a chip. */
export const CREW_OFFICE_GAP = 15

const COMMENT_KEY: Record<RatingKey, 'comment_ability' | 'comment_drive' | 'comment_integrity'> = {
  rating_ability: 'comment_ability',
  rating_drive: 'comment_drive',
  rating_integrity: 'comment_integrity',
}

const AVERAGE_KEY: Record<RatingKey, 'ability' | 'drive' | 'integrity'> = {
  rating_ability: 'ability',
  rating_drive: 'drive',
  rating_integrity: 'integrity',
}

/**
 * One subject's card on the dev Feedback tab: each rater's latest crew review averaged
 * against each office reviewer's latest review, per dimension, plus the crew notes.
 */
export function summarizeCrewSubject(rows: SourcedReviewRow[], subjectUserId: string): CrewSubjectSummary {
  const crewRows = rows.filter((r) => r.source === 'crew')
  const officeRows = rows.filter((r) => r.source === 'office')
  const crewLatest = latestReviewsByReviewer(crewRows, subjectUserId)
  const officeLatest = latestReviewsByReviewer(officeRows, subjectUserId)
  const crewAvg = averageLatestRatings(crewLatest)
  const officeAvg = averageLatestRatings(officeLatest)
  const lanes: DimensionLane[] = RATING_DEFS.map((def) => {
    const crew = crewAvg[AVERAGE_KEY[def.key]]
    const office = officeAvg[AVERAGE_KEY[def.key]]
    const gap = crew != null && office != null && Math.abs(crew - office) >= CREW_OFFICE_GAP
    return { key: def.key, short: def.short, color: def.color, crew, office, gap }
  })
  const crewNotes = crewRows
    .filter((r) => r.subject_user_id === subjectUserId)
    .sort((a, b) => b.review_month.localeCompare(a.review_month))
    .flatMap((r) =>
      RATING_DEFS.flatMap((def) => {
        const text = r[COMMENT_KEY[def.key]]
        return text && text.trim() ? [{ short: def.short, month: r.review_month, text: text.trim(), reviewerUserId: r.reviewer_user_id }] : []
      }),
    )
  return {
    subjectUserId,
    crewRaterCount: crewLatest.length,
    officeReviewerCount: officeLatest.length,
    lanes,
    gapDimensions: lanes.filter((l) => l.gap).map((l) => l.short),
    crewNotes,
  }
}

/** Subjects with at least one crew rating, most crew raters first, then name. */
export function crewSubjectsInOrder(
  rows: SourcedReviewRow[],
  nameOf: (userId: string) => string,
): string[] {
  const counts = new Map<string, Set<string>>()
  for (const r of rows) {
    if (r.source !== 'crew') continue
    const set = counts.get(r.subject_user_id) ?? new Set<string>()
    set.add(r.reviewer_user_id)
    counts.set(r.subject_user_id, set)
  }
  return [...counts.entries()]
    .sort((a, b) => b[1].size - a[1].size || nameOf(a[0]).localeCompare(nameOf(b[0]), undefined, { sensitivity: 'base' }))
    .map(([id]) => id)
}

// ---- Retired questions -----------------------------------------------------------------------

export type RetiredQuestionGroup = { heading: string; items: string[] }

/**
 * The scripted questions as they were last saved, for the read-only panel. Columns stay on
 * `team_feedback_settings`; nothing here is asked any more.
 */
export function retiredQuestionGroups(settings: {
  manager_step_heading: string | null
  manager_likert_prompts: unknown
  manager_overall_prompt: string | null
  peer_step_heading: string | null
  peer_likert_prompts: unknown
}, defaults: {
  managerHeading: string
  managerPrompts: readonly string[]
  managerOverall: string
  peerHeading: string
  peerPrompts: readonly string[]
}): RetiredQuestionGroup[] {
  const strings = (v: unknown, fallback: readonly string[]): string[] =>
    Array.isArray(v) && v.length === 5 && v.every((s) => typeof s === 'string' && s.trim()) ? (v as string[]).map((s) => s.trim()) : [...fallback]
  return [
    {
      heading: settings.manager_step_heading?.trim() || defaults.managerHeading,
      items: [...strings(settings.manager_likert_prompts, defaults.managerPrompts), settings.manager_overall_prompt?.trim() || defaults.managerOverall],
    },
    {
      heading: settings.peer_step_heading?.trim() || defaults.peerHeading,
      items: strings(settings.peer_likert_prompts, defaults.peerPrompts),
    },
    {
      heading: 'Open questions (kept on the new deck)',
      items: [...DEFAULT_OPEN_PROMPTS.slice(0, 3)],
    },
  ]
}

// ---- The crew lane in Prospects → Team → Review → Reflect (v2.2827) -------------------------

/** One row from `crew_review_aggregates`: a subject's month, averaged over its crew raters. */
export type CrewLaneMonth = {
  subject_user_id: string
  review_month: string
  rating_ability: number | null
  rating_drive: number | null
  rating_integrity: number | null
  rater_count: number
}

/** The newest month the office may see for a subject (the RPC already applies the 2-rater rule). */
export function latestCrewLane(aggregates: CrewLaneMonth[], subjectUserId: string): CrewLaneMonth | null {
  let best: CrewLaneMonth | null = null
  for (const a of aggregates) {
    if (a.subject_user_id !== subjectUserId) continue
    if (!best || a.review_month > best.review_month) best = a
  }
  return best
}

/** The reviewer id the crew lane wears when it joins the composite as one pseudo-reviewer. */
export const CREW_PSEUDO_REVIEWER_ID = 'crew'

/**
 * The crew lane as review rows so the composite and leaderboard can count it as ONE more
 * reviewer per month (averages rounded to whole points, no notes, never calibrated — the
 * pseudo-reviewer has no baseline, so it enters raw). Only used when the dev toggle is on.
 */
export function crewPseudoReviews(aggregates: CrewLaneMonth[]): TeamMemberReviewRow[] {
  const round = (v: number | null) => (v == null ? null : Math.round(v))
  return aggregates.map((a) => ({
    id: `${CREW_PSEUDO_REVIEWER_ID}-${a.subject_user_id}-${a.review_month}`,
    subject_user_id: a.subject_user_id,
    reviewer_user_id: CREW_PSEUDO_REVIEWER_ID,
    review_month: a.review_month,
    rating_ability: round(a.rating_ability),
    rating_drive: round(a.rating_drive),
    rating_integrity: round(a.rating_integrity),
    comment_ability: null,
    comment_drive: null,
    comment_integrity: null,
    source: 'crew',
  }))
}
