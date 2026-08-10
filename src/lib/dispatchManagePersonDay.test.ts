import { describe, expect, it } from 'vitest'
import { computeManageDaySummary } from './dispatchManagePersonDay'

describe('computeManageDaySummary', () => {
  it('totals block minutes and reports the free-after point', () => {
    const s = computeManageDaySummary([
      { timeStart: '08:00', timeEnd: '12:00' },
      { timeStart: '13:00', timeEnd: '15:00' },
    ])
    expect(s.count).toBe(2)
    expect(s.totalMinutes).toBe(360)
    expect(s.freeAfterMin).toBe(15 * 60)
  })

  it('empty day: zero blocks, no free-after point', () => {
    expect(computeManageDaySummary([])).toEqual({ count: 0, totalMinutes: 0, freeAfterMin: null })
  })

  it('a day booked through the 6 PM ribbon end has no free-after point', () => {
    const s = computeManageDaySummary([{ timeStart: '14:00', timeEnd: '18:00' }])
    expect(s.freeAfterMin).toBeNull()
  })

  it('ignores inverted ranges in the total but still tracks the latest end', () => {
    const s = computeManageDaySummary([
      { timeStart: '10:00', timeEnd: '09:00' },
      { timeStart: '08:00', timeEnd: '08:30' },
    ])
    expect(s.totalMinutes).toBe(30)
    expect(s.count).toBe(2)
    expect(s.freeAfterMin).toBe(9 * 60)
  })
})
