import { describe, expect, it } from 'vitest'

import {
  bidNeedsReason,
  bidTabGettable,
  buildCallQueue,
  classifyCallQueueOutcome,
  type CallQueueBid,
} from './callQueue'

const NOW = '2026-08-22T18:00:00.000Z'

let seq = 0
function bid(over: Partial<CallQueueBid>): CallQueueBid {
  seq += 1
  return {
    id: `b${seq}`,
    builderKey: 'gc-knight',
    builderName: 'Knight',
    phone: '6025550000',
    value: 100_000,
    outcome: 'pending',
    sentIso: '2026-08-01',
    lastContactIso: null,
    lossCategory: null,
    hasTab: false,
    ...over,
  }
}

describe('classifyCallQueueOutcome', () => {
  it('maps outcomes; unsent = no sent date and no outcome', () => {
    expect(classifyCallQueueOutcome({ outcome: 'won', bid_date_sent: null })).toBe('won')
    expect(classifyCallQueueOutcome({ outcome: 'started_or_complete', bid_date_sent: '2026-08-01' })).toBe('won')
    expect(classifyCallQueueOutcome({ outcome: 'lost', bid_date_sent: '2026-08-01' })).toBe('lost')
    expect(classifyCallQueueOutcome({ outcome: null, bid_date_sent: '2026-08-01' })).toBe('pending')
    expect(classifyCallQueueOutcome({ outcome: null, bid_date_sent: null })).toBe('unsent')
  })
})

describe('bidNeedsReason / bidTabGettable', () => {
  it('lost without a structured category needs a reason', () => {
    expect(bidNeedsReason(bid({ outcome: 'lost', lossCategory: null }))).toBe(true)
    expect(bidNeedsReason(bid({ outcome: 'lost', lossCategory: 'price' }))).toBe(false)
    expect(bidNeedsReason(bid({ outcome: 'pending' }))).toBe(false)
  })

  it('tabs: any lost bid without one; pending only after the waiting period', () => {
    expect(bidTabGettable(bid({ outcome: 'lost' }), NOW)).toBe(true)
    expect(bidTabGettable(bid({ outcome: 'lost', hasTab: true }), NOW)).toBe(false)
    expect(bidTabGettable(bid({ outcome: 'pending', sentIso: '2026-07-01' }), NOW)).toBe(true)
    expect(bidTabGettable(bid({ outcome: 'pending', sentIso: '2026-08-18' }), NOW)).toBe(false)
    expect(bidTabGettable(bid({ outcome: 'won' }), NOW)).toBe(false)
  })
})

describe('buildCallQueue', () => {
  it('computes the collect list, done counts, and totals', () => {
    const rows = [
      // Knight: 2 pending (1 fresh, 1 quiet), 1 lost-no-reason, 1 lost-with-reason+tab, 1 won
      bid({ outcome: 'pending', sentIso: '2026-08-10', lastContactIso: '2026-08-21T10:00:00Z' }), // fresh, too new for a tab
      bid({ outcome: 'pending', sentIso: '2026-07-15', lastContactIso: '2026-08-01T10:00:00Z', value: 250_000 }), // quiet 21d + tab gettable
      bid({ outcome: 'lost', value: 300_000 }), // needs reason + tab gettable
      bid({ outcome: 'lost', lossCategory: 'price', hasTab: true }),
      bid({ outcome: 'won' }),
      // Structura: everything handled
      bid({ builderKey: 'gc-str', builderName: 'Structura', outcome: 'lost', lossCategory: 'gc_lost', hasTab: true }),
      bid({ builderKey: 'gc-str', builderName: 'Structura', outcome: 'pending', sentIso: '2026-08-20', lastContactIso: '2026-08-21T10:00:00Z' }),
    ]
    const { builders, totals } = buildCallQueue(rows, NOW)
    expect(builders.map((b) => b.builderName)).toEqual(['Knight', 'Structura']) // work first
    const knight = builders[0]!
    expect(knight.hasWork).toBe(true)
    expect(knight.stats).toEqual({ won: 1, lost: 2, pending: 2, hitRatePct: 33, pendingValue: 350_000 })
    expect(knight.chase.todo).toHaveLength(1)
    expect(knight.chase.freshCount).toBe(1)
    expect(knight.chase.oldestQuietDays).toBe(21)
    expect(knight.reasons.todo).toHaveLength(1)
    expect(knight.reasons.dollars).toBe(300_000)
    expect(knight.reasons.recordedCount).toBe(1)
    expect(knight.tabs.todo.map((b) => b.value).sort()).toEqual([250_000, 300_000])
    expect(knight.tabs.recordedCount).toBe(1)
    const structura = builders[1]!
    expect(structura.hasWork).toBe(false)
    expect(totals).toEqual({ buildersWithWork: 1, chaseCount: 1, chasePacketRows: 1, reasonsCount: 1, reasonsPacketRows: 1, reasonsDollars: 300_000, tabsCount: 2, dueCount: 0, overdueCount: 0, noDateCount: 1, laterCount: 0, laterValue: 0 })
  })

  it('drops builders with nothing decided or in flight; sorts quiet-longest first', () => {
    const rows = [
      bid({ builderKey: 'a', builderName: 'A', outcome: 'pending', sentIso: '2026-08-01', lastContactIso: '2026-08-10T00:00:00Z' }),
      bid({ builderKey: 'b', builderName: 'B', outcome: 'pending', sentIso: '2026-08-01', lastContactIso: '2026-07-01T00:00:00Z' }),
      bid({ builderKey: 'c', builderName: 'C', outcome: 'unsent', sentIso: null }),
    ]
    const { builders } = buildCallQueue(rows, NOW)
    expect(builders.map((b) => b.builderName)).toEqual(['B', 'A']) // C dropped; B waited longer
  })

  it('never-contacted sorts before any contacted builder', () => {
    const rows = [
      bid({ builderKey: 'a', builderName: 'A', lastContactIso: '2026-01-01T00:00:00Z' }),
      bid({ builderKey: 'b', builderName: 'B', lastContactIso: null }),
    ]
    const { builders } = buildCallQueue(rows, NOW)
    expect(builders[0]!.builderName).toBe('B')
  })
})

describe('queue order (J14-F4)', () => {
  it('never-contacted builders tie-break by who has waited longest, not by name', () => {
    const { builders } = buildCallQueue(
      [
        bid({ builderKey: 'aaron', builderName: 'Aaron Berg', sentIso: '2026-08-15', lastContactIso: null }),
        bid({ builderKey: 'zed', builderName: 'Zed Builders', sentIso: '2026-05-01', lastContactIso: null }),
        bid({ builderKey: 'mid', builderName: 'Mid Co', sentIso: '2026-07-01', lastContactIso: null }),
      ],
      NOW,
    )
    expect(builders.map((b) => b.builderName)).toEqual(['Zed Builders', 'Mid Co', 'Aaron Berg'])
    expect(builders[0]!.chase.oldestQuietDays).toBeGreaterThan(builders[2]!.chase.oldestQuietDays!)
  })

  it('a contact on a LOST bid no longer ranks its builder ahead of one never called', () => {
    const { builders } = buildCallQueue(
      [
        // Never called, sent long ago — should be first.
        bid({ builderKey: 'quiet', builderName: 'Quiet GC', sentIso: '2026-05-01', lastContactIso: null }),
        // Pending never called + an ancient note on a dead lost bid.
        bid({ builderKey: 'noisy', builderName: 'Noisy GC', sentIso: '2026-08-10', lastContactIso: null }),
        bid({ builderKey: 'noisy', builderName: 'Noisy GC', outcome: 'lost', sentIso: '2025-01-01', lastContactIso: '2025-02-01T00:00:00.000Z' }),
      ],
      NOW,
    )
    expect(builders.map((b) => b.builderName)).toEqual(['Quiet GC', 'Noisy GC'])
    expect(builders[1]!.oldestContactMs).toBe(-Infinity)
  })

  it('a real contact on an open bid still ranks oldest-first ahead of the never-contacted band', () => {
    const { builders } = buildCallQueue(
      [
        bid({ builderKey: 'called', builderName: 'Called GC', sentIso: '2026-05-01', lastContactIso: '2026-06-01T00:00:00.000Z' }),
        bid({ builderKey: 'never', builderName: 'Never GC', sentIso: '2026-05-01', lastContactIso: null }),
      ],
      NOW,
    )
    expect(builders.map((b) => b.builderName)).toEqual(['Never GC', 'Called GC'])
  })
})

/**
 * Call-again days (v2.4420, punch list #80). NOW is Sat Aug 22, 2026, 1 PM in Chicago, so
 * today is 2026-08-22.
 */
describe('a promised day orders the queue', () => {
  it('a bid parked on a day ahead leaves the chase list, and its tab is not asked for', () => {
    const parked = bid({ builderKey: 'city', builderName: 'City', sentIso: '2026-02-11', lastContactIso: '2026-03-01T16:00:00Z', nextFollowupYmd: '2027-01-05', value: 27_000 })
    const { builders, totals, followupByBid } = buildCallQueue([parked], NOW)
    const city = builders[0]!
    expect(city.chase.todo).toEqual([])
    expect(city.chase.later).toEqual([parked])
    expect(city.chase.freshCount).toBe(0)
    expect(city.tabs.todo).toEqual([]) // sent six months ago: gettable, were it not parked
    expect(city.hasWork).toBe(false)
    expect(city.due).toBeNull()
    expect(followupByBid.get(parked)).toMatchObject({ state: 'later', dueYmd: '2027-01-05', source: 'bid' })
    expect(totals).toMatchObject({ chaseCount: 0, laterCount: 1, laterValue: 27_000, noDateCount: 0, tabsCount: 0 })
  })

  it('on its day the bid is back on top, ahead of builders who have been quiet far longer', () => {
    const rows = [
      bid({ builderKey: 'quiet', builderName: 'A Year Quiet', sentIso: '2025-08-01', lastContactIso: null }),
      bid({ builderKey: 'due', builderName: 'Promised Today', sentIso: '2026-08-10', lastContactIso: '2026-08-15T16:00:00Z', nextFollowupYmd: '2026-08-22' }),
      bid({ builderKey: 'late', builderName: 'Promised Tuesday', sentIso: '2026-08-10', lastContactIso: '2026-08-12T16:00:00Z', nextFollowupYmd: '2026-08-18' }),
      bid({ builderKey: 'later', builderName: 'Promised Earlier Still', sentIso: '2026-07-01', lastContactIso: '2026-08-01T16:00:00Z', nextFollowupYmd: '2026-08-10' }),
    ]
    const { builders, totals } = buildCallQueue(rows, NOW)
    // Overdue first, the longest overdue on top; then today's; then the ones nobody promised.
    expect(builders.map((b) => b.builderName)).toEqual(['Promised Earlier Still', 'Promised Tuesday', 'Promised Today', 'A Year Quiet'])
    expect(builders.map((b) => b.due)).toEqual([
      { state: 'overdue', earliestYmd: '2026-08-10' },
      { state: 'overdue', earliestYmd: '2026-08-18' },
      { state: 'due', earliestYmd: '2026-08-22' },
      { state: 'none', earliestYmd: null },
    ])
    expect(totals).toMatchObject({ chaseCount: 4, overdueCount: 2, dueCount: 1, noDateCount: 1, laterCount: 0 })
  })

  it('a promise for today shows even when the builder was called yesterday', () => {
    const b = bid({ sentIso: '2026-08-01', lastContactIso: '2026-08-21T16:00:00Z', nextFollowupYmd: '2026-08-22' })
    const { builders } = buildCallQueue([b], NOW)
    expect(builders[0]!.chase.todo).toEqual([b])
    expect(builders[0]!.chase.freshCount).toBe(0)
  })

  it('inside one card: overdue, then due, then the quiet ones; "quiet" counts only bids with no day', () => {
    const quiet = bid({ sentIso: '2026-06-01', lastContactIso: null })
    const due = bid({ sentIso: '2026-08-01', lastContactIso: '2026-08-10T16:00:00Z', nextFollowupYmd: '2026-08-22' })
    const late = bid({ sentIso: '2026-05-01', lastContactIso: '2026-08-10T16:00:00Z', nextFollowupYmd: '2026-08-20' })
    const later = bid({ sentIso: '2026-01-01', lastContactIso: null, nextFollowupYmd: '2026-12-01' })
    const fresh = bid({ sentIso: '2026-08-10', lastContactIso: '2026-08-21T16:00:00Z' })
    const { builders } = buildCallQueue([quiet, due, late, later, fresh], NOW)
    const knight = builders[0]!
    expect(knight.chase.todo).toEqual([late, due, quiet])
    expect(knight.chase.later).toEqual([later])
    expect(knight.chase.freshCount).toBe(1)
    expect(knight.chase.oldestQuietDays).toBe(82) // the quiet bid sent Jun 1, not the parked one from January
    expect(knight.due).toEqual({ state: 'overdue', earliestYmd: '2026-08-20' })
  })

  it('a bid with no day of its own takes its builder\'s', () => {
    const a = bid({ builderKey: 'gc-a', builderName: 'A', sentIso: '2026-06-01', lastContactIso: null })
    const own = bid({ builderKey: 'gc-a', builderName: 'A', sentIso: '2026-06-01', lastContactIso: null, nextFollowupYmd: '2026-08-22' })
    const { builders, followupByBid } = buildCallQueue([a, own], NOW, { builderNextYmdByKey: { 'gc-a': '2026-09-15' } })
    expect(followupByBid.get(a)).toMatchObject({ state: 'later', dueYmd: '2026-09-15', source: 'builder' })
    expect(followupByBid.get(own)).toMatchObject({ state: 'due', source: 'bid' })
    expect(builders[0]!.chase.todo).toEqual([own])
    expect(builders[0]!.chase.later).toEqual([a])
  })

  it('a bid sent to two GCs is one parked bid in the totals', () => {
    const one = bid({ id: 'same', builderKey: 'gc-a', builderName: 'A', nextFollowupYmd: '2026-12-01', value: 50_000 })
    const two = bid({ id: 'same', builderKey: 'gc-b', builderName: 'B', nextFollowupYmd: '2026-12-01', value: 52_000 })
    const { totals } = buildCallQueue([one, two], NOW)
    expect(totals).toMatchObject({ laterCount: 1, laterValue: 52_000 })
  })

  it('today can be passed in: the queue does not guess the day from UTC', () => {
    const b = bid({ sentIso: '2026-08-01', lastContactIso: '2026-08-10T16:00:00Z', nextFollowupYmd: '2026-08-23' })
    expect(buildCallQueue([b], NOW).builders[0]!.chase.later).toEqual([b])
    expect(buildCallQueue([b], NOW, { todayYmd: '2026-08-23' }).builders[0]!.chase.todo).toEqual([b])
    // 2026-08-23T03:00Z is still Aug 22 in Chicago.
    expect(buildCallQueue([b], '2026-08-23T03:00:00.000Z').builders[0]!.chase.later).toEqual([b])
  })
})
