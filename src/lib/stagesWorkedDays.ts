import { supabase } from './supabase'
import { withSupabaseRetry } from '../utils/errorHandling'

/**
 * The week so far, per job, for the Pipeline row's two-week strip (v2.3785):
 * the days actually worked (approved, unrevoked `clock_sessions` from this
 * week's Monday on) and the days that were booked before today (the upcoming
 * read starts at today, so a past block would otherwise be invisible and a
 * slipped day could never draw hollow). Two batched queries per board load.
 * The kernel folds the session rows into one entry per job-day carrying the
 * names of who clocked, so the strip can tick the day and its hover can say
 * who. Hours are deliberately not summed here — the row's ◷ line owns that.
 */

export type StagesWorkedSessionRow = {
  job_ledger_id: string | null
  work_date: string
  users: { name: string | null } | null
}

export type StagesWorkedDay = {
  ymd: string
  /** Name-sorted, deduped people who clocked an approved session that day. */
  names: string[]
}

export type StagesWeekSoFar = {
  /** Days ascending. */
  worked: StagesWorkedDay[]
  /** Distinct booked days before today, ascending (`job_schedule_blocks.work_date`). */
  bookedYmds: string[]
}

/** Rows in any order → per job, days ascending, names sorted and deduped. */
export function groupStagesWorkedDays(rows: StagesWorkedSessionRow[]): Record<string, StagesWorkedDay[]> {
  const byJob: Record<string, Map<string, Set<string>>> = {}
  for (const r of rows) {
    const jobId = r.job_ledger_id
    if (!jobId || !/^\d{4}-\d{2}-\d{2}/.test(r.work_date)) continue
    const ymd = r.work_date.slice(0, 10)
    const name = r.users?.name?.trim() || 'Unknown'
    const days = (byJob[jobId] ??= new Map())
    const names = days.get(ymd) ?? new Set<string>()
    names.add(name)
    days.set(ymd, names)
  }
  const out: Record<string, StagesWorkedDay[]> = {}
  for (const [jobId, days] of Object.entries(byJob)) {
    out[jobId] = [...days.entries()]
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([ymd, names]) => ({ ymd, names: [...names].sort((x, y) => x.localeCompare(y)) }))
  }
  return out
}

export type StagesPastBlockRow = { job_id: string | null; work_date: string }

/** Block rows in any order → per job, distinct days ascending. */
export function groupStagesPastBookedDays(rows: StagesPastBlockRow[]): Record<string, string[]> {
  const byJob: Record<string, Set<string>> = {}
  for (const r of rows) {
    if (!r.job_id || !/^\d{4}-\d{2}-\d{2}/.test(r.work_date)) continue
    ;(byJob[r.job_id] ??= new Set()).add(r.work_date.slice(0, 10))
  }
  return Object.fromEntries(Object.entries(byJob).map(([id, days]) => [id, [...days].sort()]))
}

/** Join the two reads into one entry per job that has either. */
export function mergeStagesWeekSoFar(
  worked: Record<string, StagesWorkedDay[]>,
  bookedPast: Record<string, string[]>,
): Record<string, StagesWeekSoFar> {
  const out: Record<string, StagesWeekSoFar> = {}
  for (const id of new Set([...Object.keys(worked), ...Object.keys(bookedPast)])) {
    out[id] = { worked: worked[id] ?? [], bookedYmds: bookedPast[id] ?? [] }
  }
  return out
}

/** Same chunk size as the upcoming-schedule fetch — keeps the uuid[] filter small. */
export const WORKED_DAYS_JOB_IDS_CHUNK = 200

/**
 * `fromYmd` is this week's Monday; `todayYmd` bounds the past-blocks read
 * (blocks from today on already ride the upcoming-schedule read).
 */
export async function fetchStagesWeekSoFarForJobs(
  jobIds: string[],
  fromYmd: string,
  todayYmd: string,
): Promise<Record<string, StagesWeekSoFar>> {
  if (jobIds.length === 0) return {}
  const sessions: StagesWorkedSessionRow[] = []
  const blocks: StagesPastBlockRow[] = []
  for (let i = 0; i < jobIds.length; i += WORKED_DAYS_JOB_IDS_CHUNK) {
    const chunk = jobIds.slice(i, i + WORKED_DAYS_JOB_IDS_CHUNK)
    const [s, b] = await Promise.all([
      withSupabaseRetry(
        async () =>
          await supabase
            .from('clock_sessions')
            .select('job_ledger_id, work_date, users!clock_sessions_user_id_fkey(name)')
            .in('job_ledger_id', chunk)
            .gte('work_date', fromYmd)
            .not('approved_at', 'is', null)
            .is('revoked_at', null),
        'fetchStagesWeekSoFarForJobs.sessions',
      ),
      fromYmd < todayYmd
        ? withSupabaseRetry(
            async () =>
              await supabase
                .from('job_schedule_blocks')
                .select('job_id, work_date')
                .in('job_id', chunk)
                .gte('work_date', fromYmd)
                .lt('work_date', todayYmd),
            'fetchStagesWeekSoFarForJobs.blocks',
          )
        : Promise.resolve([] as StagesPastBlockRow[]),
    ])
    sessions.push(...((s ?? []) as StagesWorkedSessionRow[]))
    blocks.push(...((b ?? []) as StagesPastBlockRow[]))
  }
  return mergeStagesWeekSoFar(groupStagesWorkedDays(sessions), groupStagesPastBookedDays(blocks))
}
