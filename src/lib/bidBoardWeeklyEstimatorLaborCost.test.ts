import { describe, expect, it } from 'vitest'
import type { BidBoardWeekEstimatorRow } from './bidBoardWeeklySentStats'
import { buildBidBoardWeeklySentPivot, type BidBoardWeekSentSummary } from './bidBoardWeeklySentStats'
import {
  aggregateClockHoursByUserAndWeek,
  BID_BOARD_ESTIMATOR_UNASSIGNED_KEY,
  buildBidBoardWeeklyLaborCostMatrix,
  buildHourlyWageLookupByNormalizedName,
  formatLaborCentsPerDollarSent,
  hourlyWageForUserName,
  payConfigLookupKey,
  type ClockSessionRowForLaborCost,
} from './bidBoardWeeklyEstimatorLaborCost'

function weekSummary(estimatorRows: BidBoardWeekEstimatorRow[], weekStart = '2026-05-31'): BidBoardWeekSentSummary {
  return {
    weekStart,
    weekEnd: '2026-06-06',
    won: 0,
    lost: 0,
    haventHeardBack: 0,
    estimatorRows,
  }
}

describe('payConfigLookupKey / buildHourlyWageLookupByNormalizedName', () => {
  it('trims and lowercases keys', () => {
    expect(payConfigLookupKey('  Jane Doe  ')).toBe('jane doe')
    const m = buildHourlyWageLookupByNormalizedName([{ person_name: 'Jane DOE ', hourly_wage: 42 }])
    expect(m.get('jane doe')).toBe(42)
  })

  it('hourlyWageForUserName returns null when unknown', () => {
    const empty = buildHourlyWageLookupByNormalizedName([])
    expect(hourlyWageForUserName('', empty)).toBe(null)
    expect(hourlyWageForUserName('Bob', empty)).toBe(null)
    expect(
      hourlyWageForUserName('Bob', buildHourlyWageLookupByNormalizedName([{ person_name: 'Bob', hourly_wage: null }])),
    ).toBe(null)
  })

  it('hourlyWageForUserName returns number when matched', () => {
    const m = buildHourlyWageLookupByNormalizedName([{ person_name: 'Carl', hourly_wage: 50 }])
    expect(hourlyWageForUserName('Carl', m)).toBe(50)
  })
})

describe('aggregateClockHoursByUserAndWeek', () => {
  const FIXED_NOW = Date.parse('2026-06-05T17:00:00.000Z')

  function sess(
    o: Partial<ClockSessionRowForLaborCost> & Pick<ClockSessionRowForLaborCost, 'user_id' | 'work_date' | 'clocked_in_at'>,
  ): ClockSessionRowForLaborCost {
    return {
      clocked_out_at: null,
      rejected_at: null,
      revoked_at: null,
      ...o,
    }
  }

  it('sums hours into user:weekStart keys using work_date bucket', () => {
    const u1 = 'user-aaa'
    // 2026-05-31 is Sunday Chicago week containing 2026-06-02
    const m = aggregateClockHoursByUserAndWeek(
      [
        sess({
          user_id: u1,
          work_date: '2026-06-02',
          clocked_in_at: '2026-06-02T14:00:00.000Z',
          clocked_out_at: '2026-06-02T16:00:00.000Z',
        }),
      ],
      FIXED_NOW,
    )
    expect(m.get(`${u1}:2026-05-31`)).toBe(2)
  })

  it('skips rejected and revoked sessions', () => {
    const u1 = 'user-bbb'
    const base = sess({
      user_id: u1,
      work_date: '2026-06-02',
      clocked_in_at: '2026-06-02T10:00:00.000Z',
      clocked_out_at: '2026-06-02T12:00:00.000Z',
    })
    const m = aggregateClockHoursByUserAndWeek(
      [{ ...base, rejected_at: '2026-06-03T01:00:00.000Z' }, { ...base, revoked_at: '2026-06-03T01:00:00.000Z' }],
      FIXED_NOW,
    )
    expect(m.size).toBe(0)
  })

  it('uses now for open sessions', () => {
    const u1 = 'user-ccc'
    const clockInMs = FIXED_NOW - 3600000
    const out = aggregateClockHoursByUserAndWeek(
      [
        sess({
          user_id: u1,
          work_date: '2026-06-02',
          clocked_in_at: new Date(clockInMs).toISOString(),
          clocked_out_at: null,
        }),
      ],
      FIXED_NOW,
    )
    expect(out.get(`${u1}:2026-05-31`)).toBeCloseTo(1, 5)
  })
})

describe('buildBidBoardWeeklyLaborCostMatrix', () => {
  const uid = 'est-1'
  const weeks: BidBoardWeekSentSummary[] = [
    weekSummary([
      {
        estimatorKey: uid,
        displayName: 'Ada',
        sentCount: 2,
        sentDollars: 1000,
        bidIds: ['a', 'b'],
      },
    ]),
  ]
  const pivot = buildBidBoardWeeklySentPivot(weeks)

  it('computes cost per estimate and cents per dollar', () => {
    const hoursMap = new Map<string, number>([[`${uid}:2026-05-31`, 4]])
    const wageMap = new Map<string, number | null>([[uid, 25]])
    const matrix = buildBidBoardWeeklyLaborCostMatrix({ pivot, hoursByUserWeek: hoursMap, wageByUserId: wageMap })
    const cell = matrix.get(`${uid}::2026-05-31`)
    expect(cell?.costPerEstimateDollars).toBeCloseTo((4 * 25) / 2, 5)
    expect(cell?.laborCentsPerDollarSent).toBeCloseTo((100 / 1000) * 100, 5)
  })

  it('nulls divisors when sentCount or sentDollars zero', () => {
    const w2 = weekSummary(
      [{ estimatorKey: uid, displayName: 'Ada', sentCount: 0, sentDollars: 0, bidIds: [] }],
      '2026-05-31',
    )
    const p = buildBidBoardWeeklySentPivot([w2])
    const matrix = buildBidBoardWeeklyLaborCostMatrix({
      pivot: p,
      hoursByUserWeek: new Map([[`${uid}:2026-05-31`, 10]]),
      wageByUserId: new Map([[uid, 10]]),
    })
    const cell = matrix.get(`${uid}::2026-05-31`)
    expect(cell?.costPerEstimateDollars).toBe(null)
    expect(cell?.laborCentsPerDollarSent).toBe(null)
  })

  it('null when wage missing', () => {
    const matrix = buildBidBoardWeeklyLaborCostMatrix({
      pivot,
      hoursByUserWeek: new Map([[`${uid}:2026-05-31`, 4]]),
      wageByUserId: new Map([[uid, null]]),
    })
    expect(matrix.get(`${uid}::2026-05-31`)).toEqual({
      costPerEstimateDollars: null,
      laborCentsPerDollarSent: null,
    })
  })

  it('allows zero hourly wage', () => {
    const matrix = buildBidBoardWeeklyLaborCostMatrix({
      pivot,
      hoursByUserWeek: new Map([[`${uid}:2026-05-31`, 4]]),
      wageByUserId: new Map([[uid, 0]]),
    })
    expect(matrix.get(`${uid}::2026-05-31`)).toEqual({
      costPerEstimateDollars: 0,
      laborCentsPerDollarSent: 0,
    })
  })

  it('skips unassigned estimator pivot row', () => {
    const w = weekSummary([
      {
        estimatorKey: BID_BOARD_ESTIMATOR_UNASSIGNED_KEY,
        displayName: 'Unassigned',
        sentCount: 1,
        sentDollars: 100,
        bidIds: ['x'],
      },
    ])
    const p = buildBidBoardWeeklySentPivot([w])
    const matrix = buildBidBoardWeeklyLaborCostMatrix({
      pivot: p,
      hoursByUserWeek: new Map(),
      wageByUserId: new Map(),
    })
    expect(matrix.size).toBe(0)
  })
})

describe('formatLaborCentsPerDollarSent', () => {
  it('formats finite values', () => {
    expect(formatLaborCentsPerDollarSent(12.345)).toBe('12.3¢/$')
  })
})
