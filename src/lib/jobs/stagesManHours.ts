/**
 * The Pipeline's man-hours folds (pure): the board reads one RPC row per person per job
 * (`job_id`, `person_name`, `man_hours`) and shows a total on the row and a per-person
 * breakdown on hover. Lifted out of `JobsStagesTab` (Stage-A sweep II, v2.3860) so the two
 * folds share one reading of the rows and the tab keeps only the memo.
 */

export type StagesManHoursRow = { job_id: string; person_name: string; man_hours: number | string | null }

export type StagesLaborBreakdownEntry = { personName: string; hours: number }

/** Total man-hours per job id. A row with no hours counts as 0. */
export function stagesManHoursByJobId(rows: ReadonlyArray<StagesManHoursRow>): Map<string, number> {
  const m = new Map<string, number>()
  for (const r of rows) m.set(r.job_id, (m.get(r.job_id) ?? 0) + Number(r.man_hours ?? 0))
  return m
}

/** Per-person man-hours per job id, most hours first — the man-hours hover tooltip. */
export function stagesLaborBreakdownByJobId(rows: ReadonlyArray<StagesManHoursRow>): Map<string, StagesLaborBreakdownEntry[]> {
  const m = new Map<string, StagesLaborBreakdownEntry[]>()
  for (const r of rows) {
    const arr = m.get(r.job_id) ?? []
    arr.push({ personName: r.person_name, hours: Number(r.man_hours ?? 0) })
    m.set(r.job_id, arr)
  }
  for (const arr of m.values()) arr.sort((a, b) => b.hours - a.hours)
  return m
}
