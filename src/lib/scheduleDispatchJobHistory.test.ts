import { describe, expect, it } from 'vitest'
import {
  buildJobHistorySummary,
  buildJobHistoryWeeks,
  findJobOpenSessions,
  isCountableJobHistorySession,
  jobHistorySessionHours,
  type JobHistorySessionRow,
} from './scheduleDispatchJobHistory'

let seq = 0
function row(overrides: Partial<JobHistorySessionRow>): JobHistorySessionRow {
  seq += 1
  return {
    id: `s${seq}`,
    user_id: 'u1',
    work_date: '2026-07-15', // a Wednesday; its company week starts Sunday 2026-07-12
    clocked_in_at: '2026-07-15T13:00:00Z',
    clocked_out_at: '2026-07-15T21:00:00Z', // 8h
    approved_at: '2026-07-16T00:00:00Z',
    rejected_at: null,
    revoked_at: null,
    notes: null,
    users: { name: 'Malachi' },
    ...overrides,
  }
}

describe('isCountableJobHistorySession', () => {
  it('counts only approved, closed, dated sessions', () => {
    expect(isCountableJobHistorySession(row({}))).toBe(true)
    expect(isCountableJobHistorySession(row({ approved_at: null }))).toBe(false)
    expect(isCountableJobHistorySession(row({ rejected_at: '2026-07-16T00:00:00Z' }))).toBe(false)
    expect(isCountableJobHistorySession(row({ revoked_at: '2026-07-16T00:00:00Z' }))).toBe(false)
    expect(isCountableJobHistorySession(row({ clocked_out_at: null }))).toBe(false)
    expect(isCountableJobHistorySession(row({ work_date: null }))).toBe(false)
    expect(isCountableJobHistorySession(row({ work_date: '  ' }))).toBe(false)
  })
})

describe('jobHistorySessionHours', () => {
  it('computes decimal hours from the clock span', () => {
    expect(jobHistorySessionHours(row({}))).toBeCloseTo(8)
    expect(
      jobHistorySessionHours(row({ clocked_in_at: '2026-07-15T13:00:00Z', clocked_out_at: '2026-07-15T20:30:00Z' })),
    ).toBeCloseTo(7.5)
  })
  it('clamps malformed or negative spans to 0', () => {
    expect(jobHistorySessionHours(row({ clocked_out_at: '2026-07-15T12:00:00Z' }))).toBe(0) // out before in
    expect(jobHistorySessionHours(row({ clocked_in_at: 'garbage' }))).toBe(0)
    expect(jobHistorySessionHours(row({ clocked_out_at: null }))).toBe(0)
  })
})

describe('buildJobHistoryWeeks', () => {
  it('buckets sessions into Sunday-start weeks, newest first', () => {
    const weeks = buildJobHistoryWeeks([
      row({ work_date: '2026-07-15' }), // week of Sun 2026-07-12
      row({ work_date: '2026-07-08', clocked_in_at: '2026-07-08T13:00:00Z', clocked_out_at: '2026-07-08T17:00:00Z' }), // week of Sun 2026-07-05
    ])
    expect(weeks.map((w) => w.weekStartYmd)).toEqual(['2026-07-12', '2026-07-05'])
    expect(weeks.map((w) => w.weekEndYmd)).toEqual(['2026-07-18', '2026-07-11'])
  })

  it('a Sunday work_date starts its own week; Saturday closes it', () => {
    const weeks = buildJobHistoryWeeks([
      row({ work_date: '2026-07-12' }), // Sunday
      row({ work_date: '2026-07-18', clocked_in_at: '2026-07-18T13:00:00Z', clocked_out_at: '2026-07-18T15:00:00Z' }), // Saturday
    ])
    expect(weeks).toHaveLength(1)
    expect(weeks[0]?.weekStartYmd).toBe('2026-07-12')
    expect(weeks[0]?.totalHours).toBeCloseTo(10)
  })

  it('excludes open, rejected, revoked, and unapproved sessions from hours', () => {
    const weeks = buildJobHistoryWeeks([
      row({}),
      row({ clocked_out_at: null }),
      row({ approved_at: null }),
      row({ rejected_at: '2026-07-16T00:00:00Z' }),
      row({ revoked_at: '2026-07-16T00:00:00Z' }),
    ])
    expect(weeks).toHaveLength(1)
    expect(weeks[0]?.totalHours).toBeCloseTo(8)
    expect(weeks[0]?.people[0]?.sessions).toHaveLength(1)
  })

  it('aggregates per person with hours-desc sort and name tie-break', () => {
    const weeks = buildJobHistoryWeeks([
      row({ user_id: 'u1', users: { name: 'Malachi' } }), // 8h
      row({ user_id: 'u2', users: { name: 'Isiah' }, clocked_in_at: '2026-07-14T13:00:00Z', clocked_out_at: '2026-07-14T23:00:00Z', work_date: '2026-07-14' }), // 10h
      row({ user_id: 'u3', users: { name: 'Abe' } }), // 8h — ties Malachi, name sorts first
    ])
    const people = weeks[0]?.people ?? []
    expect(people.map((p) => p.name)).toEqual(['Isiah', 'Abe', 'Malachi'])
    expect(people[0]?.hours).toBeCloseTo(10)
    expect(weeks[0]?.totalHours).toBeCloseTo(26)
  })

  it('sorts one person’s sessions by work date then clock-in', () => {
    const weeks = buildJobHistoryWeeks([
      row({ work_date: '2026-07-15', clocked_in_at: '2026-07-15T18:00:00Z', clocked_out_at: '2026-07-15T20:00:00Z' }),
      row({ work_date: '2026-07-13', clocked_in_at: '2026-07-13T13:00:00Z', clocked_out_at: '2026-07-13T15:00:00Z' }),
      row({ work_date: '2026-07-15', clocked_in_at: '2026-07-15T13:00:00Z', clocked_out_at: '2026-07-15T15:00:00Z' }),
    ])
    const sessions = weeks[0]?.people[0]?.sessions ?? []
    expect(sessions.map((s) => `${s.workDateYmd}|${s.clockedInAt}`)).toEqual([
      '2026-07-13|2026-07-13T13:00:00Z',
      '2026-07-15|2026-07-15T13:00:00Z',
      '2026-07-15|2026-07-15T18:00:00Z',
    ])
  })

  it('falls back to "Unknown" when the users embed is missing a name', () => {
    const weeks = buildJobHistoryWeeks([row({ users: null }), row({ users: { name: '  ' }, user_id: 'u9' })])
    expect(weeks[0]?.people.every((p) => p.name === 'Unknown')).toBe(true)
  })

  it('trims notes and nulls empties', () => {
    const weeks = buildJobHistoryWeeks([row({ notes: '  rough in done  ' }), row({ notes: '   ' })])
    const sessions = weeks[0]?.people[0]?.sessions ?? []
    expect(sessions.map((s) => s.note)).toEqual(['rough in done', null])
  })

  it('returns [] for empty input', () => {
    expect(buildJobHistoryWeeks([])).toEqual([])
  })
})

describe('buildJobHistorySummary', () => {
  it('rolls up hours, distinct people, and the first–last work-date range', () => {
    const weeks = buildJobHistoryWeeks([
      row({ user_id: 'u1', work_date: '2026-07-15' }),
      row({ user_id: 'u2', users: { name: 'Isiah' }, work_date: '2026-07-08', clocked_in_at: '2026-07-08T13:00:00Z', clocked_out_at: '2026-07-08T17:00:00Z' }),
      row({ user_id: 'u1', work_date: '2026-06-01', clocked_in_at: '2026-06-01T13:00:00Z', clocked_out_at: '2026-06-01T15:00:00Z' }),
    ])
    const s = buildJobHistorySummary(weeks)
    expect(s.totalHours).toBeCloseTo(14)
    expect(s.peopleCount).toBe(2)
    expect(s.firstWorkDateYmd).toBe('2026-06-01')
    expect(s.lastWorkDateYmd).toBe('2026-07-15')
    expect(s.weekCount).toBe(3)
  })

  it('handles no weeks', () => {
    expect(buildJobHistorySummary([])).toEqual({
      totalHours: 0,
      peopleCount: 0,
      firstWorkDateYmd: null,
      lastWorkDateYmd: null,
      weekCount: 0,
    })
  })
})

describe('findJobOpenSessions', () => {
  it('returns open (no clock-out) sessions regardless of approval, one per user', () => {
    const open = findJobOpenSessions([
      row({}), // closed — excluded
      row({ user_id: 'u2', users: { name: 'Isiah' }, clocked_out_at: null, approved_at: null, clocked_in_at: '2026-07-19T13:00:00Z' }),
      row({ user_id: 'u2', users: { name: 'Isiah' }, clocked_out_at: null, approved_at: null, clocked_in_at: '2026-07-19T15:00:00Z' }), // later dup — earliest wins
      row({ user_id: 'u3', users: { name: 'Abe' }, clocked_out_at: null, clocked_in_at: '2026-07-19T12:00:00Z' }),
    ])
    expect(open.map((o) => `${o.name}@${o.clockedInAt}`)).toEqual([
      'Abe@2026-07-19T12:00:00Z',
      'Isiah@2026-07-19T13:00:00Z',
    ])
  })

  it('excludes rejected/revoked open rows and never-clocked-in rows', () => {
    const open = findJobOpenSessions([
      row({ clocked_out_at: null, rejected_at: '2026-07-19T00:00:00Z' }),
      row({ clocked_out_at: null, revoked_at: '2026-07-19T00:00:00Z' }),
      row({ clocked_in_at: null, clocked_out_at: null }),
    ])
    expect(open).toEqual([])
  })
})
