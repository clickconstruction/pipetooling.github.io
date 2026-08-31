import { describe, expect, it } from 'vitest'
import { buildRobotQueue, type RobotQueueBidFields } from './robotQueue'

const base = (over: Partial<RobotQueueBidFields> & { id: string }): RobotQueueBidFields => ({
  bid_number: '1',
  project_name: 'P',
  plans_link: 'https://plans',
  service_type_id: 'st',
  distance_from_office: 10,
  bid_due_date: '2026-09-10',
  gc_builder_id: 'gc',
  customer_id: null,
  robot_requested_at: null,
  robot_requested_by: null,
  bid_date_sent: null,
  outcome: null,
  ...over,
})

describe('buildRobotQueue', () => {
  it('splits requested (oldest first) above ready (by due date), skipping twins and non-ready', () => {
    const bids = [
      base({ id: 'a', robot_requested_at: '2026-08-31T10:00:00Z' }),
      base({ id: 'b', robot_requested_at: '2026-08-30T10:00:00Z' }),
      base({ id: 'c', bid_due_date: '2026-09-05' }),
      base({ id: 'd', bid_due_date: '2026-09-01' }),
      base({ id: 'e', plans_link: null }), // not ready
      base({ id: 'f' }), // twin exists
      base({ id: 'g', bid_date_sent: '2026-08-01' }), // already sent
      base({ id: 'h', outcome: 'lost' }), // decided
    ]
    const q = buildRobotQueue(bids, (id) => id === 'f')
    expect(q.requested.map((b) => b.id)).toEqual(['b', 'a'])
    expect(q.ready.map((b) => b.id)).toEqual(['d', 'c'])
  })

  it('null due dates sort last in ready', () => {
    const q = buildRobotQueue(
      [base({ id: 'x', bid_due_date: null }), base({ id: 'y', bid_due_date: '2026-09-02' })],
      () => false,
    )
    expect(q.ready.map((b) => b.id)).toEqual(['y', 'x'])
  })

  it('stale due dates are left off when a cutoff is given', () => {
    const q = buildRobotQueue(
      [base({ id: 'old', bid_due_date: '2026-03-11' }), base({ id: 'new', bid_due_date: '2026-09-02' })],
      () => false,
      { staleDueBefore: '2026-08-01' },
    )
    expect(q.ready.map((b) => b.id)).toEqual(['new'])
  })

  it('a requested bid that lost readiness is not queued', () => {
    const q = buildRobotQueue(
      [base({ id: 'z', robot_requested_at: '2026-08-31T00:00:00Z', service_type_id: null })],
      () => false,
    )
    expect(q.requested).toEqual([])
    expect(q.ready).toEqual([])
  })
})
