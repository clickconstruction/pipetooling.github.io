import { describe, expect, it } from 'vitest'
import type { JobThreadActivityItem } from '../components/JobThreadNotesPanel'
import { activityItemMatchesFilter, filterActivity } from './jobActivityFilter'

const note: JobThreadActivityItem = {
  kind: 'note',
  note: { id: 'n', body: 'hi', created_at: '2026-06-01T00:00:00Z', author: { name: 'A' } },
}
const clock: JobThreadActivityItem = {
  kind: 'clock_session',
  clock: {
    dedupeKey: 'cs:1',
    sortAt: '2026-06-01T00:00:00Z',
    personName: 'A',
    clockedInAt: '2026-06-01T00:00:00Z',
    clockedOutAt: null,
    durationHours: null,
    status: 'pending',
    note: '',
  },
}
const ev = (type: Parameters<typeof import('./jobActivityEvent').bucketForEvent>[0]): JobThreadActivityItem => ({
  kind: 'event',
  event: { dedupeKey: `ev:${type}`, type, occurredAt: '2026-06-01T00:00:00Z', actorName: null, summary: 's', financial: false },
})

describe('activityItemMatchesFilter', () => {
  it('all matches everything', () => {
    for (const item of [note, clock, ev('status_change'), ev('payment_added'), ev('field_edited')]) {
      expect(activityItemMatchesFilter(item, 'all')).toBe(true)
    }
  })

  it('routes each kind/bucket to its segment', () => {
    expect(activityItemMatchesFilter(note, 'notes')).toBe(true)
    expect(activityItemMatchesFilter(note, 'status')).toBe(false)
    expect(activityItemMatchesFilter(ev('status_change'), 'status')).toBe(true)
    expect(activityItemMatchesFilter(ev('payment_added'), 'billing')).toBe(true)
    expect(activityItemMatchesFilter(ev('invoice_sent'), 'billing')).toBe(true)
    expect(activityItemMatchesFilter(ev('crew_added'), 'crew')).toBe(true)
    expect(activityItemMatchesFilter(clock, 'crew')).toBe(true)
  })

  it("'other' events appear only under all", () => {
    const fieldEdit = ev('field_edited')
    expect(activityItemMatchesFilter(fieldEdit, 'all')).toBe(true)
    for (const f of ['notes', 'status', 'billing', 'crew'] as const) {
      expect(activityItemMatchesFilter(fieldEdit, f)).toBe(false)
    }
  })

  it('filterActivity returns the same array reference for all and filters otherwise', () => {
    const items = [note, ev('status_change'), ev('payment_added')]
    expect(filterActivity(items, 'all')).toBe(items)
    expect(filterActivity(items, 'billing').map((i) => i.kind)).toEqual(['event'])
    expect(filterActivity(items, 'billing')).toHaveLength(1)
  })
})
