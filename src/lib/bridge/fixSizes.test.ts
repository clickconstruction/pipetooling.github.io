import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { buildFixSizes, type FixSizesInput } from './fixSizes'
import { buildThisWeek } from './thisWeek'

// Made-up numbers and names.
const input: FixSizesInput = {
  fieldEarnedPerHour: 72,
  contributionMargin: 0.7,
  overheadPerDayUsd: 1_150,
  bidsDue: [
    { id: 'b1', label: 'Ridgeway Builders, lot 9', bidValueUsd: 63_000, dueYmd: '2026-11-14' },
    { id: 'b2', label: 'Cedar Bend Dental', bidValueUsd: 18_000, dueYmd: '2026-11-16' },
    { id: 'b3', label: 'Oak Hollow HOA', bidValueUsd: 9_000, dueYmd: '2026-11-18' },
  ],
  dayLabel: (ymd) => `Nov ${Number(ymd.slice(8))}`,
}

describe('buildFixSizes', () => {
  it('sizes the two usual fixes the app can size, in dollars a day', () => {
    const f = buildFixSizes(input)
    expect(f.rows.fieldday).toEqual({ size: '+$58 a day', why: 'One more day a week, at $72 an hour earned.' })
    expect(f.rows.overhead).toEqual({ size: '+$115 a day', why: 'A tenth of $1,150 a day.' })
    // Hiring and more bids have no size: the app cannot read one.
    expect(f.rows.plumber).toBeUndefined()
    expect(f.rows.bids).toBeUndefined()
  })

  it('lists the first two bids due with their size and their door', () => {
    const f = buildFixSizes(input)
    expect(f.bids).toEqual([
      { id: 'b1', label: 'Ridgeway Builders, lot 9', sub: '$63k, due Nov 14', size: '+$735 a day', door: { to: '/bids', label: 'Bids' } },
      { id: 'b2', label: 'Cedar Bend Dental', sub: '$18k, due Nov 16', size: '+$210 a day', door: { to: '/bids', label: 'Bids' } },
    ])
    expect(f.bidsNote).toBe('A win is spread over 60 days of work.')
  })

  it('agrees with the sums This week made', () => {
    const moves = buildThisWeek({ unbilledUsd: 0, unbilledCount: 0, lateReceipts: { count: 0, usd: 0 }, pendingClosedHours: 0, pendingClosedSessions: 0, payrollWeeklyEstUsd: 0, noContractJobs: [], assumedHalfJobs: 0, assumedHalfEarnedUsd: 0, fieldEarnedPerHour: 72, contributionMargin: 0.7, overheadPerDayUsd: 1_150, bidsDue: input.bidsDue, dayLabel: input.dayLabel })
    const lever = (key: string): string | undefined => moves.find((m) => m.key === key)?.lever
    expect(lever('field_day')).toBe('+$58/day')
    expect(lever('overhead')).toBe('+$115/day')
    expect(lever('bid')).toBe('+$735/day over 60d')
  })

  it('leaves out what cannot be read', () => {
    const f = buildFixSizes({ ...input, fieldEarnedPerHour: null, contributionMargin: null, overheadPerDayUsd: 0, bidsDue: input.bidsDue.slice(0, 1) })
    expect(f.rows).toEqual({})
    expect(f.bids[0]?.size).toBeNull()
    expect(buildFixSizes({ ...input, bidsDue: [] }).bids).toEqual([])
  })

  it('writes plain words', () => {
    const f = buildFixSizes(input)
    for (const s of [f.rows.fieldday?.why ?? '', f.rows.overhead?.why ?? '', f.bidsNote, ...f.bids.map((b) => b.sub)]) expect(plainWordsFailures(s), s).toEqual([])
  })
})
