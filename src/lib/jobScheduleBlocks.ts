import { supabase } from './supabase'
import type { Database } from '../types/database'
import { scheduleFormatTimeHm } from './jobScheduleChicago'
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
  project_id: string | null
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
          .select('id, hcp_number, job_name, project_id, jobs_ledger_team_members(user_id, users(name))')
          .eq('id', jobId)
          .maybeSingle(),
      'fetchScheduleJobContext',
    )
    const r = row as {
      id: string
      hcp_number: string | null
      job_name: string | null
      project_id: string | null
      jobs_ledger_team_members: JobsLedgerTeamMemberEmbed[] | null
    } | null
    if (!r?.id) return { data: null, error: 'Job not found or access denied.' }
    const team = (r.jobs_ledger_team_members ?? []).map((tm) => ({
      user_id: tm.user_id,
      name: tm.users?.name ?? null,
    }))
    const pid = r.project_id != null && String(r.project_id).trim() !== '' ? String(r.project_id).trim() : null
    return {
      data: {
        jobId: r.id,
        jobTitle: mapJobTitle(r.hcp_number, r.job_name),
        project_id: pid,
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

const SELECT_FIELDS_WITH_ASSIGNEE_NAME = `${SELECT_FIELDS}, users!job_schedule_blocks_assignee_user_id_fkey(name)`

export type JobScheduleBlockWithAssigneeName = JobScheduleBlockRow & {
  users: { name: string | null } | null
}

/** All schedule blocks for a job (RLS-limited), ordered by day and start time. Capped at 101 rows so callers can detect truncation. */
export async function fetchJobScheduleBlocksForJob(
  jobId: string,
): Promise<{ data: JobScheduleBlockWithAssigneeName[]; error: string | null }> {
  try {
    const data = await withSupabaseRetry(
      async () =>
        await supabase
          .from('job_schedule_blocks')
          .select(SELECT_FIELDS_WITH_ASSIGNEE_NAME)
          .eq('job_id', jobId)
          .order('work_date', { ascending: true })
          .order('time_start', { ascending: true })
          .limit(101),
      'fetchJobScheduleBlocksForJob',
    )
    return { data: (data ?? []) as JobScheduleBlockWithAssigneeName[], error: null }
  } catch (e) {
    return { data: [], error: formatErrorMessage(e) }
  }
}

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

/** Formatted start/end for one `job_schedule_blocks` row (Assign popover). */
export type DispatchScheduledWindowSpan = {
  startLabel: string
  endLabel: string
}

/** One job per `job_id` for Assign popover quick-picks (Dispatch schedule). */
export type DispatchScheduledJobForAssign = {
  jobId: string
  hcp_number: string
  job_name: string
  job_address: string
  service_type_id: string | null
  click_number: string | null
  /** One span per schedule block, same order as Dispatch (start / end display lines). */
  windowSpans: DispatchScheduledWindowSpan[]
  /** Joined time windows for tooltip (e.g. "9:00 AM–12:00 PM; 1:00 PM–4:00 PM"), en-dash between times. */
  windowsLabel: string
}

const DISPATCH_ASSIGN_SELECT = `${SELECT_FIELDS}, jobs_ledger(hcp_number, job_name, job_address, service_type_id, click_number)`

type JobScheduleBlockWithJobEmbed = JobScheduleBlockRow & {
  jobs_ledger: {
    hcp_number: string | null
    job_name: string | null
    job_address: string | null
    service_type_id: string | null
    click_number: string | null
  } | null
}

/**
 * Distinct jobs from `job_schedule_blocks` for an assignee on `work_date`, with labels for assign UI.
 * RLS matches other schedule reads.
 */
export async function fetchDispatchScheduledJobsForAssigneeDay(
  assigneeUserId: string,
  workDateYmd: string,
): Promise<{ data: DispatchScheduledJobForAssign[]; error: string | null }> {
  const uid = assigneeUserId.trim()
  const wd = workDateYmd.trim()
  if (!uid || !wd) return { data: [], error: null }
  try {
    const raw = await withSupabaseRetry(
      async () =>
        await supabase
          .from('job_schedule_blocks')
          .select(DISPATCH_ASSIGN_SELECT)
          .eq('assignee_user_id', uid)
          .eq('work_date', wd)
          .order('time_start', { ascending: true }),
      'fetchDispatchScheduledJobsForAssigneeDay',
    )
    const rows = (raw ?? []) as JobScheduleBlockWithJobEmbed[]
    const byJob = new Map<
      string,
      { jl: NonNullable<JobScheduleBlockWithJobEmbed['jobs_ledger']>; windowSpans: DispatchScheduledWindowSpan[] }
    >()
    const enDash = '\u2013'
    for (const r of rows) {
      const jl = r.jobs_ledger
      if (!jl) continue
      const span: DispatchScheduledWindowSpan = {
        startLabel: scheduleFormatTimeHm(r.time_start),
        endLabel: scheduleFormatTimeHm(r.time_end),
      }
      const existing = byJob.get(r.job_id)
      if (existing) {
        existing.windowSpans.push(span)
      } else {
        byJob.set(r.job_id, { jl, windowSpans: [span] })
      }
    }
    const data: DispatchScheduledJobForAssign[] = []
    for (const [jobId, { jl, windowSpans }] of byJob) {
      data.push({
        jobId,
        hcp_number: (jl.hcp_number ?? '').trim(),
        job_name: (jl.job_name ?? '').trim() || '—',
        job_address: (jl.job_address ?? '').trim(),
        service_type_id: jl.service_type_id ?? null,
        click_number: jl.click_number ?? null,
        windowSpans,
        windowsLabel: windowSpans.map((s) => `${s.startLabel}${enDash}${s.endLabel}`).join('; '),
      })
    }
    data.sort((a, b) => {
      const ha = a.hcp_number || ''
      const hb = b.hcp_number || ''
      const c = hb.localeCompare(ha, undefined, { numeric: true })
      if (c !== 0) return c
      return a.job_name.localeCompare(b.job_name, undefined, { sensitivity: 'base' })
    })
    return { data, error: null }
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

/** All schedule blocks in a shared mirror group (any work_date); hub peer details. */
export async function fetchJobScheduleBlocksForSharedGroupId(
  sharedBlockGroupId: string,
): Promise<{ data: JobScheduleBlockRow[]; error: string | null }> {
  try {
    const data = await withSupabaseRetry(
      async () =>
        await supabase
          .from('job_schedule_blocks')
          .select(SELECT_FIELDS)
          .eq('shared_block_group_id', sharedBlockGroupId)
          .order('work_date', { ascending: true })
          .order('time_start', { ascending: true })
          .order('assignee_user_id', { ascending: true }),
      'fetchJobScheduleBlocksForSharedGroupId',
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

/** Atomically moves every leg of a linked group to `newWorkDate` (assignees unchanged); overlap-checked in the RPC. */
export async function moveJobScheduleBlockGroupViaRpc(
  jobId: string,
  sharedBlockGroupId: string,
  newWorkDate: string,
): Promise<{ error: string | null }> {
  try {
    await withSupabaseRetry(
      async () =>
        await supabase.rpc('move_job_schedule_block_group', {
          p_job_id: jobId,
          p_shared_block_group_id: sharedBlockGroupId,
          p_new_work_date: newWorkDate,
        }),
      'move linked schedule blocks to new day',
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
