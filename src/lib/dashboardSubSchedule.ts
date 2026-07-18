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
