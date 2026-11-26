// dev-mcp's pay setup pair (v2.7821 / 0.102.0; the owner, 2026-11-18, after a helper was put on a weekly salary by
// driving the browser pane: "Can you help me add the dev verbs so you can do this in the future if needed?"):
// plan_pay_setup → apply_pay_setup change the pay setup of a person who already exists, as People → their sheet →
// Pay & schedule does (PersonDeskPaySection.tsx) — the hourly wage and the office wage, Salaried and "also record
// hours" on the name-keyed pay row, the employment dates on the roster row, and the start of the salaried workday
// template — with the side effects the desk performs (today's salary sessions synced when Salaried turns on, the
// schedule cleared when it turns off).
//
// The pay row goes through set_pay_config (migration 20260918100000), the app's own audited door: it writes only the
// keys given and leaves a before/after line in pay_admin_events with the reason, which the desk's direct upsert does
// not. The dates are the desk's own PATCH on people, the template the Hire form's row (saveSalaryTemplate), and the
// two RPCs are the ones usePayConfig calls. No wrapper RPC, so rpc is null in WRITE_VERBS: the dry run is the server's
// read of the pay row, the roster row's dates and the template, hashed with the ask, and an apply whose rows moved
// since the plan is refused.
//
// The app has no effective date and no wage history: most readers apply today's row to every past day. So the plan
// says, before anything is written, what the change reaches back into — the weeks with no pay report, the crew days
// job labor re-prices — and what it leaves alone (pay reports already made keep their stored amounts).
//
// Since v2.7882 the plan prices with the person's own salaried week, read from the pay row by the app's rule.
// set_pay_config does not take the week. A person's week is set as working hours (punch list #429): pay.working_hours
// names each day's start and end, and apply sends it through set_working_hours, the one door the Working hours row on
// the sheet uses. The door writes the set row and, for a salaried person, the seven numbers and their line on the pay
// log. The plan reads the hours in force with the row's own kernel (workingHours.ts) and says what moves on pay and
// on the clock.
//
// Pure: no network, no env. The server (dev-mcp/index.ts) resolves the person and runs the legs; this file says what
// the ask may name, what is refused and why, what each write becomes, and the words. readPaySetupWorld takes the
// server's reader, so the reads are tested here too. Tests: src/lib/devMcp/devMcpPaySetup.test.ts.

import { formatDayHours, SALARIED_DEFAULT_WEEK, salariedUniformDayHours, salariedWeekHours, salariedWeeklyPay, salariedWeekOf, salariedWeekWords, type SalariedWeek } from './gcKernels/lib/salariedEffectiveHours.ts'
import { formatHours, paidWeekOf, parseWorkingWeek, setRowInForce, workingHoursComing, workingHoursMovePay, workingHoursStarts, workingWeekHours, workingWeekLineWords, workingWeekProblem } from './gcKernels/lib/people/workingHours.ts'
import type { AvailableHoursAnswer, Segment, WeekDays } from '../../../src/lib/people/weekTypes.ts'

type Json = Record<string, unknown>
const obj = (v: unknown): Json | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : null)
const YMD_RE = /^\d{4}-\d{2}-\d{2}$/
const HHMM_RE = /^([01]\d|2[0-3]):[0-5]\d$/

export const PAY_SETUP_VERBS = ['plan_pay_setup', 'apply_pay_setup'] as const
export type PaySetupVerb = (typeof PAY_SETUP_VERBS)[number]
export function isPaySetupVerb(verb: string): verb is PaySetupVerb {
  return (PAY_SETUP_VERBS as readonly string[]).includes(verb)
}

/**
 * A salaried person is paid their week (v2.7882): people_pay_config.salaried_week_hours (v2.7826), the paid hours of
 * each day, seven numbers, Sunday first, 0 for a day off, 8 on the five weekdays when the row names none. The plan
 * reads it with the app's own rule (salariedWeekOf, the edge copy of src/lib/salariedEffectiveHours.ts) and prices
 * with it: the weekly figure, the payroll credit, the job labor words. The seat does not set it.
 */
export { SALARIED_DEFAULT_WEEK, salariedWeekOf, type SalariedWeek }
export const isDefaultWeek = (week: SalariedWeek): boolean => week.length === 7 && week.every((h, i) => h === SALARIED_DEFAULT_WEEK[i])
/** A week said once with what it comes to: *8 h Mon to Fri, 40 hours a week*. */
export const weekSaid = (week: SalariedWeek): string => `${salariedWeekWords(week)}, ${formatDayHours(salariedWeekHours(week))} hours a week`
/**
 * The workday template's one continuous block: 480 minutes for everyone (the table's own check,
 * salary_template_continuous_duration). It draws the clock strip and does not read the week.
 */
export const WORKDAY_TEMPLATE_MINUTES = 480
export const WORKDAY_TEMPLATE_HOURS = WORKDAY_TEMPLATE_MINUTES / 60
/** An hourly wage past this is a weekly or yearly figure typed in the wrong box. */
export const WAGE_MAX = 500
export const PAY_REASON_MAX = 300
/** The weeks payroll catch-up scans when nothing bounds it (usePayrollCatchUp's whole-company scan). */
export const CATCH_UP_WEEKS = 13
/** How far back the plan counts weeks with no pay report. */
export const WEEKS_BACK_MAX = 104

// ---------------------------------------------------------------------------
// The ask
// ---------------------------------------------------------------------------

export type PaySetupSet = {
  hourly_wage?: number | null
  office_hourly_wage?: number | null
  is_salary?: boolean
  record_hours_but_salary?: boolean
  start_date?: string | null
  end_date?: string | null
  workday_start?: string
  /** The length the ask named for the workday (workday_hours, workday_minutes or workday_end), in hours: checked against the template's one block. */
  workday_hours?: number
  /** The person's working hours (punch list #429): a week of each day's ranges, or `days` null to take them off, from this week's Sunday or next week's. */
  working_hours?: WorkingHoursAsk
}
/** Seven days Sunday first, each a list of [start, end] minutes on the quarter hour; null takes working hours off again. */
export type WorkingHoursAsk = { days: WeekDays | null; from: 'this_week' | 'next_week' }
export const WORKING_DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const
/** A week said once with what it comes to: *6:00 AM to 12:00 PM Mon to Fri, 30 hours a week*. */
export const workingWeekSaid = (days: WeekDays): string => `${workingWeekLineWords(days)}, ${formatHours(workingWeekHours(days))} hours a week`
export type PaySetupPayload = { action: 'pay_setup'; person: string; reason: string; set: PaySetupSet }
export type PaySetupInput = { ok: true; p: PaySetupPayload; target: string } | { ok: false; error: string }

const hoursWords = formatDayHours
const aOrAn = (h: number): string => (/^(8|11|18)/.test(hoursWords(h)) ? 'an' : 'a')
/** What the app holds for this person's salaried week, and what the seat does with it, said once. */
export const salariedWeekNote = (who: string, week: SalariedWeek): string => `${who}'s salaried week is ${weekSaid(week)}${isDefaultWeek(week) ? ', the default' : ', their own on the pay row'}. Payroll credits each day its hours in that week, and job costs read the same week. The week is set as working_hours, each day's start and end, never as bare numbers. The workday template only switches the clock's own sessions on: they run at working hours once those are set, and one continuous ${WORKDAY_TEMPLATE_MINUTES}-minute block until then`

const PAY_SETUP_SHAPE = `needs pay — { person (a users.id, a people.id, an address or a name matching one person), reason (one line, kept on the pay log), and one or more of: hourly_wage (a number, or null to clear; a weekly salary ÷ the hours in the person's salaried week, 40 unless their pay row names another week), office_hourly_wage (a number or null), is_salary (true | false), record_hours_but_salary (true | false: also record real punches beside the salary), start_date and end_date (YYYY-MM-DD or null, the employment dates on the roster row; end on or after start), workday_start (HH:MM, the start of the workday template's one ${WORKDAY_TEMPLATE_HOURS}-hour block; workday_hours or workday_end may say its length, and the plan refuses one that is not ${WORKDAY_TEMPLATE_HOURS} hours), working_hours ({ mon: '06:00-12:00', tue: ['07:00-11:30', '12:00-15:30'], … }: each of sun to sat one range or two around a break, HH:MM-HH:MM on the quarter hour, a day left out a day off; or null to take working hours off), working_hours_from ('this_week', the default, or 'next_week': the Sunday the hours start on) }. A salaried person is paid their week on the pay row (salaried_week_hours: the hours of each day, 8 on Monday to Friday unless it names another). The plan reads the week and prices with it, and working_hours is how the seat sets it: the door works the seven numbers out from each day's hours.`

const RANGE_RE = /^([01]\d|2[0-4]):([0-5]\d)\s*-\s*([01]\d|2[0-4]):([0-5]\d)$/
const DAY_NAMES: Record<(typeof WORKING_DAY_KEYS)[number], string> = { sun: 'Sunday', mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday' }

/** pay.working_hours as the week the door takes, refused in words. Null takes working hours off. */
export function workingHoursInput(verb: string, raw: unknown, rawFrom: unknown): { ok: true; ask: WorkingHoursAsk } | { ok: false; error: string } {
  const shape = `${verb}: pay.working_hours is a week by day, { mon: '06:00-12:00', tue: ['07:00-11:30', '12:00-15:30'], … }: each of sun, mon, tue, wed, thu, fri, sat one range or two around a break, HH:MM-HH:MM on the 24-hour clock and the quarter hour, a day left out (or null) a day off. Pass null to take working hours off.`
  let from: WorkingHoursAsk['from'] = 'this_week'
  if (rawFrom !== undefined) {
    if (rawFrom !== 'this_week' && rawFrom !== 'next_week') return { ok: false, error: `${verb}: pay.working_hours_from is 'this_week' or 'next_week': hours start on the Sunday of one or the other.` }
    from = rawFrom
  }
  if (raw === null) return { ok: true, ask: { days: null, from } }
  const week = obj(raw)
  if (!week) return { ok: false, error: shape }
  const unknown = Object.keys(week).filter((k) => !(WORKING_DAY_KEYS as readonly string[]).includes(k))
  if (unknown.length) return { ok: false, error: `${verb}: pay.working_hours names ${unknown.map((k) => JSON.stringify(k)).join(', ')}, which is no day. The days are ${WORKING_DAY_KEYS.join(', ')}.` }
  const days: WeekDays = []
  for (const key of WORKING_DAY_KEYS) {
    const v = week[key]
    const list = v == null ? [] : Array.isArray(v) ? v : [v]
    const segs: Segment[] = []
    for (const item of list) {
      const m = typeof item === 'string' ? RANGE_RE.exec(item.trim()) : null
      if (!m) return { ok: false, error: `${verb}: pay.working_hours.${key} has ${JSON.stringify(item)}, which is not a range. ${DAY_NAMES[key]} reads '06:00-12:00', or two such around a break.` }
      segs.push([Number(m[1]) * 60 + Number(m[2]), Number(m[3]) * 60 + Number(m[4])])
    }
    days.push(segs)
  }
  const problem = workingWeekProblem(days)
  if (problem) return { ok: false, error: `${verb}: pay.working_hours cannot be kept. ${problem}` }
  if (workingWeekHours(days) === 0) return { ok: false, error: `${verb}: pay.working_hours names no hours on any day. Pass working_hours: null to take a person's working hours off.` }
  return { ok: true, ask: { days, from } }
}

const str = (o: Json, k: string): string => (typeof o[k] === 'string' ? (o[k] as string).trim() : '')
const cents = (n: number): number => Math.round(n * 100) / 100
const hhmmToMinutes = (t: string): number => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))
const minutesToHhmm = (m: number): string => `${String(Math.floor((((m % 1440) + 1440) % 1440) / 60)).padStart(2, '0')}:${String((((m % 1440) + 1440) % 1440) % 60).padStart(2, '0')}`
/** The end of the block that starts at `start` (HH:MM) and runs `hours`, the template's 8 unless named, wrapping past midnight. */
export const workdayEndOf = (start: string, hours: number = WORKDAY_TEMPLATE_HOURS): string => minutesToHhmm(hhmmToMinutes(start) + Math.round(hours * 60))

/** The ask's shape, refused in words. */
export function paySetupInput(verb: PaySetupVerb, input: Json): PaySetupInput {
  const a = obj(input.pay)
  if (!a) return { ok: false, error: `${verb} ${PAY_SETUP_SHAPE}` }
  const person = str(a, 'person')
  if (!person) return { ok: false, error: `${verb}: pay.person is required — a users.id, a people.id, an address or a name. find_person lists them. To make a new person with their pay, plan_account with new.` }
  const reason = str(a, 'reason').replace(/\s+/g, ' ')
  if (!reason) return { ok: false, error: `${verb}: pay.reason is required — one line saying why, kept beside the before and after on the pay log (pay_admin_events).` }
  if (reason.length > PAY_REASON_MAX) return { ok: false, error: `${verb}: pay.reason is over ${PAY_REASON_MAX} characters; one line is enough.` }
  const set: PaySetupSet = {}
  for (const key of ['hourly_wage', 'office_hourly_wage'] as const) {
    if (a[key] === undefined) continue
    if (a[key] === null) {
      set[key] = null
      continue
    }
    const n = a[key]
    if (typeof n !== 'number' || !Number.isFinite(n) || n < 0) return { ok: false, error: `${verb}: pay.${key} must be a number, 0 or more, or null to clear it.` }
    if (n > WAGE_MAX) return { ok: false, error: `${verb}: pay.${key} ${n} reads like a weekly or yearly figure. The app holds a salary as an hourly wage priced over the person's salaried week: divide a weekly amount by the week's hours (${formatDayHours(salariedWeekHours(SALARIED_DEFAULT_WEEK))} unless their pay row names another week; any plan for them shows it) and pass that.` }
    set[key] = cents(n)
  }
  for (const key of ['is_salary', 'record_hours_but_salary'] as const) {
    if (a[key] === undefined) continue
    if (typeof a[key] !== 'boolean') return { ok: false, error: `${verb}: pay.${key} must be true or false.` }
    set[key] = a[key] as boolean
  }
  for (const key of ['start_date', 'end_date'] as const) {
    if (a[key] === undefined) continue
    if (a[key] === null || a[key] === '') {
      set[key] = null
      continue
    }
    const d = str(a, key)
    if (!YMD_RE.test(d) || Number.isNaN(Date.parse(`${d}T12:00:00Z`))) return { ok: false, error: `${verb}: pay.${key} must be YYYY-MM-DD, or null to clear it.` }
    set[key] = d
  }
  if (set.start_date && set.end_date && set.end_date < set.start_date) return { ok: false, error: `${verb}: pay.end_date must be on or after pay.start_date.` }
  const workdayStart = str(a, 'workday_start')
  if (a.workday_start !== undefined) {
    if (!HHMM_RE.test(workdayStart)) return { ok: false, error: `${verb}: pay.workday_start must be HH:MM on the 24-hour clock (06:00, 07:30).` }
    set.workday_start = workdayStart
  }
  if (a.workday_hours !== undefined || a.workday_minutes !== undefined || a.workday_end !== undefined) {
    if (!set.workday_start) return { ok: false, error: `${verb}: a workday's length goes with pay.workday_start (HH:MM).` }
    const named: number[] = []
    if (a.workday_hours !== undefined) {
      if (typeof a.workday_hours !== 'number' || !(a.workday_hours > 0) || a.workday_hours > 24) return { ok: false, error: `${verb}: pay.workday_hours must be a number of hours, over 0 and at most 24.` }
      named.push(a.workday_hours)
    }
    if (a.workday_minutes !== undefined) {
      if (typeof a.workday_minutes !== 'number' || !(a.workday_minutes > 0) || a.workday_minutes > 1440) return { ok: false, error: `${verb}: pay.workday_minutes must be a number of minutes, over 0 and at most 1440.` }
      named.push(a.workday_minutes / 60)
    }
    if (a.workday_end !== undefined) {
      const end = str(a, 'workday_end').slice(0, 5)
      if (!HHMM_RE.test(end)) return { ok: false, error: `${verb}: pay.workday_end must be HH:MM on the 24-hour clock.` }
      const minutes = (((hhmmToMinutes(end) - hhmmToMinutes(set.workday_start)) % 1440) + 1440) % 1440
      named.push((minutes === 0 ? 1440 : minutes) / 60)
    }
    if (named.some((h) => Math.abs(h - named[0]!) > 1e-9)) return { ok: false, error: `${verb}: workday_hours, workday_minutes and workday_end name different lengths (${named.map(hoursWords).join(', ')} hours). Name the length once.` }
    set.workday_hours = named[0]!
  }
  if (a.working_hours !== undefined) {
    const wh = workingHoursInput(verb, a.working_hours, a.working_hours_from)
    if (!wh.ok) return wh
    set.working_hours = wh.ask
  } else if (a.working_hours_from !== undefined) {
    return { ok: false, error: `${verb}: pay.working_hours_from goes with pay.working_hours (the week, or null to take the hours off).` }
  }
  if (Object.keys(set).length === 0) return { ok: false, error: `${verb}: name at least one change for ${person}. ${PAY_SETUP_SHAPE}` }
  return { ok: true, p: { action: 'pay_setup', person, reason, set }, target: person }
}

// ---------------------------------------------------------------------------
// The rows the server reads
// ---------------------------------------------------------------------------

export const PAY_USER_SELECT = 'id,name,role,login_attached_at,archived_at,is_sample,is_digital_twin,is_walk_tester'
export type PayUserRow = { id: string; name: string | null; role: string | null; login_attached_at: string | null; archived_at: string | null; is_sample: boolean | null; is_digital_twin: boolean | null; is_walk_tester: boolean | null }
export const PAY_PERSON_SELECT = 'id,name,kind,start_date,end_date,archived_at,account_user_id'
export type PayPersonRow = { id: string; name: string; kind: string | null; start_date: string | null; end_date: string | null; archived_at: string | null; account_user_id: string | null }
export const PAY_ROW_SELECT = 'person_name,person_id,hourly_wage,office_hourly_wage,is_salary,record_hours_but_salary,salaried_week_hours'
export type PayRow = { person_name: string; person_id: string | null; hourly_wage: number | null; office_hourly_wage: number | null; is_salary: boolean; record_hours_but_salary: boolean; /** The paid hours of each day of the person's week, Sunday first, as PostgREST hands it; read with salariedWeekOf. */ salaried_week_hours?: unknown }
export const PAY_TEMPLATE_SELECT = 'user_id,timezone,exclude_weekends,mode,segment_a_start_local,segment_a_duration_minutes,segment_b_start_local,segment_b_duration_minutes,use_split_focus,job_ledger_id,bid_id,updated_at'
export type PayTemplateRow = { user_id: string; timezone: string; exclude_weekends: boolean; mode: string; segment_a_start_local: string; segment_a_duration_minutes: number; segment_b_start_local: string | null; segment_b_duration_minutes: number | null; use_split_focus: boolean; job_ledger_id: string | null; bid_id: string | null; updated_at: string | null }
/** A person's set rows on person_available_hours (kind = set), the newest first: their working hours and every earlier save. */
export const PAY_WORKING_HOURS_SELECT = 'user_id,hours_per_week,days,effective_from,set_by,created_at,note,kind'
export type PayStint = { start_date: string | null; end_date: string | null }
export type PayTimeOff = { start_date: string; end_date: string; kind: string }

/** What the server read before the dry run. */
export type PaySetupWorld = {
  user: PayUserRow | null
  person: PayPersonRow | null
  /** The pay row under the pay name. */
  payRow: PayRow | null
  /** A pay row that carries this person's people.id under a different name: the names disagree. */
  payRowOtherName: string | null
  template: PayTemplateRow | null
  /** salary_work_schedule_day_overrides rows for the user. */
  overrides: number
  /** Every pay report under the pay name. */
  stubs: { period_start: string; period_end: string }[]
  /** pay_stub_days rows under the pay name. */
  stubDays: number
  stints: PayStint[]
  timeOff: PayTimeOff[]
  /** The days the person is on a crew with a job assignment (people_crew_jobs), any date. */
  crewDates: string[]
  /** The person's set rows (working hours), as the row's kernel reads them. Missing reads as none. */
  workingRows?: AvailableHoursAnswer[]
}

/** The pay name the desk keys the pay tables by: the account's name, else the roster row's (resolvePersonKey). */
export function payNameOf(user: Pick<PayUserRow, 'name'> | null, person: Pick<PayPersonRow, 'name'> | null): string | null {
  return (user?.name ?? '').trim() || (person?.name ?? '').trim() || null
}

export type PaySetupReads = {
  rows: (table: string, query: string) => Promise<Json[]>
  count: (table: string, query: string) => Promise<number>
}

const PAGE = 1000
/** Every row of a filter, a page at a time (PostgREST caps a reply at 1,000 rows and says nothing). */
async function allRows(reads: PaySetupReads, table: string, query: string, order: string): Promise<Json[]> {
  const out: Json[] = []
  for (let page = 0; page < 20; page++) {
    const rows = await reads.rows(table, `${query}&order=${order}&limit=${PAGE}&offset=${page * PAGE}`)
    out.push(...rows)
    if (rows.length < PAGE) break
  }
  return out
}

/** The world behind one person's pay setup, read as the dev under RLS. */
export async function readPaySetupWorld(reads: PaySetupReads, subject: { user: PayUserRow | null; person: PayPersonRow | null }): Promise<PaySetupWorld> {
  const { user, person } = subject
  const payName = payNameOf(user, person)
  const empty: PaySetupWorld = { user, person, payRow: null, payRowOtherName: null, template: null, overrides: 0, stubs: [], stubDays: 0, stints: [], timeOff: [], crewDates: [], workingRows: [] }
  if (!payName) return empty
  const name = encodeURIComponent(payName)
  const [payRows, byId, templates, overrides, stubs, stubDays, stints, timeOff, crewByName, crewById, setRows] = await Promise.all([
    reads.rows('people_pay_config', `select=${PAY_ROW_SELECT}&person_name=eq.${name}&limit=1`),
    person ? reads.rows('people_pay_config', `select=person_name&person_id=eq.${person.id}&limit=5`) : Promise.resolve([] as Json[]),
    user ? reads.rows('salary_work_schedule_templates', `select=${PAY_TEMPLATE_SELECT}&user_id=eq.${user.id}&limit=1`) : Promise.resolve([] as Json[]),
    user ? reads.count('salary_work_schedule_day_overrides', `user_id=eq.${user.id}`) : Promise.resolve(0),
    allRows(reads, 'pay_stubs', `select=period_start,period_end&person_name=eq.${name}`, 'period_end.desc,id'),
    reads.count('pay_stub_days', `person_name=eq.${name}`),
    person ? reads.rows('employment_stints', `select=start_date,end_date&person_id=eq.${person.id}&order=start_date&limit=50`) : Promise.resolve([] as Json[]),
    user ? reads.rows('user_time_off', `select=start_date,end_date,kind&user_id=eq.${user.id}&order=start_date&limit=500`) : Promise.resolve([] as Json[]),
    allRows(reads, 'people_crew_jobs', `select=work_date,job_assignments&person_name=eq.${name}`, 'work_date'),
    person ? allRows(reads, 'people_crew_jobs', `select=work_date,job_assignments&person_id=eq.${person.id}&person_name=neq.${name}`, 'work_date') : Promise.resolve([] as Json[]),
    user ? reads.rows('person_available_hours', `select=${PAY_WORKING_HOURS_SELECT}&user_id=eq.${user.id}&kind=eq.set&order=created_at.desc&limit=200`) : Promise.resolve([] as Json[]),
  ])
  const other = byId.map((r) => String(r.person_name ?? '').trim()).find((n) => n && n !== payName) ?? null
  const crewDates = [...new Set([...crewByName, ...crewById].filter((r) => Array.isArray(r.job_assignments) && r.job_assignments.length > 0).map((r) => String(r.work_date ?? '').slice(0, 10)).filter((d) => YMD_RE.test(d)))].sort()
  return {
    user,
    person,
    payRow: (payRows[0] as PayRow | undefined) ?? null,
    payRowOtherName: other,
    template: (templates[0] as PayTemplateRow | undefined) ?? null,
    overrides,
    stubs: stubs.map((s) => ({ period_start: String(s.period_start ?? '').slice(0, 10), period_end: String(s.period_end ?? '').slice(0, 10) })),
    stubDays,
    stints: stints.map((s) => ({ start_date: (s.start_date as string | null) ?? null, end_date: (s.end_date as string | null) ?? null })),
    timeOff: timeOff.map((t) => ({ start_date: String(t.start_date ?? ''), end_date: String(t.end_date ?? ''), kind: String(t.kind ?? '') })),
    crewDates,
    workingRows: setRows.map(workingRowOf),
  }
}

/** One set row as the kernel reads it. A stored week that is not sound reads as no week, which the database's own check never lets in. */
export function workingRowOf(r: Json): AvailableHoursAnswer {
  return {
    user_id: String(r.user_id ?? ''),
    hours_per_week: Number(r.hours_per_week) || 0,
    days: r.days == null ? null : parseWorkingWeek(r.days),
    effective_from: String(r.effective_from ?? '').slice(0, 10),
    set_by: typeof r.set_by === 'string' ? r.set_by : null,
    set_at: String(r.created_at ?? ''),
    note: typeof r.note === 'string' ? r.note : null,
    kind: 'set',
  }
}

// ---------------------------------------------------------------------------
// The calendar: the app's own rules, restated (the tests pin them equal to salariedPayrollDays and unreportedPayrollWeeks)
// ---------------------------------------------------------------------------

const DAY_MS = 86_400_000
export const ymdAddDays = (ymd: string, n: number): string => new Date(Date.parse(`${ymd}T12:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10)
/** 0 Sunday … 6 Saturday. */
export const weekdayOf = (ymd: string): number => new Date(`${ymd}T12:00:00Z`).getUTCDay()
const isWeekend = (ymd: string): boolean => weekdayOf(ymd) === 0 || weekdayOf(ymd) === 6

export type PayWindow = { timeOff: PayTimeOff[]; employmentStart: string | null; employmentEnd: string | null; stints: PayStint[] }

/** The hours payroll credits a salaried person on a day (salariedDayCredit): that day's hours in their week inside the employment window, 0 on unpaid time off. */
export function salariedCreditHours(ymd: string, w: PayWindow, week: SalariedWeek = SALARIED_DEFAULT_WEEK): number {
  const day = week[weekdayOf(ymd)] ?? 0
  if (!(day > 0)) return 0
  if (w.stints.length >= 2) {
    if (!w.stints.some((s) => (s.start_date == null || ymd >= s.start_date) && (s.end_date == null || ymd <= s.end_date))) return 0
  } else {
    if (w.employmentStart != null && ymd < w.employmentStart) return 0
    if (w.employmentEnd != null && ymd > w.employmentEnd) return 0
  }
  const overlapping = w.timeOff.filter((r) => ymd >= r.start_date && ymd <= r.end_date)
  if (overlapping.some((r) => r.kind !== 'paid')) return 0
  return day
}

/** The `weeksBack` Sunday-to-Saturday weeks before the week holding `today`, newest first (scanWeeksBefore). */
export function weeksBefore(today: string, weeksBack: number): { weekStart: string; weekEnd: string }[] {
  const sunday = ymdAddDays(today, -weekdayOf(today))
  const out: { weekStart: string; weekEnd: string }[] = []
  for (let i = 1; i <= weeksBack; i++) {
    const weekStart = ymdAddDays(sunday, -7 * i)
    out.push({ weekStart, weekEnd: ymdAddDays(weekStart, 6) })
  }
  return out
}

// ---------------------------------------------------------------------------
// Before, after, and what apply writes
// ---------------------------------------------------------------------------

export type PayFacts = { hourly_wage: number | null; office_hourly_wage: number | null; is_salary: boolean; record_hours_but_salary: boolean; start_date: string | null; end_date: string | null; workday_start: string | null; /** The working hours that hold on the Sunday the ask names (today's with none asked), said as a week; null with none. */ working_hours: string | null }
export type PayChange = { field: keyof PayFacts; from: unknown; to: unknown }

/** What apply writes, in order. Derived by the same function as the plan, so the two cannot disagree. */
export type PaySetupOps = {
  payName: string
  userId: string | null
  personId: string | null
  /** The desk's PATCH on people. */
  dates: { start_date: string | null; end_date: string | null } | null
  /** set_pay_config's p_changes: only the keys that move. */
  payChanges: Json | null
  /** The pay row had no people.id on it (or did not exist): the desk's upsert writes it, so apply links it. */
  linkPersonId: string | null
  /** Salaried turned off: pay_staff_clear_salary_schedule_by_person_name. */
  clearSchedule: boolean
  /** The workday template: the Hire form's row when there is none, else the start of the block that stands. */
  template: { kind: 'insert'; start: string } | { kind: 'move'; start: string } | null
  /** set_working_hours: the week (null takes the hours off), the Sunday it starts on, whether a salaried person's seven numbers move, and what they become. */
  workingHours: { days: WeekDays | null; from: string; movesPay: boolean; paidWeek: number[] | null } | null
  /** sync_salary_clock_sessions_for_user_day for today. */
  sync: boolean
  /** The pay_admin_events line for what set_pay_config does not log: the dates and the workday start. */
  logPayload: Json | null
}

export type PaySetupResolved = { ok: true; payName: string; /** The person's salaried week once the plan lands: the pay row's (salariedWeekOf), or the one working hours work out. */ week: SalariedWeek; /** The week as the pay row holds it today. */ weekBefore: SalariedWeek; before: PayFacts; after: PayFacts; changes: PayChange[]; unchanged: string[]; ops: PaySetupOps } | { ok: false; refused: string }

const templateStart = (t: PayTemplateRow | null): string | null => (t ? String(t.segment_a_start_local ?? '').slice(0, 5) || null : null)
const sameMoney = (a: number | null, b: number | null): boolean => (a == null || b == null ? a == b : cents(a) === cents(b))
const money = (n: number): string => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const s = (n: number): string => (n === 1 ? '' : 's')

/** The refusals, the before and after, and the writes. Pure over the ask and the world. */
export function resolvePaySetup(p: PaySetupPayload, world: PaySetupWorld, today: string | null = null): PaySetupResolved {
  const { user, person } = world
  if (!user && !person) return { ok: false, refused: `No person for ${p.person} — not a users.id, a people.id, an address or a name that matches one. find_person lists the roster. To make a new person with their pay, plan_account with new.` }
  const payName = payNameOf(user, person)
  const who = payName ?? p.person
  if (user && (user.is_sample || user.is_digital_twin || user.is_walk_tester)) return { ok: false, refused: `${who} is a sample, a twin or the walk tester: a fixture account, never paid through this door.` }
  const archivedAt = user?.archived_at ?? person?.archived_at ?? null
  if (archivedAt) return { ok: false, refused: `${who} is archived (${archivedAt.slice(0, 10)}). Bring them back from their desk first; the seat changes the pay of people on the roster.` }
  if (!payName) return { ok: false, refused: `${p.person} has no name on the account or the roster row, so no pay name: the pay tables are keyed by it. Name them first (plan_account, rename).` }
  if ((user?.role ?? '') === 'primary' || (person?.kind ?? '') === 'primary') return { ok: false, refused: `${who} is a primary, never paid through the pay tables.` }
  if (world.payRowOtherName) return { ok: false, refused: `Nothing to plan: the pay row for ${who} is under another name, ${JSON.stringify(world.payRowOtherName)}, while the account reads ${JSON.stringify(payName)}. The pay tables are keyed by name, so a change here would make a second pay row. Make the names agree first (plan_account, rename: the name-keyed rows follow).` }

  const row = world.payRow
  const weekBefore = salariedWeekOf(row)
  let week = weekBefore
  const weekHours = salariedWeekHours(week)
  const set = p.set
  // Working hours hold from a Sunday: the row in force there is the newest save among the rows that have started.
  const workingRows = world.workingRows ?? []
  const starts = today ? workingHoursStarts(today) : null
  const whFrom = starts ? (set.working_hours?.from === 'next_week' ? starts.nextWeek : starts.thisWeek) : null
  const whBefore = whFrom ? (setRowInForce(workingRows, whFrom)?.days ?? null) : null
  const before: PayFacts = {
    hourly_wage: row?.hourly_wage ?? null,
    office_hourly_wage: row?.office_hourly_wage ?? null,
    is_salary: row?.is_salary === true,
    record_hours_but_salary: row?.record_hours_but_salary === true,
    start_date: person?.start_date ?? null,
    end_date: person?.end_date ?? null,
    workday_start: templateStart(world.template),
    working_hours: whBefore ? workingWeekSaid(whBefore) : null,
  }
  if ((set.start_date !== undefined || set.end_date !== undefined) && !person) return { ok: false, refused: `Nothing to plan: ${who} has no roster row, and the employment dates live on it. The Users tab's fix makes the row; the wage and Salaried can be planned without the dates.` }
  const after: PayFacts = {
    hourly_wage: set.hourly_wage !== undefined ? set.hourly_wage : before.hourly_wage,
    office_hourly_wage: set.office_hourly_wage !== undefined ? set.office_hourly_wage : before.office_hourly_wage,
    is_salary: set.is_salary !== undefined ? set.is_salary : before.is_salary,
    record_hours_but_salary: set.record_hours_but_salary !== undefined ? set.record_hours_but_salary : before.record_hours_but_salary,
    start_date: set.start_date !== undefined ? set.start_date : before.start_date,
    end_date: set.end_date !== undefined ? set.end_date : before.end_date,
    workday_start: set.workday_start !== undefined ? set.workday_start : before.workday_start,
    working_hours: set.working_hours !== undefined ? (set.working_hours.days ? workingWeekSaid(set.working_hours.days) : null) : before.working_hours,
  }
  const stoppedSalary = before.is_salary && !after.is_salary
  const becameSalary = !before.is_salary && after.is_salary
  if (stoppedSalary) after.workday_start = null
  if (after.start_date && after.end_date && after.end_date < after.start_date) return { ok: false, refused: `Nothing to plan: the end date ${after.end_date} would fall before the start date ${after.start_date}. End on or after start; pass both dates to move them together.` }
  if (after.is_salary && (becameSalary || set.hourly_wage !== undefined) && !((after.hourly_wage ?? 0) > 0)) return { ok: false, refused: `Nothing to plan: Salaried needs the hourly rate ${who}'s week is priced at (${weekSaid(week)}), and ${who} would have none. Pass hourly_wage${weekHours > 0 ? `: a weekly amount ÷ ${hoursWords(weekHours)}` : ''}.` }
  if (set.record_hours_but_salary === true && !after.is_salary) return { ok: false, refused: `Nothing to plan: "also record hours" goes with Salaried, and ${who} would be hourly: their logged hours are already what pays them.` }
  if (set.workday_start !== undefined) {
    if (!after.is_salary) return { ok: false, refused: `Nothing to plan: a workday template is a salaried day's, and ${who} would be hourly. Pass is_salary: true in the same plan, or leave workday_start out.` }
    if (!user) return { ok: false, refused: `Nothing to plan: ${who} has no users row, and the workday template hangs on one. plan_account makes the row; the wage and Salaried can be planned without the workday.` }
    if (set.workday_hours !== undefined && Math.abs(set.workday_hours - WORKDAY_TEMPLATE_HOURS) > 1e-9) {
      return { ok: false, refused: `Nothing to plan: ${aOrAn(set.workday_hours)} ${hoursWords(set.workday_hours)}-hour workday (${set.workday_start} to ${workdayEndOf(set.workday_start, set.workday_hours)}) is not a length the workday template holds. It stores one continuous ${WORKDAY_TEMPLATE_MINUTES}-minute block for everyone, so nothing was stored. Pass workday_start alone: the sessions then run ${set.workday_start} to ${workdayEndOf(set.workday_start)}. The template draws the clock strip and pays nobody: ${who}'s pay is the wage × their salaried week (${weekSaid(week)}). For a day of another length, set working_hours: the sessions then run each day's own start and end.` }
    }
    const t = world.template
    if (t && (t.mode !== 'continuous' || t.segment_a_duration_minutes !== WORKDAY_TEMPLATE_MINUTES || t.segment_b_start_local != null)) {
      return { ok: false, refused: `Nothing to plan: ${who}'s workday is a split day (${templateStart(t)} for ${t.segment_a_duration_minutes} minutes${t.segment_b_start_local ? `, then ${String(t.segment_b_start_local).slice(0, 5)} for ${t.segment_b_duration_minutes ?? 0}` : ''}), set on their sheet. The seat writes only the one continuous ${WORKDAY_TEMPLATE_HOURS}-hour block: change a split day in Workday schedule… on People → their sheet → Pay & schedule, or leave workday_start out.` }
    }
  }
  // Working hours. The door's own rules, said before anything is sent: an account to hang them on, this Sunday or
  // the next, and a change to what a salaried day pays starts this week (pay carries no date).
  let workingOp: PaySetupOps['workingHours'] = null
  let workingSame = false
  if (set.working_hours !== undefined) {
    const asked = set.working_hours
    if (!user) return { ok: false, refused: `Nothing to plan: ${who} has no users row, and working hours hang on one. plan_account makes the row; the wage and Salaried can be planned without the hours.` }
    if (!starts || !whFrom || !today) return { ok: false, refused: 'Nothing to plan: working hours start on a Sunday, and the plan was given no today to count from.' }
    const coming = workingHoursComing(workingRows, today)
    if (asked.days === null) {
      // Taking off what is not there is no change, unless a save for next week is waiting and this one stops it.
      workingSame = whBefore === null && !(asked.from === 'this_week' && coming?.days)
    } else {
      workingSame = whBefore !== null && JSON.stringify(whBefore) === JSON.stringify(asked.days) && !(asked.from === 'this_week' && coming)
    }
    // A take-off puts a salaried person's week on pay back on the standard week (the door's rule since v2.8607): pay
    // moves when a set week is in force on the Sunday asked for and the pay row holds another week than the standard.
    const takeOff = asked.days === null
    const movesPay = after.is_salary && (takeOff ? whBefore !== null && !isDefaultWeek(weekBefore) : workingHoursMovePay(asked.days!, weekBefore))
    if (movesPay && asked.from === 'next_week') {
      return { ok: false, refused: takeOff
        ? `Nothing to plan: taking working hours off puts ${who} back on the standard week (${weekSaid(weekBefore)} today, ${weekSaid(SALARIED_DEFAULT_WEEK)} after), and pay carries no date, so it cannot start next week. Leave working_hours_from out to take them off this week.`
        : `Nothing to plan: these hours change what a salaried day pays (${weekSaid(weekBefore)} today, ${weekSaid(paidWeekOf(asked.days!))} with them), and pay carries no date, so they cannot start next week. Leave working_hours_from out to start them this week, or plan them next week with days of the same lengths.` }
    }
    if (movesPay) week = takeOff ? [...SALARIED_DEFAULT_WEEK] : paidWeekOf(asked.days!)
    if (!workingSame) workingOp = { days: asked.days, from: whFrom, movesPay, paidWeek: asked.days ? paidWeekOf(asked.days) : movesPay ? [...SALARIED_DEFAULT_WEEK] : null }
  }

  const changes: PayChange[] = []
  const unchanged: string[] = []
  const note = (field: keyof PayFacts, asked: boolean, same: boolean) => {
    if (!asked) return
    if (same) unchanged.push(field)
    else changes.push({ field, from: before[field], to: after[field] })
  }
  note('hourly_wage', set.hourly_wage !== undefined, sameMoney(before.hourly_wage, after.hourly_wage))
  note('office_hourly_wage', set.office_hourly_wage !== undefined, sameMoney(before.office_hourly_wage, after.office_hourly_wage))
  note('is_salary', set.is_salary !== undefined, before.is_salary === after.is_salary)
  note('record_hours_but_salary', set.record_hours_but_salary !== undefined, before.record_hours_but_salary === after.record_hours_but_salary)
  note('start_date', set.start_date !== undefined, before.start_date === after.start_date)
  note('end_date', set.end_date !== undefined, before.end_date === after.end_date)
  note('workday_start', set.workday_start !== undefined, before.workday_start === after.workday_start)
  note('working_hours', set.working_hours !== undefined, workingSame)
  if (changes.length === 0) return { ok: false, refused: `Nothing to plan: ${who}'s pay setup already reads that way (${unchanged.join(', ')}).` }

  const moved = (f: keyof PayFacts): boolean => changes.some((c) => c.field === f)
  const payKeys = (['hourly_wage', 'office_hourly_wage', 'is_salary', 'record_hours_but_salary'] as const).filter(moved)
  const payChanges: Json | null = payKeys.length ? Object.fromEntries(payKeys.map((k) => [k, after[k]])) : null
  const datesMoved = moved('start_date') || moved('end_date')
  const templateOp: PaySetupOps['template'] = moved('workday_start') ? { kind: world.template ? 'move' : 'insert', start: after.workday_start! } : null
  const logged: (keyof PayFacts)[] = (['start_date', 'end_date', 'workday_start'] as const).filter(moved)
  const ops: PaySetupOps = {
    payName,
    userId: user?.id ?? null,
    personId: person?.id ?? null,
    dates: datesMoved ? { start_date: after.start_date, end_date: after.end_date } : null,
    payChanges,
    linkPersonId: payChanges && person && !row?.person_id ? person.id : null,
    clearSchedule: stoppedSalary,
    template: templateOp,
    workingHours: workingOp,
    sync: !!user && !stoppedSalary && (becameSalary || !!templateOp),
    logPayload: logged.length ? { via: 'dev-mcp', verb: 'apply_pay_setup', changes: Object.fromEntries(logged.map((k) => [k, after[k]])), before: Object.fromEntries(logged.map((k) => [k, before[k]])), after: Object.fromEntries(logged.map((k) => [k, after[k]])) } : null,
  }
  return { ok: true, payName, week, weekBefore, before, after, changes, unchanged, ops }
}

// ---------------------------------------------------------------------------
// What the change reaches back into
// ---------------------------------------------------------------------------

/** The stints as payroll will read them once the dates land: the stint that held the old pair takes the new one. */
function stintsAfter(stints: PayStint[], before: PayFacts, after: PayFacts): PayStint[] {
  if (stints.length < 2) return stints
  const i = stints.findIndex((st) => st.start_date === before.start_date && st.end_date === before.end_date)
  if (i < 0) return stints
  return stints.map((st, j) => (j === i ? { start_date: after.start_date, end_date: after.end_date } : st))
}

export type PayrollWeeks = {
  last_report_through: string | null
  weeks_counted: number
  weeks_without_report: number
  salaried_before: { weeks: number; est_gross: number } | null
  salaried_after: { weeks: number; hours: number; est_gross: number; first_week: string | null; last_week: string | null } | null
}

/** The weeks before this one with no pay report, and how many of them payroll catch-up shows for a salaried person. */
export function payrollWeeks(world: PaySetupWorld, before: PayFacts, after: PayFacts, today: string, week: SalariedWeek = salariedWeekOf(world.payRow), weekBefore: SalariedWeek = week): PayrollWeeks {
  const lastEnd = world.stubs.map((st) => st.period_end).filter((d) => YMD_RE.test(d)).sort().pop() ?? null
  const sundayThis = ymdAddDays(today, -weekdayOf(today))
  let back = CATCH_UP_WEEKS
  if (lastEnd) {
    const sundayLast = ymdAddDays(lastEnd, -weekdayOf(lastEnd))
    back = Math.max(0, Math.min(WEEKS_BACK_MAX, Math.round((Date.parse(`${sundayThis}T12:00:00Z`) - Date.parse(`${sundayLast}T12:00:00Z`)) / (7 * DAY_MS))))
  }
  const open = weeksBefore(today, back).filter((w) => !world.stubs.some((st) => st.period_start <= w.weekEnd && st.period_end >= w.weekStart))
  const credit = (facts: PayFacts, stints: PayStint[], wk: SalariedWeek) => {
    const window: PayWindow = { timeOff: world.timeOff, employmentStart: facts.start_date, employmentEnd: facts.end_date, stints }
    let weeks = 0
    let hours = 0
    const starts: string[] = []
    for (const w of open) {
      let h = 0
      for (let d = w.weekStart; d <= w.weekEnd; d = ymdAddDays(d, 1)) h += salariedCreditHours(d, window, wk)
      if (h < 0.005) continue
      weeks++
      hours += h
      starts.push(w.weekStart)
    }
    starts.sort()
    return { weeks, hours: cents(hours), est_gross: cents(hours * (facts.hourly_wage ?? 0)), first_week: starts[0] ?? null, last_week: starts[starts.length - 1] ?? null }
  }
  const was = before.is_salary ? credit(before, world.stints, weekBefore) : null
  return {
    last_report_through: lastEnd,
    weeks_counted: back,
    weeks_without_report: open.length,
    salaried_before: was ? { weeks: was.weeks, est_gross: was.est_gross } : null,
    salaried_after: after.is_salary ? credit(after, stintsAfter(world.stints, before, after), week) : null,
  }
}

/**
 * The crew days up to today that job labor prices (teamLabor.ts): weekdays and weekend days apart, and against the
 * person's week, the days it pays, the days it leaves out and the hours a salaried reading of them comes to.
 */
export function crewDays(world: PaySetupWorld, today: string, week: SalariedWeek = salariedWeekOf(world.payRow)): { days: number; weekdays: number; weekend_days: number; paid_days: number; unpaid_days: number; flat_hours: number; first: string | null; last: string | null } {
  const past = world.crewDates.filter((d) => d <= today)
  const weekend = past.filter(isWeekend).length
  const hours = past.map((d) => week[weekdayOf(d)] ?? 0)
  const paid = hours.filter((h) => h > 0).length
  return { days: past.length, weekdays: past.length - weekend, weekend_days: weekend, paid_days: paid, unpaid_days: past.length - paid, flat_hours: cents(hours.reduce((t, h) => t + h, 0)), first: past[0] ?? null, last: past[past.length - 1] ?? null }
}

// ---------------------------------------------------------------------------
// The dry run
// ---------------------------------------------------------------------------

export type PaySetupDryRun = { ok: true; reply: Json } | { ok: false; refused: string }

const FIELD_WORDS: Record<keyof PayFacts, string> = { hourly_wage: 'the hourly wage', office_hourly_wage: 'the office wage', is_salary: 'Salaried', record_hours_but_salary: 'also record hours', start_date: 'the employment start date', end_date: 'the employment end date', workday_start: 'the workday start', working_hours: 'working hours' }
const showValue = (field: keyof PayFacts, v: unknown): string => {
  if (v == null) return field === 'end_date' ? 'none (still employed)' : 'none'
  if (field === 'hourly_wage' || field === 'office_hourly_wage') return `${money(v as number)}/h`
  if (typeof v === 'boolean') return v ? 'on' : 'off'
  return String(v)
}

/** The plan: before and after for each field, what the change reaches back into, and the writes in order. */
export function paySetupDryRun(p: PaySetupPayload, world: PaySetupWorld, today: string): PaySetupDryRun {
  const r = resolvePaySetup(p, world, today)
  if (!r.ok) return r
  const { payName, week, weekBefore, before, after, changes, unchanged, ops } = r
  const wh = ops.workingHours
  const weekWords = salariedWeekWords(week)
  const weekHours = salariedWeekHours(week)
  const uniform = salariedUniformDayHours(week)
  const defaultWeek = isDefaultWeek(week)
  // Job labor's reading of a salaried day: one length when every paid day shares it, else the day's own.
  const flatDay = uniform != null ? `a flat ${hoursWords(uniform)} h` : `its day's hours in their week (${weekWords})`
  const paidDaysWords = (n: number): string => (defaultWeek ? `${n} weekday${s(n)}` : `${n} day${s(n)} their week pays`)
  const unpaidDaysWords = (n: number): string => (defaultWeek ? `${n} weekend day${s(n)}` : `${n} day${s(n)} it leaves out`)
  const { user, person } = world
  const moved = (f: keyof PayFacts): boolean => changes.some((c) => c.field === f)
  const becameSalary = !before.is_salary && after.is_salary
  const stoppedSalary = before.is_salary && !after.is_salary
  const wageMoved = moved('hourly_wage')

  const weekly = after.is_salary && after.hourly_wage != null
    ? { hourly_wage: after.hourly_wage, week_hours: weekHours, per_week: salariedWeeklyPay(after.hourly_wage, week), words: `${money(after.hourly_wage)}/h × ${hoursWords(weekHours)} h (${weekWords}) = ${money(salariedWeeklyPay(after.hourly_wage, week))} a week, whatever hours are worked or logged. A paid day of unpaid time off, or outside the employment dates, pays 0.` }
    : null

  // Payroll: the weeks with no pay report.
  const weeks = payrollWeeks(world, before, after, today, week, weekBefore)
  const since = weeks.last_report_through ? `Since the last pay report (through ${weeks.last_report_through})` : `No pay report has ever been made for ${payName}; over the ${weeks.weeks_counted} weeks payroll catch-up scans`
  let payrollWords = `${since}, ${weeks.weeks_without_report} whole week${s(weeks.weeks_without_report)} before this one ${weeks.weeks_without_report === 1 ? 'has' : 'have'} no pay report${weeks.weeks_counted >= WEEKS_BACK_MAX ? ` (counted ${WEEKS_BACK_MAX} weeks back and no further)` : ''}.`
  if (weeks.salaried_after) {
    const a = weeks.salaried_after
    const was = weeks.salaried_before
    payrollWords += a.weeks === 0
      ? ` With Salaried on${after.start_date ? ` and the start date ${after.start_date}` : ''}, none of them shows on payroll catch-up as unreported.`
      : ` With Salaried on${after.start_date ? ` and the start date ${after.start_date}` : ' and no start date'}, ${a.weeks} of them show${a.weeks === 1 ? 's' : ''} on payroll catch-up as an unreported week (${a.first_week}${a.last_week !== a.first_week ? ` to the week of ${a.last_week}` : ''}), about ${money(a.est_gross)} in all at this wage${was ? `; today ${was.weeks} show${was.weeks === 1 ? 's' : ''}, about ${money(was.est_gross)}` : '; today, hourly, a week shows only when it holds logged hours'}.`
    if (a.weeks > 0 && !after.start_date) payrollWords += ` The app has no effective date: a salaried person is credited their week (${weekWords}) in every week with no report, back as far as anyone looks. A start date is the only thing that stops it, and only on payroll: pass start_date (the first salaried day) in the same plan.`
    else if (a.weeks > 0) payrollWords += ` Each holds a paid day on or after the start date with no report covering it: make those reports, or move start_date to the first day the salary applies.`
  } else {
    payrollWords += stoppedSalary ? ` With Salaried off, a week shows on payroll catch-up only when it holds logged hours: the salaried weeks with no report stop showing.` : ` Hourly: a week shows on payroll catch-up only when it holds logged hours${wageMoved ? ', and its estimate there reads the new wage' : ''}.`
  }

  // Job labor: today's row prices every past crew day.
  const crew = crewDays(world, today, week)
  const span = crew.days ? ` (${crew.first}${crew.last !== crew.first ? ` to ${crew.last}` : ''})` : ''
  let laborWords: string
  if (crew.days === 0) laborWords = `${payName} is on no crew day with a job yet, so nothing on job labor re-prices.`
  else if (becameSalary) laborWords = `${crew.days} past crew day${s(crew.days)}${span} re-price on job labor: each of the ${paidDaysWords(crew.paid_days)} reads ${flatDay} × ${showValue('hourly_wage', after.hourly_wage)} whatever was logged, and the ${unpaidDaysWords(crew.unpaid_days)} read${crew.unpaid_days === 1 ? 's' : ''} 0. The start date does not shield them: job labor reads today's pay row for every past day.`
  else if (stoppedSalary) laborWords = `${crew.days} past crew day${s(crew.days)}${span} re-price on job labor: each goes back to its logged hours × ${showValue('hourly_wage', after.hourly_wage)}, and a day with no logged hours reads 0.`
  else if (wageMoved && after.is_salary) laborWords = `${defaultWeek ? `${crew.paid_days} past weekday crew day${s(crew.paid_days)}` : `${crew.paid_days} past crew day${s(crew.paid_days)} on a day their week pays`}${span} re-price on job labor at ${flatDay} × ${showValue('hourly_wage', after.hourly_wage)} in place of ${showValue('hourly_wage', before.hourly_wage)}: job labor reads today's wage for every past day, and no date shields them.`
  else if (wageMoved) laborWords = `${crew.days} past crew day${s(crew.days)}${span} re-price on job labor at their logged hours × ${showValue('hourly_wage', after.hourly_wage)} in place of ${showValue('hourly_wage', before.hourly_wage)}: job labor reads today's wage for every past day, and no date shields them.`
  else if (wh?.movesPay) laborWords = `${crew.paid_days} past crew day${s(crew.paid_days)} on a day the new week pays${span} re-price on job labor at ${flatDay} × ${showValue('hourly_wage', after.hourly_wage)}, where they read the old week (${salariedWeekWords(weekBefore)}): job labor reads today's week for every past day, and no date shields them.`
  else laborWords = `Job labor does not re-price: the wage and Salaried stay as they are (${crew.days} past crew day${s(crew.days)} on record).`

  // The clock. The sync the desk calls (sync_salary_clock_sessions_for_user_day) fills the day it is given AND the day
  // before, and reads no employment start date: a template is enough. So turning Salaried on today can leave an
  // unapproved auto-session on yesterday, even before the start date (found on the first live walk, 2026-11-18).
  const t = world.template
  const dayBefore = ymdAddDays(today, -1)
  const syncDays = ops.sync ? [dayBefore, today] : []
  // With no template the sync mints nothing, so there is no day to name.
  const syncBeforeStart = ops.sync && after.workday_start != null && after.start_date != null && dayBefore < after.start_date ? dayBefore : null
  const syncWords = !ops.sync ? '' : `; apply syncs today and the day before (${dayBefore}), since the app's sync fills both days the template covers and reads no start date${syncBeforeStart ? `. So an unapproved session can appear on ${dayBefore}, before the start date ${after.start_date}: payroll's credit still starts on the start date, and the session waits on the clock strip` : ''}`
  const tStart = after.workday_start
  // Working hours: what holds today, what waits for a Sunday ahead, and what the clock reads once the plan lands.
  const whRows = world.workingRows ?? []
  const whToday = setRowInForce(whRows, today)?.days ?? null
  const whComing = workingHoursComing(whRows, today)
  const whNow = wh && wh.from <= today ? wh.days : whToday
  let clockWords: string
  if (stoppedSalary) clockWords = `Turning Salaried off clears the workday schedule: ${t ? `the template (${templateStart(t)})` : 'no template stands'}, ${world.overrides} day override${s(world.overrides)}, and the unapproved auto-sessions of today and the day before (${dayBefore}). Pay goes back to logged hours × wage, so ${payName} clocks in and out from now on. Past pay reports and approved hours stay.`
  else if (!after.is_salary) clockWords = `Hourly: ${payName}'s own punches are what pays them; nothing on the clock changes.`
  else if (!user) clockWords = `${payName} has no users row, so no workday template and no sessions on a clock: payroll credits their week (${weekWords}) all the same.`
  else if (tStart) clockWords = `${ops.template ? (ops.template.kind === 'insert' ? 'A workday template is made' : `The workday template moves from ${before.workday_start}`) : 'A workday template stands'}: ${WORKDAY_TEMPLATE_HOURS} hours from ${tStart} to ${workdayEndOf(tStart)}, ${t && !t.exclude_weekends ? 'every day' : 'weekdays'}. Sessions appear on ${payName}'s clock strip by themselves${syncWords}. They do not clock in for pay${after.record_hours_but_salary ? '; "also record hours" keeps their real punches recorded beside the salary' : ''}.${whNow ? ` Working hours are set (${workingWeekSaid(whNow)}): the sessions run at them and not at the template's block${wh && wh.from <= today ? ', from the day after this is applied' : ''}, and a day with no hours makes none.` : defaultWeek ? '' : ` The template does not read their week: the sessions run ${WORKDAY_TEMPLATE_HOURS} hours on ${t && !t.exclude_weekends ? 'every day' : 'weekdays'}, while pay follows the week (${weekWords}).`}`
  else clockWords = `No workday template: Salaried is on for pay (${weekWords}), but no session appears on ${payName}'s clock strip until a template is saved. Pass workday_start (HH:MM) in the plan, or Workday schedule… on their sheet.`

  // The stints the trigger keeps.
  let stintWords: string | null = null
  if (ops.dates) {
    const isReturn = before.end_date != null && after.end_date == null && after.start_date != null && after.start_date !== before.start_date && after.start_date >= before.end_date
    stintWords = isReturn
      ? `The end date is cleared with a new start on or after it: the app reads that as a return and opens a new stint from ${after.start_date}; the stint that ended ${before.end_date} stays (${world.stints.length} on record).`
      : `The dates are the current stint's own, so it moves with them (${world.stints.length} stint${s(world.stints.length)} on record).`
  }

  const writes: string[] = []
  if (ops.dates) writes.push(`the roster row's dates: ${after.start_date ?? 'no start date'} → ${after.end_date ?? 'present'} (the desk's own save on people)`)
  if (ops.payChanges) writes.push(`set_pay_config as you, with the reason: ${Object.keys(ops.payChanges).map((k) => `${k} ${showValue(k as keyof PayFacts, ops.payChanges![k])}`).join(', ')} — one line on the pay log (pay_admin_events) with before and after${world.payRow ? '' : '; the pay row is made'}${ops.linkPersonId ? ', then linked to the roster row' : ''}`)
  if (ops.clearSchedule) writes.push('pay_staff_clear_salary_schedule_by_person_name: the workday template, the day overrides and the unapproved auto-sessions of today and the day before go')
  if (wh) writes.push(`set_working_hours as you, with the reason: ${wh.days ? workingWeekSaid(wh.days) : 'working hours taken off'}, from the Sunday of ${wh.from} — one set row on person_available_hours${wh.movesPay ? ', the seven numbers on the pay row and one line on the pay log with before and after' : ''}`)
  if (ops.template) writes.push(ops.template.kind === 'insert' ? `the workday template: one continuous ${WORKDAY_TEMPLATE_MINUTES}-minute block from ${ops.template.start}, weekdays (the Hire form's row)` : `the workday template's start: ${before.workday_start} → ${ops.template.start}; its length, its days and its job focus stay`)
  if (ops.sync) writes.push('sync_salary_clock_sessions_for_user_day for today, which fills today and the day before, so the clock strip shows the salaried sessions now')
  if (ops.logPayload) writes.push(`one more line on the pay log for what set_pay_config does not record: ${Object.keys(ops.logPayload.changes as Json).join(', ')}`)

  // What the plan does to the hours, to pay and to the clock, said once.
  let whPlan: Json | null = null
  if (wh) {
    const thisWeek = wh.from <= today
    const whenWords = thisWeek
      ? `They start on the Sunday of this week (${wh.from}), so they hold now.${whComing ? ` The save that was waiting for the Sunday of ${whComing.effective_from} (${whComing.days ? workingWeekSaid(whComing.days) : 'working hours taken off'}) will never hold: the newest save wins.` : ''}`
      : `They start on the Sunday of next week (${wh.from}). Until then ${whToday ? `the hours in force stay (${workingWeekSaid(whToday)})` : 'no working hours are in force'}.`
    const payWords = !after.is_salary
      ? `${payName} is hourly: working hours move nothing on pay. Logged hours × the wage pay them.`
      : wh.movesPay
        ? wh.days
          ? `The door writes the seven numbers on the pay row with the hours: ${weekSaid(weekBefore)} becomes ${weekSaid(week)}, with one line on the pay log and the reason. Pay carries no date, so the new week prices every week with no pay report (reaches_back).`
          : `Taking working hours off puts the seven numbers on pay back on the standard week: ${weekSaid(weekBefore)} becomes ${weekSaid(week)}, with one line on the pay log and the reason. Pay carries no date, so the standard week prices every week with no pay report (reaches_back).`
        : wh.days
          ? `Each day keeps its length, so the seven numbers on pay stay (${weekSaid(week)}) and no pay moves.`
          : `Taking working hours off leaves the seven numbers on pay as they are (${weekSaid(week)}): ${isDefaultWeek(weekBefore) ? 'the pay row already holds the standard week' : 'no set week is in force on that Sunday'}, so there is nothing to put back.`
    const whClock = !after.is_salary || !user
      ? `${payName} clocks in and out themselves: working hours make no sessions.`
      : !tStart
        ? `No workday template stands, so the clock makes no sessions for ${payName}, with working hours or without.`
        : wh.days
          ? `The clock's sessions run at these hours from ${thisWeek ? 'the day after this is applied' : wh.from}: the day they are saved on keeps the hours it began with.`
          : `From ${thisWeek ? 'the day after this is applied' : wh.from} the sessions go back to the template's ${WORKDAY_TEMPLATE_HOURS}-hour block from ${tStart}.`
    whPlan = {
      from: wh.from,
      days: wh.days,
      hours_per_week: wh.days ? workingWeekHours(wh.days) : 0,
      words: `${wh.days ? `${payName}'s working hours become ${workingWeekSaid(wh.days)}` : `${payName}'s working hours are taken off`}. ${whenWords}`,
      pay: { salaried: after.is_salary, moves: wh.movesPay, before: after.is_salary ? [...weekBefore] : null, after: after.is_salary ? [...week] : null, words: payWords },
      clock: whClock,
      readers: `Utilization and ${payName}'s My Time read working hours over any answer, and ${payName} cannot answer Hours you can work while they are in force.`,
    }
  }

  const reply: Json = {
    dry_run: true,
    action: 'pay_setup',
    person: { pay_name: payName, user_id: user?.id ?? null, person_id: person?.id ?? null, kind: person?.kind ?? null, role: user?.role ?? null, login: !user ? 'no users row' : user.login_attached_at ? 'attached' : 'none' },
    reason: p.reason,
    // The rows as read: the plan commits to them, so a save by anyone since refuses the apply.
    pay_row: world.payRow ? { exists: true, person_name: world.payRow.person_name, linked: !!world.payRow.person_id, hourly_wage: world.payRow.hourly_wage, office_hourly_wage: world.payRow.office_hourly_wage, is_salary: world.payRow.is_salary, record_hours_but_salary: world.payRow.record_hours_but_salary, salaried_week_hours: world.payRow.salaried_week_hours ?? null } : { exists: false },
    employment: person ? { start_date: person.start_date, end_date: person.end_date } : null,
    workday_template: t ? { exists: true, mode: t.mode, start: templateStart(t), minutes: t.segment_a_duration_minutes, exclude_weekends: t.exclude_weekends, timezone: t.timezone, job_focus: !!(t.job_ledger_id || t.bid_id), updated_at: t.updated_at } : { exists: false },
    changes: changes.map((c) => ({ field: c.field, from: c.from, to: c.to, words: `${FIELD_WORDS[c.field]}: ${showValue(c.field, c.from)} → ${showValue(c.field, c.to)}` })),
    unchanged,
    after,
    // The week the plan priced with: the pay row's own, or the default when the row names none.
    // The hours as read: the plan commits to them, so a save by anyone since refuses the apply.
    working_hours: {
      in_force: whToday ? { days: whToday, hours_per_week: workingWeekHours(whToday), words: workingWeekSaid(whToday) } : null,
      coming: whComing ? { from: whComing.effective_from, words: whComing.days ? workingWeekSaid(whComing.days) : 'working hours taken off' } : null,
      saves: whRows.length,
      newest_save: whRows.map((row) => row.set_at).sort().pop() ?? null,
      plan: whPlan,
    },
    salaried_week: { hours: [...week], week_hours: weekHours, uniform_day_hours: uniform, is_default: defaultWeek, words: weekSaid(week), before: wh?.movesPay ? { hours: [...weekBefore], words: weekSaid(weekBefore) } : null, note: after.is_salary || moved('workday_start') ? `${salariedWeekNote(payName, week)}.` : null },
    weekly,
    reaches_back: {
      rule: 'The app keeps no effective date and no wage history: one pay row, read as it stands today for every past day. A change is not dated; it rewrites how the past is priced wherever a report has not already stored it.',
      payroll: { ...weeks, words: payrollWords },
      job_labor: { ...crew, words: laborWords },
      pay_reports: { pay_stubs: world.stubs.length, pay_stub_days: world.stubDays, words: world.stubs.length ? `The ${world.stubs.length} pay report${s(world.stubs.length)} already made (${world.stubDays} day row${s(world.stubDays)}) keep${world.stubs.length === 1 ? 's' : ''} the hours, rates and amounts stored on ${world.stubs.length === 1 ? 'it' : 'them'}; nothing here rewrites a report.` : 'No pay report exists yet, so nothing stored is at stake.' },
    },
    clock: { template: !!t, day_overrides: world.overrides, sync_days: syncDays, sync_before_start: syncBeforeStart, words: clockWords },
    stints: stintWords,
    writes,
    not_written: 'a pay report, logged hours, time off, the vehicle arrangement, show in hours and a split workday, which each stay on their own screen. The seven numbers of the salaried week are never written bare: working_hours sets the week, each day with its start and end',
    then: `apply writes ${writes.length === 1 ? 'it' : `the ${writes.length} steps in this order`} as you and stops at the first that fails, naming it; what landed stays. Then it reads the rows back.`,
  }
  return { ok: true, reply }
}

// ---------------------------------------------------------------------------
// The writes' bodies and the words after
// ---------------------------------------------------------------------------

/** set_pay_config's arguments. */
export function setPayConfigArgs(ops: PaySetupOps, reason: string): Json {
  return { p_person: ops.payName, p_changes: ops.payChanges ?? {}, p_reason: reason }
}

/** set_working_hours's arguments: the week, the Sunday it starts on and the reason, which the door keeps on the row and on the pay log. */
export function setWorkingHoursArgs(ops: PaySetupOps, reason: string, dryRun = false): Json | null {
  if (!ops.workingHours || !ops.userId) return null
  return { p_user_id: ops.userId, p_days: ops.workingHours.days, p_effective_from: ops.workingHours.from, p_reason: reason, p_dry_run: dryRun }
}

/** The workday template the Hire form saves (saveSalaryTemplate): one continuous 480-minute block from the start, weekdays. */
export function workdayTemplateRow(userId: string, start: string, timezone: string): Json {
  return { user_id: userId, timezone, exclude_weekends: true, mode: 'continuous', segment_a_start_local: `${start}:00`, segment_a_duration_minutes: WORKDAY_TEMPLATE_MINUTES, segment_b_start_local: null, segment_b_duration_minutes: null, use_split_focus: false, job_ledger_id: null, bid_id: null, segment_b_job_ledger_id: null, segment_b_bid_id: null }
}

/** The pay log's line for the dates and the workday start, written as the dev (set_pay_config logs the pay row's own keys). */
export function payLogRow(ops: PaySetupOps, reason: string, actor: string): Json | null {
  if (!ops.logPayload) return null
  return { person_name: ops.payName, action: 'set_pay_config', payload: ops.logPayload, reason, actor }
}

/** One applied step or hold, in the order planned. */
export type PaySetupStep = { step: string; ok: boolean; words: string }

export function paySetupAppliedWords(steps: PaySetupStep[], payName: string, planned: number): string {
  const held = steps.find((st) => !st.ok)
  if (!held) return `Done: ${payName}'s pay setup reads as planned. People → their sheet → Pay & schedule shows it, and the pay log (read_rows pay_admin_events, person_name eq) holds the before and after.`
  const landed = steps.filter((st) => st.ok).length
  return `${landed} of ${planned} step${s(planned)} landed, then ${held.step} was held (${held.words}) and nothing after it was tried. What landed stays. Read the rows in this reply, fix the reason, and plan again for what is left.`
}
