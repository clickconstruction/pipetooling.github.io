import { supabase } from './supabase'
import type { Database } from '../types/database'
import { withSupabaseRetry } from '../utils/errorHandling'

export type TeamFeedbackSource = 'clock_out_prompt' | 'home_button' | 'comment_only'

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
  if (role === 'assistant') {
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

/** Exactly one of person_id or peer_user_id is set (people row vs login user without people row). */
export type PeerCandidate = {
  person_id: string | null
  peer_user_id: string | null
  peer_name: string
  /** Labels shared with reviewer (auth user user_labels ∩ peer people_labels or user_labels). */
  shared_tag_count: number
}

export function peerCandidateKey(c: PeerCandidate): string {
  if (c.person_id) return `p:${c.person_id}`
  if (c.peer_user_id) return `u:${c.peer_user_id}`
  return ''
}

export async function fetchPeerCandidates(): Promise<PeerCandidate[]> {
  const data = await withSupabaseRetry(
    async () => supabase.rpc('list_feedback_peer_candidates'),
    'list_feedback_peer_candidates'
  )
  const rows = (data ?? []) as PeerCandidate[]
  return rows.map((r) => ({
    ...r,
    shared_tag_count: r.shared_tag_count ?? 0,
  }))
}

export interface SubmitTeamFeedbackPayload {
  /** Expected to match the signed-in user; inserts use `auth.getUser().id` for RLS. */
  userId: string
  source: TeamFeedbackSource
  cadenceDays: number
  managerUserId: string | null
  mode: 'full' | 'comment_only'
  managerLikert: [number, number, number, number, number] | null
  managerOverall1_10: number | null
  openFixImprove: string | null
  openSafetyTools: string | null
  openTraining: string | null
  peerRows: Array<{
    peer_person_id: string | null
    peer_user_id: string | null
    likert: [number, number, number, number, number]
    trust: number | null
  }>
}

export async function submitTeamFeedback(payload: SubmitTeamFeedbackPayload): Promise<void> {
  const { data: authData, error: authError } = await supabase.auth.getUser()
  const reviewerUserId = authData.user?.id
  if (authError || !reviewerUserId) {
    throw new Error('Not authenticated')
  }
  // RLS: team_feedback_submissions_insert_own requires reviewer_user_id = auth.uid() (must not trust payload.userId).
  const cycleStart = computeCyclePeriodStart(payload.cadenceDays)
  const isCommentOnly = payload.mode === 'comment_only'

  const insertRow: Database['public']['Tables']['team_feedback_submissions']['Insert'] = {
    reviewer_user_id: reviewerUserId,
    source: payload.source,
    cycle_period_start: cycleStart,
    manager_user_id: payload.managerUserId,
    manager_likert_1: isCommentOnly ? null : payload.managerLikert?.[0] ?? null,
    manager_likert_2: isCommentOnly ? null : payload.managerLikert?.[1] ?? null,
    manager_likert_3: isCommentOnly ? null : payload.managerLikert?.[2] ?? null,
    manager_likert_4: isCommentOnly ? null : payload.managerLikert?.[3] ?? null,
    manager_likert_5: isCommentOnly ? null : payload.managerLikert?.[4] ?? null,
    manager_overall_1_10: isCommentOnly ? null : payload.managerOverall1_10,
    open_fix_improve: payload.openFixImprove?.trim() || null,
    open_safety_tools: payload.openSafetyTools?.trim() || null,
    open_training: payload.openTraining?.trim() || null,
  }

  const inserted = await withSupabaseRetry(
    async () => supabase.from('team_feedback_submissions').insert(insertRow).select('id').single(),
    'insert team_feedback_submissions'
  )
  const submissionId = (inserted as { id: string } | null)?.id
  if (!submissionId) throw new Error('Missing submission id')

  for (const pr of payload.peerRows) {
    await withSupabaseRetry(
      async () =>
        supabase.from('team_feedback_peer_ratings').insert({
          submission_id: submissionId,
          peer_person_id: pr.peer_person_id,
          peer_user_id: pr.peer_user_id,
          peer_likert_1: pr.likert[0],
          peer_likert_2: pr.likert[1],
          peer_likert_3: pr.likert[2],
          peer_likert_4: pr.likert[3],
          peer_likert_5: pr.likert[4],
          peer_trust: pr.trust,
        }),
      'insert team_feedback_peer_ratings'
    )
  }

  await upsertTeamFeedbackUserState(reviewerUserId, {
    last_completed_at: new Date().toISOString(),
    snooze_until: null,
  })
}
