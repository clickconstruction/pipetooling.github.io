import { supabase } from './supabase'
import type { Database } from '../types/database'
import { formatErrorMessage, withSupabaseRetry } from '../utils/errorHandling'

export type JobScheduleBlockRow = Database['public']['Tables']['job_schedule_blocks']['Row']

/** Team row + joined user name (matches Jobs loadJobs embed). */
type JobsLedgerTeamMemberEmbed = Pick<
  Database['public']['Tables']['jobs_ledger_team_members']['Row'],
  'user_id'
> & {
  users: { name: string } | null
}

export type ScheduleTeamMember = {
  user_id: string
  name: string | null
}

export type ScheduleJobContext = {
  jobId: string
  jobTitle: string
  teamMembers: ScheduleTeamMember[]
}

function mapJobTitle(hcp: string | null | undefined, jobName: string | null | undefined): string {
  return `${(hcp ?? '').trim() || '—'} · ${(jobName ?? '').trim() || 'Job'}`
}

/** Job + team for Schedule modal navigation (RLS must allow read). */
export async function fetchScheduleJobContext(
  jobId: string,
): Promise<{ data: ScheduleJobContext | null; error: string | null }> {
  try {
    const row = await withSupabaseRetry(
      async () =>
        await supabase
          .from('jobs_ledger')
          .select('id, hcp_number, job_name, jobs_ledger_team_members(user_id, users(name))')
          .eq('id', jobId)
          .maybeSingle(),
      'fetchScheduleJobContext',
    )
    const r = row as {
      id: string
      hcp_number: string | null
      job_name: string | null
      jobs_ledger_team_members: JobsLedgerTeamMemberEmbed[] | null
    } | null
    if (!r?.id) return { data: null, error: 'Job not found or access denied.' }
    const team = (r.jobs_ledger_team_members ?? []).map((tm) => ({
      user_id: tm.user_id,
      name: tm.users?.name ?? null,
    }))
    return {
      data: {
        jobId: r.id,
        jobTitle: mapJobTitle(r.hcp_number, r.job_name),
        teamMembers: team,
      },
      error: null,
    }
  } catch (e) {
    return { data: null, error: formatErrorMessage(e) }
  }
}

const SELECT_FIELDS =
  'id, job_id, assignee_user_id, work_date, time_start, time_end, note, shared_block_group_id, created_at, created_by, updated_at'

/** New UUID for `shared_block_group_id` on insert (browser / modern runtimes). */
export function newJobScheduleSharedBlockGroupId(): string {
  return globalThis.crypto.randomUUID()
}

export async function fetchJobScheduleBlocksForJobDay(
  jobId: string,
  workDate: string,
): Promise<{ data: JobScheduleBlockRow[]; error: string | null }> {
  try {
    const data = await withSupabaseRetry(
      async () =>
        await supabase
          .from('job_schedule_blocks')
          .select(SELECT_FIELDS)
          .eq('job_id', jobId)
          .eq('work_date', workDate)
          .order('time_start', { ascending: true }),
      'fetchJobScheduleBlocksForJobDay',
    )
    return { data: (data ?? []) as JobScheduleBlockRow[], error: null }
  } catch (e) {
    return { data: [], error: formatErrorMessage(e) }
  }
}

/** Blocks for many assignees on one day (RLS filters to visible rows). */
export async function fetchScheduleBlocksForAssigneesOnDay(
  assigneeUserIds: string[],
  workDate: string,
): Promise<{ data: JobScheduleBlockRow[]; error: string | null }> {
  if (assigneeUserIds.length === 0) return { data: [], error: null }
  try {
    const data = await withSupabaseRetry(
      async () =>
        await supabase
          .from('job_schedule_blocks')
          .select(SELECT_FIELDS)
          .in('assignee_user_id', assigneeUserIds)
          .eq('work_date', workDate)
          .order('time_start', { ascending: true }),
      'fetchScheduleBlocksForAssigneesOnDay',
    )
    return { data: (data ?? []) as JobScheduleBlockRow[], error: null }
  } catch (e) {
    return { data: [], error: formatErrorMessage(e) }
  }
}

export async function fetchScheduleBlocksForAssigneeDateRange(
  assigneeUserId: string,
  fromDate: string,
  toDate: string,
): Promise<{ data: JobScheduleBlockRow[]; error: string | null }> {
  try {
    const data = await withSupabaseRetry(
      async () =>
        await supabase
          .from('job_schedule_blocks')
          .select(SELECT_FIELDS)
          .eq('assignee_user_id', assigneeUserId)
          .gte('work_date', fromDate)
          .lte('work_date', toDate)
          .order('work_date', { ascending: true })
          .order('time_start', { ascending: true }),
      'fetchScheduleBlocksForAssigneeDateRange',
    )
    return { data: (data ?? []) as JobScheduleBlockRow[], error: null }
  } catch (e) {
    return { data: [], error: formatErrorMessage(e) }
  }
}

/** All blocks for one job in an inclusive work_date range (Sunday–Saturday week, etc.). */
export async function fetchJobScheduleBlocksForJobDateRange(
  jobId: string,
  fromDate: string,
  toDate: string,
): Promise<{ data: JobScheduleBlockRow[]; error: string | null }> {
  try {
    const data = await withSupabaseRetry(
      async () =>
        await supabase
          .from('job_schedule_blocks')
          .select(SELECT_FIELDS)
          .eq('job_id', jobId)
          .gte('work_date', fromDate)
          .lte('work_date', toDate)
          .order('work_date', { ascending: true })
          .order('time_start', { ascending: true }),
      'fetchJobScheduleBlocksForJobDateRange',
    )
    return { data: (data ?? []) as JobScheduleBlockRow[], error: null }
  } catch (e) {
    return { data: [], error: formatErrorMessage(e) }
  }
}

/** All schedule blocks visible to the caller in an inclusive work_date range (Schedule dispatch hub). */
export async function fetchJobScheduleBlocksForHubDateRange(
  fromDate: string,
  toDate: string,
): Promise<{ data: JobScheduleBlockRow[]; error: string | null }> {
  try {
    const data = await withSupabaseRetry(
      async () =>
        await supabase
          .from('job_schedule_blocks')
          .select(SELECT_FIELDS)
          .gte('work_date', fromDate)
          .lte('work_date', toDate)
          .order('assignee_user_id', { ascending: true })
          .order('work_date', { ascending: true })
          .order('time_start', { ascending: true }),
      'fetchJobScheduleBlocksForHubDateRange',
    )
    return { data: (data ?? []) as JobScheduleBlockRow[], error: null }
  } catch (e) {
    return { data: [], error: formatErrorMessage(e) }
  }
}

export async function insertJobScheduleBlock(
  row: Database['public']['Tables']['job_schedule_blocks']['Insert'],
): Promise<{ data: JobScheduleBlockRow | null; error: string | null }> {
  try {
    const data = await withSupabaseRetry(
      async () =>
        await supabase.from('job_schedule_blocks').insert(row).select(SELECT_FIELDS).single(),
      'insertJobScheduleBlock',
    )
    return { data: data as JobScheduleBlockRow | null, error: null }
  } catch (e) {
    return { data: null, error: formatErrorMessage(e) }
  }
}

export async function updateJobScheduleBlock(
  id: string,
  patch: Database['public']['Tables']['job_schedule_blocks']['Update'],
): Promise<{ error: string | null }> {
  try {
    await withSupabaseRetry(
      async () => await supabase.from('job_schedule_blocks').update(patch).eq('id', id),
      'updateJobScheduleBlock',
    )
    return { error: null }
  } catch (e) {
    return { error: formatErrorMessage(e) }
  }
}

/** Sync times/note for every leg of a linked block (same `shared_block_group_id`). */
export async function updateJobScheduleBlockGroup(
  jobId: string,
  groupId: string,
  patch: Pick<
    Database['public']['Tables']['job_schedule_blocks']['Update'],
    'time_start' | 'time_end' | 'note'
  >,
): Promise<{ error: string | null }> {
  try {
    await withSupabaseRetry(
      async () =>
        await supabase
          .from('job_schedule_blocks')
          .update(patch)
          .eq('job_id', jobId)
          .eq('shared_block_group_id', groupId),
      'updateJobScheduleBlockGroup',
    )
    return { error: null }
  } catch (e) {
    return { error: formatErrorMessage(e) }
  }
}

/**
 * Ensure a row has a non-null `shared_block_group_id` (legacy solo rows).
 * Returns existing or newly assigned UUID.
 */
export async function ensureSharedBlockGroupForRow(id: string): Promise<{ data: string | null; error: string | null }> {
  try {
    const row = await withSupabaseRetry(
      async () =>
        await supabase.from('job_schedule_blocks').select('shared_block_group_id').eq('id', id).maybeSingle(),
      'ensureSharedBlockGroupForRow',
    )
    const cur = row as { shared_block_group_id: string | null } | null
    if (!cur) return { data: null, error: 'Block not found.' }
    if (cur.shared_block_group_id) return { data: cur.shared_block_group_id, error: null }
    const gid = newJobScheduleSharedBlockGroupId()
    await withSupabaseRetry(
      async () =>
        await supabase.from('job_schedule_blocks').update({ shared_block_group_id: gid }).eq('id', id),
      'ensureSharedBlockGroupForRow patch',
    )
    return { data: gid, error: null }
  } catch (e) {
    return { data: null, error: formatErrorMessage(e) }
  }
}

export async function deleteJobScheduleBlock(id: string): Promise<{ error: string | null }> {
  try {
    await withSupabaseRetry(
      async () => await supabase.from('job_schedule_blocks').delete().eq('id', id),
      'deleteJobScheduleBlock',
    )
    return { error: null }
  } catch (e) {
    return { error: formatErrorMessage(e) }
  }
}
