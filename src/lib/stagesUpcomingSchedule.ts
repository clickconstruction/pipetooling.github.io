import { supabase } from './supabase'
import { withSupabaseRetry } from '../utils/errorHandling'
import { scheduleFormatTimeHm } from './jobScheduleChicago'

/**
 * Next upcoming schedule appointment per job for the Stages Activity column
 * ("Next: Fri Jul 31 · 11:00 AM–12:30 PM · Abraham — note"). One batched
 * query over job_schedule_blocks (work_date >= today); the kernel keeps the
 * earliest block per job and merges assignees sharing that same window.
 */

export type StagesUpcomingBlockRow = {
  job_id: string
  work_date: string
  time_start: string
  time_end: string
  note: string | null
  users: { name: string | null } | null
}

export type StagesUpcomingAppointment = {
  ymd: string
  timeStart: string
  timeEnd: string
  /** Name-sorted, deduped assignees on the job's earliest upcoming window. */
  assigneeNames: string[]
  note: string | null
}

/**
 * Rows must be ordered by work_date then time_start (the query's order). For
 * each job: first row wins; later rows merge in only when they share the
 * winning (date, start, end) window — i.e. linked/shared blocks.
 */
export function pickNextUpcomingAppointmentPerJob(
  rows: StagesUpcomingBlockRow[],
): Record<string, StagesUpcomingAppointment> {
  const byJob: Record<string, StagesUpcomingAppointment> = {}
  for (const r of rows) {
    const name = r.users?.name?.trim() || 'Unknown'
    const existing = byJob[r.job_id]
    if (!existing) {
      byJob[r.job_id] = {
        ymd: r.work_date,
        timeStart: r.time_start,
        timeEnd: r.time_end,
        assigneeNames: [name],
        note: r.note?.trim() || null,
      }
      continue
    }
    if (
      existing.ymd === r.work_date &&
      existing.timeStart === r.time_start &&
      existing.timeEnd === r.time_end
    ) {
      if (!existing.assigneeNames.includes(name)) existing.assigneeNames.push(name)
      if (!existing.note && r.note?.trim()) existing.note = r.note.trim()
    }
  }
  for (const a of Object.values(byJob)) a.assigneeNames.sort((x, y) => x.localeCompare(y))
  return byJob
}

/** Avoid oversized uuid[] filters — same chunk size as the thread-stats fetch. */
/** "Fri Jul 31" — the NEXT line's compact date. */
export function formatStagesNextDateLabel(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(y || 1970, (m || 1) - 1, d || 1)
    .toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    .replace(',', '')
}

/**
 * "8–9:30 AM" / "10 AM–12 PM" — window with the start meridiem dropped when
 * both sides share it, and ":00" dropped on whole hours (v2.1179).
 */
export function formatStagesCompactWindow(timeStart: string, timeEnd: string): string {
  // scheduleFormatTimeHm returns "H:MM AM" — exactly one colon, so a plain
  // ':00' replace only ever hits the top-of-hour minutes.
  const a = scheduleFormatTimeHm(timeStart).replace(':00', '')
  const b = scheduleFormatTimeHm(timeEnd).replace(':00', '')
  const suffixA = a.slice(-3)
  if ((suffixA === ' AM' || suffixA === ' PM') && b.endsWith(suffixA)) {
    return `${a.slice(0, -3)}\u2013${b}`
  }
  return `${a}\u2013${b}`
}

export const UPCOMING_SCHEDULE_JOB_IDS_CHUNK = 200

export async function fetchStagesUpcomingScheduleForJobs(
  jobIds: string[],
  todayYmd: string,
): Promise<Record<string, StagesUpcomingAppointment>> {
  if (jobIds.length === 0) return {}
  const all: StagesUpcomingBlockRow[] = []
  for (let i = 0; i < jobIds.length; i += UPCOMING_SCHEDULE_JOB_IDS_CHUNK) {
    const chunk = jobIds.slice(i, i + UPCOMING_SCHEDULE_JOB_IDS_CHUNK)
    const data = await withSupabaseRetry(
      async () =>
        await supabase
          .from('job_schedule_blocks')
          .select(
            'job_id, work_date, time_start, time_end, note, users!job_schedule_blocks_assignee_user_id_fkey(name)',
          )
          .in('job_id', chunk)
          .gte('work_date', todayYmd)
          .order('work_date', { ascending: true })
          .order('time_start', { ascending: true }),
      'fetchStagesUpcomingScheduleForJobs',
    )
    all.push(...((data ?? []) as StagesUpcomingBlockRow[]))
  }
  return pickNextUpcomingAppointmentPerJob(all)
}
