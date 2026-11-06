import { describe, expect, it } from 'vitest'
import { crewAgainstTarget, crewTargetWeeks, crewTargetWords, lastWeeks, targetOf, type TargetJob } from './crewTarget'

const WEEK = { start: '2026-11-01', end: '2026-11-07' }

const job = (p: Partial<TargetJob> = {}): TargetJob => ({ jobId: 'j', label: '1184 Water heater', finishedYmd: '2026-11-03', targetHours: 40, crewHours: 36, ...p })

describe('targetOf', () => {
  it('reads the open expected hours first, then a labor budget above zero, else none', () => {
    expect(targetOf(96, 110)).toBe(96)
    expect(targetOf(null, 110)).toBe(110)
    expect(targetOf(0, 0)).toBeNull()
    expect(targetOf(undefined, undefined)).toBeNull()
  })
})

describe('crewAgainstTarget', () => {
  it('counts only the jobs finished in the week that carry a target, and says how many had none', () => {
    const read = crewAgainstTarget(
      [
        job({ jobId: 'a', crewHours: 36, targetHours: 40 }),
        job({ jobId: 'b', crewHours: 50, targetHours: 44, finishedYmd: '2026-11-06' }),
        job({ jobId: 'c', crewHours: 20, targetHours: null }),
        job({ jobId: 'd', crewHours: 20, targetHours: 30, finishedYmd: '2026-10-30' }),
        job({ jobId: 'e', crewHours: 20, targetHours: 30, finishedYmd: null }),
      ],
      WEEK,
    )
    expect(read).toEqual({ jobs: 2, hours: 86, target: 84, noTarget: 1, under: -2 })
  })

  it('reads an empty week as nothing counted', () => {
    expect(crewAgainstTarget([], WEEK)).toEqual({ jobs: 0, hours: 0, target: 0, noTarget: 0, under: 0 })
  })
})

describe('crewTargetWords', () => {
  it('says under with a check, over without one, on the target, and nothing counted', () => {
    expect(crewTargetWords({ jobs: 3, hours: 112, target: 124, noTarget: 1, under: 12 })).toEqual({
      head: '112 h for a 124 h target',
      move: '✓ 12 hours under on 3 jobs',
      tone: 'up',
      note: 'One more job finished with no target, so it is not counted.',
    })
    expect(crewTargetWords({ jobs: 3, hours: 132, target: 124, noTarget: 0, under: -8 })).toMatchObject({ move: '8 hours over on 3 jobs', tone: 'down', note: '' })
    expect(crewTargetWords({ jobs: 1, hours: 40, target: 41, noTarget: 2, under: 1 })).toMatchObject({ move: '✓ 1 hour under on 1 job', note: '2 more jobs finished with no target, so they are not counted.' })
    expect(crewTargetWords({ jobs: 2, hours: 80, target: 80, noTarget: 0, under: 0 })).toMatchObject({ move: 'On the target over 2 jobs', tone: 'flat' })
    expect(crewTargetWords({ jobs: 0, hours: 0, target: 0, noTarget: 2, under: 0 })).toMatchObject({ head: 'No finished job with a target this week', move: '', tone: 'none' })
  })

  it('keeps a half hour', () => {
    expect(crewTargetWords({ jobs: 1, hours: 36.5, target: 40, noTarget: 0, under: 3.5 })).toMatchObject({ head: '36.5 h for a 40 h target', move: '✓ 3.5 hours under on 1 job' })
  })
})

describe('lastWeeks and crewTargetWeeks', () => {
  it('lists the last eight pay weeks oldest first, ending with the one holding today', () => {
    const weeks = lastWeeks('2026-11-06', 8)
    expect(weeks).toHaveLength(8)
    expect(weeks[7]).toEqual({ start: '2026-11-01', end: '2026-11-07' })
    expect(weeks[0]).toEqual({ start: '2026-09-13', end: '2026-09-19' })
  })

  it('reads each week on its own', () => {
    const series = crewTargetWeeks([job({ finishedYmd: '2026-10-28', crewHours: 30, targetHours: 40 }), job({ jobId: 'b', finishedYmd: '2026-11-03' })], lastWeeks('2026-11-06', 2))
    expect(series.map((s) => s.read.under)).toEqual([10, 4])
  })
})
