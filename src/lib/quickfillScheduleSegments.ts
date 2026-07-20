import {
  dispatchMinutesToFractionalSlotIndex,
  timeInputToMinutesSafe,
  timeInputToPg,
} from './dispatchAddBlockTime'
import type { JobScheduleBlockRow } from './jobScheduleBlocks'
import { scheduleTimeToMinutesFromMidnight } from './jobScheduleOverlap'
import type { AddBlockTimelineSegment } from './scheduleDispatchAddBlockTimeline'
import { formatScheduleDispatchHubJobTitle } from './scheduleDispatchHub'
import type { DispatchOccupiedBand } from '../components/schedule/DispatchAddBlockTimeRange'

export function blocksToSegments(
  rows: JobScheduleBlockRow[],
  jobTitleById: Map<string, string>,
): AddBlockTimelineSegment[] {
  return [...rows]
    .map((b) => ({
      blockId: b.id,
      jobId: b.job_id,
      label: jobTitleById.get(b.job_id) ?? formatScheduleDispatchHubJobTitle(null, null),
      time_start: b.time_start,
      time_end: b.time_end,
      shared_block_group_id: b.shared_block_group_id,
    }))
    .sort(
      (a, b) =>
        scheduleTimeToMinutesFromMidnight(timeInputToPg(a.time_start.slice(0, 5))) -
        scheduleTimeToMinutesFromMidnight(timeInputToPg(b.time_start.slice(0, 5))),
    )
}

export function segmentsToOccupiedBands(segments: AddBlockTimelineSegment[]): DispatchOccupiedBand[] {
  return segments.map((s) => {
    const ts = s.time_start.slice(0, 5)
    const te = s.time_end.slice(0, 5)
    const sm = timeInputToMinutesSafe(ts)
    const em = timeInputToMinutesSafe(te)
    return {
      blockId: s.blockId,
      jobId: s.jobId,
      label: s.label,
      // Fractional so off-grid times (15-min dot drags) render at their exact wall-time x.
      startSlotIndex: dispatchMinutesToFractionalSlotIndex(sm),
      endSlotIndex: dispatchMinutesToFractionalSlotIndex(em),
    }
  })
}
