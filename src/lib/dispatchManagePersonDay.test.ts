import { describe, expect, it } from 'vitest'
import { computeManageDaySummary, crewNamesByGroup } from './dispatchManagePersonDay'

describe('crewNamesByGroup', () => {
  it('groups deduped names by group id in query order', () => {
    const map = crewNamesByGroup([
      { shared_block_group_id: 'g1', name: 'Abraham' },
      { shared_block_group_id: 'g1', name: 'Paige' },
      { shared_block_group_id: 'g2', name: 'Isiah' },
      { shared_block_group_id: 'g1', name: 'Abraham' },
    ])
    expect(map.get('g1')).toEqual(['Abraham', 'Paige'])
    expect(map.get('g2')).toEqual(['Isiah'])
  })

  it('drops ungrouped legs and blank names; all-blank groups have no entry', () => {
    const map = crewNamesByGroup([
      { shared_block_group_id: null, name: 'Solo' },
      { shared_block_group_id: 'g1', name: '   ' },
      { shared_block_group_id: 'g1', name: null },
    ])
    expect(map.size).toBe(0)
  })
})

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
