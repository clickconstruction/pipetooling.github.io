import { describe, expect, it } from 'vitest'
import {
  aggregateLostBidLaborUsd,
  getLaborUsdForBid,
  isLostSummarySessionIncluded,
  type LostBidSessionRow,
} from './bidLostSummaryLabor'
import { buildHourlyWageLookupByNormalizedName } from './bidBoardWeeklyEstimatorLaborCost'

const baseSession = (overrides: Partial<LostBidSessionRow>): LostBidSessionRow => ({
  bid_id: 'bid-1',
  user_id: 'user-1',
  clocked_in_at: '2026-01-01T08:00:00.000Z',
  clocked_out_at: '2026-01-01T10:00:00.000Z',
  approved_at: '2026-01-01T12:00:00.000Z',
  rejected_at: null,
  revoked_at: null,
  ...overrides,
})

describe('isLostSummarySessionIncluded', () => {
  it('includes approved and closed, not rejected/revoked', () => {
    expect(isLostSummarySessionIncluded(baseSession({}))).toBe(true)
    expect(isLostSummarySessionIncluded(baseSession({ approved_at: null }))).toBe(false)
    expect(isLostSummarySessionIncluded(baseSession({ clocked_out_at: null }))).toBe(false)
    expect(isLostSummarySessionIncluded(baseSession({ rejected_at: '2026-01-01' }))).toBe(false)
    expect(isLostSummarySessionIncluded(baseSession({ revoked_at: '2026-01-01' }))).toBe(false)
  })
})

describe('aggregateLostBidLaborUsd', () => {
  it('returns 0 laborUsd when no sessions', () => {
    const m = aggregateLostBidLaborUsd({
      sessions: [],
      userIdToDisplayName: new Map([['user-1', 'Alice']]),
      wageByNormalizedName: buildHourlyWageLookupByNormalizedName([{ person_name: 'Alice', hourly_wage: 50 }]),
    })
    expect(m.size).toBe(0)
    expect(getLaborUsdForBid(m, 'bid-x').laborUsd).toBe(0)
  })

  it('sums hours × wage for one user', () => {
    const m = aggregateLostBidLaborUsd({
      sessions: [
        baseSession({
          bid_id: 'b1',
          user_id: 'u1',
          clocked_in_at: '2026-01-01T08:00:00.000Z',
          clocked_out_at: '2026-01-01T10:00:00.000Z',
        }),
      ],
      userIdToDisplayName: new Map([['u1', 'Alice']]),
      wageByNormalizedName: buildHourlyWageLookupByNormalizedName([{ person_name: 'Alice', hourly_wage: 25 }]),
    })
    expect(m.get('b1')?.laborUsd).toBe(50)
  })

  it('returns null when any session has missing wage', () => {
    const m = aggregateLostBidLaborUsd({
      sessions: [
        baseSession({ bid_id: 'b1', user_id: 'u1' }),
        baseSession({ bid_id: 'b1', user_id: 'u2', clocked_out_at: '2026-01-01T11:00:00.000Z' }),
      ],
      userIdToDisplayName: new Map([
        ['u1', 'Alice'],
        ['u2', 'Nobody'],
      ]),
      wageByNormalizedName: buildHourlyWageLookupByNormalizedName([{ person_name: 'Alice', hourly_wage: 25 }]),
    })
    expect(m.get('b1')?.laborUsd).toBe(null)
  })
})
