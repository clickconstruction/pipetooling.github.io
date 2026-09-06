import { describe, expect, it } from 'vitest'
import { groupVisitsByDay, parseVisitRow, parseVisitSummaryRow, visitHow, visitLine, visitMatches, whenWord } from './subPortalVisits'

const NOW = new Date('2026-09-05T18:00:00')

describe('subPortalVisits', () => {
  it('parses the summary RPC row and tolerates nulls', () => {
    expect(parseVisitSummaryRow({ person_id: 'p1', outside_opens: 6, first_outside_at: '2026-08-29T20:18:00Z', last_outside_at: '2026-09-04T21:40:00Z', staff_looks: 3, last_staff_at: '2026-09-05T14:12:00Z', last_staff_user_id: 'u1', last_staff_name: 'Taunya Smith' })).toEqual({
      personId: 'p1',
      outsideOpens: 6,
      firstOutsideAt: '2026-08-29T20:18:00Z',
      lastOutsideAt: '2026-09-04T21:40:00Z',
      staffLooks: 3,
      lastStaffAt: '2026-09-05T14:12:00Z',
      lastStaffUserId: 'u1',
      lastStaffName: 'Taunya Smith',
    })
    expect(parseVisitSummaryRow({ person_id: 'p2', outside_opens: null, staff_looks: 0 })).toMatchObject({ personId: 'p2', outsideOpens: 0, lastOutsideAt: null, staffLooks: 0, lastStaffName: null })
    expect(parseVisitSummaryRow({})).toBeNull()
    expect(parseVisitRow({ occurred_at: '2026-09-04T21:40:00Z', viewer: null, via: 'slug' })).toEqual({ occurredAt: '2026-09-04T21:40:00Z', viewer: 'outside', via: 'slug', staffUserId: null, staffName: null })
    expect(parseVisitRow({ occurred_at: 'nope' })).toBeNull()
  })

  it('words the line under the name', () => {
    const base = { personId: 'p', firstOutsideAt: null, lastOutsideAt: null, outsideOpens: 0, staffLooks: 0, lastStaffAt: null, lastStaffUserId: null, lastStaffName: null }
    expect(visitLine({ ...base, outsideOpens: 6, lastOutsideAt: '2026-09-04T21:40:00', staffLooks: 1, lastStaffAt: '2026-09-05T14:12:00', lastStaffName: 'Taunya Smith' }, { now: NOW })).toEqual({ outside: 'Opened their page yesterday · 6 times', tone: 'green', team: 'Taunya looked today' })
    expect(visitLine({ ...base, outsideOpens: 1, lastOutsideAt: '2026-08-29T20:18:00' }, { now: NOW })).toEqual({ outside: 'Opened their page Aug 29 · once', tone: 'green', team: null })
    expect(visitLine(base, { now: NOW })).toEqual({ outside: 'Never opened', tone: 'amber', team: null })
    expect(visitLine(base, { now: NOW, hasLink: false })).toEqual({ outside: 'Link not shared yet', tone: 'gray', team: null })
    expect(visitLine({ ...base, staffLooks: 2, lastStaffAt: '2026-09-02T16:30:00', lastStaffName: null }, { now: NOW })).toMatchObject({ team: 'Team looked Sep 2' })
    expect(visitLine(null)).toBeNull()
  })

  it('whenWord and how', () => {
    expect(whenWord('2026-09-05T09:00:00', NOW)).toBe('today')
    expect(whenWord('2026-09-04T09:00:00', NOW)).toBe('yesterday')
    expect(whenWord('2026-09-01T09:00:00', NOW)).toBe('Sep 1')
    expect(whenWord('2025-12-25T09:00:00', NOW)).toBe('Dec 25, 2025')
    expect(visitHow({ via: 'slug' })).toBe('short address')
    expect(visitHow({ via: 'token' })).toBe('direct link')
    expect(visitHow({ via: null })).toBe('—')
  })

  it('groups the trail by day, newest first, and filters', () => {
    const v = (occurredAt: string, viewer: 'outside' | 'staff' | 'preview', staffName: string | null = null) => ({ occurredAt, viewer, via: 'token' as const, staffUserId: null, staffName })
    const rows = [v('2026-09-01T18:52:00', 'outside'), v('2026-09-05T14:12:00', 'staff', 'Taunya'), v('2026-09-04T21:40:00', 'outside'), v('2026-09-04T12:15:00', 'outside'), v('2026-09-03T10:00:00', 'preview')]
    const days = groupVisitsByDay(rows.filter((r) => visitMatches('all', r)), NOW)
    expect(days.map((d) => [d.day, d.rows.length])).toEqual([
      ['Today', 1],
      ['Yesterday', 2],
      ['Sep 1', 1],
    ])
    expect(days[1]!.rows.map((r) => r.occurredAt)).toEqual(['2026-09-04T21:40:00', '2026-09-04T12:15:00'])
    expect(rows.filter((r) => visitMatches('staff', r)).map((r) => r.staffName)).toEqual(['Taunya'])
    expect(rows.filter((r) => visitMatches('outside', r))).toHaveLength(3)
  })
})
