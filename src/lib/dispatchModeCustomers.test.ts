import { describe, expect, it } from 'vitest'
import {
  customerLastInteractionLabel,
  daysSinceYmd,
  sortDispatchModeCustomers,
  type DispatchModeCustomerListRow,
} from './dispatchModeCustomers'

const TODAY = '2026-07-22'

const R = (
  name: string,
  lastWorkYmd: string | null,
  jobCount = 1,
  nextScheduledYmd: string | null = null,
): DispatchModeCustomerListRow => ({
  id: name,
  name,
  address: null,
  jobCount,
  lastWorkYmd,
  nextScheduledYmd,
})

describe('daysSinceYmd / customerLastInteractionLabel', () => {
  it('labels today, day counts, and never-worked', () => {
    expect(daysSinceYmd('2026-07-22', TODAY)).toBe(0)
    expect(daysSinceYmd('2026-07-17', TODAY)).toBe(5)
    expect(customerLastInteractionLabel('2026-07-22', TODAY)).toBe('today')
    expect(customerLastInteractionLabel('2026-07-21', TODAY)).toBe('1d ago')
    expect(customerLastInteractionLabel('2026-06-22', TODAY)).toBe('30d ago')
    expect(customerLastInteractionLabel(null, TODAY)).toBeNull()
  })

  it('an upcoming scheduled job supersedes past work', () => {
    expect(customerLastInteractionLabel('2026-07-01', TODAY, '2026-07-23')).toBe('in 1d')
    expect(customerLastInteractionLabel(null, TODAY, '2026-07-27')).toBe('in 5d')
    expect(customerLastInteractionLabel('2026-07-01', TODAY, '2026-07-22')).toBe('today')
  })

  it('clamps future dates to today (clock skew safety)', () => {
    expect(daysSinceYmd('2026-07-23', TODAY)).toBe(0)
  })
})

describe('sortDispatchModeCustomers', () => {
  const rows = [R('Charlie', '2026-07-01'), R('Alice', null), R('Bob', '2026-07-20'), R('Dana', '2026-07-20')]

  it('name sort is alphabetical', () => {
    expect(sortDispatchModeCustomers(rows, 'name').map((r) => r.name)).toEqual([
      'Alice',
      'Bob',
      'Charlie',
      'Dana',
    ])
  })

  it('interacted sort: newest first, ties alphabetical, never-worked last', () => {
    expect(sortDispatchModeCustomers(rows, 'interacted').map((r) => r.name)).toEqual([
      'Bob',
      'Dana',
      'Charlie',
      'Alice',
    ])
  })

  it('interacted sort: scheduled customers rank first, farthest future highest', () => {
    const mixed = [
      R('PastOnly', '2026-07-21'),
      R('SoonSched', '2026-07-01', 1, '2026-07-23'),
      R('FarSched', null, 1, '2026-07-30'),
      R('Never', null),
    ]
    expect(sortDispatchModeCustomers(mixed, 'interacted').map((r) => r.name)).toEqual([
      'FarSched',
      'SoonSched',
      'PastOnly',
      'Never',
    ])
  })

  it('does not mutate the input', () => {
    const input = [...rows]
    sortDispatchModeCustomers(input, 'interacted')
    expect(input.map((r) => r.name)).toEqual(rows.map((r) => r.name))
  })
})
