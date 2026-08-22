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
    expect(totals).toEqual({ buildersWithWork: 1, chaseCount: 1, reasonsCount: 1, reasonsDollars: 300_000, tabsCount: 2 })
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
