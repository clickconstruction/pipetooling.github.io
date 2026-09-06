import { describe, expect, it } from 'vitest'
import { formatHrReportWhen, sortPendingReportsOldestFirst, summarizePendingReportAging } from './hrPendingReports'

describe('formatHrReportWhen', () => {
  it('separates when it happened from when it was written', () => {
    expect(formatHrReportWhen({ occurred_date: '2026-08-24', created_at: '2026-08-25T12:00:00Z', author_name: 'Malachi Whites' }))
      .toBe('happened Aug 24 · written by Malachi Whites, Aug 25')
  })
  it('omits the author when unknown', () => {
    expect(formatHrReportWhen({ occurred_date: '2026-08-01', created_at: '2026-08-01T09:00:00Z', author_name: '  ' }))
      .toBe('happened Aug 1 · written Aug 1')
  })
  it('passes odd dates through rather than inventing one', () => {
    expect(formatHrReportWhen({ occurred_date: 'unknown', created_at: '2026-12-31T00:00:00Z', author_name: 'R' }))
      .toBe('happened unknown · written by R, Dec 31')
  })
})

const NOW = Date.parse('2026-09-05T15:00:00Z')
const daysAgo = (n: number) => new Date(NOW - n * 86_400_000).toISOString()

describe('sortPendingReportsOldestFirst (journey-map #40)', () => {
  it('the report that has waited longest leads; input untouched', () => {
    const rows = [
      { id: 'b', created_at: daysAgo(2) },
      { id: 'c', created_at: daysAgo(11) },
      { id: 'a', created_at: daysAgo(0) },
    ]
    expect(sortPendingReportsOldestFirst(rows).map((r) => r.id)).toEqual(['c', 'b', 'a'])
    expect(rows.map((r) => r.id)).toEqual(['b', 'c', 'a'])
  })
})

describe('summarizePendingReportAging', () => {
  it('counts reports at or past the min age with the oldest named; null while the queue is young', () => {
    const rows = [{ created_at: daysAgo(11) }, { created_at: daysAgo(3) }, { created_at: daysAgo(1) }]
    expect(summarizePendingReportAging(rows, 3, NOW)).toEqual({ count: 2, total: 3, oldestAgeDays: 11 })
    expect(summarizePendingReportAging(rows, 12, NOW)).toBeNull()
    expect(summarizePendingReportAging([{ created_at: daysAgo(0) }], 3, NOW)).toBeNull()
    expect(summarizePendingReportAging([], 3, NOW)).toBeNull()
  })
  it('min age 0 is the plain "how old is the oldest" read used by the section header', () => {
    expect(summarizePendingReportAging([{ created_at: daysAgo(5) }, { created_at: null }], 0, NOW)).toEqual({ count: 1, total: 2, oldestAgeDays: 5 })
  })
})
