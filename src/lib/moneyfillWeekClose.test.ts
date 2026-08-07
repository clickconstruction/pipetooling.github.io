import { describe, expect, it } from 'vitest'
import {
  buildWeekCloseConfidenceLine,
  filterNoncardRowsToWeek,
  noncardWeekQueueCount,
  previousCompleteWeekMonday,
  summarizeWeekClose,
  type MoneyfillQueueCount,
} from './moneyfillWeekClose'
import type { NoncardAttributionQueueRow } from './banking/noncardAttributionQueue'

const row = (posted: string | null, amount: number): NoncardAttributionQueueRow => ({
  mercury_transaction_id: 'x',
  posted_at: posted,
  amount,
  kind: 'externalTransfer',
  counterparty_name: null,
  external_memo: null,
})

describe('previousCompleteWeekMonday', () => {
  it('returns the Monday of last week for a mid-week Central date', () => {
    // Thu Aug 6 2026 (Central) → previous complete week starts Mon Jul 27.
    expect(previousCompleteWeekMonday(new Date('2026-08-06T18:00:00-05:00'))).toBe('2026-07-27')
  })

  it('a Monday itself closes the week that just ended', () => {
    expect(previousCompleteWeekMonday(new Date('2026-08-10T08:00:00-05:00'))).toBe('2026-08-03')
  })
})

describe('filterNoncardRowsToWeek', () => {
  it('keeps only rows whose Chicago posted date falls inside the Mon–Sun week', () => {
    const rows = [
      row('2026-08-03T06:00:00-05:00', -100), // Mon in week
      row('2026-08-09T23:00:00-05:00', -50), // Sun in week
      row('2026-08-10T00:30:00-05:00', -25), // next Mon — out
      row('2026-08-02T23:59:00-05:00', -10), // prior Sun — out
      row(null, -999), // undated — out
    ]
    const kept = filterNoncardRowsToWeek(rows, '2026-08-03')
    expect(kept.map((r) => r.amount)).toEqual([-100, -50])
  })

  it('UTC timestamps bucket by the CHICAGO calendar day', () => {
    // 2026-08-10T03:00Z is still Sun Aug 9 in Chicago (CDT −5).
    const kept = filterNoncardRowsToWeek([row('2026-08-10T03:00:00Z', -1)], '2026-08-03')
    expect(kept).toHaveLength(1)
  })
})

describe('noncardWeekQueueCount', () => {
  it('sums absolute dollars for the week', () => {
    const c = noncardWeekQueueCount(
      [row('2026-08-04T12:00:00-05:00', -750), row('2026-08-05T12:00:00-05:00', -430)],
      '2026-08-03',
      true,
    )
    expect(c.count).toBe(2)
    expect(c.dollars).toBe(1180)
  })

  it('ineligible or missing rows report null (partial), never zero', () => {
    expect(noncardWeekQueueCount(null, '2026-08-03', true).count).toBeNull()
    expect(noncardWeekQueueCount([], '2026-08-03', false).count).toBeNull()
  })
})

describe('summarizeWeekClose + confidence line', () => {
  const counts: MoneyfillQueueCount[] = [
    { key: 'bank-transfers', label: 'Bank transfers', count: 3, dollars: 1180 },
    { key: 'card-charges', label: 'Card charges', count: 0, dollars: 0 },
    { key: 'pending-approval', label: 'Pending approval', count: 2, dollars: null },
    { key: 'supply-invoices', label: 'Supply invoices', count: null, dollars: null },
  ]

  it('summarizes zero-queues, dollars, and partiality', () => {
    const s = summarizeWeekClose(counts)
    expect(s.totalQueues).toBe(4)
    expect(s.queuesAtZero).toBe(1)
    expect(s.unattributedDollars).toBe(1180)
    expect(s.partial).toBe(true)
  })

  it('confidence line names open queues only, dollars first when known', () => {
    expect(buildWeekCloseConfidenceLine(counts)).toBe(
      '$1,180 in bank transfers unattributed · 2 pending approval open',
    )
  })

  it('confidence line is null when everything is clean or unknown', () => {
    expect(
      buildWeekCloseConfidenceLine([
        { key: 'card-charges', label: 'Card charges', count: 0, dollars: 0 },
        { key: 'supply-invoices', label: 'Supply invoices', count: null, dollars: null },
      ]),
    ).toBeNull()
  })
})
