import { describe, expect, it } from 'vitest'
import { buildManHoursEntries, buildManHoursPeriods, type ManHoursSession } from './manHoursByPeriod'
import { buildManHoursNames, buildManHoursWho } from './manHoursWho'

const OFFICE = 'job-office'

function sess(day: string, userId: string, name: string | null, hours: number, over: Partial<ManHoursSession> = {}): ManHoursSession {
  const start = new Date(`${day}T14:00:00.000Z`).getTime()
  return {
    user_id: userId,
    work_date: day,
    clocked_in_at: new Date(start).toISOString(),
    clocked_out_at: new Date(start + hours * 3600000).toISOString(),
    job_ledger_id: null,
    bid_id: null,
    approved_at: `${day}T23:00:00.000Z`,
    rejected_at: null,
    revoked_at: null,
    users: name == null ? null : { name },
    ...over,
  }
}

const SESSIONS = [
  sess('2026-09-01', 'u1', 'Abraham', 8, { job_ledger_id: 'job-1' }),
  sess('2026-09-02', 'u1', 'Abraham', 8, { job_ledger_id: 'job-1', approved_at: null }),
  sess('2026-09-02', 'u2', ' Taunya ', 6, { job_ledger_id: OFFICE }),
  sess('2026-09-03', 'u2', 'Taunya', 2, { bid_id: 'bid-1' }),
  sess('2026-09-03', 'u3', null, 3, {}),
  sess('2026-10-01', 'u1', 'Abraham', 5, { job_ledger_id: 'job-1' }),
]

describe('buildManHoursNames', () => {
  it('reads each person’s name off their sessions, trimmed, and skips a session with none', () => {
    expect([...buildManHoursNames(SESSIONS)]).toEqual([
      ['u1', 'Abraham'],
      ['u2', 'Taunya'],
    ])
  })
})

describe('buildManHoursWho', () => {
  const entries = buildManHoursEntries(SESSIONS, OFFICE)
  const names = buildManHoursNames(SESSIONS)
  const september = { start: '2026-09-01', end: '2026-09-30' }

  it('lists the people inside the period, most hours first, each side in its column', () => {
    expect(buildManHoursWho(entries, september, names)).toEqual([
      { userId: 'u1', name: 'Abraham', fieldHours: 16, officeHours: 0, bidHours: 0, unassignedHours: 0, totalHours: 16, pendingHours: 8 },
      { userId: 'u2', name: 'Taunya', fieldHours: 0, officeHours: 6, bidHours: 2, unassignedHours: 0, totalHours: 8, pendingHours: 0 },
      { userId: 'u3', name: 'Unknown', fieldHours: 0, officeHours: 0, bidHours: 0, unassignedHours: 3, totalHours: 3, pendingHours: 0 },
    ])
  })

  it('adds up to the period’s own row on the card', () => {
    const period = buildManHoursPeriods({ entries, zoom: 'month', todayYmd: '2026-10-04' }).periods[0]
    const rows = buildManHoursWho(entries, september, names)
    const sum = (pick: (r: (typeof rows)[number]) => number) => rows.reduce((total, r) => total + pick(r), 0)
    expect(sum((r) => r.fieldHours)).toBeCloseTo(period?.fieldHours ?? -1)
    expect(sum((r) => r.officeHours)).toBeCloseTo(period?.officeHours ?? -1)
    expect(sum((r) => r.bidHours)).toBeCloseTo(period?.bidHours ?? -1)
    expect(sum((r) => r.unassignedHours)).toBeCloseTo(period?.unassignedHours ?? -1)
    expect(sum((r) => r.totalHours)).toBeCloseTo(period?.totalHours ?? -1)
    expect(sum((r) => r.pendingHours)).toBeCloseTo(period?.pendingHours ?? -1)
    expect(rows).toHaveLength(period?.people ?? -1)
  })

  it('is empty for a period nobody worked', () => {
    expect(buildManHoursWho(entries, { start: '2026-08-01', end: '2026-08-31' }, names)).toEqual([])
  })
})
