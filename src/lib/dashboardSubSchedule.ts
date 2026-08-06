import type { JobScheduleBlockRow } from './jobScheduleBlocks'

/**
 * Pure kernels for the Dashboard My Schedule section / `useDashboardSubSchedule`
 * (extraction-series refactor; no behavior change).
 */

/** One row per mirrored linked group (same group, date, window). */
export function dedupeSubScheduleBlocks(blocks: JobScheduleBlockRow[]): JobScheduleBlockRow[] {
  const seen = new Set<string>()
  const out: JobScheduleBlockRow[] = []
  for (const b of blocks) {
    const g = b.shared_block_group_id
    const key = g
      ? `g:${g}:${b.work_date}:${b.time_start}:${b.time_end}`
      : `id:${b.id}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(b)
  }
  return out
}

/** "HCP · name" schedule-row label with the My Schedule fallbacks ('—' / 'Job'). */
export function subScheduleJobLabel(
  hcpNumber: string | null | undefined,
  jobName: string | null | undefined,
): string {
  return `${(hcpNumber ?? '').trim() || '—'} · ${(jobName ?? '').trim() || 'Job'}`
}

/** Today/tomorrow buckets for the My Schedule day groups (ymd keys from `jobScheduleChicago`). */
export function partitionSubScheduleBlocksByDay(
  rows: JobScheduleBlockRow[],
  todayYmd: string,
  tomorrowYmd: string,
): { todayBlocks: JobScheduleBlockRow[]; tomorrowBlocks: JobScheduleBlockRow[] } {
  return {
    todayBlocks: rows.filter((b) => b.work_date === todayYmd),
    tomorrowBlocks: rows.filter((b) => b.work_date === tomorrowYmd),
  }
}

/** Ascending by `time_start` (localeCompare), non-mutating — My Schedule day-row order. */
export function sortSubScheduleBlocksByStart(blocks: JobScheduleBlockRow[]): JobScheduleBlockRow[] {
  return [...blocks].sort((a, b) => a.time_start.localeCompare(b.time_start))
}

/** Shape of `useDashboardSubSchedule`'s `subScheduleDayPartition` memo. */
export type SubScheduleDayPartition = {
  todayYmd: string
  tomorrowYmd: string
  todayBlocks: JobScheduleBlockRow[]
  tomorrowBlocks: JobScheduleBlockRow[]
}

/**
 * Per-job fields a My Schedule row needs that the Dashboard's assigned-job
 * lists cannot supply. `list_assigned_jobs_for_dashboard` filters to
 * `status IN ('waiting','working')` and the ready-to-bill RPC to
 * `ready_to_bill`, but schedule blocks carry no status filter — so a scheduled
 * job that is billed or paid is absent from BOTH lists. Before this map existed
 * those rows resolved `job_pictures_link` to `undefined` and rendered the red
 * "no photos — ask Dispatch" button on jobs that already had a link (which is
 * how a duplicate, unclosable `link_job_pictures` dispatch request was filed on
 * the permanently-paid Office job).
 */
export type SubScheduleJobMeta = {
  job_pictures_link: string | null
  hcp_number: string | null
  click_number: string | null
  job_address: string | null
}

/**
 * Job-row values for one schedule block: the assigned-list row wins when it has
 * a non-blank value, otherwise the `subScheduleJobMeta` fallback map. Blank and
 * whitespace-only values count as absent on both sides; the returned value is
 * the original (untrimmed) string so display formatting is unchanged.
 */
export function resolveSubScheduleJobMeta(
  fromAssigned: Partial<SubScheduleJobMeta> | null | undefined,
  fallback: SubScheduleJobMeta | null | undefined,
): SubScheduleJobMeta {
  const pick = (a: string | null | undefined, b: string | null | undefined): string | null => {
    if ((a ?? '').trim()) return a ?? null
    if ((b ?? '').trim()) return b ?? null
    return null
  }
  return {
    job_pictures_link: pick(fromAssigned?.job_pictures_link, fallback?.job_pictures_link),
    hcp_number: pick(fromAssigned?.hcp_number, fallback?.hcp_number),
    click_number: pick(fromAssigned?.click_number, fallback?.click_number),
    job_address: pick(fromAssigned?.job_address, fallback?.job_address),
  }
}
