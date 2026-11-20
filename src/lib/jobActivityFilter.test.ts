import { describe, expect, it } from 'vitest'
import type { JobThreadActivityItem } from '../components/JobThreadNotesPanel'
import {
  ACTIVITY_FILTERS,
  FULL_ACTIVITY_FILTER_ACCESS,
  JOB_ACTIVITY_FILTERS,
  activityItemMatchesFilter,
  countActivityByFilter,
  filterActivity,
  resolveActivityFilter,
  visibleActivityFilters,
} from './jobActivityFilter'

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
    expect(activityItemMatchesFilter(note, 'reports')).toBe(false)
    expect(activityItemMatchesFilter(note, 'status')).toBe(false)
    const report = {
      kind: 'report',
      report: { id: 'r1', template_name: 'Note', job_display_name: '', created_at: '2026-01-01T00:00:00Z', created_by_name: 'A', field_values: {}, reported_at_lat: null, reported_at_lng: null },
    } as const
    expect(activityItemMatchesFilter(report, 'reports')).toBe(true)
    expect(activityItemMatchesFilter(report, 'notes')).toBe(false)
    expect(activityItemMatchesFilter(ev('status_change'), 'status')).toBe(true)
    expect(activityItemMatchesFilter(ev('payment_added'), 'billing')).toBe(true)
    expect(activityItemMatchesFilter(ev('invoice_sent'), 'billing')).toBe(true)
    expect(activityItemMatchesFilter(ev('crew_added'), 'crew')).toBe(true)
    expect(activityItemMatchesFilter(clock, 'crew')).toBe(true)
  })

  it("'other' events appear only under all", () => {
    const fieldEdit = ev('field_edited')
    expect(activityItemMatchesFilter(fieldEdit, 'all')).toBe(true)
    for (const f of ['notes', 'reports', 'status', 'billing', 'crew'] as const) {
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

describe('countActivityByFilter', () => {
  it('counts each bucket and totals under all', () => {
    const items = [note, note, clock, ev('status_change'), ev('payment_added'), ev('crew_added')]
    expect(countActivityByFilter(items)).toEqual({ all: 6, notes: 2, reports: 0, status: 1, billing: 1, crew: 2 })
  })

  it("'other' events count under all only, so all can exceed the buckets' sum", () => {
    const items = [note, ev('field_edited')]
    const counts = countActivityByFilter(items)
    expect(counts.all).toBe(2)
    expect(counts.notes + counts.reports + counts.status + counts.billing + counts.crew).toBe(1)
  })

  it('every count matches what filterActivity returns for that bucket', () => {
    const items = [note, clock, ev('status_change'), ev('payment_added'), ev('field_edited')]
    const counts = countActivityByFilter(items)
    for (const f of ['all', 'notes', 'reports', 'status', 'billing', 'crew'] as const) {
      expect(counts[f]).toBe(filterActivity(items, f).length)
    }
  })

  it('empty input yields all zeros', () => {
    expect(countActivityByFilter([])).toEqual({ all: 0, notes: 0, reports: 0, status: 0, billing: 0, crew: 0 })
  })
})

describe('visibleActivityFilters', () => {
  const values = (fs: readonly { value: string }[]) => fs.map((f) => f.value)

  it('draws every chip for a viewer who reads both kinds', () => {
    expect(values(visibleActivityFilters(ACTIVITY_FILTERS, FULL_ACTIVITY_FILTER_ACCESS))).toEqual(['all', 'notes', 'reports', 'status', 'billing', 'crew'])
  })

  it('covers the four combinations, in the list\'s own order', () => {
    expect(values(visibleActivityFilters(ACTIVITY_FILTERS, { canSeeBilling: false, canSeeReports: false }))).toEqual(['all', 'notes', 'status', 'crew'])
    expect(values(visibleActivityFilters(ACTIVITY_FILTERS, { canSeeBilling: true, canSeeReports: false }))).toEqual(['all', 'notes', 'status', 'billing', 'crew'])
    expect(values(visibleActivityFilters(ACTIVITY_FILTERS, { canSeeBilling: false, canSeeReports: true }))).toEqual(['all', 'notes', 'reports', 'status', 'crew'])
    expect(values(visibleActivityFilters(ACTIVITY_FILTERS, { canSeeBilling: true, canSeeReports: true }))).toEqual(['all', 'notes', 'reports', 'status', 'billing', 'crew'])
  })

  it('keeps the Customer chip, which asks nothing here', () => {
    expect(values(visibleActivityFilters(JOB_ACTIVITY_FILTERS, { canSeeBilling: false, canSeeReports: false }))).toEqual(['all', 'notes', 'status', 'crew', 'customer'])
  })

  it('keeps a chip the viewer has access to when nothing is under it', () => {
    const counts = { all: 3, notes: 3, reports: 0, status: 0, billing: 0, crew: 0 }
    expect(values(visibleActivityFilters(ACTIVITY_FILTERS, FULL_ACTIVITY_FILTER_ACCESS, counts))).toEqual(['all', 'notes', 'reports', 'status', 'billing', 'crew'])
  })

  it('draws a gated chip over a line the feed did hand the viewer', () => {
    const none = { canSeeBilling: false, canSeeReports: false }
    expect(values(visibleActivityFilters(ACTIVITY_FILTERS, none, { reports: 2, billing: 0 }))).toEqual(['all', 'notes', 'reports', 'status', 'crew'])
    expect(values(visibleActivityFilters(ACTIVITY_FILTERS, none, { reports: 0, billing: 1 }))).toEqual(['all', 'notes', 'status', 'billing', 'crew'])
  })

  it('reads no counts as no lines', () => {
    const none = { canSeeBilling: false, canSeeReports: false }
    expect(values(visibleActivityFilters(ACTIVITY_FILTERS, none, null))).toEqual(['all', 'notes', 'status', 'crew'])
  })
})

describe('resolveActivityFilter', () => {
  const field = visibleActivityFilters(JOB_ACTIVITY_FILTERS, { canSeeBilling: false, canSeeReports: false })

  it('keeps a filter whose chip is drawn', () => {
    expect(resolveActivityFilter('crew', field)).toBe('crew')
    expect(resolveActivityFilter('customer', field)).toBe('customer')
    expect(resolveActivityFilter('all', field)).toBe('all')
  })

  it('falls back to All for a filter the viewer cannot see', () => {
    expect(resolveActivityFilter('billing', field)).toBe('all')
    expect(resolveActivityFilter('reports', field)).toBe('all')
  })

  it('keeps Billing for a viewer who reads it', () => {
    expect(resolveActivityFilter('billing', visibleActivityFilters(ACTIVITY_FILTERS, FULL_ACTIVITY_FILTER_ACCESS))).toBe('billing')
  })
})
