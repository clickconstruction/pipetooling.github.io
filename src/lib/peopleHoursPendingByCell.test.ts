import { describe, expect, it } from 'vitest'
import type { ClockSessionRow } from '../types/clockSessions'
import {
  buildPeopleHoursPendingByCellMap,
  pendingByCellKey,
  personPendingExcessHours,
  summarizePeopleHoursPendingByCell,
  sumClosedPendingClockHoursForCell,
  workDateHasAnyPendingExcess,
} from './peopleHoursPendingByCell'

function row(overrides: Partial<ClockSessionRow> & {
  id: string
  user_id: string
  work_date: string
  clocked_in_at: string
  clocked_out_at: string | null
}): ClockSessionRow {
  return {
    notes: '',
    job_ledger_id: null,
    bid_id: null,
    clock_in_lat: null,
    clock_in_lng: null,
    clock_out_lat: null,
    clock_out_lng: null,
    clock_in_location_source: null,
    clock_out_location_source: null,
    approved_at: null,
    approved_by: null,
    rejected_at: null,
    rejected_by: null,
    revoked_at: null,
    revoked_by: null,
    users: null,
    approved_by_user: null,
    rejected_by_user: null,
    revoked_by_user: null,
    jobs_ledger: null,
    bids: null,
    ...overrides,
  } as ClockSessionRow
}

const ALEX_ID = '00000000-0000-0000-0000-00000000aaaa'
const BLAKE_ID = '00000000-0000-0000-0000-00000000bbbb'
const SALLY_ID = '00000000-0000-0000-0000-00000000cccc'
const USERS = [
  { id: ALEX_ID, name: 'Alex' },
  { id: BLAKE_ID, name: 'Blake' },
  { id: SALLY_ID, name: 'Sally' },
]
const PEOPLE = ['Alex', 'Blake', 'Sally']
const DATES = ['2026-05-11', '2026-05-12', '2026-05-13']
const NEVER_SALARY = () => false

describe('buildPeopleHoursPendingByCellMap', () => {
  it('emits an entry only when pending hours exceed saved people_hours', () => {
    const pending: ClockSessionRow[] = [
      row({
        id: 's1',
        user_id: ALEX_ID,
        work_date: '2026-05-12',
        clocked_in_at: '2026-05-12T13:00:00Z',
        clocked_out_at: '2026-05-12T17:00:00Z',
      }),
    ]
    const map = buildPeopleHoursPendingByCellMap({
      pendingClockSessions: pending,
      peopleHours: [],
      peopleNames: PEOPLE,
      workDates: DATES,
      users: USERS,
      isSalaryOnly: NEVER_SALARY,
    })
    const entry = map.get(pendingByCellKey('Alex', '2026-05-12'))
    expect(entry).toBeDefined()
    expect(entry?.count).toBe(1)
    expect(entry?.pendingHours).toBeCloseTo(4, 5)
    expect(entry?.peopleHoursValue).toBe(0)
    expect(entry?.diffHours).toBeCloseTo(4, 5)
    expect(entry?.sessionIds).toEqual(['s1'])
  })

  it('skips when saved hours already cover (or exceed) pending', () => {
    const pending: ClockSessionRow[] = [
      row({
        id: 's2',
        user_id: ALEX_ID,
        work_date: '2026-05-12',
        clocked_in_at: '2026-05-12T13:00:00Z',
        clocked_out_at: '2026-05-12T15:00:00Z',
      }),
    ]
    const map = buildPeopleHoursPendingByCellMap({
      pendingClockSessions: pending,
      peopleHours: [{ person_name: 'Alex', work_date: '2026-05-12', hours: 2 }],
      peopleNames: PEOPLE,
      workDates: DATES,
      users: USERS,
      isSalaryOnly: NEVER_SALARY,
    })
    expect(map.size).toBe(0)
  })

  it('emits diff = pending - saved when saved is partial', () => {
    const pending: ClockSessionRow[] = [
      row({
        id: 's3a',
        user_id: ALEX_ID,
        work_date: '2026-05-12',
        clocked_in_at: '2026-05-12T13:00:00Z',
        clocked_out_at: '2026-05-12T17:00:00Z',
      }),
      row({
        id: 's3b',
        user_id: ALEX_ID,
        work_date: '2026-05-12',
        clocked_in_at: '2026-05-12T18:00:00Z',
        clocked_out_at: '2026-05-12T19:30:00Z',
      }),
    ]
    const map = buildPeopleHoursPendingByCellMap({
      pendingClockSessions: pending,
      peopleHours: [{ person_name: 'Alex', work_date: '2026-05-12', hours: 4 }],
      peopleNames: PEOPLE,
      workDates: DATES,
      users: USERS,
      isSalaryOnly: NEVER_SALARY,
    })
    const entry = map.get(pendingByCellKey('Alex', '2026-05-12'))
    expect(entry).toBeDefined()
    expect(entry?.pendingHours).toBeCloseTo(5.5, 5)
    expect(entry?.peopleHoursValue).toBeCloseTo(4, 5)
    expect(entry?.diffHours).toBeCloseTo(1.5, 5)
    expect(entry?.sessionIds).toEqual(['s3a', 's3b'])
  })

  it('ignores open sessions, rejected, revoked, and out-of-range dates', () => {
    const pending: ClockSessionRow[] = [
      row({
        id: 'open',
        user_id: ALEX_ID,
        work_date: '2026-05-12',
        clocked_in_at: '2026-05-12T13:00:00Z',
        clocked_out_at: null,
      }),
      row({
        id: 'rejected',
        user_id: ALEX_ID,
        work_date: '2026-05-12',
        clocked_in_at: '2026-05-12T13:00:00Z',
        clocked_out_at: '2026-05-12T15:00:00Z',
        rejected_at: '2026-05-12T16:00:00Z',
      }),
      row({
        id: 'revoked',
        user_id: ALEX_ID,
        work_date: '2026-05-12',
        clocked_in_at: '2026-05-12T13:00:00Z',
        clocked_out_at: '2026-05-12T15:00:00Z',
        revoked_at: '2026-05-12T16:00:00Z',
      }),
      row({
        id: 'outOfRange',
        user_id: ALEX_ID,
        work_date: '2026-05-20',
        clocked_in_at: '2026-05-20T13:00:00Z',
        clocked_out_at: '2026-05-20T15:00:00Z',
      }),
    ]
    const map = buildPeopleHoursPendingByCellMap({
      pendingClockSessions: pending,
      peopleHours: [],
      peopleNames: PEOPLE,
      workDates: DATES,
      users: USERS,
      isSalaryOnly: NEVER_SALARY,
    })
    expect(map.size).toBe(0)
  })

  it('skips salary-only people via isSalaryOnly callback', () => {
    const pending: ClockSessionRow[] = [
      row({
        id: 's4',
        user_id: SALLY_ID,
        work_date: '2026-05-12',
        clocked_in_at: '2026-05-12T13:00:00Z',
        clocked_out_at: '2026-05-12T17:00:00Z',
      }),
      row({
        id: 's4-blake',
        user_id: BLAKE_ID,
        work_date: '2026-05-12',
        clocked_in_at: '2026-05-12T13:00:00Z',
        clocked_out_at: '2026-05-12T15:00:00Z',
      }),
    ]
    const map = buildPeopleHoursPendingByCellMap({
      pendingClockSessions: pending,
      peopleHours: [],
      peopleNames: PEOPLE,
      workDates: DATES,
      users: USERS,
      isSalaryOnly: (n) => n === 'Sally',
    })
    expect(map.has(pendingByCellKey('Sally', '2026-05-12'))).toBe(false)
    expect(map.has(pendingByCellKey('Blake', '2026-05-12'))).toBe(true)
  })

  it('summarize / row / day helpers report correct counts', () => {
    const pending: ClockSessionRow[] = [
      row({
        id: 'a1',
        user_id: ALEX_ID,
        work_date: '2026-05-11',
        clocked_in_at: '2026-05-11T13:00:00Z',
        clocked_out_at: '2026-05-11T16:00:00Z',
      }),
      row({
        id: 'a2',
        user_id: ALEX_ID,
        work_date: '2026-05-12',
        clocked_in_at: '2026-05-12T13:00:00Z',
        clocked_out_at: '2026-05-12T17:00:00Z',
      }),
      row({
        id: 'b1',
        user_id: BLAKE_ID,
        work_date: '2026-05-12',
        clocked_in_at: '2026-05-12T13:00:00Z',
        clocked_out_at: '2026-05-12T14:30:00Z',
      }),
    ]
    const map = buildPeopleHoursPendingByCellMap({
      pendingClockSessions: pending,
      peopleHours: [],
      peopleNames: PEOPLE,
      workDates: DATES,
      users: USERS,
      isSalaryOnly: NEVER_SALARY,
    })
    const summary = summarizePeopleHoursPendingByCell(map)
    expect(summary.totalSessions).toBe(3)
    expect(summary.peopleCount).toBe(2)
    expect(summary.workDates).toEqual(['2026-05-11', '2026-05-12'])
    expect(summary.totalDiffHours).toBeCloseTo(8.5, 5)
    expect(summary.allSessionIds.sort()).toEqual(['a1', 'a2', 'b1'])

    expect(workDateHasAnyPendingExcess(map, '2026-05-12')).toBe(true)
    expect(workDateHasAnyPendingExcess(map, '2026-05-13')).toBe(false)

    expect(personPendingExcessHours(map, 'Alex')).toBeCloseTo(7, 5)
    expect(personPendingExcessHours(map, 'Blake')).toBeCloseTo(1.5, 5)
    expect(personPendingExcessHours(map, 'Sally')).toBe(0)
  })
})

describe('sumClosedPendingClockHoursForCell', () => {
  it('returns 0 when userId is missing', () => {
    const sessions: ClockSessionRow[] = [
      row({
        id: 's1',
        user_id: ALEX_ID,
        work_date: '2026-05-12',
        clocked_in_at: '2026-05-12T13:00:00Z',
        clocked_out_at: '2026-05-12T17:00:00Z',
      }),
    ]
    expect(sumClosedPendingClockHoursForCell(sessions, null, '2026-05-12')).toBe(0)
    expect(sumClosedPendingClockHoursForCell(sessions, undefined, '2026-05-12')).toBe(0)
    expect(sumClosedPendingClockHoursForCell(sessions, '', '2026-05-12')).toBe(0)
  })

  it('sums closed pending sessions for the matching (user, work_date)', () => {
    const sessions: ClockSessionRow[] = [
      row({
        id: 's1',
        user_id: ALEX_ID,
        work_date: '2026-05-12',
        clocked_in_at: '2026-05-12T13:00:00Z',
        clocked_out_at: '2026-05-12T17:00:00Z',
      }),
      row({
        id: 's2',
        user_id: ALEX_ID,
        work_date: '2026-05-12',
        clocked_in_at: '2026-05-12T18:00:00Z',
        clocked_out_at: '2026-05-12T19:30:00Z',
      }),
      row({
        id: 'other-day',
        user_id: ALEX_ID,
        work_date: '2026-05-13',
        clocked_in_at: '2026-05-13T13:00:00Z',
        clocked_out_at: '2026-05-13T15:00:00Z',
      }),
      row({
        id: 'other-user',
        user_id: BLAKE_ID,
        work_date: '2026-05-12',
        clocked_in_at: '2026-05-12T13:00:00Z',
        clocked_out_at: '2026-05-12T15:00:00Z',
      }),
    ]
    expect(sumClosedPendingClockHoursForCell(sessions, ALEX_ID, '2026-05-12')).toBeCloseTo(5.5, 5)
    expect(sumClosedPendingClockHoursForCell(sessions, ALEX_ID, '2026-05-13')).toBeCloseTo(2, 5)
    expect(sumClosedPendingClockHoursForCell(sessions, BLAKE_ID, '2026-05-12')).toBeCloseTo(2, 5)
  })

  it('skips open sessions, rejected, and revoked sessions', () => {
    const sessions: ClockSessionRow[] = [
      row({
        id: 'open',
        user_id: ALEX_ID,
        work_date: '2026-05-12',
        clocked_in_at: '2026-05-12T13:00:00Z',
        clocked_out_at: null,
      }),
      row({
        id: 'rejected',
        user_id: ALEX_ID,
        work_date: '2026-05-12',
        clocked_in_at: '2026-05-12T13:00:00Z',
        clocked_out_at: '2026-05-12T15:00:00Z',
        rejected_at: '2026-05-12T16:00:00Z',
      }),
      row({
        id: 'revoked',
        user_id: ALEX_ID,
        work_date: '2026-05-12',
        clocked_in_at: '2026-05-12T13:00:00Z',
        clocked_out_at: '2026-05-12T15:00:00Z',
        revoked_at: '2026-05-12T16:00:00Z',
      }),
    ]
    expect(sumClosedPendingClockHoursForCell(sessions, ALEX_ID, '2026-05-12')).toBe(0)
  })

  it('keeps a fresh pending session in the same person+day after a sibling is revoked', () => {
    const sessions: ClockSessionRow[] = [
      row({
        id: 'fresh',
        user_id: ALEX_ID,
        work_date: '2026-05-12',
        clocked_in_at: '2026-05-12T13:00:00Z',
        clocked_out_at: '2026-05-12T16:00:00Z',
      }),
      row({
        id: 'revoked-sibling',
        user_id: ALEX_ID,
        work_date: '2026-05-12',
        clocked_in_at: '2026-05-12T17:00:00Z',
        clocked_out_at: '2026-05-12T19:00:00Z',
        revoked_at: '2026-05-12T20:00:00Z',
      }),
    ]
    expect(sumClosedPendingClockHoursForCell(sessions, ALEX_ID, '2026-05-12')).toBeCloseTo(3, 5)
  })

  it('skips zero-duration and non-finite timestamps', () => {
    const sessions: ClockSessionRow[] = [
      row({
        id: 'zero',
        user_id: ALEX_ID,
        work_date: '2026-05-12',
        clocked_in_at: '2026-05-12T13:00:00Z',
        clocked_out_at: '2026-05-12T13:00:00Z',
      }),
      row({
        id: 'bad',
        user_id: ALEX_ID,
        work_date: '2026-05-12',
        clocked_in_at: 'not-a-date',
        clocked_out_at: '2026-05-12T15:00:00Z',
      }),
    ]
    expect(sumClosedPendingClockHoursForCell(sessions, ALEX_ID, '2026-05-12')).toBe(0)
  })
})

