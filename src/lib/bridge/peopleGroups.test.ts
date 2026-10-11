import { describe, expect, it } from 'vitest'
import { groupPeopleRows, peopleGroupOf } from './peopleGroups'
import type { VectorRow } from './vectors'

const row = (p: Partial<VectorRow> & { userId: string; name: string }): VectorRow => ({
  role: null,
  fieldHours: 0,
  officeBidHours: 0,
  pendingHours: 0,
  earnedUsd: 0,
  laborUsd: 0,
  contributionUsd: null,
  contributionPerHour: null,
  pctReports: 0,
  billedCount: 0,
  billedUsd: 0,
  collectedCount: 0,
  collectedUsd: 0,
  bidsSentCount: 0,
  bidsSentUsd: 0,
  bidsWonCount: 0,
  bidsWonUsd: 0,
  unratedHours: 0,
  guessedEarnedUsd: 0,
  noWage: false,
  isSalary: false,
  empty: false,
  ...p,
})

describe('groupPeopleRows', () => {
  it('splits field from office by role, falling back to field hours', () => {
    expect(peopleGroupOf({ role: 'master_technician', fieldHours: 0, pendingHours: 0 })).toBe('field')
    expect(peopleGroupOf({ role: 'dev', fieldHours: 0, pendingHours: 0 })).toBe('office')
    expect(peopleGroupOf({ role: 'estimator', fieldHours: 0, pendingHours: 0 })).toBe('office')
    expect(peopleGroupOf({ role: null, fieldHours: 3, pendingHours: 0 })).toBe('field')
    expect(peopleGroupOf({ role: 'mystery', fieldHours: 0, pendingHours: 0 })).toBe('office')
  })
  it('sorts each group by contribution then waiting hours, and subtotals it', () => {
    const groups = groupPeopleRows([
      row({ userId: 'a', name: 'Abraham', role: 'superintendent', fieldHours: 40, earnedUsd: 5300, laborUsd: 1200, contributionUsd: 4100, contributionPerHour: 101, pctReports: 2 }),
      row({ userId: 'm', name: 'Malachi', role: 'master_technician', fieldHours: 40, pendingHours: 17, earnedUsd: 7900, laborUsd: 2300, contributionUsd: 5600, contributionPerHour: 141, pctReports: 6 }),
      row({ userId: 'p', name: 'Paige', role: 'helpers', pendingHours: 65 }),
      row({ userId: 't', name: 'Tristen', role: 'helpers', pendingHours: 57 }),
      row({ userId: 'ta', name: 'Taunya', role: 'assistant', pendingHours: 35, pctReports: 11, billedCount: 7, billedUsd: 22_600, collectedCount: 17, collectedUsd: 41_000 }),
      row({ userId: 'r', name: 'Robert', role: 'dev', pctReports: 2, collectedCount: 3, collectedUsd: 5500 }),
      row({ userId: 'w', name: 'Wendi', role: 'estimator', pendingHours: 14, bidsSentCount: 2 }),
    ])
    expect(groups.map((g) => [g.id, g.rows.map((r) => r.name)])).toEqual([
      ['field', ['Malachi', 'Abraham', 'Paige', 'Tristen']],
      ['office', ['Taunya', 'Wendi', 'Robert']],
    ])
    const f = groups[0]!
    expect(f.note).toBe('4 people · 80h approved, 139h waiting · all of the contribution')
    expect(f.subtotal).toMatchObject({ fieldHours: 80, pendingHours: 139, earnedUsd: 13_200, laborUsd: 3500, contributionUsd: 9700, pctReports: 8 })
    expect(f.subtotal.contributionPerHour).toBeCloseTo(121.25, 2)
    const o = groups[1]!
    expect(o.note).toBe('3 people, dev counts as office · 49h waiting · all of the billing, collecting and bids')
    expect(o.subtotal).toMatchObject({ contributionUsd: null, pctReports: 13, billedUsd: 22_600, billedCount: 7, collectedUsd: 46_500, collectedCount: 20, bidsSentCount: 2 })
  })
})
