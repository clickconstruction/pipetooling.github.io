import { describe, expect, it } from 'vitest'
import { compareDispatchInboxRows, sortDispatchInboxRows, summarizeOpenDispatchAging } from './dispatchInboxAging'

const NOW = Date.parse('2026-09-05T15:00:00Z')
const daysAgo = (n: number) => new Date(NOW - n * 86_400_000).toISOString()

describe('sortDispatchInboxRows', () => {
  it('open before closed; open OLDEST first; closed newest-closed first', () => {
    const rows = [
      { id: 'c-old', status: 'closed', created_at: daysAgo(30), closed_at: daysAgo(20) },
      { id: 'o-new', status: 'open', created_at: daysAgo(0), closed_at: null },
      { id: 'c-new', status: 'closed', created_at: daysAgo(3), closed_at: daysAgo(1) },
      { id: 'o-old', status: 'open', created_at: daysAgo(46), closed_at: null },
      { id: 'o-mid', status: 'open', created_at: daysAgo(4), closed_at: null },
    ]
    expect(sortDispatchInboxRows(rows).map((r) => r.id)).toEqual(['o-old', 'o-mid', 'o-new', 'c-new', 'c-old'])
  })

  it('an open row with no created_at sinks below stamped open rows; closed rows fall back to created_at', () => {
    const rows = [
      { id: 'o-none', status: 'open', created_at: null },
      { id: 'o-old', status: 'open', created_at: daysAgo(10) },
      { id: 'c-a', status: 'closed', created_at: daysAgo(9), closed_at: null },
      { id: 'c-b', status: 'closed', created_at: daysAgo(2), closed_at: null },
    ]
    expect(sortDispatchInboxRows(rows).map((r) => r.id)).toEqual(['o-old', 'o-none', 'c-b', 'c-a'])
  })

  it('a customer waiting (open + high) leads the open tier, oldest waiting first; high closed rows stay in the closed tier (v2.3247)', () => {
    const rows = [
      { id: 'o-old', status: 'open', created_at: daysAgo(46), closed_at: null },
      { id: 'w-new', status: 'open', created_at: daysAgo(0), closed_at: null, priority: 'high' },
      { id: 'c-high', status: 'closed', created_at: daysAgo(3), closed_at: daysAgo(1), priority: 'high' },
      { id: 'w-old', status: 'open', created_at: daysAgo(1), closed_at: null, priority: 'high' },
      { id: 'o-mid', status: 'open', created_at: daysAgo(4), closed_at: null, priority: 'normal' },
    ]
    expect(sortDispatchInboxRows(rows).map((r) => r.id)).toEqual(['w-old', 'w-new', 'o-old', 'o-mid', 'c-high'])
  })

  it('does not mutate the input', () => {
    const rows = [{ id: 'a', status: 'open', created_at: daysAgo(1) }, { id: 'b', status: 'open', created_at: daysAgo(5) }]
    sortDispatchInboxRows(rows)
    expect(rows.map((r) => r.id)).toEqual(['a', 'b'])
    expect(compareDispatchInboxRows(rows[0]!, rows[1]!)).toBeGreaterThan(0)
  })
})

describe('summarizeOpenDispatchAging', () => {
  it('counts open rows at or past the min age and names the oldest; null while nothing has aged', () => {
    const rows = [
      { status: 'open', created_at: daysAgo(46) },
      { status: 'open', created_at: daysAgo(4) },
      { status: 'open', created_at: daysAgo(0) },
      { status: 'closed', created_at: daysAgo(90), closed_at: daysAgo(80) },
    ]
    expect(summarizeOpenDispatchAging(rows, 3, NOW)).toEqual({ count: 2, total: 3, oldestAgeDays: 46 })
    expect(summarizeOpenDispatchAging(rows, 50, NOW)).toBeNull()
    expect(summarizeOpenDispatchAging([{ status: 'open', created_at: daysAgo(1) }], 3, NOW)).toBeNull()
    expect(summarizeOpenDispatchAging([], 3, NOW)).toBeNull()
  })

  it('the boundary day counts (min age is inclusive, like HOURS_APPROVALS_MIN_AGE_DAYS)', () => {
    expect(summarizeOpenDispatchAging([{ status: 'open', created_at: daysAgo(3) }], 3, NOW)).toEqual({ count: 1, total: 1, oldestAgeDays: 3 })
  })

  it('ignores unstamped open rows for age but still counts them in the total', () => {
    const rows = [
      { status: 'open', created_at: null },
      { status: 'open', created_at: daysAgo(5) },
    ]
    expect(summarizeOpenDispatchAging(rows, 3, NOW)).toEqual({ count: 1, total: 2, oldestAgeDays: 5 })
  })
})
