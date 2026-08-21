import { describe, expect, it } from 'vitest'

import {
  PENDING_CHASE_STALE_CONTACT_DAYS,
  bidNeedsChase,
  bidSentWithinWindow,
  buildPendingChaseRollup,
  groupPendingChaseByBuilder,
  nextPendingChaseBidIndex,
  pendingChaseDaysBetween,
  type PendingChaseBid,
} from './bidPendingChase'

const NOW = '2026-08-21T18:00:00.000Z'

function bid(over: Partial<PendingChaseBid> & Pick<PendingChaseBid, 'id'>): PendingChaseBid {
  return {
    builderKey: 'gc-1',
    builderName: 'Structura',
    value: 100_000,
    sentIso: '2026-08-10',
    lastContactIso: null,
    ...over,
  }
}

describe('pendingChaseDaysBetween', () => {
  it('counts whole days and tolerates bad input', () => {
    expect(pendingChaseDaysBetween('2026-08-10', NOW)).toBe(11)
    expect(pendingChaseDaysBetween(NOW, NOW)).toBe(0)
    expect(pendingChaseDaysBetween('garbage', NOW)).toBe(0)
  })
})

describe('bidSentWithinWindow', () => {
  it('filters by sent age; null window admits everything', () => {
    expect(bidSentWithinWindow({ sentIso: '2026-08-10' }, 30, NOW)).toBe(true)
    expect(bidSentWithinWindow({ sentIso: '2026-05-01' }, 60, NOW)).toBe(false)
    expect(bidSentWithinWindow({ sentIso: '2025-01-01' }, null, NOW)).toBe(true)
  })
})

describe('bidNeedsChase', () => {
  it('never contacted → needs chase', () => {
    expect(bidNeedsChase({ sentIso: '2026-08-10', lastContactIso: null }, NOW)).toBe(true)
  })

  it('contact BEFORE the sent date does not count as chasing the sent bid', () => {
    expect(bidNeedsChase({ sentIso: '2026-08-10', lastContactIso: '2026-08-01T12:00:00Z' }, NOW)).toBe(true)
  })

  it('fresh contact after sending clears it; stale contact re-queues it', () => {
    expect(bidNeedsChase({ sentIso: '2026-08-10', lastContactIso: '2026-08-18T12:00:00Z' }, NOW)).toBe(false)
    expect(bidNeedsChase({ sentIso: '2026-06-01', lastContactIso: '2026-07-01T12:00:00Z' }, NOW)).toBe(true)
  })

  it('respects a custom staleness threshold', () => {
    const b = { sentIso: '2026-08-01', lastContactIso: '2026-08-11T12:00:00Z' }
    expect(bidNeedsChase(b, NOW, PENDING_CHASE_STALE_CONTACT_DAYS)).toBe(true)
    expect(bidNeedsChase(b, NOW, 30)).toBe(false)
  })
})

describe('groupPendingChaseByBuilder', () => {
  it('groups by builderKey and counts needs-chase bids and value', () => {
    const groups = groupPendingChaseByBuilder(
      [
        bid({ id: 'a', value: 50_000 }),
        bid({ id: 'b', value: 25_000, lastContactIso: '2026-08-20T12:00:00Z' }),
        bid({ id: 'c', builderKey: 'gc-2', builderName: 'Joeris', value: 10_000 }),
      ],
      NOW,
    )
    expect(groups).toHaveLength(2)
    const structura = groups.find((g) => g.builderKey === 'gc-1')!
    expect(structura.needsCount).toBe(1)
    expect(structura.needsValue).toBe(50_000)
  })

  it('ranks builders with chases first, most recently sent first', () => {
    const groups = groupPendingChaseByBuilder(
      [
        bid({ id: 'old', builderKey: 'gc-old', builderName: 'Old Sender', sentIso: '2026-07-01' }),
        bid({ id: 'new', builderKey: 'gc-new', builderName: 'New Sender', sentIso: '2026-08-19' }),
        bid({ id: 'done', builderKey: 'gc-done', builderName: 'All Chased', sentIso: '2026-08-20', lastContactIso: '2026-08-21T00:00:00Z' }),
      ],
      NOW,
    )
    expect(groups.map((g) => g.builderKey)).toEqual(['gc-new', 'gc-old', 'gc-done'])
  })

  it('sorts bids inside a group newest sent first', () => {
    const groups = groupPendingChaseByBuilder(
      [bid({ id: 'a', sentIso: '2026-08-01' }), bid({ id: 'b', sentIso: '2026-08-15' })],
      NOW,
    )
    expect(groups[0]!.bids.map((b) => b.id)).toEqual(['b', 'a'])
  })

  it('breaks fully-chased ties alphabetically', () => {
    const chased = { lastContactIso: '2026-08-21T00:00:00Z', sentIso: '2026-08-20' }
    const groups = groupPendingChaseByBuilder(
      [
        bid({ id: 'z', builderKey: 'z', builderName: 'Zeta Builders', ...chased }),
        bid({ id: 'a', builderKey: 'a', builderName: 'Acme GC', ...chased }),
      ],
      NOW,
    )
    expect(groups.map((g) => g.builderName)).toEqual(['Acme GC', 'Zeta Builders'])
  })
})

describe('nextPendingChaseBidIndex', () => {
  const group = {
    bids: [
      bid({ id: 'a', lastContactIso: '2026-08-20T12:00:00Z' }),
      bid({ id: 'b' }),
      bid({ id: 'c' }),
    ],
  }

  it('finds the next needs-chase bid after the given index', () => {
    expect(nextPendingChaseBidIndex(group, 1, NOW)).toBe(2)
  })

  it('wraps to the first needs-chase bid', () => {
    expect(nextPendingChaseBidIndex(group, 2, NOW)).toBe(1)
  })

  it('returns null when the group is fully chased', () => {
    const done = { bids: [bid({ id: 'a', lastContactIso: '2026-08-21T00:00:00Z' })] }
    expect(nextPendingChaseBidIndex(done, 0, NOW)).toBeNull()
  })
})

describe('buildPendingChaseRollup', () => {
  it('totals pending, needs-chase, and untouched-since-send buckets', () => {
    const rollup = buildPendingChaseRollup(
      [
        bid({ id: 'untouched', value: 40_000, sentIso: '2026-08-01' }),
        bid({ id: 'stale', value: 30_000, sentIso: '2026-06-01', lastContactIso: '2026-07-01T00:00:00Z' }),
        bid({ id: 'fresh', value: 20_000, lastContactIso: '2026-08-20T00:00:00Z' }),
      ],
      NOW,
    )
    expect(rollup.pendingCount).toBe(3)
    expect(rollup.pendingValue).toBe(90_000)
    expect(rollup.needsCount).toBe(2)
    expect(rollup.needsValue).toBe(70_000)
    expect(rollup.untouchedCount).toBe(1)
    expect(rollup.untouchedValue).toBe(40_000)
    expect(rollup.oldestUntouchedDays).toBe(20)
  })

  it('handles the empty queue', () => {
    const rollup = buildPendingChaseRollup([], NOW)
    expect(rollup.pendingCount).toBe(0)
    expect(rollup.oldestUntouchedDays).toBeNull()
  })

  it('treats non-finite values as zero dollars', () => {
    const rollup = buildPendingChaseRollup([bid({ id: 'nan', value: Number.NaN })], NOW)
    expect(rollup.pendingValue).toBe(0)
    expect(rollup.needsCount).toBe(1)
  })
})
