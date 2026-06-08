import { describe, expect, it } from 'vitest'
import type { JobStatusEventRow } from './fetchJobStatusEventsForJobLedger'
import { humanizeJobStatus, statusEventsToActivityItems } from './jobThreadStatusEventActivity'

const row = (over: Partial<JobStatusEventRow>): JobStatusEventRow =>
  ({
    id: 's1',
    from_status: 'working',
    to_status: 'ready_to_bill',
    changed_at: '2026-06-03T15:00:00Z',
    changed_by_user_id: 'u1',
    users: { name: 'Alex' },
    ...over,
  }) as JobStatusEventRow

describe('humanizeJobStatus', () => {
  it('maps known statuses and title-cases unknown', () => {
    expect(humanizeJobStatus('ready_to_bill')).toBe('Ready to Bill')
    expect(humanizeJobStatus('working')).toBe('Working')
    expect(humanizeJobStatus('some_new_state')).toBe('Some New State')
    expect(humanizeJobStatus(null)).toBe('—')
  })
})

describe('statusEventsToActivityItems', () => {
  it('builds a from→to summary with actor and stable key', () => {
    const [it0] = statusEventsToActivityItems([row({ id: 'abc' })])
    expect(it0!.kind).toBe('event')
    expect(it0!.event.type).toBe('status_change')
    expect(it0!.event.dedupeKey).toBe('ev:status:abc')
    expect(it0!.event.summary).toBe('Working → Ready to Bill')
    expect(it0!.event.actorName).toBe('Alex')
    expect(it0!.event.financial).toBe(false)
    expect(it0!.event.occurredAt).toBe('2026-06-03T15:00:00Z')
  })

  it('null actor name → null, and skips rows with no changed_at', () => {
    const items = statusEventsToActivityItems([
      row({ id: 'a', users: null }),
      row({ id: 'b', changed_at: null }),
    ])
    expect(items.map((i) => i.event.dedupeKey)).toEqual(['ev:status:a'])
    expect(items[0]!.event.actorName).toBeNull()
  })
})
