import { supabase } from './supabase'
import type { Database } from '../types/database'
import { withSupabaseRetry } from '../utils/errorHandling'
import { isAssistantLike } from './subcontractorLikeRole'
import type { CrewTeammate } from './people/crewReview'

/** Where the deck was opened from. ('comment_only' is a retired value still allowed by the DB check.) */
export type TeamFeedbackSource = 'clock_out_prompt' | 'home_button'

export type TeamFeedbackSettingsRow = Database['public']['Tables']['team_feedback_settings']['Row']
export type TeamFeedbackUserStateRow = Database['public']['Tables']['team_feedback_user_state']['Row']
export type TeamFeedbackOverviewUserRow = Pick<
  Database['public']['Tables']['users']['Row'],
  'id' | 'name' | 'email' | 'role'
>

const CYCLE_ANCHOR_MS = new Date('2024-01-01T12:00:00.000Z').getTime()

/** Bucket start date for reporting (aligned to cadence_days from anchor). */
export function computeCyclePeriodStart(cadenceDays: number, date = new Date()): string {
  const dayIndex = Math.floor((date.getTime() - CYCLE_ANCHOR_MS) / 86_400_000)
  const period = Math.floor(dayIndex / cadenceDays)
  const start = new Date(CYCLE_ANCHOR_MS + period * cadenceDays * 86_400_000)
  return start.toISOString().slice(0, 10)
}

export async function fetchTeamFeedbackSettings(): Promise<TeamFeedbackSettingsRow | null> {
  return withSupabaseRetry(
    async () => supabase.from('team_feedback_settings').select('*').eq('id', 1).maybeSingle(),
    'fetch team_feedback_settings'
  )
}

/** Latest submission timestamp (org-wide), for dev Settings display. */
export async function fetchLastTeamFeedbackSubmissionCreatedAt(): Promise<string | null> {
  const rows = await withSupabaseRetry(
    async () =>
      supabase.from('team_feedback_submissions').select('created_at').order('created_at', { ascending: false }).limit(1),
    'fetch last team_feedback_submissions created_at'
  )
  const first = rows?.[0]
  return first?.created_at ?? null
}

export async function fetchTeamFeedbackUserState(userId: string): Promise<TeamFeedbackUserStateRow | null> {
  return withSupabaseRetry(
    async () => supabase.from('team_feedback_user_state').select('*').eq('user_id', userId).maybeSingle(),
    'fetch team_feedback_user_state'
  )
}

export interface EligibilityResult {
  eligible: boolean
  reason: 'ok' | 'disabled' | 'snoozed' | 'cadence' | 'error'
}

/** Pure eligibility (matches clock-out prompt rules). */
export type TeamFeedbackEligibilityDetailReason = 'ok' | 'disabled' | 'snoozed' | 'cadence'

export interface TeamFeedbackEligibilityDetail {
  eligible: boolean
  reason: TeamFeedbackEligibilityDetailReason
  /** When not eligible (except disabled), earliest instant the prompt could apply on clock-out. */
  earliestEligibleAt: Date | null
}

/**
 * Same rules as clock-out: disabled → snooze → cadence → ok.
 * Use for dev overview and keep `getTeamFeedbackEligibility` aligned.
 */
export function computeTeamFeedbackEligibilityDetail(
  settings: TeamFeedbackSettingsRow | null,
  state: TeamFeedbackUserStateRow | null,
  nowMs: number
): TeamFeedbackEligibilityDetail {
  if (!settings?.enabled) {
    return { eligible: false, reason: 'disabled', earliestEligibleAt: null }
  }

  const cadenceMs = settings.cadence_days * 86_400_000
  const completed = state?.last_completed_at ? new Date(state.last_completed_at).getTime() : 0
  const skipped = state?.last_skipped_at ? new Date(state.last_skipped_at).getTime() : 0
  const lastBarrier = Math.max(completed, skipped)
  const cadenceClearAt = lastBarrier > 0 ? lastBarrier + cadenceMs : 0
  const cadenceBlocks = lastBarrier > 0 && nowMs - lastBarrier < cadenceMs

  const snoozeUntilMs = state?.snooze_until ? new Date(state.snooze_until).getTime() : 0
  const snoozeActive = snoozeUntilMs > nowMs

  const combinedEarliestMs = Math.max(
    snoozeActive ? snoozeUntilMs : 0,
    cadenceBlocks ? cadenceClearAt : 0
  )

  if (snoozeActive) {
    return {
      eligible: false,
      reason: 'snoozed',
      earliestEligibleAt: combinedEarliestMs > 0 ? new Date(combinedEarliestMs) : null,
    }
  }

  if (cadenceBlocks) {
    return {
      eligible: false,
      reason: 'cadence',
      earliestEligibleAt: cadenceClearAt > 0 ? new Date(cadenceClearAt) : null,
    }
  }

  return { eligible: true, reason: 'ok', earliestEligibleAt: null }
}

export async function getTeamFeedbackEligibility(userId: string): Promise<EligibilityResult> {
  try {
    const settings = await fetchTeamFeedbackSettings()
    const state = await fetchTeamFeedbackUserState(userId)
    const d = computeTeamFeedbackEligibilityDetail(settings, state, Date.now())
    return { eligible: d.eligible, reason: d.reason }
  } catch {
    return { eligible: false, reason: 'error' }
  }
}

export async function fetchAllActiveUsersForTeamFeedbackOverview(): Promise<TeamFeedbackOverviewUserRow[]> {
  const data = await withSupabaseRetry(
    async () =>
      supabase.from('users').select('id, name, email, role').is('archived_at', null).order('name'),
    'fetch users for team feedback overview'
  )
  return (data ?? []) as TeamFeedbackOverviewUserRow[]
}

export async function fetchAllTeamFeedbackUserStates(): Promise<Map<string, TeamFeedbackUserStateRow>> {
  const data = await withSupabaseRetry(
    async () => supabase.from('team_feedback_user_state').select('*'),
    'fetch all team_feedback_user_state'
  )
  const map = new Map<string, TeamFeedbackUserStateRow>()
  const rows = (data ?? []) as TeamFeedbackUserStateRow[]
  for (const r of rows) {
    map.set(r.user_id, r)
  }
  return map
}

/** Dev-only path: clear snooze/cadence barriers for another user (UPDATE only; RLS allows dev). */
export async function resetTeamFeedbackUserStateEligibilityForDev(
  userId: string
): Promise<'updated' | 'no_row'> {
  const data = await withSupabaseRetry(
    async () =>
      supabase
        .from('team_feedback_user_state')
        .update({
          snooze_until: null,
          last_completed_at: null,
          last_skipped_at: null,
          last_prompt_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .select('user_id'),
    'reset team_feedback_user_state eligibility'
  )
  const rows = (data ?? []) as { user_id: string }[]
  return rows.length > 0 ? 'updated' : 'no_row'
}

export async function upsertTeamFeedbackUserState(
  userId: string,
  patch: Partial<
    Pick<TeamFeedbackUserStateRow, 'last_prompt_at' | 'last_completed_at' | 'last_skipped_at' | 'snooze_until'>
  >
): Promise<void> {
  await withSupabaseRetry(
    async () =>
      supabase.from('team_feedback_user_state').upsert(
        {
          user_id: userId,
          updated_at: new Date().toISOString(),
          ...patch,
        },
        { onConflict: 'user_id' }
      ),
    'upsert team_feedback_user_state'
  )
}

/** Master / lead user id being rated (pay roster scope). */
export async function resolveManagerUserIdForFeedback(userId: string): Promise<string | null> {
  const me = await withSupabaseRetry(
    async () => supabase.from('users').select('role, email').eq('id', userId).single(),
    'resolveManager user role'
  )
  if (!me) return null
  const role = (me as { role: string }).role
  if (role === 'master_technician' || role === 'dev') return userId
  if (isAssistantLike(role)) {
    const adoptions = await withSupabaseRetry(
      async () => supabase.from('master_assistants').select('master_id').eq('assistant_id', userId).limit(1),
      'resolveManager master_assistants'
    )
    const row = (adoptions as { master_id: string }[] | null)?.[0]
    return row?.master_id ?? null
  }
  if (role === 'superintendent') {
    const ms = await withSupabaseRetry(
      async () =>
        supabase.from('master_superintendents').select('master_id').eq('superintendent_id', userId).limit(1),
      'resolveManager master_superintendents'
    )
    const row = (ms as { master_id: string }[] | null)?.[0]
    return row?.master_id ?? null
  }
  const email = (me as { email: string | null }).email?.trim().toLowerCase()
  if (!email) return null
  const people = await withSupabaseRetry(
    async () =>
      supabase.from('people').select('master_user_id').is('archived_at', null).ilike('email', email).limit(1),
    'resolveManager people email'
  )
  const p = (people as { master_user_id: string }[] | null)?.[0]
  return p?.master_user_id ?? null
}

// ---- The clock-out deck (v2.2824): crew ratings on the three bars ----------------------------

export type CrewReviewInsertRow = Database['public']['Tables']['team_member_reviews']['Insert'] & { source: 'crew' }

/** Who the signed-in user shared approved clock sessions with, plus the extra ids (their lead). */
export async function fetchCrewTeammates(lookbackDays: number, extraUserIds: string[]): Promise<CrewTeammate[]> {
  const data = await withSupabaseRetry(
    () => supabase.rpc('crew_review_teammates', { p_lookback_days: lookbackDays, p_extra_user_ids: extraUserIds }),
    'crew_review_teammates',
  )
  return ((data ?? []) as CrewTeammate[]).map((r) => ({ ...r, jobs: Array.isArray(r.jobs) ? r.jobs : [] }))
}

/** Subjects the user already gave a crew rating this month (their own rows are readable under RLS). */
export async function fetchMyCrewRatedThisMonth(userId: string, reviewMonth: string): Promise<Set<string>> {
  const data = await withSupabaseRetry(
    async () =>
      supabase
        .from('team_member_reviews')
        .select('subject_user_id')
        .eq('reviewer_user_id', userId)
        .eq('source', 'crew')
        .eq('review_month', reviewMonth),
    'fetch own crew reviews this month',
  )
  return new Set(((data ?? []) as { subject_user_id: string }[]).map((r) => r.subject_user_id))
}

/** One crew row per (subject, rater, month): saving again in the same month updates it. */
export async function upsertCrewReview(row: CrewReviewInsertRow): Promise<void> {
  await withSupabaseRetry(
    async () =>
      supabase.from('team_member_reviews').upsert(row, { onConflict: 'subject_user_id,reviewer_user_id,review_month,source' }),
    'upsert crew review',
  )
}

export type OpenWordsSubmission = {
  source: TeamFeedbackSource
  cadenceDays: number
  managerUserId: string | null
  fixImprove: string
  safetyTools: string
  training: string
  anything: string
}

/** The deck's last card. Inserts as the signed-in user (RLS: reviewer_user_id = auth.uid()). */
export async function submitOpenWords(payload: OpenWordsSubmission): Promise<void> {
  const { data: authData, error: authError } = await supabase.auth.getUser()
  const reviewerUserId = authData.user?.id
  if (authError || !reviewerUserId) throw new Error('Not authenticated')
  const insertRow: Database['public']['Tables']['team_feedback_submissions']['Insert'] = {
    reviewer_user_id: reviewerUserId,
    source: payload.source,
    cycle_period_start: computeCyclePeriodStart(payload.cadenceDays),
    manager_user_id: payload.managerUserId,
    open_fix_improve: payload.fixImprove.trim() || null,
    open_safety_tools: payload.safetyTools.trim() || null,
    open_training: payload.training.trim() || null,
    open_anything: payload.anything.trim() || null,
  }
  await withSupabaseRetry(async () => supabase.from('team_feedback_submissions').insert(insertRow), 'insert open words')
}

/** Stamps the cycle done: the prompt stays quiet for cadence_days and any snooze is cleared. */
export async function markCrewDeckCompleted(userId: string): Promise<void> {
  await upsertTeamFeedbackUserState(userId, { last_completed_at: new Date().toISOString(), snooze_until: null })
}

export type CrewReviewAggregateRow = {
  subject_user_id: string
  review_month: string
  rating_ability: number | null
  rating_drive: number | null
  rating_integrity: number | null
  rater_count: number
}

/** The anonymous crew lane: per subject per month averages + rater count (office: months with 2+ raters). */
export async function fetchCrewReviewAggregates(): Promise<CrewReviewAggregateRow[]> {
  const data = await withSupabaseRetry(() => supabase.rpc('crew_review_aggregates'), 'crew_review_aggregates')
  return ((data ?? []) as CrewReviewAggregateRow[]).map((r) => ({
    ...r,
    rating_ability: r.rating_ability == null ? null : Number(r.rating_ability),
    rating_drive: r.rating_drive == null ? null : Number(r.rating_drive),
    rating_integrity: r.rating_integrity == null ? null : Number(r.rating_integrity),
  }))
}
