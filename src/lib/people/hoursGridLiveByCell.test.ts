import { describe, expect, it } from 'vitest'
import type { ClockSessionRow } from '../../types/clockSessions'
import { buildHoursGridLiveByWorkDate, liveDayChipLabel, liveDayChipTitle } from './hoursGridLiveByCell'

const NOW = new Date('2026-09-02T20:00:00Z').getTime()
const users = [
  { id: 'u-ana', name: ' Ana Ruiz ' },
  { id: 'u-bo', name: 'Bo Lee' },
  { id: 'u-cy', name: 'Cy Park' },
]

function open(id: string, user_id: string, work_date: string, hoursAgo: number, extra: Partial<ClockSessionRow> = {}): ClockSessionRow {
  return {
    id,
    user_id,
    work_date,
    clocked_in_at: new Date(NOW - hoursAgo * 3_600_000).toISOString(),
    clocked_out_at: null,
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
    ...extra,
  } as ClockSessionRow
}

describe('buildHoursGridLiveByWorkDate', () => {
  it('counts distinct people and running hours per day column, trimming names through the shared join', () => {
    const map = buildHoursGridLiveByWorkDate({
      activeClockSessions: [open('a', 'u-ana', '2026-09-02', 2), open('b', 'u-bo', '2026-09-02', 0.5), open('c', 'u-cy', '2026-09-01', 4)],
      peopleNames: ['Ana Ruiz', 'Bo Lee', 'Cy Park'],
      workDates: ['2026-09-01', '2026-09-02'],
      users,
      nowMs: NOW,
    })
    expect(map.get('2026-09-02')).toEqual({ workDate: '2026-09-02', people: 2, elapsedHours: 2.5 })
    expect(map.get('2026-09-01')).toEqual({ workDate: '2026-09-01', people: 1, elapsedHours: 4 })
  })

  it('ignores closed, rejected and revoked sessions, people off the roster, and days off the grid', () => {
    const map = buildHoursGridLiveByWorkDate({
      activeClockSessions: [
        open('closed', 'u-ana', '2026-09-02', 3, { clocked_out_at: new Date(NOW).toISOString() }),
        open('rejected', 'u-bo', '2026-09-02', 3, { rejected_at: new Date(NOW).toISOString() }),
        open('revoked', 'u-bo', '2026-09-02', 3, { revoked_at: new Date(NOW).toISOString() }),
        open('off-roster', 'u-cy', '2026-09-02', 3),
        open('off-grid', 'u-ana', '2026-08-20', 3),
        open('unknown-user', 'u-zed', '2026-09-02', 3),
      ],
      peopleNames: ['Ana Ruiz', 'Bo Lee'],
      workDates: ['2026-09-02'],
      users,
      nowMs: NOW,
    })
    expect(map.size).toBe(0)
  })

  it('a person clocked in twice on one day counts once; a future clock-in contributes zero elapsed', () => {
    const map = buildHoursGridLiveByWorkDate({
      activeClockSessions: [open('a1', 'u-ana', '2026-09-02', 1), open('a2', 'u-ana', '2026-09-02', -1)],
      peopleNames: ['Ana Ruiz'],
      workDates: ['2026-09-02'],
      users,
      nowMs: NOW,
    })
    expect(map.get('2026-09-02')).toEqual({ workDate: '2026-09-02', people: 1, elapsedHours: 1 })
  })

  it('returns an empty map without work when nobody is on the clock', () => {
    expect(buildHoursGridLiveByWorkDate({ activeClockSessions: [], peopleNames: ['Ana Ruiz'], workDates: ['2026-09-02'], users, nowMs: NOW }).size).toBe(0)
  })
})

describe('live chip copy', () => {
  it('labels the count and says what the column is not counting', () => {
    const one = { workDate: '2026-09-02', people: 1, elapsedHours: 2.25 }
    const many = { workDate: '2026-09-02', people: 3, elapsedHours: 7.5 }
    expect(liveDayChipLabel(one)).toBe('+1 on the clock')
    expect(liveDayChipLabel(many)).toBe('+3 on the clock')
    expect(liveDayChipTitle(one)).toBe('1 person is clocked in right now (2.25 h so far). This column counts closed sessions only — their time lands here when they clock out.')
    expect(liveDayChipTitle(many)).toContain('3 people are clocked in right now (7.50 h so far)')
  })
})
