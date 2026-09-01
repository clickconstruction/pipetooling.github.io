import { describe, expect, it } from 'vitest'

import {
  LATE_GRACE_MINUTES,
  computeAttendanceSummaryForUser,
  computeLatenessByCell,
  latenessCellKey,
  latenessLedgerEntries,
  latestAnnotationByCell,
  type LatenessBlockRow,
  type LatenessSessionRow,
} from './scheduleLateness'

// APP_CALENDAR_TZ is America/Chicago; 2026-08-31 is CDT (UTC-5), so 8:00 AM
// wall clock = 13:00Z.
const block = (over: Partial<LatenessBlockRow>): LatenessBlockRow => ({
  assignee_user_id: 'u1',
  work_date: '2026-08-31',
  time_start: '08:00:00',
  job_label: 'J996',
  ...over,
})
const session = (over: Partial<LatenessSessionRow>): LatenessSessionRow => ({
  user_id: 'u1',
  work_date: '2026-08-31',
  clocked_in_at: '2026-08-31T15:17:00Z', // 10:17 AM CDT
  ...over,
})
const KEY = latenessCellKey('u1', '2026-08-31')

describe('computeLatenessByCell', () => {
  it('reports the late arrival with rounded label and exact receipt', () => {
    const map = computeLatenessByCell([block({})], [session({})])
    const entry = map.get(KEY)
    expect(entry?.minutesLate).toBe(137)
    expect(entry?.label).toBe('Late 2h 15m')
    expect(entry?.title).toBe(
      'Scheduled 8:00 AM (J996) · First clock-in 10:17 AM · 2h 17m late (shown after 15m grace)',
    )
  })

  it('no entry inside the grace window', () => {
    // 8:14 AM CDT = 13:14Z — 14 minutes late, grace is 15.
    const map = computeLatenessByCell([block({})], [session({ clocked_in_at: '2026-08-31T13:14:00Z' })])
    expect(map.size).toBe(0)
    expect(LATE_GRACE_MINUTES).toBe(15)
  })

  it('exactly at the grace boundary stays quiet; one minute past shows', () => {
    expect(
      computeLatenessByCell([block({})], [session({ clocked_in_at: '2026-08-31T13:15:00Z' })]).size,
    ).toBe(0)
    expect(
      computeLatenessByCell([block({})], [session({ clocked_in_at: '2026-08-31T13:16:00Z' })])
        .get(KEY)?.minutesLate,
    ).toBe(16)
  })

  it('earliest block start and first clock-in win', () => {
    const map = computeLatenessByCell(
      [block({ time_start: '10:00:00', job_label: 'J650' }), block({ time_start: '08:00:00' })],
      [session({ clocked_in_at: '2026-08-31T16:00:00Z' }), session({ clocked_in_at: '2026-08-31T15:00:00Z' })],
    )
    // vs the 8:00 start, first in at 10:00 AM CDT → 120 late.
    expect(map.get(KEY)?.minutesLate).toBe(120)
    expect(map.get(KEY)?.title).toContain('(J996)')
  })

  it('rejected and revoked sessions never count as arrival', () => {
    const map = computeLatenessByCell(
      [block({})],
      [
        session({ clocked_in_at: '2026-08-31T13:05:00Z', rejected_at: '2026-08-31T20:00:00Z' }),
        session({ clocked_in_at: '2026-08-31T15:17:00Z' }),
      ],
    )
    expect(map.get(KEY)?.minutesLate).toBe(137)
  })

  it('no clock-in at all → no entry (that is the NCNS decision, not lateness)', () => {
    expect(computeLatenessByCell([block({})], []).size).toBe(0)
  })

  it('no blocks → no entry even with sessions', () => {
    expect(computeLatenessByCell([], [session({})]).size).toBe(0)
  })

  it('person-days are independent', () => {
    const map = computeLatenessByCell(
      [block({}), block({ assignee_user_id: 'u2', time_start: '09:00:00' })],
      [session({}), session({ user_id: 'u2', clocked_in_at: '2026-08-31T14:05:00Z' })],
    )
    expect(map.get(KEY)?.minutesLate).toBe(137)
    // u2: scheduled 9:00, in 9:05 CDT — inside grace.
    expect(map.get(latenessCellKey('u2', '2026-08-31'))).toBeUndefined()
  })

  it('sub-hour label has no hour part', () => {
    const map = computeLatenessByCell([block({})], [session({ clocked_in_at: '2026-08-31T13:38:00Z' })])
    expect(map.get(KEY)?.label).toBe('Late 40m')
    expect(map.get(KEY)?.minutesLate).toBe(38)
  })
})

// v2.2551: People-side ledger helpers.
describe('latenessLedgerEntries', () => {
  it('flattens the map newest-first with ids parsed from the key', () => {
    const entries = latenessLedgerEntries(
      [block({}), block({ work_date: '2026-08-28', time_start: '08:00:00' })],
      [
        session({}),
        session({ work_date: '2026-08-28', clocked_in_at: '2026-08-28T14:00:00Z' }), // 9:00 CDT, 1h late
      ],
    )
    expect(entries.map((e) => e.work_date)).toEqual(['2026-08-31', '2026-08-28'])
    expect(entries[0]?.user_id).toBe('u1')
    expect(entries[1]?.label).toBe('Late 1h')
  })
})

describe('computeAttendanceSummaryForUser', () => {
  it('counts scheduled, clocked-in, on-time, late days and the median', () => {
    const blocks = [
      block({}), // 8/31 late 137m
      block({ work_date: '2026-08-28' }), // on time
      block({ work_date: '2026-08-27' }), // late 30m
      block({ work_date: '2026-08-26' }), // no clock-in
      block({ assignee_user_id: 'u2' }), // someone else
    ]
    const sessions = [
      session({}),
      session({ work_date: '2026-08-28', clocked_in_at: '2026-08-28T13:00:00Z' }),
      session({ work_date: '2026-08-27', clocked_in_at: '2026-08-27T13:30:00Z' }),
    ]
    const s = computeAttendanceSummaryForUser(blocks, sessions, 'u1')
    expect(s).toEqual({
      scheduledDays: 4,
      clockInDays: 3,
      onTimeDays: 1,
      lateDays: 2,
      excusedDays: 0,
      medianLateMinutes: 84, // (30 + 137) / 2 rounded
    })
  })

  it('empty inputs → zeros and null median', () => {
    expect(computeAttendanceSummaryForUser([], [], 'u1')).toEqual({
      scheduledDays: 0,
      clockInDays: 0,
      onTimeDays: 0,
      lateDays: 0,
      excusedDays: 0,
      medianLateMinutes: null,
    })
  })
})

// v2.2556: excuse annotations.
describe('latestAnnotationByCell', () => {
  it('latest note per person-day wins (append-only corrections)', () => {
    const map = latestAnnotationByCell([
      { subject_user_id: 'u1', work_date: '2026-08-31', note: 'first', created_at: '2026-08-31T18:00:00Z' },
      { subject_user_id: 'u1', work_date: '2026-08-31', note: 'corrected', created_at: '2026-08-31T19:00:00Z' },
      { subject_user_id: 'u1', work_date: '2026-08-28', note: 'other day', created_at: '2026-08-31T17:00:00Z' },
    ])
    expect(map.get(latenessCellKey('u1', '2026-08-31'))?.note).toBe('corrected')
    expect(map.get(latenessCellKey('u1', '2026-08-28'))?.note).toBe('other day')
  })
})

describe('computeAttendanceSummaryForUser with excused days', () => {
  it('excused lates leave lateDays and the median, land in excusedDays', () => {
    const blocks = [
      block({}), // 8/31 late 137m
      block({ work_date: '2026-08-27' }), // late 30m
      block({ work_date: '2026-08-28' }), // on time
    ]
    const sessions = [
      session({}),
      session({ work_date: '2026-08-27', clocked_in_at: '2026-08-27T13:30:00Z' }),
      session({ work_date: '2026-08-28', clocked_in_at: '2026-08-28T13:00:00Z' }),
    ]
    const excused = new Set([latenessCellKey('u1', '2026-08-31')])
    const s = computeAttendanceSummaryForUser(blocks, sessions, 'u1', undefined, excused)
    expect(s).toEqual({
      scheduledDays: 3,
      clockInDays: 3,
      onTimeDays: 1,
      lateDays: 1,
      excusedDays: 1,
      medianLateMinutes: 30,
    })
  })

  it('no excused set behaves as before (plus excusedDays: 0)', () => {
    const s = computeAttendanceSummaryForUser([block({})], [session({})], 'u1')
    expect(s.lateDays).toBe(1)
    expect(s.excusedDays).toBe(0)
  })
})
