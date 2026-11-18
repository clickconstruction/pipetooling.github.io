/**
 * The dev seat's pay setup pair (v2.7821; server 0.102.0): plan_pay_setup → apply_pay_setup. The kernel says what the
 * ask may name, what is refused, what each write becomes and what the change reaches back into; the server reads the
 * world and runs the legs. Every name here is made up: a person's pay is private, and no real row is a fixture.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  CATCH_UP_WEEKS,
  PAY_PERSON_SELECT,
  PAY_ROW_SELECT,
  PAY_SETUP_VERBS,
  PAY_TEMPLATE_SELECT,
  PAY_USER_SELECT,
  SALARIED_DAY_HOURS_DEFAULT,
  WAGE_MAX,
  crewDays,
  dayMinutesOf,
  isPaySetupVerb,
  payLogRow,
  payNameOf,
  payrollWeeks,
  paySetupAppliedWords,
  paySetupDryRun,
  paySetupInput,
  readPaySetupWorld,
  resolvePaySetup,
  salariedCreditHours,
  salariedDayHoursOf,
  setPayConfigArgs,
  weeksBefore,
  workdayEndOf,
  workdayTemplateRow,
  type PayPersonRow,
  type PayRow,
  type PaySetupPayload,
  type PaySetupReads,
  type PaySetupWorld,
  type PayTemplateRow,
  type PayUserRow,
} from '../../../supabase/functions/_shared/devMcpPaySetup'
import { accountInput, salaryTemplateRow } from '../../../supabase/functions/_shared/devMcpAccount'
import { WRITE_VERBS, planHash, planReply, planVerbFor, writeRpcBody } from '../../../supabase/functions/_shared/devMcpWrites'
import { CATALOG_RPCS, CATALOG_TABLES } from '../../../supabase/functions/dev-mcp/catalog'
import { APP_CALENDAR_TZ } from '../../../supabase/functions/_shared/appTimeZone'
import { salariedHoursForDay } from '../salariedPayrollDays'
import { scanWeeksBefore, unreportedPayrollWeeks } from '../unreportedPayrollWeeks'

const SERVER = readFileSync('supabase/functions/dev-mcp/index.ts', 'utf8')
const README = readFileSync('docs/dev-mcp/README.md', 'utf8')
const DESK = readFileSync('src/components/personDesk/sections/PersonDeskPaySection.tsx', 'utf8')
const HIRE = readFileSync('src/lib/people/hireWrites.ts', 'utf8')
const SET_PAY_CONFIG = readFileSync('supabase/migrations/20260918100000_pay_person_admin.sql', 'utf8')

const USER = '2a9722b9-b354-49d0-a60c-53d6f0345bb4'
const PERSON = 'd73eebbd-ba46-43ed-9940-ed8d919b55ba'
const DEV = 'd0000000-0000-4000-8000-00000000000d'
/** A Wednesday. The week holding it starts Sunday 2026-11-15. */
const TODAY = '2026-11-18'
const NAME = 'ZZ Test Helper'

const user: PayUserRow = { id: USER, name: NAME, role: 'helpers', login_attached_at: '2026-10-01T15:00:00Z', archived_at: null, is_sample: false, is_digital_twin: false, is_walk_tester: false }
const person: PayPersonRow = { id: PERSON, name: NAME, kind: 'helper', start_date: null, end_date: null, archived_at: null, account_user_id: USER }
const hourly: PayRow = { person_name: NAME, person_id: PERSON, hourly_wage: 20, office_hourly_wage: null, is_salary: false, record_hours_but_salary: false }
const salaried: PayRow = { ...hourly, hourly_wage: 25, is_salary: true }
const template: PayTemplateRow = { user_id: USER, timezone: APP_CALENDAR_TZ, exclude_weekends: true, mode: 'continuous', segment_a_start_local: '07:00:00', segment_a_duration_minutes: 480, segment_b_start_local: null, segment_b_duration_minutes: null, use_split_focus: false, job_ledger_id: null, bid_id: null, updated_at: '2026-10-02T12:00:00Z' }
/** One pay report, through Saturday 2026-10-17: four whole weeks before this one have none. */
const world = (over: Partial<PaySetupWorld> = {}): PaySetupWorld => ({
  user,
  person,
  payRow: hourly,
  payRowOtherName: null,
  template: null,
  overrides: 0,
  stubs: [{ period_start: '2026-10-11', period_end: '2026-10-17' }],
  stubDays: 5,
  stints: [{ start_date: null, end_date: null }],
  timeOff: [],
  // A Tuesday, a Saturday, a Tuesday, and a day still to come.
  crewDates: ['2026-10-20', '2026-10-24', '2026-11-03', '2026-11-20'],
  ...over,
})
const ask = (set: Record<string, unknown>, verb: 'plan_pay_setup' | 'apply_pay_setup' = 'plan_pay_setup'): PaySetupPayload => {
  const built = paySetupInput(verb, { pay: { person: NAME, reason: 'The owner put them on a weekly salary.', ...set } })
  if (!built.ok) throw new Error(built.error)
  return built.p
}
const plan = (set: Record<string, unknown>, w: PaySetupWorld = world()) => {
  const dry = paySetupDryRun(ask(set), w, TODAY)
  if (!dry.ok) throw new Error(dry.refused)
  return dry.reply as Record<string, any>
}
const refusal = (set: Record<string, unknown>, w: PaySetupWorld = world()): string => {
  const dry = paySetupDryRun(ask(set), w, TODAY)
  return dry.ok ? '' : dry.refused
}

describe('the pay setup pair is on the allowlist with no wrapper RPC', () => {
  it('two write verbs, rpc null, plan before apply, and the server declares each', () => {
    expect([...PAY_SETUP_VERBS]).toEqual(['plan_pay_setup', 'apply_pay_setup'])
    for (const v of PAY_SETUP_VERBS) {
      expect(WRITE_VERBS[v]).toEqual({ rpc: null, step: v.startsWith('plan_') ? 'plan' : 'apply' })
      expect(isPaySetupVerb(v)).toBe(true)
      expect(SERVER).toContain(`name: '${v}'`)
      expect(SERVER).toContain(`case '${v}':`)
    }
    expect(isPaySetupVerb('plan_account')).toBe(false)
    expect(planVerbFor('apply_pay_setup')).toBe('plan_pay_setup')
    expect(Object.keys(WRITE_VERBS)).toHaveLength(127)
    expect(SERVER).toContain("const SERVER_VERSION = '0.103.0'")
    expect(SERVER).toContain('Writes are one hundred and twenty-seven verbs and nothing else:')
    expect(SERVER).toContain('plan_pay_setup → apply_pay_setup')
    expect(README).toContain('`plan_pay_setup(pay)` · `apply_pay_setup(pay, plan_hash)`')
    expect(README).toContain("one hundred and twenty-five since v2.7821's pay setup pair")
  })

  it('writes only as a dev, through the desk\'s own doors, and the pay row through the audited one', () => {
    const branch = SERVER.slice(SERVER.indexOf("case 'plan_pay_setup':"), SERVER.indexOf("case 'plan_login':"))
    expect(branch).toContain("if (who.role !== 'dev') return refused(`${name} writes, and only a dev's own key may write.`)")
    expect(branch).toContain("restPost(session, 'rpc/set_pay_config', setPayConfigArgs(ops, p.reason))")
    expect(branch).toContain("'rpc/pay_staff_clear_salary_schedule_by_person_name'")
    expect(branch).toContain("'rpc/sync_salary_clock_sessions_for_user_day'")
    expect(branch).toContain("restRows(session, 'PATCH', 'people', `id=eq.${ops.personId}`")
    expect(branch).toContain("'pay_admin_events'")
    // The plan is hashed before any write, and an apply whose hash moved is refused.
    expect(branch.indexOf('planMismatch(')).toBeLessThan(branch.indexOf("'rpc/set_pay_config'"))
    // The desk performs the same two side effects (upsertPay), and the Hire form saves the same template row.
    expect(DESK).toContain("supabase.rpc('pay_staff_clear_salary_schedule_by_person_name'")
    expect(DESK).toContain('syncSalaryClockSessionsForUserDay(userId, todayYmd)')
    expect(DESK).toContain("supabase.from('people').update({ start_date: start, end_date: end }).eq('id', personId)")
    expect(HIRE).toContain('segment_a_duration_minutes: 480')
  })

  it('reads real columns and calls real functions with the keys they take', () => {
    const cols = (t: string) => Object.keys(CATALOG_TABLES[t]!.columns)
    for (const c of PAY_USER_SELECT.split(',')) expect(cols('users')).toContain(c)
    for (const c of PAY_PERSON_SELECT.split(',')) expect(cols('people')).toContain(c)
    for (const c of PAY_ROW_SELECT.split(',')) expect(cols('people_pay_config')).toContain(c)
    for (const c of PAY_TEMPLATE_SELECT.split(',')) expect(cols('salary_work_schedule_templates')).toContain(c)
    for (const c of Object.keys(workdayTemplateRow(USER, '06:00', APP_CALENDAR_TZ))) expect(cols('salary_work_schedule_templates')).toContain(c)
    expect(cols('salary_work_schedule_day_overrides')).toContain('user_id')
    for (const c of ['period_start', 'period_end', 'person_name']) expect(cols('pay_stubs')).toContain(c)
    expect(cols('pay_stub_days')).toContain('person_name')
    for (const c of ['work_date', 'job_assignments', 'person_name', 'person_id']) expect(cols('people_crew_jobs')).toContain(c)
    for (const c of ['start_date', 'end_date', 'person_id']) expect(cols('employment_stints')).toContain(c)
    for (const c of ['start_date', 'end_date', 'kind', 'user_id']) expect(cols('user_time_off')).toContain(c)
    const r = resolvePaySetup(ask({ hourly_wage: 25, office_hourly_wage: 22, is_salary: true, record_hours_but_salary: true, start_date: '2026-11-09', workday_start: '06:00' }), world())
    if (!r.ok) throw new Error(r.refused)
    for (const c of Object.keys(payLogRow(r.ops, 'why', DEV)!)) expect(cols('pay_admin_events')).toContain(c)
    expect(Object.keys(setPayConfigArgs(r.ops, 'why')).sort()).toEqual(Object.keys(CATALOG_RPCS.set_pay_config![0]!.args).sort())
    // set_pay_config refuses a key it does not know, and its log table an action it does not know.
    for (const key of Object.keys(r.ops.payChanges!)) expect(SET_PAY_CONFIG).toContain(`'${key}'`)
    expect(SET_PAY_CONFIG).toContain("action IN ('void_report', 'set_hours', 'set_pay_config', 'set_alias')")
    expect(payLogRow(r.ops, 'why', DEV)).toMatchObject({ action: 'set_pay_config', person_name: NAME, reason: 'why', actor: DEV })
    expect(Object.keys(CATALOG_RPCS.sync_salary_clock_sessions_for_user_day![0]!.args).sort()).toEqual(['p_user_id', 'p_work_date'])
    expect(Object.keys(CATALOG_RPCS.pay_staff_clear_salary_schedule_by_person_name![0]!.args)).toEqual(['p_person_name'])
  })

  it('plan_account sends a person who exists to this pair', () => {
    const r = accountInput('plan_account', { account: { person: NAME, pay: { hourly_wage: 30 } } }, TODAY)
    expect(r).toMatchObject({ ok: false, error: expect.stringContaining('plan_pay_setup') })
  })
})

describe('plan_pay_setup — the shape', () => {
  const r = (pay: unknown) => paySetupInput('plan_pay_setup', { pay })
  it('keeps what was asked, to the cent, and no more', () => {
    expect(r({ person: ` ${NAME} `, reason: '  Weekly   salary. ', hourly_wage: 25.004, is_salary: true, start_date: '2026-11-09', workday_start: '06:00' })).toEqual({
      ok: true,
      target: NAME,
      p: { action: 'pay_setup', person: NAME, reason: 'Weekly salary.', set: { hourly_wage: 25, is_salary: true, start_date: '2026-11-09', workday_start: '06:00' } },
    })
    expect(r({ person: NAME, reason: 'x', hourly_wage: null, end_date: null })).toMatchObject({ ok: true, p: { set: { hourly_wage: null, end_date: null } } })
    expect(writeRpcBody('plan_pay_setup', { pay: { person: NAME, reason: 'x', is_salary: false } })).toMatchObject({ ok: true, rpc: null, step: 'plan', body: { p: { action: 'pay_setup', set: { is_salary: false } } } })
    expect(writeRpcBody('apply_pay_setup', { pay: { person: NAME, reason: 'x', is_salary: false } })).toMatchObject({ ok: false })
  })

  it('refuses in words', () => {
    expect(r(undefined)).toMatchObject({ ok: false, error: expect.stringContaining('plan_pay_setup needs pay') })
    expect(r({ reason: 'x', is_salary: true })).toMatchObject({ ok: false, error: expect.stringContaining('pay.person is required') })
    expect(r({ person: NAME, is_salary: true })).toMatchObject({ ok: false, error: expect.stringContaining('pay.reason is required') })
    expect(r({ person: NAME, reason: 'x'.repeat(301), is_salary: true })).toMatchObject({ ok: false, error: expect.stringContaining('over 300') })
    expect(r({ person: NAME, reason: 'x' })).toMatchObject({ ok: false, error: expect.stringContaining('name at least one change') })
    expect(r({ person: NAME, reason: 'x', hourly_wage: -1 })).toMatchObject({ ok: false, error: expect.stringContaining('0 or more') })
    expect(r({ person: NAME, reason: 'x', hourly_wage: '25' })).toMatchObject({ ok: false, error: expect.stringContaining('must be a number') })
    expect(r({ person: NAME, reason: 'x', is_salary: 'yes' })).toMatchObject({ ok: false, error: expect.stringContaining('true or false') })
    expect(r({ person: NAME, reason: 'x', start_date: 'Nov 9' })).toMatchObject({ ok: false, error: expect.stringContaining('YYYY-MM-DD') })
    expect(r({ person: NAME, reason: 'x', start_date: '2026-11-09', end_date: '2026-11-01' })).toMatchObject({ ok: false, error: expect.stringContaining('on or after') })
    expect(r({ person: NAME, reason: 'x', workday_start: '6am' })).toMatchObject({ ok: false, error: expect.stringContaining('HH:MM') })
    expect(r({ person: NAME, reason: 'x', workday_start: '24:00' })).toMatchObject({ ok: false, error: expect.stringContaining('HH:MM') })
  })

  it('a weekly figure in the wage box is refused with the sum to do', () => {
    expect(r({ person: NAME, reason: 'x', hourly_wage: 1000 })).toMatchObject({ ok: false, error: expect.stringContaining('divide a weekly amount by 40') })
    expect(r({ person: NAME, reason: 'x', hourly_wage: WAGE_MAX })).toMatchObject({ ok: true })
  })

  it('the workday\'s length may be named, once, and is kept for the plan to judge', () => {
    expect(r({ person: NAME, reason: 'x', is_salary: true, workday_start: '06:00', workday_end: '12:00' })).toMatchObject({ ok: true, p: { set: { workday_start: '06:00', workday_hours: 6 } } })
    expect(r({ person: NAME, reason: 'x', workday_start: '06:00', workday_minutes: 360 })).toMatchObject({ ok: true, p: { set: { workday_hours: 6 } } })
    expect(r({ person: NAME, reason: 'x', workday_start: '06:00', workday_hours: 8, workday_end: '14:00' })).toMatchObject({ ok: true, p: { set: { workday_start: '06:00', workday_hours: 8 } } })
    expect(r({ person: NAME, reason: 'x', workday_start: '22:00', workday_end: '06:00' })).toMatchObject({ ok: true, p: { set: { workday_hours: 8 } } })
    expect(r({ person: NAME, reason: 'x', is_salary: true, workday_hours: 8 })).toMatchObject({ ok: false, error: expect.stringContaining('goes with pay.workday_start') })
    expect(r({ person: NAME, reason: 'x', workday_start: '06:00', workday_hours: 6, workday_end: '14:00' })).toMatchObject({ ok: false, error: expect.stringContaining('Name the length once') })
    expect(r({ person: NAME, reason: 'x', workday_start: '06:00', workday_hours: 0 })).toMatchObject({ ok: false, error: expect.stringContaining('over 0 and at most 24') })
    expect(r({ person: NAME, reason: 'x', workday_start: '06:00', workday_end: 'noon' })).toMatchObject({ ok: false, error: expect.stringContaining('pay.workday_end must be HH:MM') })
    expect(workdayEndOf('06:00')).toBe('14:00')
    expect(workdayEndOf('18:30')).toBe('02:30')
    expect(workdayEndOf('06:00', 6)).toBe('12:00')
  })
})

describe('plan_pay_setup — the dry run', () => {
  it('Salaried on with no start date: every week with no report shows, and the plan says so', () => {
    const p = plan({ hourly_wage: 25, is_salary: true })
    expect(p.changes.map((c: any) => c.words)).toEqual(['the hourly wage: $20.00/h → $25.00/h', 'Salaried: off → on'])
    expect(p.weekly).toMatchObject({ per_week: 1000, words: expect.stringContaining('$25.00/h × 8 h × 5 weekdays = $1,000.00 a week') })
    expect(p.reaches_back.payroll).toMatchObject({ last_report_through: '2026-10-17', weeks_without_report: 4, salaried_before: null, salaried_after: { weeks: 4, hours: 160, est_gross: 4000, first_week: '2026-10-18', last_week: '2026-11-08' } })
    expect(p.reaches_back.payroll.words).toContain('4 whole weeks before this one have no pay report')
    expect(p.reaches_back.payroll.words).toContain('and no start date, 4 of them show on payroll catch-up as an unreported week')
    expect(p.reaches_back.payroll.words).toContain('The app has no effective date')
    expect(p.reaches_back.payroll.words).toContain('pass start_date')
    expect(p.reaches_back.rule).toContain('no effective date and no wage history')
  })

  it('a start date shields payroll, and only payroll', () => {
    const p = plan({ hourly_wage: 25, is_salary: true, start_date: '2026-11-09' })
    expect(p.reaches_back.payroll.salaried_after).toMatchObject({ weeks: 1, hours: 40, est_gross: 1000, first_week: '2026-11-08' })
    expect(p.reaches_back.payroll.words).toContain('and the start date 2026-11-09, 1 of them shows')
    expect(plan({ hourly_wage: 25, is_salary: true, start_date: '2026-11-16' }).reaches_back.payroll.words).toContain('none of them shows on payroll catch-up')
    // Job labor reads today's row for every past day: the same crew days either way.
    expect(p.reaches_back.job_labor).toMatchObject({ days: 3, weekdays: 2, weekend_days: 1, first: '2026-10-20', last: '2026-11-03' })
    expect(p.reaches_back.job_labor.words).toContain('3 past crew days (2026-10-20 to 2026-11-03) re-price on job labor')
    expect(p.reaches_back.job_labor.words).toContain('each of the 2 weekdays reads a flat 8 h × $25.00/h whatever was logged')
    expect(p.reaches_back.job_labor.words).toContain('The start date does not shield them')
    expect(p.stints).toContain('the current stint')
  })

  it('pay reports already made keep their stored amounts', () => {
    expect(plan({ hourly_wage: 25 }).reaches_back.pay_reports).toMatchObject({ pay_stubs: 1, pay_stub_days: 5, words: expect.stringContaining('keeps the hours, rates and amounts stored on it') })
    expect(plan({ hourly_wage: 25 }, world({ stubs: [], stubDays: 0 })).reaches_back.pay_reports.words).toContain('No pay report exists yet')
  })

  it('a wage change alone re-prices every past crew day, hourly or salaried', () => {
    expect(plan({ hourly_wage: 22 }).reaches_back.job_labor.words).toContain('3 past crew days (2026-10-20 to 2026-11-03) re-price on job labor at their logged hours × $22.00/h in place of $20.00/h')
    expect(plan({ hourly_wage: 30 }, world({ payRow: salaried })).reaches_back.job_labor.words).toContain('2 past weekday crew days (2026-10-20 to 2026-11-03) re-price on job labor at a flat 8 h × $30.00/h in place of $25.00/h')
    expect(plan({ start_date: '2026-11-09' }).reaches_back.job_labor.words).toContain('Job labor does not re-price')
    expect(plan({ hourly_wage: 22 }, world({ crewDates: [] })).reaches_back.job_labor.words).toContain('on no crew day with a job yet')
  })

  it('with no pay report ever, the weeks payroll catch-up scans are the ones counted', () => {
    const p = plan({ hourly_wage: 25, is_salary: true }, world({ stubs: [], stubDays: 0 }))
    expect(p.reaches_back.payroll).toMatchObject({ last_report_through: null, weeks_counted: CATCH_UP_WEEKS, weeks_without_report: CATCH_UP_WEEKS, salaried_after: { weeks: CATCH_UP_WEEKS } })
    expect(p.reaches_back.payroll.words).toContain(`No pay report has ever been made for ${NAME}`)
  })

  it('the clock: no template, a template made, a template that stands, and a start moved', () => {
    const none = plan({ hourly_wage: 25, is_salary: true })
    expect(none.workday_template).toEqual({ exists: false })
    expect(none.clock.words).toContain('No workday template')
    expect(none.clock.words).toContain('Pass workday_start (HH:MM)')
    expect(none.fixed_day).toContain('A salaried day is 8 hours for this person')
    expect(none.fixed_day).toContain('Today every salaried day is 8 hours')
    expect(none.salaried_day_hours).toBe(8)
    const made = plan({ hourly_wage: 25, is_salary: true, workday_start: '06:00' })
    expect(made.clock.words).toContain('A workday template is made: 8 hours from 06:00 to 14:00, weekdays')
    expect(made.writes.join(' | ')).toContain('one continuous 480-minute block from 06:00, weekdays')
    const stands = plan({ hourly_wage: 25, is_salary: true }, world({ template }))
    expect(stands.workday_template).toMatchObject({ exists: true, start: '07:00', minutes: 480 })
    expect(stands.clock.words).toContain('A workday template stands: 8 hours from 07:00 to 15:00')
    const moved = plan({ workday_start: '06:00' }, world({ payRow: salaried, template }))
    expect(moved.clock.words).toContain('The workday template moves from 07:00: 8 hours from 06:00 to 14:00')
    expect(moved.writes.join(' | ')).toContain("the workday template's start: 07:00 → 06:00; its length, its days and its job focus stay")
    expect(plan({ hourly_wage: 22 }).clock.words).toContain('Hourly')
    expect(plan({ hourly_wage: 22 }).fixed_day).toBeNull()
  })

  it('Salaried off: the schedule goes, and the plan counts what goes with it', () => {
    const p = plan({ is_salary: false }, world({ payRow: salaried, template, overrides: 3 }))
    expect(p.clock.words).toContain('Turning Salaried off clears the workday schedule: the template (07:00), 3 day overrides, and today\'s unapproved auto-sessions')
    expect(p.after.workday_start).toBeNull()
    expect(p.reaches_back.payroll.salaried_before).toMatchObject({ weeks: 4, est_gross: 4000 })
    expect(p.reaches_back.payroll.salaried_after).toBeNull()
    expect(p.reaches_back.payroll.words).toContain('With Salaried off')
    expect(p.reaches_back.job_labor.words).toContain('each goes back to its logged hours')
    expect(p.writes.join(' | ')).toContain('pay_staff_clear_salary_schedule_by_person_name')
    expect(p.writes.join(' | ')).not.toContain('sync_salary_clock_sessions_for_user_day')
  })

  it('refusals once the rows are read', () => {
    expect(refusal({ is_salary: true }, world({ user: null, person: null }))).toContain('No person for')
    expect(refusal({ hourly_wage: 25 }, world({ user: { ...user, is_sample: true } }))).toContain('fixture account')
    expect(refusal({ hourly_wage: 25 }, world({ user: { ...user, archived_at: '2026-09-01T00:00:00Z' } }))).toContain('is archived (2026-09-01)')
    expect(refusal({ hourly_wage: 25 }, world({ user: null, person: { ...person, archived_at: '2026-09-01T00:00:00Z' } }))).toContain('is archived')
    expect(refusal({ hourly_wage: 25 }, world({ user: { ...user, role: 'primary' } }))).toContain('never paid through the pay tables')
    expect(refusal({ hourly_wage: 25 }, world({ payRowOtherName: 'ZZ Test Helpr' }))).toContain('under another name, "ZZ Test Helpr"')
    expect(refusal({ start_date: '2026-11-09' }, world({ person: null }))).toContain('the employment dates live on it')
    expect(refusal({ end_date: '2026-10-01' }, world({ person: { ...person, start_date: '2026-11-01' } }))).toContain('would fall before the start date 2026-11-01')
    expect(refusal({ is_salary: true }, world({ payRow: { ...hourly, hourly_wage: null } }))).toContain('Salaried needs the hourly rate')
    expect(refusal({ hourly_wage: null }, world({ payRow: salaried }))).toContain('Salaried needs the hourly rate')
    expect(refusal({ record_hours_but_salary: true })).toContain('goes with Salaried')
    expect(refusal({ workday_start: '06:00' })).toContain('a workday template is a salaried day\'s')
    expect(refusal({ is_salary: true, hourly_wage: 25, workday_start: '06:00' }, world({ user: null }))).toContain('has no users row')
    expect(refusal({ workday_start: '06:00' }, world({ payRow: salaried, template: { ...template, mode: 'split', segment_a_duration_minutes: 240, segment_b_start_local: '13:00:00', segment_b_duration_minutes: 240 } }))).toContain('is a split day (07:00 for 240 minutes, then 13:00 for 240)')
    expect(refusal({ hourly_wage: 20, is_salary: false })).toContain('already reads that way (hourly_wage, is_salary)')
  })

  it('a roster row with no users row is paid by its roster name', () => {
    expect(payNameOf(null, person)).toBe(NAME)
    expect(payNameOf({ name: '  ' }, { name: ` ${NAME} ` })).toBe(NAME)
    const p = plan({ hourly_wage: 25, is_salary: true }, world({ user: null }))
    expect(p.person).toMatchObject({ pay_name: NAME, user_id: null, login: 'no users row' })
    expect(p.clock.words).toContain('has no users row, so no workday template')
    expect(p.writes.join(' | ')).not.toContain('sync_salary_clock_sessions_for_user_day')
  })
})

describe('a salaried day\'s length is read in one place', () => {
  it('8 hours today, and a workday of another length is refused with nothing stored', () => {
    expect(SALARIED_DAY_HOURS_DEFAULT).toBe(8)
    expect(salariedDayHoursOf(null)).toBe(8)
    expect(salariedDayHoursOf(hourly)).toBe(8)
    expect(dayMinutesOf(salariedDayHoursOf(hourly))).toBe(480)
    const six = refusal({ hourly_wage: 25, is_salary: true, workday_start: '06:00', workday_end: '12:00' })
    expect(six).toContain('a 6-hour workday (06:00 to 12:00) is not ZZ Test Helper\'s salaried day')
    expect(six).toContain('A salaried day is 8 hours for this person')
    expect(six).toContain('a person\'s own day length is not on the pay row yet')
    expect(six).toContain('nothing was stored')
    expect(six).toContain('the sessions then run 06:00 to 14:00')
    // The one length the person's day holds passes, and the template is that long.
    const eight = plan({ hourly_wage: 25, is_salary: true, workday_start: '06:00', workday_hours: 8 })
    expect(eight.writes.join(' | ')).toContain('one continuous 480-minute block from 06:00')
    // The kernel never writes a bare 8 or 480 where a day's length belongs.
    const kernel = readFileSync('supabase/functions/_shared/devMcpPaySetup.ts', 'utf8')
    expect(kernel.match(/\b480\b/g)?.length).toBe(1) // the comment that says what today's day is
    expect(kernel).not.toMatch(/segment_a_duration_minutes: \d/)
    expect(kernel).not.toMatch(/\* 8 \*|× 8 ×/)
  })

  it('a pay row that carries its own day is priced, credited and scheduled by it', () => {
    // The follow-up adds salaried_day_hours to PAY_ROW_SELECT and to the ask; nothing below it moves.
    const sixHour = world({ payRow: { ...hourly, salaried_day_hours: 6 } })
    expect(salariedDayHoursOf(sixHour.payRow)).toBe(6)
    const p = plan({ hourly_wage: 10, is_salary: true, start_date: '2026-11-09', workday_start: '06:00', workday_end: '12:00' }, sixHour)
    expect(p.salaried_day_hours).toBe(6)
    expect(p.weekly).toMatchObject({ day_hours: 6, per_week: 300, words: expect.stringContaining('$10.00/h × 6 h × 5 weekdays = $300.00 a week') })
    expect(p.reaches_back.payroll.salaried_after).toMatchObject({ weeks: 1, hours: 30, est_gross: 300 })
    expect(p.reaches_back.job_labor.words).toContain('reads a flat 6 h × $10.00/h')
    expect(p.clock.words).toContain('6 hours from 06:00 to 12:00')
    expect(p.writes.join(' | ')).toContain('one continuous 360-minute block from 06:00')
    const r = resolvePaySetup(ask({ hourly_wage: 10, is_salary: true, workday_start: '06:00' }), sixHour)
    if (!r.ok) throw new Error(r.refused)
    expect(r.ops.dayHours).toBe(6)
    expect(workdayTemplateRow(USER, '06:00', APP_CALENDAR_TZ, r.ops.dayHours)).toMatchObject({ segment_a_duration_minutes: 360, segment_a_start_local: '06:00:00' })
    // And an 8-hour workday is then the one refused.
    expect(refusal({ hourly_wage: 10, is_salary: true, workday_start: '06:00', workday_hours: 8 }, sixHour)).toContain('an 8-hour workday (06:00 to 14:00) is not')
    expect(salariedCreditHours('2026-11-10', { timeOff: [], employmentStart: null, employmentEnd: null, stints: [] }, 6)).toBe(6)
    expect(SERVER).toContain('workdayTemplateRow(ops.userId!, t.start, APP_CALENDAR_TZ, ops.dayHours)')
  })
})

describe('what apply writes', () => {
  const ops = (set: Record<string, unknown>, w: PaySetupWorld = world()) => {
    const r = resolvePaySetup(ask(set), w)
    if (!r.ok) throw new Error(r.refused)
    return r.ops
  }
  it('only the keys that move, in the desk\'s order, with its side effects', () => {
    const on = ops({ hourly_wage: 25, office_hourly_wage: null, is_salary: true, start_date: '2026-11-09', workday_start: '06:00' })
    expect(on).toMatchObject({
      payName: NAME,
      userId: USER,
      personId: PERSON,
      dates: { start_date: '2026-11-09', end_date: null },
      payChanges: { hourly_wage: 25, is_salary: true },
      linkPersonId: null,
      clearSchedule: false,
      template: { kind: 'insert', start: '06:00' },
      sync: true,
      logPayload: { via: 'dev-mcp', verb: 'apply_pay_setup', before: { start_date: null, workday_start: null }, after: { start_date: '2026-11-09', workday_start: '06:00' } },
    })
    expect(setPayConfigArgs(on, 'Weekly salary.')).toEqual({ p_person: NAME, p_changes: { hourly_wage: 25, is_salary: true }, p_reason: 'Weekly salary.' })
    // The same row the Hire form and plan_account (new) save.
    expect(workdayTemplateRow(USER, '06:00', APP_CALENDAR_TZ)).toEqual(salaryTemplateRow(USER, '06:00', APP_CALENDAR_TZ))
    const off = ops({ is_salary: false }, world({ payRow: salaried, template }))
    expect(off).toMatchObject({ payChanges: { is_salary: false }, clearSchedule: true, sync: false, template: null, dates: null, logPayload: null })
    expect(payLogRow(off, 'x', DEV)).toBeNull()
  })

  it('a pay row with no roster link, or none at all, is linked as the desk\'s upsert links it', () => {
    expect(ops({ hourly_wage: 25 }, world({ payRow: null })).linkPersonId).toBe(PERSON)
    expect(ops({ hourly_wage: 25 }, world({ payRow: { ...hourly, person_id: null } })).linkPersonId).toBe(PERSON)
    expect(ops({ start_date: '2026-11-09' }, world({ payRow: null }))).toMatchObject({ payChanges: null, linkPersonId: null, sync: false })
  })

  it('the words after: done, or the step that was held and what stays', () => {
    expect(paySetupAppliedWords([{ step: 'pay_row', ok: true, words: 'w' }], NAME, 1)).toContain('reads as planned')
    const held = paySetupAppliedWords([{ step: 'employment_dates', ok: true, words: 'w' }, { step: 'pay_row', ok: false, words: 'set_pay_config refused: payroll access required' }], NAME, 4)
    expect(held).toContain('1 of 4 steps landed, then pay_row was held (set_pay_config refused: payroll access required) and nothing after it was tried')
  })
})

describe('the plan commits to the rows as read', () => {
  it('the same world hashes alike; a save to the pay row, the dates or the template since refuses the apply', async () => {
    const p = ask({ hourly_wage: 25, is_salary: true, start_date: '2026-11-09' })
    const hashOf = async (w: PaySetupWorld) => {
      const dry = paySetupDryRun(p, w, TODAY)
      if (!dry.ok) throw new Error(dry.refused)
      return planHash('plan_pay_setup', p, dry.reply)
    }
    const base = await hashOf(world())
    expect(await hashOf(world())).toBe(base)
    expect(await planHash('apply_pay_setup', p, (paySetupDryRun(p, world(), TODAY) as { reply: unknown }).reply)).toBe(base)
    expect(await hashOf(world({ payRow: { ...hourly, office_hourly_wage: 18 } }))).not.toBe(base)
    expect(await hashOf(world({ payRow: { ...hourly, record_hours_but_salary: true } }))).not.toBe(base)
    expect(await hashOf(world({ person: { ...person, end_date: '2026-12-31' } }))).not.toBe(base)
    expect(await hashOf(world({ template }))).not.toBe(base)
    expect(await hashOf(world({ template: { ...template, updated_at: '2026-11-18T09:00:00Z' } }))).not.toBe(await hashOf(world({ template })))
    const dry = paySetupDryRun(p, world(), TODAY)
    expect(String(planReply('plan_pay_setup', (dry as { reply: unknown }).reply, base).next)).toContain('apply_pay_setup')
  })
})

describe('the calendar is the app\'s own', () => {
  it('a salaried day\'s credit matches salariedPayrollDays, day for day', () => {
    const windows = [
      { timeOff: [], employmentStart: null, employmentEnd: null, stints: [] },
      { timeOff: [{ start_date: '2026-11-03', end_date: '2026-11-04', kind: 'unpaid' }, { start_date: '2026-11-05', end_date: '2026-11-05', kind: 'paid' }], employmentStart: '2026-10-21', employmentEnd: '2026-11-12', stints: [] },
      { timeOff: [], employmentStart: '2026-11-09', employmentEnd: null, stints: [{ start_date: '2026-10-01', end_date: '2026-10-23' }, { start_date: '2026-11-09', end_date: null }] },
    ]
    for (const w of windows) {
      for (let i = 0; i < 45; i++) {
        const d = new Date(Date.parse('2026-10-10T12:00:00Z') + i * 86_400_000).toISOString().slice(0, 10)
        expect(salariedCreditHours(d, w), `${d} ${JSON.stringify(w)}`).toBe(salariedHoursForDay(d, w))
      }
    }
  })

  it('the weeks are payroll catch-up\'s, and the count is what its list would hold', () => {
    expect(weeksBefore(TODAY, 6)).toEqual(scanWeeksBefore(TODAY, 6))
    expect(weeksBefore('2026-11-15', 3)).toEqual(scanWeeksBefore('2026-11-15', 3))
    const w = world({ timeOff: [{ start_date: '2026-10-26', end_date: '2026-10-30', kind: 'unpaid' }] })
    const after = { hourly_wage: 25, office_hourly_wage: null, is_salary: true, record_hours_but_salary: false, start_date: '2026-10-20', end_date: null, workday_start: null }
    const mine = payrollWeeks(w, { ...after, is_salary: false, start_date: null }, after, TODAY)
    const theirs = unreportedPayrollWeeks({
      weeks: scanWeeksBefore(TODAY, mine.weeks_counted),
      peopleNames: [NAME],
      hoursRows: [],
      payConfig: { [NAME]: { hourly_wage: 25, is_salary: true } },
      salaryWindows: { [NAME]: { timeOff: w.timeOff, employmentStart: '2026-10-20', employmentEnd: null } },
      stubs: w.stubs.map((st) => ({ person_name: NAME, ...st })),
    })
    // The week of unpaid time off holds no credit; the week the start date falls in holds four days.
    expect(mine.salaried_after).toMatchObject({ weeks: theirs.length, hours: theirs.reduce((n, r) => n + r.hours, 0), est_gross: theirs.reduce((n, r) => n + r.estGross, 0) })
    expect(mine.salaried_after).toMatchObject({ weeks: 3, hours: 112 })
    expect(crewDays(world(), TODAY)).toEqual({ days: 3, weekdays: 2, weekend_days: 1, first: '2026-10-20', last: '2026-11-03' })
  })
})

describe('the reads', () => {
  it('pages past 1,000 rows, keeps crew days with a job, and names a pay row under another name', async () => {
    const asked: string[] = []
    const crew = Array.from({ length: 1000 }, (_, i) => ({ work_date: new Date(Date.parse('2023-01-02T12:00:00Z') + i * 86_400_000).toISOString().slice(0, 10), job_assignments: i % 2 ? [{ job_id: 'j', pct: 100 }] : [] }))
    const reads: PaySetupReads = {
      rows: async (table, query) => {
        asked.push(`${table}?${query}`)
        if (table === 'people_pay_config' && query.includes('person_name=eq.')) return [hourly as unknown as Record<string, unknown>]
        if (table === 'people_pay_config') return [{ person_name: NAME }, { person_name: 'ZZ Test Helpr' }]
        if (table === 'salary_work_schedule_templates') return [template as unknown as Record<string, unknown>]
        if (table === 'pay_stubs') return [{ period_start: '2026-10-11', period_end: '2026-10-17' }]
        if (table === 'employment_stints') return [{ start_date: '2026-01-05', end_date: null }]
        if (table === 'user_time_off') return [{ start_date: '2026-11-03', end_date: '2026-11-03', kind: 'unpaid' }]
        if (table === 'people_crew_jobs' && query.includes('person_name=eq.')) return query.includes('offset=0') ? crew : [{ work_date: '2026-11-03', job_assignments: [{ job_id: 'j', pct: 100 }] }]
        if (table === 'people_crew_jobs') return [{ work_date: '2026-11-03', job_assignments: [{ job_id: 'j', pct: 100 }] }, { work_date: '2026-11-04', job_assignments: null }]
        return []
      },
      count: async (table) => (table === 'pay_stub_days' ? 5 : 2),
    }
    const w = await readPaySetupWorld(reads, { user, person })
    expect(w.payRow).toEqual(hourly)
    expect(w.payRowOtherName).toBe('ZZ Test Helpr')
    expect(w.template?.segment_a_start_local).toBe('07:00:00')
    expect(w).toMatchObject({ overrides: 2, stubDays: 5, stints: [{ start_date: '2026-01-05', end_date: null }] })
    expect(w.crewDates).toHaveLength(501)
    expect(w.crewDates[w.crewDates.length - 1]).toBe('2026-11-03')
    expect(asked.some((q) => q.startsWith('people_crew_jobs?') && q.includes('offset=1000'))).toBe(true)
    expect(asked.some((q) => q.includes(`person_name=eq.${encodeURIComponent(NAME)}`))).toBe(true)
    // No name, nothing to read.
    expect(await readPaySetupWorld(reads, { user: null, person: null })).toMatchObject({ payRow: null, crewDates: [] })
  })
})
