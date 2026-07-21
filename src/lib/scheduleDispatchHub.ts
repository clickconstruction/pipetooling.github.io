import { supabase } from './supabase'
import type { JobScheduleBlockRow } from './jobScheduleBlocks'
import type { Database } from '../types/database'
import { formatErrorMessage, withSupabaseRetry } from '../utils/errorHandling'
import { effectiveJobLedgerNumber } from './ledgerDisplayPrefixes'

type SupabaseUserRole = Database['public']['Enums']['user_role']

/** PostgREST GET URL stays safe vs one giant `.in('job_id', …)` — same magnitude as Jobs Stages schedule search chunks. */
const JOBS_LEDGER_TEAM_MEMBERS_JOB_ID_CHUNK = 150

export type ScheduleDispatchHubJobRow = {
  id: string
  hcp_number: string | null
  click_number?: string | null
  job_name: string | null
  project_id: string | null
  created_at?: string | null
  job_address?: string | null
}

export function formatScheduleDispatchHubJobTitle(
  hcp: string | null | undefined,
  jobName: string | null | undefined,
  clickNumber?: string | null | undefined,
): string {
  return `${effectiveJobLedgerNumber(hcp, clickNumber) || '—'} · ${(jobName ?? '').trim() || 'Job'}`
}

export async function fetchJobsLedgerForScheduleDispatchHub(): Promise<{
  data: ScheduleDispatchHubJobRow[]
  error: string | null
}> {
  try {
    const data = await withSupabaseRetry(
      async () =>
        await supabase
          .from('jobs_ledger')
          .select('id, hcp_number, click_number, job_name, project_id, created_at, job_address')
          .order('hcp_number', { ascending: false }),
      'fetchJobsLedgerForScheduleDispatchHub',
    )
    return { data: (data ?? []) as ScheduleDispatchHubJobRow[], error: null }
  } catch (e) {
    return { data: [], error: formatErrorMessage(e) }
  }
}

/** Distinct team member auth user ids for the given job ids (Schedule dispatch hub roster). */
export async function fetchTeamMemberUserIdsForJobIds(
  jobIds: string[],
): Promise<{ data: string[]; error: string | null }> {
  const uniqueJobIds = [...new Set(jobIds)].filter(Boolean)
  if (uniqueJobIds.length === 0) return { data: [], error: null }
  const seen = new Set<string>()
  const ids: string[] = []
  try {
    for (let i = 0; i < uniqueJobIds.length; i += JOBS_LEDGER_TEAM_MEMBERS_JOB_ID_CHUNK) {
      const slice = uniqueJobIds.slice(i, i + JOBS_LEDGER_TEAM_MEMBERS_JOB_ID_CHUNK)
      const rows = await withSupabaseRetry(
        async () =>
          await supabase.from('jobs_ledger_team_members').select('user_id').in('job_id', slice),
        'fetchTeamMemberUserIdsForJobIds',
      )
      for (const row of (rows ?? []) as Array<{ user_id: string }>) {
        const id = row.user_id
        if (!id || seen.has(id)) continue
        seen.add(id)
        ids.push(id)
      }
    }
    return { data: ids, error: null }
  } catch (e) {
    return { data: [], error: formatErrorMessage(e) }
  }
}

const USERS_TAB_BASE_ROLES: readonly SupabaseUserRole[] = [
  'assistant',
  // 'controller' is live in the DB enum but the generated types are stale.
  'controller' as SupabaseUserRole,
  'master_technician',
  'subcontractor',
  'helpers',
  'estimator',
  'primary',
  'superintendent',
]

/** Same auth `users` cohort as People → Users (non-archived). Includes `dev` when `includeDevUsers` (viewer is dev). */
export async function fetchUsersTabUserIdsForScheduleDispatchHub(
  includeDevUsers: boolean,
): Promise<{ data: string[]; error: string | null }> {
  try {
    const allowedRoles: SupabaseUserRole[] = includeDevUsers
      ? ['dev', ...USERS_TAB_BASE_ROLES]
      : [...USERS_TAB_BASE_ROLES]
    const rows = await withSupabaseRetry(
      async () =>
        await supabase.from('users').select('id').is('archived_at', null).in('role', allowedRoles),
      'fetchUsersTabUserIdsForScheduleDispatchHub',
    )
    const seen = new Set<string>()
    const ids: string[] = []
    for (const row of (rows ?? []) as Array<{ id: string }>) {
      const id = row.id
      if (!id || seen.has(id)) continue
      seen.add(id)
      ids.push(id)
    }
    return { data: ids, error: null }
  } catch (e) {
    return { data: [], error: formatErrorMessage(e) }
  }
}

export type ScheduleDispatchHubRosterRow = { id: string; role: string }

/** Same cohort as {@link fetchUsersTabUserIdsForScheduleDispatchHub}, with `role` for each user (e.g. Quickfill Schedule filters). */
export async function fetchUsersTabRosterForScheduleDispatchHub(
  includeDevUsers: boolean,
): Promise<{ data: ScheduleDispatchHubRosterRow[]; error: string | null }> {
  try {
    const allowedRoles: SupabaseUserRole[] = includeDevUsers
      ? ['dev', ...USERS_TAB_BASE_ROLES]
      : [...USERS_TAB_BASE_ROLES]
    const rows = await withSupabaseRetry(
      async () =>
        await supabase
          .from('users')
          .select('id, role')
          .is('archived_at', null)
          .in('role', allowedRoles),
      'fetchUsersTabRosterForScheduleDispatchHub',
    )
    const seen = new Set<string>()
    const out: ScheduleDispatchHubRosterRow[] = []
    for (const row of (rows ?? []) as Array<{ id: string; role: string | null }>) {
      const id = row.id
      const roleVal = row.role
      if (!id || seen.has(id) || typeof roleVal !== 'string' || roleVal === '') continue
      seen.add(id)
      out.push({ id, role: roleVal })
    }
    return { data: out, error: null }
  } catch (e) {
    return { data: [], error: formatErrorMessage(e) }
  }
}

export type JobScheduleBlockWeekSummaryRow = {
  job_id: string
  work_date: string
}

export async function fetchJobScheduleBlockWeekSummaries(
  fromDate: string,
  toDate: string,
): Promise<{ data: JobScheduleBlockWeekSummaryRow[]; error: string | null }> {
  try {
    const data = await withSupabaseRetry(
      async () =>
        await supabase
          .from('job_schedule_blocks')
          .select('job_id, work_date')
          .gte('work_date', fromDate)
          .lte('work_date', toDate),
      'fetchJobScheduleBlockWeekSummaries',
    )
    return { data: (data ?? []) as JobScheduleBlockWeekSummaryRow[], error: null }
  } catch (e) {
    return { data: [], error: formatErrorMessage(e) }
  }
}

/** Derive lightweight job×day summary rows for aggregateWeekSummariesByJob (one row per block). */
export function blocksToJobWeekSummaries(blocks: JobScheduleBlockRow[]): JobScheduleBlockWeekSummaryRow[] {
  return blocks.map((b) => ({ job_id: b.job_id, work_date: b.work_date }))
}

const HUB_PERSON_DAY_KEY_SEP = '\t'

export function hubPersonDayKey(assigneeUserId: string, workDate: string): string {
  return `${assigneeUserId}${HUB_PERSON_DAY_KEY_SEP}${workDate}`
}

/** Inverse of {@link hubPersonDayKey}; `null` if malformed. */
export function parseHubPersonDayKey(key: string): { assigneeUserId: string; workDate: string } | null {
  const i = key.indexOf(HUB_PERSON_DAY_KEY_SEP)
  if (i <= 0) return null
  const assigneeUserId = key.slice(0, i)
  const workDate = key.slice(i + HUB_PERSON_DAY_KEY_SEP.length)
  if (!assigneeUserId.trim() || !workDate.trim()) return null
  return { assigneeUserId, workDate }
}

/** assignee_user_id × work_date → blocks sorted by time_start */
export function buildPersonDayBlockMap(blocks: JobScheduleBlockRow[]): Map<string, JobScheduleBlockRow[]> {
  const m = new Map<string, JobScheduleBlockRow[]>()
  for (const b of blocks) {
    const k = hubPersonDayKey(b.assignee_user_id, b.work_date)
    const arr = m.get(k) ?? []
    arr.push(b)
    m.set(k, arr)
  }
  for (const [, arr] of m) {
    arr.sort((a, c) => a.time_start.localeCompare(c.time_start))
  }
  return m
}

/**
 * Subset of `ids` that have `users.archived_at IS NOT NULL`. Used by Schedule dispatch
 * (Hub + Job-Week) to hide archived users from the roster while keeping the schedule
 * blocks in the database — archived users with dangling blocks simply have no row to
 * render on. Empty input returns an empty set without hitting Supabase.
 */
export async function fetchArchivedUserIdSetForIds(ids: string[]): Promise<Set<string>> {
  const unique = [...new Set(ids)].filter(Boolean)
  if (unique.length === 0) return new Set()
  try {
    // RPC (not a users select): the users RLS policy hides archived rows from
    // non-devs, which made this set come back empty for e.g. assistants.
    const rows = await withSupabaseRetry(
      async () => await supabase.rpc('list_user_display_names', { p_user_ids: unique }),
      'fetchArchivedUserIdSetForIds',
    )
    const out = new Set<string>()
    for (const row of (rows ?? []) as Array<{ id: string; archived_at: string | null }>) {
      if (row.id && row.archived_at != null) out.add(row.id)
    }
    return out
  } catch {
    return new Set()
  }
}

export async function fetchUserNamesForIds(
  ids: string[],
): Promise<{ data: Map<string, string>; error: string | null }> {
  const unique = [...new Set(ids)].filter(Boolean)
  if (unique.length === 0) return { data: new Map(), error: null }
  try {
    // RPC (not a users select): the users RLS policy hides archived rows and
    // (for some roles) master/dev rows, which rendered those people "Unknown"
    // across dispatch for non-dev viewers.
    const data = await withSupabaseRetry(
      async () => await supabase.rpc('list_user_display_names', { p_user_ids: unique }),
      'fetchUserNamesForIds',
    )
    const m = new Map<string, string>()
    for (const row of (data ?? []) as Array<{ id: string; name: string | null }>) {
      m.set(row.id, (row.name ?? '').trim() || 'Unnamed')
    }
    for (const id of unique) {
      if (!m.has(id)) m.set(id, 'Unknown')
    }
    return { data: m, error: null }
  } catch (e) {
    return { data: new Map(unique.map((id) => [id, 'Unknown'] as const)), error: formatErrorMessage(e) }
  }
}

export type WeekSummaryAgg = { total: number; byDay: Record<string, number> }

/** Count blocks per job and per work_date for the loaded summary rows. */
export function aggregateWeekSummariesByJob(
  rows: JobScheduleBlockWeekSummaryRow[],
): Map<string, WeekSummaryAgg> {
  const m = new Map<string, WeekSummaryAgg>()
  for (const r of rows) {
    const cur = m.get(r.job_id) ?? { total: 0, byDay: {} }
    cur.total += 1
    cur.byDay[r.work_date] = (cur.byDay[r.work_date] ?? 0) + 1
    m.set(r.job_id, cur)
  }
  return m
}
