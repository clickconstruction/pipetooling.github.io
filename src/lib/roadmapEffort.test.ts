import { describe, expect, it } from 'vitest'
import { averageEstimatedDays, effortDaysLabel, effortSumLabel, observedEffortPace, taskWeightDays } from './roadmapEffort'

const NOW = new Date('2026-08-26T12:00:00')

describe('averageEstimatedDays / taskWeightDays', () => {
  it('mean of set estimates; 1 when none; average fills the gaps', () => {
    const tasks = [
      { completed_at: null, estimated_days: 4 },
      { completed_at: null, estimated_days: 2 },
      { completed_at: null }, // unestimated
    ]
    expect(averageEstimatedDays(tasks)).toBe(3)
    expect(taskWeightDays(tasks[2]!, 3)).toBe(3)
    expect(taskWeightDays(tasks[0]!, 3)).toBe(4)
    expect(averageEstimatedDays([{ completed_at: null }])).toBe(1)
  })
  it('ignores zero/negative/NaN estimates', () => {
    expect(averageEstimatedDays([{ completed_at: null, estimated_days: 0 }, { completed_at: null, estimated_days: 5 }])).toBe(5)
  })
})

describe('labels', () => {
  it('one decimal, no trailing .0; sums round whole', () => {
    expect(effortDaysLabel(5)).toBe('5d')
    expect(effortDaysLabel(2.5)).toBe('2.5d')
    expect(effortDaysLabel(2.04)).toBe('2d')
    expect(effortSumLabel(139.6)).toBe('≈ 140d')
  })
})

describe('observedEffortPace', () => {
  it('weights recent completions by estimate; unestimated weigh the average', () => {
    const tasks = [
      { completed_at: '2026-08-20T10:00:00', estimated_days: 6 },
      { completed_at: '2026-08-22T10:00:00' }, // weighs avg = 4
      { completed_at: null, estimated_days: 2 },
    ]
    const p = observedEffortPace(tasks, NOW)
    expect(p?.basis).toBe('recent')
    expect(p?.daysPerWeek).toBeCloseTo((6 + 4) / 4, 5)
  })
  it('reduces to tasks/week when nothing is estimated', () => {
    const tasks = [
      { completed_at: '2026-08-20T10:00:00' },
      { completed_at: '2026-08-22T10:00:00' },
      { completed_at: null },
    ]
    expect(observedEffortPace(tasks, NOW)?.daysPerWeek).toBeCloseTo(2 / 4, 5)
  })
  it('all-time fallback and null with no completions', () => {
    const old = [{ completed_at: '2026-06-01T10:00:00', estimated_days: 12 }]
    const p = observedEffortPace(old, NOW)
    expect(p?.basis).toBe('allTime')
    expect(p!.daysPerWeek).toBeGreaterThan(0)
    expect(observedEffortPace([{ completed_at: null }], NOW)).toBeNull()
  })
})
