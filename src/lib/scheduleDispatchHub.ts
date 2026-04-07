import { supabase } from './supabase'
import type { JobScheduleBlockRow } from './jobScheduleBlocks'
import { formatErrorMessage, withSupabaseRetry } from '../utils/errorHandling'

export type ScheduleDispatchHubJobRow = {
  id: string
  hcp_number: string | null
  job_name: string | null
  project_id: string | null
}

export function formatScheduleDispatchHubJobTitle(
  hcp: string | null | undefined,
  jobName: string | null | undefined,
): string {
  return `${(hcp ?? '').trim() || '—'} · ${(jobName ?? '').trim() || 'Job'}`
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
          .select('id, hcp_number, job_name, project_id')
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
  try {
    const data = await withSupabaseRetry(
      async () =>
        await supabase.from('jobs_ledger_team_members').select('user_id').in('job_id', uniqueJobIds),
      'fetchTeamMemberUserIdsForJobIds',
    )
    const seen = new Set<string>()
    const ids: string[] = []
    for (const row of (data ?? []) as Array<{ user_id: string }>) {
      const id = row.user_id
      if (!id || seen.has(id)) continue
      seen.add(id)
      ids.push(id)
    }
    return { data: ids, error: null }
  } catch (e) {
    return { data: [], error: formatErrorMessage(e) }
  }
}

/** Same auth `users` cohort as People → Users (non-archived). Includes `dev` when `includeDevUsers` (viewer is dev). */
export async function fetchUsersTabUserIdsForScheduleDispatchHub(
  includeDevUsers: boolean,
): Promise<{ data: string[]; error: string | null }> {
  try {
    const baseRows = await withSupabaseRetry(
      async () =>
        await supabase
          .from('users')
          .select('id')
          .is('archived_at', null)
          .in('role', [
            'assistant',
            'master_technician',
            'subcontractor',
            'estimator',
            'primary',
            'superintendent',
          ]),
      'fetchUsersTabUserIdsForScheduleDispatchHub',
    )
    const seen = new Set<string>()
    const ids: string[] = []
    for (const row of (baseRows ?? []) as Array<{ id: string }>) {
      const id = row.id
      if (!id || seen.has(id)) continue
      seen.add(id)
      ids.push(id)
    }
    if (includeDevUsers) {
      const devRows = await withSupabaseRetry(
        async () =>
          await supabase.from('users').select('id').is('archived_at', null).eq('role', 'dev'),
        'fetchUsersTabUserIdsForScheduleDispatchHubDev',
      )
      for (const row of (devRows ?? []) as Array<{ id: string }>) {
        const id = row.id
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

export function hubPersonDayKey(assigneeUserId: string, workDate: string): string {
  return `${assigneeUserId}\t${workDate}`
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

export async function fetchUserNamesForIds(
  ids: string[],
): Promise<{ data: Map<string, string>; error: string | null }> {
  const unique = [...new Set(ids)].filter(Boolean)
  if (unique.length === 0) return { data: new Map(), error: null }
  try {
    const data = await withSupabaseRetry(
      async () =>
        await supabase.from('users').select('id, name').in('id', unique),
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
