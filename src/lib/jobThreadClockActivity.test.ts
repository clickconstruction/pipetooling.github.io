import { describe, expect, it } from 'vitest'
import type { JobDetailClockSessionRow } from './fetchClockSessionsForJobLedger'
import { clockSessionsToActivityItems } from './jobThreadClockActivity'

const session = (over: Partial<JobDetailClockSessionRow>): JobDetailClockSessionRow =>
  ({
    id: 's1',
    user_id: 'u1',
    clocked_in_at: '2026-06-03T14:00:00Z',
    clocked_out_at: '2026-06-03T17:30:00Z',
    work_date: '2026-06-03',
    notes: null,
    approved_at: null,
    rejected_at: null,
    users: { name: 'Alex' },
    ...over,
  }) as JobDetailClockSessionRow

describe('clockSessionsToActivityItems', () => {
  it('maps a closed session with person, duration, and stable key', () => {
    const items = clockSessionsToActivityItems([session({ id: 'abc' })])
    expect(items).toHaveLength(1)
    const c = items[0]!.clock
    expect(items[0]!.kind).toBe('clock_session')
    expect(c.dedupeKey).toBe('cs:abc')
    expect(c.personName).toBe('Alex')
    expect(c.sortAt).toBe('2026-06-03T14:00:00Z')
    expect(c.durationHours).toBeCloseTo(3.5, 5)
  })

  it('marks unapproved sessions pending and approved sessions approved', () => {
    const [pending] = clockSessionsToActivityItems([session({ approved_at: null })])
    const [approved] = clockSessionsToActivityItems([
      session({ approved_at: '2026-06-04T10:00:00Z' }),
    ])
    expect(pending!.clock.status).toBe('pending')
    expect(approved!.clock.status).toBe('approved')
  })

  it('keeps open sessions (no clock-out) with null duration', () => {
    const [open] = clockSessionsToActivityItems([session({ clocked_out_at: null })])
    expect(open!.clock.clockedOutAt).toBeNull()
    expect(open!.clock.durationHours).toBeNull()
  })

  it('drops rejected sessions', () => {
    const items = clockSessionsToActivityItems([
      session({ id: 'keep' }),
      session({ id: 'drop', rejected_at: '2026-06-04T09:00:00Z' }),
    ])
    expect(items.map((i) => i.clock.dedupeKey)).toEqual(['cs:keep'])
  })

  it('returns null duration when clock-out is not after clock-in', () => {
    const [bad] = clockSessionsToActivityItems([
      session({ clocked_in_at: '2026-06-03T17:00:00Z', clocked_out_at: '2026-06-03T17:00:00Z' }),
    ])
    expect(bad!.clock.durationHours).toBeNull()
  })

  it('falls back to user_id then "Unknown" for the person label', () => {
    const [byId] = clockSessionsToActivityItems([session({ users: null, user_id: 'u-42' })])
    const [unknown] = clockSessionsToActivityItems([
      session({ users: { name: '  ' }, user_id: '' }),
    ])
    expect(byId!.clock.personName).toBe('u-42')
    expect(unknown!.clock.personName).toBe('Unknown')
  })

  it('uses work_date midday as sort fallback when clocked_in_at is missing', () => {
    const [row] = clockSessionsToActivityItems([
      session({ clocked_in_at: null, work_date: '2026-06-03' }),
    ])
    // Sort key is a valid ISO instant derived from the work date (not the epoch).
    expect(row!.clock.sortAt).toBe(new Date('2026-06-03T12:00:00').toISOString())
  })
})
