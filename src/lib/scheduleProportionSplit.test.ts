import { describe, expect, it } from 'vitest'
import { buildScheduleProportionSplit, type ScheduleProportionJob } from './scheduleProportionSplit'
import { MIN_SEGMENT_MS } from './myTimeDayTimeline'

const HOUR = 3600_000
const start = 1_000_000_000_000 // arbitrary epoch ms

function job(jobId: string, scheduledMinutes: number, earliestStartMinutes: number): ScheduleProportionJob {
  return { jobId, scheduledMinutes, earliestStartMinutes }
}

describe('buildScheduleProportionSplit', () => {
  it('splits evenly across two equal-duration jobs', () => {
    const res = buildScheduleProportionSplit({
      spanStartMs: start,
      spanEndMs: start + 8 * HOUR,
      jobs: [job('A', 90, 8 * 60), job('B', 90, 11 * 60)],
    })
    expect(res).not.toBeNull()
    expect(res!.segmentJobIds).toEqual(['A', 'B'])
    expect(res!.boundaries).toEqual([start, start + 4 * HOUR, start + 8 * HOUR])
  })

  it('weights segments by scheduled minutes (2h vs 1.5h)', () => {
    // Mirrors the screenshot example: JP857 = 2h of an 8h schedule = 25%.
    const res = buildScheduleProportionSplit({
      spanStartMs: start,
      spanEndMs: start + 8 * HOUR,
      jobs: [
        job('first', 90, 8 * 60), // 1.5h, 18.75%
        job('mid', 120, 11 * 60), // 2h, 25%
        job('last', 90, 13 * 60), // 1.5h, 18.75%
      ],
    })
    expect(res).not.toBeNull()
    expect(res!.segmentJobIds).toEqual(['first', 'mid', 'last'])
    // total scheduled = 300 min. first=90/300, +mid=210/300.
    expect(res!.boundaries).toEqual([
      start,
      start + Math.round((90 / 300) * 8 * HOUR),
      start + Math.round((210 / 300) * 8 * HOUR),
      start + 8 * HOUR,
    ])
  })

  it('orders segments by earliest start, not input order', () => {
    const res = buildScheduleProportionSplit({
      spanStartMs: start,
      spanEndMs: start + 6 * HOUR,
      jobs: [job('afternoon', 60, 14 * 60), job('morning', 60, 8 * 60), job('noon', 60, 12 * 60)],
    })
    expect(res!.segmentJobIds).toEqual(['morning', 'noon', 'afternoon'])
  })

  it('sums multiple windows for a single job (pre-summed minutes)', () => {
    // Caller sums a job's windows into scheduledMinutes; verify weighting reflects the larger total.
    const res = buildScheduleProportionSplit({
      spanStartMs: start,
      spanEndMs: start + 4 * HOUR,
      jobs: [job('split-day', 180, 8 * 60), job('other', 60, 13 * 60)],
    })
    // 180 vs 60 -> 3:1 -> first boundary at 3h.
    expect(res!.boundaries).toEqual([start, start + 3 * HOUR, start + 4 * HOUR])
  })

  it('returns a single full-span segment for one job', () => {
    const res = buildScheduleProportionSplit({
      spanStartMs: start,
      spanEndMs: start + 5 * HOUR,
      jobs: [job('only', 120, 9 * 60)],
    })
    expect(res!.segmentJobIds).toEqual(['only'])
    expect(res!.boundaries).toEqual([start, start + 5 * HOUR])
  })

  it('final boundary is pinned exactly to spanEndMs (no rounding drift)', () => {
    const res = buildScheduleProportionSplit({
      spanStartMs: start,
      spanEndMs: start + 7 * HOUR + 1234, // odd span to force rounding
      jobs: [job('A', 37, 8 * 60), job('B', 53, 10 * 60), job('C', 41, 12 * 60)],
    })
    expect(res!.boundaries[0]).toBe(start)
    expect(res!.boundaries[res!.boundaries.length - 1]).toBe(start + 7 * HOUR + 1234)
    // strictly increasing
    for (let i = 1; i < res!.boundaries.length; i++) {
      expect(res!.boundaries[i]!).toBeGreaterThan(res!.boundaries[i - 1]!)
    }
  })

  it('drops a tiny job and renormalizes the rest', () => {
    // tiny job ~ 0.001% of an 8h span -> below MIN_SEGMENT_MS (36s) -> dropped.
    const res = buildScheduleProportionSplit({
      spanStartMs: start,
      spanEndMs: start + 8 * HOUR,
      jobs: [job('A', 100, 8 * 60), job('tiny', 0.0001, 10 * 60), job('B', 100, 12 * 60)],
    })
    expect(res!.segmentJobIds).toEqual(['A', 'B'])
    expect(res!.boundaries).toEqual([start, start + 4 * HOUR, start + 8 * HOUR])
  })

  it('returns null when span is below the minimum segment', () => {
    const res = buildScheduleProportionSplit({
      spanStartMs: start,
      spanEndMs: start + MIN_SEGMENT_MS - 1,
      jobs: [job('A', 60, 8 * 60)],
    })
    expect(res).toBeNull()
  })

  it('returns null with no positively-scheduled jobs', () => {
    expect(
      buildScheduleProportionSplit({
        spanStartMs: start,
        spanEndMs: start + 8 * HOUR,
        jobs: [job('A', 0, 8 * 60), job('B', -5, 9 * 60)],
      }),
    ).toBeNull()
    expect(
      buildScheduleProportionSplit({ spanStartMs: start, spanEndMs: start + 8 * HOUR, jobs: [] }),
    ).toBeNull()
  })
})
