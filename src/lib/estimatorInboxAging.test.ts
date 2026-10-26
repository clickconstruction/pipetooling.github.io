import { describe, expect, it } from 'vitest'
import { compareEstimatorInboxRows, sortEstimatorInboxRows } from './estimatorInboxAging'

const NOW = Date.parse('2026-10-26T15:00:00Z')
const daysAgo = (n: number) => new Date(NOW - n * 86_400_000).toISOString()

describe('sortEstimatorInboxRows (punch list #184 sweep B)', () => {
  it('open before closed; open OLDEST first; closed newest-closed first', () => {
    const rows = [
      { id: 'c-old', status: 'closed', created_at: daysAgo(30), closed_at: daysAgo(20) },
      { id: 'o-new', status: 'open', created_at: daysAgo(0), closed_at: null },
      { id: 'c-new', status: 'closed', created_at: daysAgo(3), closed_at: daysAgo(1) },
      { id: 'o-old', status: 'open', created_at: daysAgo(12), closed_at: null },
      { id: 'o-mid', status: 'open', created_at: daysAgo(4), closed_at: null },
    ]
    expect(sortEstimatorInboxRows(rows).map((r) => r.id)).toEqual(['o-old', 'o-mid', 'o-new', 'c-new', 'c-old'])
  })

  it('a customer waiting (open + high) still leads, oldest waiting first (v2.3247 kept)', () => {
    const rows = [
      { id: 'o-old', status: 'open', created_at: daysAgo(12), closed_at: null },
      { id: 'w-new', status: 'open', created_at: daysAgo(0), closed_at: null, priority: 'high' },
      { id: 'c-high', status: 'closed', created_at: daysAgo(3), closed_at: daysAgo(1), priority: 'high' },
      { id: 'w-old', status: 'open', created_at: daysAgo(1), closed_at: null, priority: 'high' },
    ]
    expect(sortEstimatorInboxRows(rows).map((r) => r.id)).toEqual(['w-old', 'w-new', 'o-old', 'c-high'])
  })

  it('an open row with no created_at sinks below stamped open rows; closed rows fall back to created_at', () => {
    const rows = [
      { id: 'o-none', status: 'open', created_at: null },
      { id: 'o-old', status: 'open', created_at: daysAgo(10) },
      { id: 'c-a', status: 'closed', created_at: daysAgo(9), closed_at: null },
      { id: 'c-b', status: 'closed', created_at: daysAgo(2), closed_at: null },
    ]
    expect(sortEstimatorInboxRows(rows).map((r) => r.id)).toEqual(['o-old', 'o-none', 'c-b', 'c-a'])
  })

  it('does not mutate the input', () => {
    const rows = [{ id: 'a', status: 'open', created_at: daysAgo(1) }, { id: 'b', status: 'open', created_at: daysAgo(5) }]
    sortEstimatorInboxRows(rows)
    expect(rows.map((r) => r.id)).toEqual(['a', 'b'])
    expect(compareEstimatorInboxRows(rows[0]!, rows[1]!)).toBeGreaterThan(0)
  })
})
