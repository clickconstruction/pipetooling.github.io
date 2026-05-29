import { describe, expect, it } from 'vitest'
import type { BidWithBuilder } from '../../types/bidWithBuilder'
import {
  computeBidBoardStaffOutcomeStatsByRole,
  staffOutcomeWonPctDisplay,
  sortStaffOutcomeDrilldownBids,
  filterBidsForStaffOutcomeDrilldown,
  staffOutcomeDrilldownMetricLabel,
  staffOutcomeDrilldownRolePhrase,
} from './bidBoardStaffOutcomes'

type BidLike = {
  id: string
  project_name?: string | null
  outcome?: string | null
  bid_date_sent?: string | null
  estimator_id?: string | null
  account_manager_id?: string | null
  estimator?: { name?: string | null; email?: string | null } | null
  account_manager?: { name?: string | null; email?: string | null } | null
}

function bid(b: BidLike): BidWithBuilder {
  return {
    project_name: null,
    outcome: null,
    bid_date_sent: null,
    estimator_id: null,
    account_manager_id: null,
    estimator: null,
    account_manager: null,
    ...b,
  } as unknown as BidWithBuilder
}

describe('computeBidBoardStaffOutcomeStatsByRole', () => {
  it('tallies won (incl. started_or_complete), lost, and pending per estimator above the min-bids threshold', () => {
    const bids = [
      bid({ id: '1', estimator_id: 'e1', estimator: { name: 'Alice' }, outcome: 'won', bid_date_sent: '2026-01-01' }),
      bid({ id: '2', estimator_id: 'e1', estimator: { name: 'Alice' }, outcome: 'lost', bid_date_sent: '2026-01-02' }),
      bid({ id: '3', estimator_id: 'e1', estimator: { name: 'Alice' }, outcome: null, bid_date_sent: '2026-01-03' }),
      bid({ id: '4', estimator_id: 'e1', estimator: { name: 'Alice' }, outcome: 'started_or_complete', bid_date_sent: '2026-01-04' }),
    ]
    const stats = computeBidBoardStaffOutcomeStatsByRole(bids)
    expect(stats.estimatorsHadAnyAssignment).toBe(true)
    expect(stats.estimators).toHaveLength(1)
    expect(stats.estimators[0]).toMatchObject({ userId: 'e1', displayName: 'Alice', won: 2, lost: 1, notYetWonOrLost: 1 })
  })

  it('excludes staff below the minimum bid count', () => {
    const bids = [
      bid({ id: '1', estimator_id: 'e2', estimator: { name: 'Bob' }, outcome: 'won' }),
      bid({ id: '2', estimator_id: 'e2', estimator: { name: 'Bob' }, outcome: 'lost' }),
    ]
    const stats = computeBidBoardStaffOutcomeStatsByRole(bids)
    expect(stats.estimators).toHaveLength(0)
    expect(stats.estimatorsHadAnyAssignment).toBe(true)
  })

  it('does not count an unsent pending bid as notYetWonOrLost', () => {
    const bids = [
      bid({ id: '1', estimator_id: 'e1', estimator: { name: 'Alice' }, outcome: null, bid_date_sent: null }),
      bid({ id: '2', estimator_id: 'e1', estimator: { name: 'Alice' }, outcome: 'won', bid_date_sent: '2026-01-01' }),
      bid({ id: '3', estimator_id: 'e1', estimator: { name: 'Alice' }, outcome: 'lost', bid_date_sent: '2026-01-02' }),
    ]
    const stats = computeBidBoardStaffOutcomeStatsByRole(bids)
    expect(stats.estimators[0]).toMatchObject({ won: 1, lost: 1, notYetWonOrLost: 0 })
  })
})

describe('staffOutcomeWonPctDisplay', () => {
  it('computes won percent over decided bids', () => {
    expect(staffOutcomeWonPctDisplay({ userId: 'x', displayName: 'X', notYetWonOrLost: 2, won: 3, lost: 1 })).toEqual({
      decided: 4,
      pct: 75,
    })
  })

  it('returns null pct when no decided bids', () => {
    expect(staffOutcomeWonPctDisplay({ userId: 'x', displayName: 'X', notYetWonOrLost: 5, won: 0, lost: 0 })).toEqual({
      decided: 0,
      pct: null,
    })
  })
})

describe('filterBidsForStaffOutcomeDrilldown', () => {
  const bids = [
    bid({ id: '1', estimator_id: 'e1', outcome: 'won', bid_date_sent: '2026-01-01' }),
    bid({ id: '2', estimator_id: 'e1', outcome: 'lost', bid_date_sent: '2026-01-02' }),
    bid({ id: '3', estimator_id: 'e1', outcome: null, bid_date_sent: '2026-01-03' }),
    bid({ id: '4', estimator_id: 'e2', outcome: 'won', bid_date_sent: '2026-01-04' }),
    bid({ id: '5', account_manager_id: 'e1', outcome: 'won', bid_date_sent: '2026-01-05' }),
  ]

  it('filters sent bids for an estimator', () => {
    const r = filterBidsForStaffOutcomeDrilldown(bids, { userId: 'e1', role: 'estimator', metric: 'sent' })
    expect(r.map((b) => b.id)).toEqual(['1', '2', '3'])
  })

  it('filters won bids for an estimator', () => {
    const r = filterBidsForStaffOutcomeDrilldown(bids, { userId: 'e1', role: 'estimator', metric: 'won' })
    expect(r.map((b) => b.id)).toEqual(['1'])
  })

  it('filters by account manager role', () => {
    const r = filterBidsForStaffOutcomeDrilldown(bids, { userId: 'e1', role: 'account_manager', metric: 'won' })
    expect(r.map((b) => b.id)).toEqual(['5'])
  })
})

describe('sortStaffOutcomeDrilldownBids', () => {
  it('sorts by project name (case-insensitive) then id', () => {
    const bids = [
      bid({ id: 'b', project_name: 'Zeta' }),
      bid({ id: 'a', project_name: 'alpha' }),
      bid({ id: 'c', project_name: 'alpha' }),
    ]
    expect(sortStaffOutcomeDrilldownBids(bids).map((b) => b.id)).toEqual(['a', 'c', 'b'])
  })
})

describe('drilldown labels', () => {
  it('maps metric to a human label', () => {
    expect(staffOutcomeDrilldownMetricLabel('sent')).toBe('Sent')
    expect(staffOutcomeDrilldownMetricLabel('notYetWonOrLost')).toBe('Not yet won or lost')
    expect(staffOutcomeDrilldownMetricLabel('won')).toBe('Won')
    expect(staffOutcomeDrilldownMetricLabel('lost')).toBe('Lost')
  })

  it('maps role to a phrase', () => {
    expect(staffOutcomeDrilldownRolePhrase('estimator')).toBe('estimator')
    expect(staffOutcomeDrilldownRolePhrase('account_manager')).toBe('account manager')
  })
})
