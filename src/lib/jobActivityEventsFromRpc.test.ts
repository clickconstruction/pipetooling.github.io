import { describe, expect, it } from 'vitest'
import { jobActivityEventsFromRpc, type JobActivityEventRpcRow } from './jobActivityEventsFromRpc'

const row = (over: Partial<JobActivityEventRpcRow>): JobActivityEventRpcRow => ({
  id: 'r1',
  event_type: 'status_change',
  occurred_at: '2026-06-03T15:00:00Z',
  actor_user_id: 'u1',
  actor_name: 'Alex',
  summary: 'Working → Ready to Bill',
  detail: { from: 'working', to: 'ready_to_bill' },
  financial: false,
  ...over,
})

describe('jobActivityEventsFromRpc', () => {
  it('maps a row to a generic event item', () => {
    const [it0] = jobActivityEventsFromRpc([row({ id: 'abc' })])
    expect(it0!.kind).toBe('event')
    expect(it0!.event.dedupeKey).toBe('ev:abc')
    expect(it0!.event.type).toBe('status_change')
    expect(it0!.event.summary).toBe('Working → Ready to Bill')
    expect(it0!.event.actorName).toBe('Alex')
    expect(it0!.event.financial).toBe(false)
  })

  it('carries financial flag and null actor', () => {
    const [it0] = jobActivityEventsFromRpc([
      row({ event_type: 'payment_added', financial: true, actor_name: null, actor_user_id: null }),
    ])
    expect(it0!.event.financial).toBe(true)
    expect(it0!.event.actorName).toBeNull()
  })

  it('drops unknown event types and rows without occurred_at', () => {
    const items = jobActivityEventsFromRpc([
      row({ id: 'keep' }),
      row({ id: 'unknown', event_type: 'totally_made_up' }),
      row({ id: 'nodate', occurred_at: null }),
    ])
    expect(items.map((i) => i.event.dedupeKey)).toEqual(['ev:keep'])
  })
})
