/**
 * The board's reads hand the kernel the same window they covered. Found on the dev walk as the
 * Sample assistant (3-week window): the kernel counted eight weeks over three weeks of sessions,
 * so five weeks read as nothing recorded and a steady helper read "light four weeks running".
 * They also hand it each salaried person's own set week off the pay flags (v2.7948), so a person on
 * 6 hours a day reads against 30 hours, not 40.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ roster: [] as unknown[], flags: [] as unknown[], sessions: [] as unknown[] }))

vi.mock('../supabase', () => ({ supabase: { rpc: async () => ({ data: h.flags, error: null }), from: () => ({ select: () => ({ eq: () => ({ gte: () => ({ lte: () => ({ is: () => ({ is: async () => ({ data: [], error: null }) }) }) }) }) }) }) } }))
vi.mock('./rosterPeople', () => ({ fetchRosterPeople: async () => h.roster }))
vi.mock('../userTimeOffByCell', () => ({ fetchUserTimeOffForUsersInRange: async () => ({ data: [] }) }))
vi.mock('../supabasePaging', () => ({ fetchAllRows: async () => h.sessions }))

import { fetchMyUtilization, fetchUtilizationBoard } from './fetchUtilizationBoard'
import { localAvailabilityIo } from './availabilityIo'

afterEach(() => {
  h.roster = []
  h.flags = []
  h.sessions = []
})

function rosterRow(userId: string, personId: string, name: string) {
  return { user_id: userId, has_login: true, is_digital_twin: false, is_sample: false, is_walk_tester: false, is_dev: false, user_archived_at: null, person_archived_at: null, end_date: null, is_active_roster: true, person_id: personId, pay_name: name, role: 'helpers', kind: 'helper', start_date: '2026-01-05' }
}

/** Six hours a day, Monday Nov 2 to Friday Nov 6, as the salary schedule makes them. */
function sixHourDays(userId: string) {
  return ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06'].map((d) => ({
    user_id: userId,
    work_date: d,
    clocked_in_at: `${d}T13:00:00Z`,
    clocked_out_at: `${d}T19:00:00Z`,
    approved_at: `${d}T20:00:00Z`,
    rejected_at: null,
    revoked_at: null,
    origin: 'salary_schedule',
  }))
}

describe('fetchUtilizationBoard', () => {
  it('counts the weeks the reads covered, not the default eight', async () => {
    const read = await fetchUtilizationBoard(localAvailabilityIo(), { weeks: 3, todayYmd: '2026-11-08', nowMs: Date.UTC(2026, 10, 8, 18) })
    expect(read.board.team).toHaveLength(3)
    expect(read.startYmd).toBe(read.board.team[0]!.week.start)
    expect(read.endYmd).toBe(read.board.team[2]!.week.end)
  })

  it('hands the kernel each salaried person’s own set week off the pay flags', async () => {
    h.roster = [rosterRow('u-rosa', 'p-rosa', 'Rosa Sample'), rosterRow('u-ann', 'p-ann', 'Ann Sample')]
    h.flags = [
      { person_name: 'Rosa Sample', person_id: 'p-rosa', is_salary: true, record_hours_but_salary: false, show_in_hours: false, salaried_week_hours: ['0.00', '6.00', '6.00', '6.00', '6.00', '6.00', '0.00'] },
      { person_name: 'Ann Sample', person_id: 'p-ann', is_salary: false, record_hours_but_salary: false, show_in_hours: true, salaried_week_hours: [0, 8, 8, 8, 8, 8, 0] },
    ]
    h.sessions = [...sixHourDays('u-rosa'), ...sixHourDays('u-ann')]
    const read = await fetchUtilizationBoard(localAvailabilityIo(), { weeks: 3, todayYmd: '2026-11-08', nowMs: Date.UTC(2026, 10, 8, 18) })
    expect(read.people.map((p) => [p.name, p.isSalary, p.salariedWeek])).toEqual([
      ['Rosa Sample', true, [0, 6, 6, 6, 6, 6, 0]],
      ['Ann Sample', false, null],
    ])
    const rosa = read.board.people.find((p) => p.person.id === 'u-rosa')!
    expect(rosa.canWork).toMatchObject({ hours: 30, source: 'schedule' })
    expect(rosa.lastFullWeek?.pct).toBe(100)
    const ann = read.board.people.find((p) => p.person.id === 'u-ann')!
    expect(ann.canWork).toMatchObject({ hours: 40, source: 'assumed' })
  })

  it('My Time reads the same count it asked for', async () => {
    const read = await fetchMyUtilization({ userId: 'u1', name: 'Pat', role: 'helpers', isSalary: false, io: localAvailabilityIo(), weeks: 4 })
    expect(read.board.team).toHaveLength(4)
  })

  it('My Time holds a salaried person to the week it was handed, and an hourly one to none', async () => {
    const mine = await fetchMyUtilization({ userId: 'u1', name: 'Pat', role: 'helpers', isSalary: true, salariedWeek: [0, 6, 6, 6, 6, 6, 0], io: localAvailabilityIo(), weeks: 4 })
    expect(mine.people[0]!.salariedWeek).toEqual([0, 6, 6, 6, 6, 6, 0])
    const hourly = await fetchMyUtilization({ userId: 'u1', name: 'Pat', role: 'helpers', isSalary: false, salariedWeek: [0, 6, 6, 6, 6, 6, 0], io: localAvailabilityIo(), weeks: 4 })
    expect(hourly.people[0]!.salariedWeek).toBeNull()
  })
})
