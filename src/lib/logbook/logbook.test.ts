import { describe, expect, it } from 'vitest'
import type { LicenseHoursLogRow } from '../licenseHoursLog'
import { withOfficeJob, goalsFor, logWeeks, monthsOfTrade, parseLicenseType, progressFor, rowCounts, supervisorCandidates, totalsOf } from './logbook'

function row(over: Partial<LicenseHoursLogRow>): LicenseHoursLogRow {
  return {
    session_id: Math.random().toString(36),
    work_date: '2026-10-28',
    clocked_in_at: '',
    clocked_out_at: '',
    hours: 8,
    job_ledger_id: 'j1',
    job_number: '1184',
    job_name: 'Whitfield water heater',
    job_address: '1208 Mesquite Ln',
    service_type_name: 'Plumbing',
    bid_id: null,
    notes: '',
    ...over,
  }
}

describe('parseLicenseType', () => {
  it('reads the Licenses tab free text into trade, class and number', () => {
    expect(parseLicenseType('Plumber Apprentice #141860')).toMatchObject({ trade: 'plumbing', cls: 'apprentice', number: '141860', name: 'Plumber Apprentice' })
    expect(parseLicenseType('Apprentice Electrician #783430')).toMatchObject({ trade: 'electrical', cls: 'apprentice' })
    expect(parseLicenseType('Master Electrician #49889')).toMatchObject({ trade: 'electrical', cls: 'master', number: '49889' })
    expect(parseLicenseType('AC Contractor TACLA39079E')).toMatchObject({ trade: 'hvac', cls: 'contractor', number: 'TACLA39079E', name: 'AC Contractor' })
    expect(parseLicenseType('AC Tech #158729')).toMatchObject({ trade: 'hvac', cls: 'registered_tech' })
  })
  it('keeps a license with no trade as held, never a ladder', () => {
    expect(parseLicenseType('Notary #135545090')).toMatchObject({ trade: null, cls: null, number: '135545090' })
  })
})

describe('goalsFor', () => {
  it('gives the next rung in every trade a person holds a license in', () => {
    const held = ['AC Tech #1', 'Apprentice Electrician #2', 'Plumber Apprentice #3'].map((t) => parseLicenseType(t))
    const { goals } = goalsFor(held)
    expect(goals.map((g) => g.requirement.toName)).toEqual(['Journeyman plumber', 'Journeyman electrician', 'Certified technician'])
  })
  it('climbs from the highest rung held, and names a top rung with no requirement', () => {
    const held = ['Journeyman Plumber #1', 'Master Plumber #2'].map((t) => parseLicenseType(t))
    const { goals, topOfLadder, noRuleYet } = goalsFor(held)
    expect(goals).toEqual([])
    expect(topOfLadder[0]?.cls).toBe('master')
    expect(noRuleYet).toEqual([])
  })
  it('calls a journeyman electrician the rung under master, not the top, when master has no rule seeded', () => {
    const held = [parseLicenseType('Journeyman Electrician #4')]
    const { goals, topOfLadder, noRuleYet } = goalsFor(held)
    expect(goals).toEqual([])
    expect(topOfLadder).toEqual([])
    expect(noRuleYet).toEqual([{ holds: held[0], next: { level: 'master', name: 'Master Electrician' } }])
  })
  it('names the top rung only when the trade has no higher level', () => {
    const { topOfLadder, noRuleYet } = goalsFor(['AC Contractor TACLA39079E', 'Electrical Contractor #5'].map((t) => parseLicenseType(t)))
    expect(topOfLadder.map((l) => l.cls)).toEqual(['contractor', 'contractor'])
    expect(noRuleYet).toEqual([])
  })
})

describe('rowCounts', () => {
  it('counts an hour toward the trade of its job and keeps office and estimating out', () => {
    expect(rowCounts(row({ service_type_name: 'Electrical' }))).toEqual({ trade: 'electrical' })
    expect(rowCounts(row({ job_ledger_id: null, bid_id: 'b1' }))).toEqual({ trade: null, reason: 'estimating' })
    expect(rowCounts(row({ job_ledger_id: null }))).toEqual({ trade: null, reason: 'office' })
    expect(rowCounts(row({ service_type_name: 'General contracting' }))).toEqual({ trade: null, reason: 'no_trade' })
  })
})

describe('progressFor', () => {
  it('adds the opening balance to the clock and names the next 500-hour mark', () => {
    const goal = goalsFor([parseLicenseType('Plumber Apprentice #3')]).goals[0]
    if (!goal) throw new Error('expected a goal')
    const rows = [row({ hours: 40 }), row({ hours: 10, service_type_name: 'Electrical' })]
    const p = progressFor(goal, rows, [{ trade: 'plumbing', amount: 1920, unit: 'hours', source: 'Old employer' }], '2026-11-03')
    expect(p).toMatchObject({ unit: 'hours', fromClock: 40, opening: 1920, done: 1960, nextMark: { at: 2000, away: 40 } })
  })
  it('counts an HVAC month only when it holds enough HVAC hours', () => {
    const rows = [
      row({ work_date: '2026-09-02', hours: 90, service_type_name: 'HVAC' }),
      row({ work_date: '2026-10-02', hours: 30, service_type_name: 'HVAC' }),
      row({ work_date: '2026-10-03', hours: 200, service_type_name: 'Plumbing' }),
    ]
    expect(monthsOfTrade(rows, 'hvac', '2026-11-03')).toEqual(['2026-09'])
    const goal = goalsFor([parseLicenseType('AC Tech #1')]).goals[0]
    if (!goal) throw new Error('expected a goal')
    expect(progressFor(goal, rows, [], '2026-11-03')).toMatchObject({ unit: 'months', done: 1, need: 24 })
  })
})

describe('logWeeks and totalsOf', () => {
  it('groups a week by job, counted trades first, and keeps the not-counted line', () => {
    const rows = [
      row({ work_date: '2026-10-27', hours: 8 }),
      row({ work_date: '2026-10-28', hours: 7.5 }),
      row({ work_date: '2026-10-29', hours: 2, job_ledger_id: null }),
      row({ work_date: '2026-10-20', hours: 8, service_type_name: 'HVAC', job_ledger_id: 'j2', job_number: '1170' }),
    ]
    const weeks = logWeeks(rows)
    expect(weeks).toHaveLength(2)
    expect(weeks[0]?.lines.map((l) => [l.jobNumber, l.hours])).toEqual([['1184', 15.5], ['', 2]])
    expect(weeks[0]).toMatchObject({ byTrade: { plumbing: 15.5 }, notCounted: 2 })
    const t = totalsOf(rows)
    expect(t.byTrade).toEqual({ plumbing: 15.5, electrical: 0, hvac: 8 })
    expect(t.notCounted.office).toBe(2)
    expect(t.all).toBe(25.5)
  })
})

describe('supervisorCandidates', () => {
  it('offers everyone else holding the supervisor class in the trade', () => {
    const all = [
      { personName: 'Zoe', license: parseLicenseType('Master Plumber #9') },
      { personName: 'Ana', license: parseLicenseType('Master Plumber #41130') },
      { personName: 'Ben', license: parseLicenseType('Journeyman Plumber #1') },
      { personName: 'Cal', license: parseLicenseType('Master Electrician #2') },
    ]
    expect(supervisorCandidates('plumbing', 'master', all, 'Zed')).toEqual([
      { personName: 'Ana', licenseName: 'Master Plumber', number: '41130' },
      { personName: 'Zoe', licenseName: 'Master Plumber', number: '9' },
    ])
  })
})

describe('withOfficeJob', () => {
  it('reads time on the office job as office, not as the trade on its service type', () => {
    const rows = withOfficeJob([row({ job_ledger_id: 'office', hours: 5 }), row({ hours: 3 })], 'office')
    expect(totalsOf(rows)).toMatchObject({ byTrade: { plumbing: 3 }, notCounted: { office: 5 } })
  })
})
