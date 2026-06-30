import { MIN_SEGMENT_MS } from './myTimeDayTimeline'

/** One scheduled job's share of the day (summed window minutes + earliest start for ordering). */
export type ScheduleProportionJob = {
  jobId: string
  /** Total scheduled minutes for this job across all of its windows that day. */
  scheduledMinutes: number
  /** Earliest window start (minutes past midnight) — drives segment order. */
  earliestStartMinutes: number
}

export type ScheduleProportionSplitArgs = {
  spanStartMs: number
  spanEndMs: number
  jobs: ScheduleProportionJob[]
  /** Minimum duration per resulting segment. Defaults to MIN_SEGMENT_MS. */
  minSegmentMs?: number
}

export type ScheduleProportionSplitResult = {
  /** Length N+1 boundary timestamps (ms); first === spanStartMs, last === spanEndMs. */
  boundaries: number[]
  /** Length N job ids, parallel to the segments between boundaries (schedule-start order). */
  segmentJobIds: string[]
}

/**
 * Partition a worked time span `[spanStartMs, spanEndMs]` across scheduled jobs, proportional to
 * each job's share of total *scheduled* time (gaps in the schedule are ignored). Segments are laid
 * out contiguously in schedule-start order. Jobs whose proportional slice would fall below
 * `minSegmentMs` are dropped and the remaining shares renormalized (repeated until stable), so the
 * span is always fully partitioned among the surviving jobs. The final boundary is pinned exactly
 * to `spanEndMs` to avoid cumulative rounding drift.
 *
 * Returns `null` when nothing can be split (non-positive span, no jobs with positive scheduled time,
 * or the span is too small to hold even one min-length segment).
 */
export function buildScheduleProportionSplit({
  spanStartMs,
  spanEndMs,
  jobs,
  minSegmentMs = MIN_SEGMENT_MS,
}: ScheduleProportionSplitArgs): ScheduleProportionSplitResult | null {
  const spanMs = spanEndMs - spanStartMs
  if (!Number.isFinite(spanMs) || spanMs < minSegmentMs) return null

  // Keep jobs with positive scheduled time, ordered by earliest start (tiebreak: jobId for stability).
  let candidates = jobs
    .filter((j) => Number.isFinite(j.scheduledMinutes) && j.scheduledMinutes > 0)
    .sort((a, b) => {
      if (a.earliestStartMinutes !== b.earliestStartMinutes) {
        return a.earliestStartMinutes - b.earliestStartMinutes
      }
      return a.jobId.localeCompare(b.jobId)
    })
  if (candidates.length === 0) return null

  // Drop jobs whose proportional slice would be below the minimum, then renormalize. Repeat until
  // stable (dropping one job grows the others' shares, which can rescue a borderline job — but the
  // loop only ever removes, so it terminates).
  for (;;) {
    const totalMinutes = candidates.reduce((sum, j) => sum + j.scheduledMinutes, 0)
    if (totalMinutes <= 0) return null
    const tooSmall = candidates.filter((j) => (j.scheduledMinutes / totalMinutes) * spanMs < minSegmentMs)
    if (tooSmall.length === 0) break
    const dropIds = new Set(tooSmall.map((j) => j.jobId))
    const next = candidates.filter((j) => !dropIds.has(j.jobId))
    if (next.length === 0) {
      // Even the largest single job rounds below min only when the whole span is < min, which we
      // already guarded. Fall back to assigning the whole span to the largest job.
      const largest = candidates.reduce((best, j) => (j.scheduledMinutes > best.scheduledMinutes ? j : best))
      candidates = [largest]
      break
    }
    candidates = next
  }

  const totalMinutes = candidates.reduce((sum, j) => sum + j.scheduledMinutes, 0)
  if (totalMinutes <= 0) return null

  const n = candidates.length
  const boundaries: number[] = [spanStartMs]
  let cumulativeMinutes = 0
  for (let i = 0; i < n - 1; i++) {
    cumulativeMinutes += candidates[i]!.scheduledMinutes
    const frac = cumulativeMinutes / totalMinutes
    boundaries.push(Math.round(spanStartMs + frac * spanMs))
  }
  boundaries.push(spanEndMs) // pin final boundary exactly — no drift

  // Defensive: rounding can in theory make an interior boundary non-monotonic for extreme inputs.
  // Clamp each interior boundary to keep at least minSegmentMs on both sides.
  for (let i = 1; i < boundaries.length - 1; i++) {
    const lo = boundaries[i - 1]! + minSegmentMs
    const hi = boundaries[i + 1]! - minSegmentMs
    if (boundaries[i]! < lo) boundaries[i] = lo
    if (boundaries[i]! > hi) boundaries[i] = hi
  }

  return {
    boundaries,
    segmentJobIds: candidates.map((j) => j.jobId),
  }
}
