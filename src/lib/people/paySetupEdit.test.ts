import { describe, expect, it } from 'vitest'
import { draftFromFacts, parseWeekBoxes, payWords, paySetupPlan, wholeWeeksSince, type PaySetupDraft, type PaySetupFacts } from './paySetupEdit'

const DEFAULT_WEEK = [0, 8, 8, 8, 8, 8, 0]
const SIX = [0, 6, 6, 6, 6, 6, 0]
const CTX = { todayYmd: '2026-11-18', lastReportEndYmd: '2026-08-15' }

const HOURLY: PaySetupFacts = { exists: true, hourlyWage: 10, officeWage: null, isSalary: false, recordHoursButSalary: false, week: DEFAULT_WEEK, startDate: null, endDate: null }
const SALARIED: PaySetupFacts = { exists: true, hourlyWage: 10, officeWage: null, isSalary: true, recordHoursButSalary: true, week: SIX, startDate: '2026-11-16', endDate: null }
const NONE: PaySetupFacts = { exists: false, hourlyWage: null, officeWage: null, isSalary: false, recordHoursButSalary: false, week: DEFAULT_WEEK, startDate: null, endDate: null }

function draft(f: PaySetupFacts, patch: Partial<PaySetupDraft>): PaySetupDraft {
  return { ...draftFromFacts(f), ...patch }
}
function good(f: PaySetupFacts, d: PaySetupDraft) {
  const plan = paySetupPlan(f, d, CTX)
  if (!plan.ok) throw new Error(`expected a plan, got: ${plan.error}`)
  return plan
}

describe('opening the form', () => {
  it('a set week opens on the weekly pay its wage comes to, with its days', () => {
    expect(draftFromFacts(SALARIED)).toEqual({ kind: 'salaried', hourlyWage: '10', officeWage: '', week: ['0', '6', '6', '6', '6', '6', '0'], weeklyPay: '300', recordHours: true, startDate: '2026-11-16', endDate: '' })
  })

  it('an hourly person opens on the wage, with the default week ready and the clock tick on', () => {
    expect(draftFromFacts(HOURLY)).toMatchObject({ kind: 'hourly', hourlyWage: '10', weeklyPay: '', week: ['0', '8', '8', '8', '8', '8', '0'], recordHours: true })
  })

  it('nothing changed is no change', () => {
    expect(good(SALARIED, draftFromFacts(SALARIED))).toMatchObject({ payChanged: false, datesChanged: false, summary: 'No change.', warnings: [] })
    expect(good(HOURLY, draftFromFacts(HOURLY))).toMatchObject({ payChanged: false, summary: 'No change.' })
  })
})

describe('a set week', () => {
  it('thirty hours for $300 is $10 an hour, and a Monday on a job is $60', () => {
    const plan = good(HOURLY, draft(HOURLY, { kind: 'salaried', week: ['0', '6', '6', '6', '6', '6', '0'], weeklyPay: '300', startDate: '2026-11-16' }))
    expect(plan.write).toEqual({ hourly_wage: 10, office_hourly_wage: null, is_salary: true, record_hours_but_salary: true, salaried_week_hours: SIX })
    expect(plan.comesTo).toEqual({ weekHours: 30, wage: 10, weeklyPay: 300, mondayCost: 60 })
    expect(plan).toMatchObject({ payChanged: true, datesChanged: true, becameSalaried: true, stoppedSalaried: false })
    expect(plan.summary).toBe('Was by the hour at $10.00. Now $300.00 a week, 6 h Mon to Fri. Employment from 2026-11-16.')
  })

  it('a blank day is a day off, and each day keeps its own hours', () => {
    const plan = good(SALARIED, draft(SALARIED, { week: ['', '8', '8', '8', '8', '4', ''], weeklyPay: '360' }))
    expect(plan.write.salaried_week_hours).toEqual([0, 8, 8, 8, 8, 4, 0])
    expect(plan.comesTo).toEqual({ weekHours: 36, wage: 10, weeklyPay: 360, mondayCost: 80 })
    expect(plan.summary).toBe('Was $300.00 a week, 6 h Mon to Fri. Now $360.00 a week, 8 h Mon to Thu, 4 h Fri.')
  })

  it('a week that does not divide to the cent says what it will really pay', () => {
    const plan = good(SALARIED, draft(SALARIED, { week: ['0', '8', '8', '8', '8', '4', '0'], weeklyPay: '1000' }))
    expect(plan.comesTo).toEqual({ weekHours: 36, wage: 27.78, weeklyPay: 1000.08, mondayCost: 222.24 })
    expect(plan.warnings[0]).toBe('$27.78 an hour over 36 hours comes to $1,000.08 a week, not $1,000.00. A wage is kept to the cent.')
  })

  it('warns when there is no start date, counting the weeks since the last pay report', () => {
    const plan = good(HOURLY, draft(HOURLY, { kind: 'salaried', weeklyPay: '300' }))
    expect(plan.warnings).toEqual([
      'No start date. Payroll will show 13 earlier weeks with no pay report as owed. Set the day the set week starts.',
      'Past days on jobs are priced again at the new setup. Pay reports already made keep their amounts.',
    ])
    const never = paySetupPlan(HOURLY, draft(HOURLY, { kind: 'salaried', weeklyPay: '300' }), { todayYmd: '2026-11-18', lastReportEndYmd: null })
    expect(never.ok && never.warnings[0]).toBe('No start date. Payroll will pay every week it is asked for. Set the day the set week starts.')
  })

  it('keeps the office wage as stored, where it prices nothing', () => {
    const withOffice = { ...HOURLY, officeWage: 14 }
    expect(good(withOffice, draft(withOffice, { kind: 'salaried', weeklyPay: '400', startDate: '2026-11-16' })).write.office_hourly_wage).toBe(14)
  })

  it('the clock tick alone is a change, said in its own words', () => {
    const plan = good(SALARIED, draft(SALARIED, { recordHours: false }))
    expect(plan).toMatchObject({ payChanged: true, summary: 'No longer clocks in and out.', warnings: [] })
  })

  it('names the one field to fix', () => {
    const bad = (patch: Partial<PaySetupDraft>) => paySetupPlan(SALARIED, draft(SALARIED, patch), CTX)
    expect(bad({ week: ['0', '0', '0', '0', '0', '0', '0'] })).toEqual({ ok: false, field: 'week', error: 'Give at least one day its hours' })
    expect(bad({ week: ['0', '6.1', '6', '6', '6', '6', '0'] })).toEqual({ ok: false, field: 'week', error: 'A day’s hours go by the quarter hour' })
    expect(bad({ week: ['0', '17', '6', '6', '6', '6', '0'] })).toEqual({ ok: false, field: 'week', error: 'A day holds at most 16 hours' })
    expect(bad({ week: ['0', 'x', '6', '6', '6', '6', '0'] })).toEqual({ ok: false, field: 'week', error: 'A day’s hours must be a number, 0 or more' })
    expect(bad({ weeklyPay: '' })).toEqual({ ok: false, field: 'weeklyPay', error: 'Enter the weekly pay' })
    expect(bad({ weeklyPay: '0' })).toEqual({ ok: false, field: 'weeklyPay', error: 'Enter the weekly pay' })
    expect(bad({ weeklyPay: '0.10' })).toEqual({ ok: false, field: 'weeklyPay', error: 'That weekly pay comes to less than a cent an hour' })
    expect(bad({ startDate: '2026-11-16', endDate: '2026-11-01' })).toEqual({ ok: false, field: 'dates', error: 'The end date must be on or after the start date' })
  })
})

describe('by the hour', () => {
  it('a set week turned to the hour keeps its week on file and says so in the line', () => {
    const plan = good(SALARIED, draft(SALARIED, { kind: 'hourly', hourlyWage: '12' }))
    expect(plan.write).toEqual({ hourly_wage: 12, office_hourly_wage: null, is_salary: false, record_hours_but_salary: true, salaried_week_hours: SIX })
    expect(plan).toMatchObject({ stoppedSalaried: true, becameSalaried: false, comesTo: null })
    expect(plan.summary).toBe('Was $300.00 a week, 6 h Mon to Fri. Now by the hour at $12.00.')
  })

  it('a first pay setup has no was to re-price', () => {
    const plan = good(NONE, draft(NONE, { hourlyWage: '18.5', officeWage: '15' }))
    expect(plan.write).toMatchObject({ hourly_wage: 18.5, office_hourly_wage: 15, is_salary: false })
    expect(plan.summary).toBe('Was no pay setup. Now by the hour at $18.50.')
    expect(plan.warnings).toEqual([])
  })

  it('a blank wage is no wage, and a wage that is not a number is named', () => {
    expect(good(HOURLY, draft(HOURLY, { hourlyWage: '' })).write.hourly_wage).toBeNull()
    expect(paySetupPlan(HOURLY, draft(HOURLY, { hourlyWage: 'ten' }), CTX)).toEqual({ ok: false, field: 'hourlyWage', error: 'The wage must be a number, 0 or more' })
    expect(paySetupPlan(HOURLY, draft(HOURLY, { officeWage: '-1' }), CTX)).toEqual({ ok: false, field: 'officeWage', error: 'The office wage must be a number, 0 or more' })
  })
})

describe('the small rules', () => {
  it('reads the seven boxes', () => {
    expect(parseWeekBoxes(['', '7.25', '7.5', '7.75', '6', '6', ''])).toEqual({ week: [0, 7.25, 7.5, 7.75, 6, 6, 0] })
    expect(parseWeekBoxes(['0', '8'])).toEqual({ error: 'The week needs seven days' })
  })

  it('says how a person is paid', () => {
    expect(payWords(HOURLY)).toBe('by the hour at $10.00')
    expect(payWords(SALARIED)).toBe('$300.00 a week, 6 h Mon to Fri')
    expect(payWords(NONE)).toBe('no pay setup')
    expect(payWords({ ...HOURLY, hourlyWage: null })).toBe('by the hour with no wage')
    expect(payWords({ ...SALARIED, hourlyWage: null })).toBe('a set week with no pay, 6 h Mon to Fri')
  })

  it('counts whole weeks since the last pay report', () => {
    expect(wholeWeeksSince('2026-08-15', '2026-11-18')).toBe(13)
    expect(wholeWeeksSince('2026-11-14', '2026-11-18')).toBe(0)
    expect(wholeWeeksSince('2026-11-21', '2026-11-18')).toBe(0)
    expect(wholeWeeksSince(null, '2026-11-18')).toBe(0)
  })
})
