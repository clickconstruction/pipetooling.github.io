/**
 * Leg grouping for the Linked crew modal (v2.1401 redesign).
 *
 * A linked schedule group is a set of `job_schedule_blocks` rows sharing
 * `shared_block_group_id`. Members share the same (job, work date, time
 * window) per "leg" — multi-day crews have one leg per day. The modal renders
 * one header card per leg with a person row per block, so the shared facts
 * appear once instead of repeating per table row; joining a crew inserts one
 * block per leg (same key), so the key function is shared with that path.
 */

export type LinkedCrewLegRowShape = {
  job_id: string | null
  /** Bid anchor (v2.1613) — legs key on the anchor so bid legs never collapse together. */
  bid_id?: string | null
  work_date: string
  time_start: string
  time_end: string
}

export type LinkedCrewLeg<T extends LinkedCrewLegRowShape> = {
  key: string
  /** Anchor id: job uuid or `bid:<uuid>` (v2.1613). */
  jobId: string
  workDate: string
  timeStart: string
  timeEnd: string
  rows: T[]
}

function linkedCrewLegAnchorId(row: LinkedCrewLegRowShape): string {
  return row.job_id ?? `bid:${row.bid_id ?? ''}`
}

export function linkedCrewLegKey(row: LinkedCrewLegRowShape): string {
  return `${linkedCrewLegAnchorId(row)}|${row.work_date}|${row.time_start}|${row.time_end}`
}

/** Group blocks into legs, ordered by work date, then start time, then job id; row order within a leg is preserved. */
export function groupLinkedCrewLegs<T extends LinkedCrewLegRowShape>(rows: readonly T[]): LinkedCrewLeg<T>[] {
  const byKey = new Map<string, LinkedCrewLeg<T>>()
  for (const row of rows) {
    const key = linkedCrewLegKey(row)
    const leg = byKey.get(key)
    if (leg) {
      leg.rows.push(row)
    } else {
      byKey.set(key, {
        key,
        jobId: linkedCrewLegAnchorId(row),
        workDate: row.work_date,
        timeStart: row.time_start,
        timeEnd: row.time_end,
        rows: [row],
      })
    }
  }
  return [...byKey.values()].sort(
    (a, b) =>
      a.workDate.localeCompare(b.workDate) ||
      a.timeStart.localeCompare(b.timeStart) ||
      a.jobId.localeCompare(b.jobId),
  )
}

const WEEKDAY_MONTH_FORMAT: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' }

/** 'YYYY-MM-DD' → 'Wed, Aug 5' (local-constructed date, so no UTC previous-day shift); malformed input returns as-is. */
export function formatLinkedCrewWorkDate(workDate: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(workDate)
  if (!m) return workDate
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  if (Number.isNaN(d.getTime())) return workDate
  return d.toLocaleDateString('en-US', WEEKDAY_MONTH_FORMAT)
}
