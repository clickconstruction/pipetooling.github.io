import { describe, expect, it } from 'vitest'
import {
  DEFAULT_UPCOMING_SORT,
  groupUpcomingPayrollByPerson,
  nextUpcomingSort,
  parseUpcomingSort,
  sortUpcomingGroups,
  toggleExcluded,
  upcomingTotals,
} from './upcomingPayrollGroups'
import type { UpcomingPayrollLine } from './upcomingPayrollSummary'

function line(personName: string, weekStartYmd: string, hours: number, gross: number): UpcomingPayrollLine {
  return { personName, weekStartYmd, weekEndYmd: weekStartYmd, hours, estimatedGrossDollars: gross }
}

// The summary emits people A → Z, weeks oldest first.
const LINES: UpcomingPayrollLine[] = [
  line('Abraham', '2026-08-23', 40, 1200),
  line('Abraham', '2026-08-30', 44.06, 1321.67),
  line('Malachi', '2026-08-16', 40, 2309.2),
  line('Malachi', '2026-08-23', 40, 2309.2),
  line('Malachi', '2026-08-30', 36.06, 2081.49),
  line('William', '2026-08-16', 0.19, 4.74),
  line('William', '2026-08-23', 0.11, 2.72),
]

describe('groupUpcomingPayrollByPerson', () => {
  it('folds each person into one group with subtotals and keeps their weeks in order', () => {
    const groups = groupUpcomingPayrollByPerson(LINES)
    expect(groups.map((g) => g.personName)).toEqual(['Abraham', 'Malachi', 'William'])
    const malachi = groups[1]
    expect(malachi?.weekCount).toBe(3)
    expect(malachi?.hours).toBeCloseTo(116.06)
    expect(malachi?.estimatedGrossDollars).toBeCloseTo(6699.89)
    expect(malachi?.lines.map((l) => l.weekStartYmd)).toEqual(['2026-08-16', '2026-08-23', '2026-08-30'])
  })

  it('returns no groups for no lines', () => {
    expect(groupUpcomingPayrollByPerson([])).toEqual([])
  })
})

describe('sortUpcomingGroups', () => {
  const groups = groupUpcomingPayrollByPerson(LINES)

  it('orders people by amount, biggest first, without touching the input', () => {
    const sorted = sortUpcomingGroups(groups, { key: 'gross', dir: -1 })
    expect(sorted.map((g) => g.personName)).toEqual(['Malachi', 'Abraham', 'William'])
    expect(groups.map((g) => g.personName)).toEqual(['Abraham', 'Malachi', 'William'])
  })

  it('orders by hours and by name in either direction', () => {
    expect(sortUpcomingGroups(groups, { key: 'hours', dir: 1 }).map((g) => g.personName)).toEqual(['William', 'Abraham', 'Malachi'])
    expect(sortUpcomingGroups(groups, { key: 'name', dir: -1 }).map((g) => g.personName)).toEqual(['William', 'Malachi', 'Abraham'])
  })

  it('breaks amount ties by name so the order is stable', () => {
    const tied = groupUpcomingPayrollByPerson([line('Zed', '2026-08-23', 1, 10), line('Amy', '2026-08-23', 1, 10)])
    expect(sortUpcomingGroups(tied, { key: 'gross', dir: -1 }).map((g) => g.personName)).toEqual(['Zed', 'Amy'])
    expect(sortUpcomingGroups(tied, { key: 'gross', dir: 1 }).map((g) => g.personName)).toEqual(['Amy', 'Zed'])
  })
})

describe('nextUpcomingSort', () => {
  it('gives a new key its natural direction and flips the same key', () => {
    expect(nextUpcomingSort(DEFAULT_UPCOMING_SORT, 'gross')).toEqual({ key: 'gross', dir: -1 })
    expect(nextUpcomingSort({ key: 'gross', dir: -1 }, 'gross')).toEqual({ key: 'gross', dir: 1 })
    expect(nextUpcomingSort({ key: 'gross', dir: -1 }, 'name')).toEqual({ key: 'name', dir: 1 })
    expect(nextUpcomingSort({ key: 'name', dir: 1 }, 'name')).toEqual({ key: 'name', dir: -1 })
  })
})

describe('upcomingTotals + toggleExcluded', () => {
  const groups = groupUpcomingPayrollByPerson(LINES)

  it('with nobody excluded, totals match the summary', () => {
    const t = upcomingTotals(groups, new Set())
    expect(t).toMatchObject({ totalPeople: 3, includedPeople: 3, excludedPeople: 0, personWeeks: 7, excludedGrossDollars: 0 })
    expect(t.hours).toBeCloseTo(200.42)
    expect(t.estimatedGrossDollars).toBeCloseTo(9229.02)
  })

  it('excluding a person drops their weeks, hours and dollars and names what left', () => {
    const excluded = toggleExcluded(new Set(), 'Malachi')
    const t = upcomingTotals(groups, excluded)
    expect(t).toMatchObject({ includedPeople: 2, excludedPeople: 1, personWeeks: 4 })
    expect(t.estimatedGrossDollars).toBeCloseTo(2529.13)
    expect(t.excludedGrossDollars).toBeCloseTo(6699.89)
  })

  it('toggling twice puts the person back and never mutates the input set', () => {
    const start = new Set<string>()
    const once = toggleExcluded(start, 'William')
    const twice = toggleExcluded(once, 'William')
    expect(start.size).toBe(0)
    expect(once.has('William')).toBe(true)
    expect(twice.has('William')).toBe(false)
  })
})

describe('parseUpcomingSort', () => {
  it('accepts a well-formed persisted sort and rejects everything else', () => {
    expect(parseUpcomingSort(JSON.stringify({ key: 'gross', dir: -1 }))).toEqual({ key: 'gross', dir: -1 })
    expect(parseUpcomingSort(null)).toEqual(DEFAULT_UPCOMING_SORT)
    expect(parseUpcomingSort('not json')).toEqual(DEFAULT_UPCOMING_SORT)
    expect(parseUpcomingSort(JSON.stringify({ key: 'wage', dir: -1 }))).toEqual(DEFAULT_UPCOMING_SORT)
    expect(parseUpcomingSort(JSON.stringify({ key: 'hours', dir: 0 }))).toEqual(DEFAULT_UPCOMING_SORT)
  })
})
