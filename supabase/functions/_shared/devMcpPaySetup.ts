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
// Pure: no network, no env. The server (dev-mcp/index.ts) resolves the person and runs the legs; this file says what
// the ask may name, what is refused and why, what each write becomes, and the words. readPaySetupWorld takes the
// server's reader, so the reads are tested here too. Tests: src/lib/devMcp/devMcpPaySetup.test.ts.

type Json = Record<string, unknown>
const obj = (v: unknown): Json | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : null)
const YMD_RE = /^\d{4}-\d{2}-\d{2}$/
const HHMM_RE = /^([01]\d|2[0-3]):[0-5]\d$/

export const PAY_SETUP_VERBS = ['plan_pay_setup', 'apply_pay_setup'] as const
export type PaySetupVerb = (typeof PAY_SETUP_VERBS)[number]
export function isPaySetupVerb(verb: string): verb is PaySetupVerb {
  return (PAY_SETUP_VERBS as readonly string[]).includes(verb)
}

/** A salaried day's length. The template stores one block of this many minutes and payroll credits these hours a weekday. */
export const SALARIED_DAY_MINUTES = 480
export const SALARIED_DAY_HOURS = 8
export const SALARIED_WEEKDAYS = 5
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
}
export type PaySetupPayload = { action: 'pay_setup'; person: string; reason: string; set: PaySetupSet }
export type PaySetupInput = { ok: true; p: PaySetupPayload; target: string } | { ok: false; error: string }

const FIXED_DAY_WORDS = `A salaried day is ${SALARIED_DAY_HOURS} hours in this app: the workday template stores one continuous ${SALARIED_DAY_MINUTES}-minute block and payroll credits a flat ${SALARIED_DAY_HOURS} h on each weekday. No other length can be stored`

const PAY_SETUP_SHAPE = `needs pay — { person (a users.id, a people.id, an address or a name matching one person), reason (one line, kept on the pay log), and one or more of: hourly_wage (a number, or null to clear; a weekly salary ÷ 40), office_hourly_wage (a number or null), is_salary (true | false), record_hours_but_salary (true | false: also record real punches beside the salary), start_date and end_date (YYYY-MM-DD or null, the employment dates on the roster row; end on or after start), workday_start (HH:MM, the start of the salaried day's one 8-hour block) }. ${FIXED_DAY_WORDS}: workday_hours other than 8, or a workday_end that is not 8 hours after the start, is refused.`

const str = (o: Json, k: string): string => (typeof o[k] === 'string' ? (o[k] as string).trim() : '')
const cents = (n: number): number => Math.round(n * 100) / 100
const hhmmToMinutes = (t: string): number => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))
const minutesToHhmm = (m: number): string => `${String(Math.floor((((m % 1440) + 1440) % 1440) / 60)).padStart(2, '0')}:${String((((m % 1440) + 1440) % 1440) % 60).padStart(2, '0')}`
/** The end of the 8-hour block that starts at `start` (HH:MM), wrapping past midnight. */
export const workdayEndOf = (start: string): string => minutesToHhmm(hhmmToMinutes(start) + SALARIED_DAY_MINUTES)

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
    if (n > WAGE_MAX) return { ok: false, error: `${verb}: pay.${key} ${n} reads like a weekly or yearly figure. The app holds a salary as an hourly wage priced over the flat ${SALARIED_DAY_HOURS}-hour day: divide a weekly amount by ${SALARIED_DAY_HOURS * SALARIED_WEEKDAYS} (a yearly one by ${SALARIED_DAY_HOURS * SALARIED_WEEKDAYS * 52}) and pass that.` }
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
    if (!set.workday_start) return { ok: false, error: `${verb}: a workday's length goes with pay.workday_start. ${FIXED_DAY_WORDS}.` }
    const end = workdayEndOf(set.workday_start)
    const refuse = (asked: string): PaySetupInput => ({ ok: false, error: `${verb}: ${asked} is not a day this app can hold. ${FIXED_DAY_WORDS}, so nothing was planned. Pass workday_start alone: the sessions then run ${set.workday_start} to ${end}, ${SALARIED_DAY_HOURS} hours, and pay is the wage × ${SALARIED_DAY_HOURS} × ${SALARIED_WEEKDAYS} a week whatever the person works. A shorter paid day is an hourly person with logged hours, or a lower wage.` })
    if (a.workday_hours !== undefined && a.workday_hours !== SALARIED_DAY_HOURS) return refuse(`workday_hours ${JSON.stringify(a.workday_hours)}`)
    if (a.workday_minutes !== undefined && a.workday_minutes !== SALARIED_DAY_MINUTES) return refuse(`workday_minutes ${JSON.stringify(a.workday_minutes)}`)
    if (a.workday_end !== undefined && str(a, 'workday_end').slice(0, 5) !== end) return refuse(`a workday from ${set.workday_start} to ${JSON.stringify(a.workday_end)}`)
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
export const PAY_ROW_SELECT = 'person_name,person_id,hourly_wage,office_hourly_wage,is_salary,record_hours_but_salary'
export type PayRow = { person_name: string; person_id: string | null; hourly_wage: number | null; office_hourly_wage: number | null; is_salary: boolean; record_hours_but_salary: boolean }
export const PAY_TEMPLATE_SELECT = 'user_id,timezone,exclude_weekends,mode,segment_a_start_local,segment_a_duration_minutes,segment_b_start_local,segment_b_duration_minutes,use_split_focus,job_ledger_id,bid_id,updated_at'
export type PayTemplateRow = { user_id: string; timezone: string; exclude_weekends: boolean; mode: string; segment_a_start_local: string; segment_a_duration_minutes: number; segment_b_start_local: string | null; segment_b_duration_minutes: number | null; use_split_focus: boolean; job_ledger_id: string | null; bid_id: string | null; updated_at: string | null }
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
  const empty: PaySetupWorld = { user, person, payRow: null, payRowOtherName: null, template: null, overrides: 0, stubs: [], stubDays: 0, stints: [], timeOff: [], crewDates: [] }
  if (!payName) return empty
  const name = encodeURIComponent(payName)
  const [payRows, byId, templates, overrides, stubs, stubDays, stints, timeOff, crewByName, crewById] = await Promise.all([
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

/** The hours payroll credits a salaried person on a day (salariedDayCredit): 8 on a weekday inside the employment window, 0 on unpaid time off. */
export function salariedCreditHours(ymd: string, w: PayWindow): number {
  if (isWeekend(ymd)) return 0
  if (w.stints.length >= 2) {
    if (!w.stints.some((s) => (s.start_date == null || ymd >= s.start_date) && (s.end_date == null || ymd <= s.end_date))) return 0
  } else {
    if (w.employmentStart != null && ymd < w.employmentStart) return 0
    if (w.employmentEnd != null && ymd > w.employmentEnd) return 0
  }
  const overlapping = w.timeOff.filter((r) => ymd >= r.start_date && ymd <= r.end_date)
  if (overlapping.some((r) => r.kind !== 'paid')) return 0
  return SALARIED_DAY_HOURS
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

export type PayFacts = { hourly_wage: number | null; office_hourly_wage: number | null; is_salary: boolean; record_hours_but_salary: boolean; start_date: string | null; end_date: string | null; workday_start: string | null }
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
  /** sync_salary_clock_sessions_for_user_day for today. */
  sync: boolean
  /** The pay_admin_events line for what set_pay_config does not log: the dates and the workday start. */
  logPayload: Json | null
}

export type PaySetupResolved = { ok: true; payName: string; before: PayFacts; after: PayFacts; changes: PayChange[]; unchanged: string[]; ops: PaySetupOps } | { ok: false; refused: string }

const templateStart = (t: PayTemplateRow | null): string | null => (t ? String(t.segment_a_start_local ?? '').slice(0, 5) || null : null)
const sameMoney = (a: number | null, b: number | null): boolean => (a == null || b == null ? a == b : cents(a) === cents(b))
const money = (n: number): string => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const s = (n: number): string => (n === 1 ? '' : 's')

/** The refusals, the before and after, and the writes. Pure over the ask and the world. */
export function resolvePaySetup(p: PaySetupPayload, world: PaySetupWorld): PaySetupResolved {
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
  const before: PayFacts = {
    hourly_wage: row?.hourly_wage ?? null,
    office_hourly_wage: row?.office_hourly_wage ?? null,
    is_salary: row?.is_salary === true,
    record_hours_but_salary: row?.record_hours_but_salary === true,
    start_date: person?.start_date ?? null,
    end_date: person?.end_date ?? null,
    workday_start: templateStart(world.template),
  }
  const set = p.set
  if ((set.start_date !== undefined || set.end_date !== undefined) && !person) return { ok: false, refused: `Nothing to plan: ${who} has no roster row, and the employment dates live on it. The Users tab's fix makes the row; the wage and Salaried can be planned without the dates.` }
  const after: PayFacts = {
    hourly_wage: set.hourly_wage !== undefined ? set.hourly_wage : before.hourly_wage,
    office_hourly_wage: set.office_hourly_wage !== undefined ? set.office_hourly_wage : before.office_hourly_wage,
    is_salary: set.is_salary !== undefined ? set.is_salary : before.is_salary,
    record_hours_but_salary: set.record_hours_but_salary !== undefined ? set.record_hours_but_salary : before.record_hours_but_salary,
    start_date: set.start_date !== undefined ? set.start_date : before.start_date,
    end_date: set.end_date !== undefined ? set.end_date : before.end_date,
    workday_start: set.workday_start !== undefined ? set.workday_start : before.workday_start,
  }
  const stoppedSalary = before.is_salary && !after.is_salary
  const becameSalary = !before.is_salary && after.is_salary
  if (stoppedSalary) after.workday_start = null
  if (after.start_date && after.end_date && after.end_date < after.start_date) return { ok: false, refused: `Nothing to plan: the end date ${after.end_date} would fall before the start date ${after.start_date}. End on or after start; pass both dates to move them together.` }
  if (after.is_salary && (becameSalary || set.hourly_wage !== undefined) && !((after.hourly_wage ?? 0) > 0)) return { ok: false, refused: `Nothing to plan: Salaried needs the hourly rate the flat ${SALARIED_DAY_HOURS}-hour day is priced at, and ${who} would have none. Pass hourly_wage: a weekly amount ÷ ${SALARIED_DAY_HOURS * SALARIED_WEEKDAYS}.` }
  if (set.record_hours_but_salary === true && !after.is_salary) return { ok: false, refused: `Nothing to plan: "also record hours" goes with Salaried, and ${who} would be hourly: their logged hours are already what pays them.` }
  if (set.workday_start !== undefined) {
    if (!after.is_salary) return { ok: false, refused: `Nothing to plan: a workday template is a salaried day's, and ${who} would be hourly. Pass is_salary: true in the same plan, or leave workday_start out.` }
    if (!user) return { ok: false, refused: `Nothing to plan: ${who} has no users row, and the workday template hangs on one. plan_account makes the row; the wage and Salaried can be planned without the workday.` }
    const t = world.template
    if (t && (t.mode !== 'continuous' || t.segment_a_duration_minutes !== SALARIED_DAY_MINUTES || t.segment_b_start_local != null)) {
      return { ok: false, refused: `Nothing to plan: ${who}'s workday is a split day (${templateStart(t)} for ${t.segment_a_duration_minutes} minutes${t.segment_b_start_local ? `, then ${String(t.segment_b_start_local).slice(0, 5)} for ${t.segment_b_duration_minutes ?? 0}` : ''}), set on their sheet. The seat writes only the one continuous ${SALARIED_DAY_HOURS}-hour block: change a split day in Workday schedule… on People → their sheet → Pay & schedule, or leave workday_start out.` }
    }
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
    sync: !!user && !stoppedSalary && (becameSalary || !!templateOp),
    logPayload: logged.length ? { via: 'dev-mcp', verb: 'apply_pay_setup', changes: Object.fromEntries(logged.map((k) => [k, after[k]])), before: Object.fromEntries(logged.map((k) => [k, before[k]])), after: Object.fromEntries(logged.map((k) => [k, after[k]])) } : null,
  }
  return { ok: true, payName, before, after, changes, unchanged, ops }
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
export function payrollWeeks(world: PaySetupWorld, before: PayFacts, after: PayFacts, today: string): PayrollWeeks {
  const lastEnd = world.stubs.map((st) => st.period_end).filter((d) => YMD_RE.test(d)).sort().pop() ?? null
  const sundayThis = ymdAddDays(today, -weekdayOf(today))
  let back = CATCH_UP_WEEKS
  if (lastEnd) {
    const sundayLast = ymdAddDays(lastEnd, -weekdayOf(lastEnd))
    back = Math.max(0, Math.min(WEEKS_BACK_MAX, Math.round((Date.parse(`${sundayThis}T12:00:00Z`) - Date.parse(`${sundayLast}T12:00:00Z`)) / (7 * DAY_MS))))
  }
  const open = weeksBefore(today, back).filter((w) => !world.stubs.some((st) => st.period_start <= w.weekEnd && st.period_end >= w.weekStart))
  const credit = (facts: PayFacts, stints: PayStint[]) => {
    const window: PayWindow = { timeOff: world.timeOff, employmentStart: facts.start_date, employmentEnd: facts.end_date, stints }
    let weeks = 0
    let hours = 0
    const starts: string[] = []
    for (const w of open) {
      let h = 0
      for (let d = w.weekStart; d <= w.weekEnd; d = ymdAddDays(d, 1)) h += salariedCreditHours(d, window)
      if (h < 0.005) continue
      weeks++
      hours += h
      starts.push(w.weekStart)
    }
    starts.sort()
    return { weeks, hours, est_gross: cents(hours * (facts.hourly_wage ?? 0)), first_week: starts[0] ?? null, last_week: starts[starts.length - 1] ?? null }
  }
  const was = before.is_salary ? credit(before, world.stints) : null
  return {
    last_report_through: lastEnd,
    weeks_counted: back,
    weeks_without_report: open.length,
    salaried_before: was ? { weeks: was.weeks, est_gross: was.est_gross } : null,
    salaried_after: after.is_salary ? credit(after, stintsAfter(world.stints, before, after)) : null,
  }
}

/** The crew days up to today that job labor prices (teamLabor.ts): weekdays and weekend days apart. */
export function crewDays(world: PaySetupWorld, today: string): { days: number; weekdays: number; weekend_days: number; first: string | null; last: string | null } {
  const past = world.crewDates.filter((d) => d <= today)
  const weekend = past.filter(isWeekend).length
  return { days: past.length, weekdays: past.length - weekend, weekend_days: weekend, first: past[0] ?? null, last: past[past.length - 1] ?? null }
}

// ---------------------------------------------------------------------------
// The dry run
// ---------------------------------------------------------------------------

export type PaySetupDryRun = { ok: true; reply: Json } | { ok: false; refused: string }

const FIELD_WORDS: Record<keyof PayFacts, string> = { hourly_wage: 'the hourly wage', office_hourly_wage: 'the office wage', is_salary: 'Salaried', record_hours_but_salary: 'also record hours', start_date: 'the employment start date', end_date: 'the employment end date', workday_start: 'the workday start' }
const showValue = (field: keyof PayFacts, v: unknown): string => {
  if (v == null) return field === 'end_date' ? 'none (still employed)' : 'none'
  if (field === 'hourly_wage' || field === 'office_hourly_wage') return `${money(v as number)}/h`
  if (typeof v === 'boolean') return v ? 'on' : 'off'
  return String(v)
}

/** The plan: before and after for each field, what the change reaches back into, and the writes in order. */
export function paySetupDryRun(p: PaySetupPayload, world: PaySetupWorld, today: string): PaySetupDryRun {
  const r = resolvePaySetup(p, world)
  if (!r.ok) return r
  const { payName, before, after, changes, unchanged, ops } = r
  const { user, person } = world
  const moved = (f: keyof PayFacts): boolean => changes.some((c) => c.field === f)
  const becameSalary = !before.is_salary && after.is_salary
  const stoppedSalary = before.is_salary && !after.is_salary
  const wageMoved = moved('hourly_wage')

  const weekly = after.is_salary && after.hourly_wage != null
    ? { hourly_wage: after.hourly_wage, per_week: cents(after.hourly_wage * SALARIED_DAY_HOURS * SALARIED_WEEKDAYS), words: `${money(after.hourly_wage)}/h × ${SALARIED_DAY_HOURS} h × ${SALARIED_WEEKDAYS} weekdays = ${money(cents(after.hourly_wage * SALARIED_DAY_HOURS * SALARIED_WEEKDAYS))} a week, whatever hours are worked or logged. A weekday of unpaid time off, or outside the employment dates, pays 0.` }
    : null

  // Payroll: the weeks with no pay report.
  const weeks = payrollWeeks(world, before, after, today)
  const since = weeks.last_report_through ? `Since the last pay report (through ${weeks.last_report_through})` : `No pay report has ever been made for ${payName}; over the ${weeks.weeks_counted} weeks payroll catch-up scans`
  let payrollWords = `${since}, ${weeks.weeks_without_report} whole week${s(weeks.weeks_without_report)} before this one ${weeks.weeks_without_report === 1 ? 'has' : 'have'} no pay report${weeks.weeks_counted >= WEEKS_BACK_MAX ? ` (counted ${WEEKS_BACK_MAX} weeks back and no further)` : ''}.`
  if (weeks.salaried_after) {
    const a = weeks.salaried_after
    const was = weeks.salaried_before
    payrollWords += a.weeks === 0
      ? ` With Salaried on${after.start_date ? ` and the start date ${after.start_date}` : ''}, none of them shows on payroll catch-up as unreported.`
      : ` With Salaried on${after.start_date ? ` and the start date ${after.start_date}` : ' and no start date'}, ${a.weeks} of them show${a.weeks === 1 ? 's' : ''} on payroll catch-up as an unreported week (${a.first_week}${a.last_week !== a.first_week ? ` to the week of ${a.last_week}` : ''}), about ${money(a.est_gross)} in all at this wage${was ? `; today ${was.weeks} show${was.weeks === 1 ? 's' : ''}, about ${money(was.est_gross)}` : '; today, hourly, a week shows only when it holds logged hours'}.`
    if (a.weeks > 0 && !after.start_date) payrollWords += ' The app has no effective date: a salaried person is credited 8 h on every weekday of every week with no report, back as far as anyone looks. A start date is the only thing that stops it, and only on payroll: pass start_date (the first salaried day) in the same plan.'
    else if (a.weeks > 0) payrollWords += ` Each is a weekday on or after the start date with no report covering it: make those reports, or move start_date to the first day the salary applies.`
  } else {
    payrollWords += stoppedSalary ? ` With Salaried off, a week shows on payroll catch-up only when it holds logged hours: the salaried weeks with no report stop showing.` : ` Hourly: a week shows on payroll catch-up only when it holds logged hours${wageMoved ? ', and its estimate there reads the new wage' : ''}.`
  }

  // Job labor: today's row prices every past crew day.
  const crew = crewDays(world, today)
  const span = crew.days ? ` (${crew.first}${crew.last !== crew.first ? ` to ${crew.last}` : ''})` : ''
  let laborWords: string
  if (crew.days === 0) laborWords = `${payName} is on no crew day with a job yet, so nothing on job labor re-prices.`
  else if (becameSalary) laborWords = `${crew.days} past crew day${s(crew.days)}${span} re-price on job labor: each of the ${crew.weekdays} weekday${s(crew.weekdays)} reads a flat ${SALARIED_DAY_HOURS} h × ${showValue('hourly_wage', after.hourly_wage)} whatever was logged, and the ${crew.weekend_days} weekend day${s(crew.weekend_days)} read${crew.weekend_days === 1 ? 's' : ''} 0. The start date does not shield them: job labor reads today's pay row for every past day.`
  else if (stoppedSalary) laborWords = `${crew.days} past crew day${s(crew.days)}${span} re-price on job labor: each goes back to its logged hours × ${showValue('hourly_wage', after.hourly_wage)}, and a day with no logged hours reads 0.`
  else if (wageMoved && after.is_salary) laborWords = `${crew.weekdays} past weekday crew day${s(crew.weekdays)}${span} re-price on job labor at a flat ${SALARIED_DAY_HOURS} h × ${showValue('hourly_wage', after.hourly_wage)} in place of ${showValue('hourly_wage', before.hourly_wage)}: job labor reads today's wage for every past day, and no date shields them.`
  else if (wageMoved) laborWords = `${crew.days} past crew day${s(crew.days)}${span} re-price on job labor at their logged hours × ${showValue('hourly_wage', after.hourly_wage)} in place of ${showValue('hourly_wage', before.hourly_wage)}: job labor reads today's wage for every past day, and no date shields them.`
  else laborWords = `Job labor does not re-price: the wage and Salaried stay as they are (${crew.days} past crew day${s(crew.days)} on record).`

  // The clock.
  const t = world.template
  const tStart = after.workday_start
  let clockWords: string
  if (stoppedSalary) clockWords = `Turning Salaried off clears the workday schedule: ${t ? `the template (${templateStart(t)})` : 'no template stands'}, ${world.overrides} day override${s(world.overrides)}, and today's unapproved auto-sessions. Pay goes back to logged hours × wage, so ${payName} clocks in and out from now on. Past pay reports and approved hours stay.`
  else if (!after.is_salary) clockWords = `Hourly: ${payName}'s own punches are what pays them; nothing on the clock changes.`
  else if (!user) clockWords = `${payName} has no users row, so no workday template and no sessions on a clock: payroll credits the flat ${SALARIED_DAY_HOURS} h on weekdays all the same.`
  else if (tStart) clockWords = `${ops.template ? (ops.template.kind === 'insert' ? 'A workday template is made' : `The workday template moves from ${before.workday_start}`) : 'A workday template stands'}: ${SALARIED_DAY_HOURS} hours from ${tStart} to ${workdayEndOf(tStart)}, ${t && !t.exclude_weekends ? 'every day' : 'weekdays'}. Sessions appear on ${payName}'s clock strip by themselves${ops.sync ? '; apply syncs today\'s' : ''}. They do not clock in for pay${after.record_hours_but_salary ? '; "also record hours" keeps their real punches recorded beside the salary' : ''}.`
  else clockWords = `No workday template: Salaried is on for pay (the flat ${SALARIED_DAY_HOURS} h on weekdays), but no session appears on ${payName}'s clock strip until a template is saved. Pass workday_start (HH:MM) in the plan, or Workday schedule… on their sheet.`

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
  if (ops.clearSchedule) writes.push('pay_staff_clear_salary_schedule_by_person_name: the workday template, the day overrides and today\'s unapproved auto-sessions go')
  if (ops.template) writes.push(ops.template.kind === 'insert' ? `the workday template: one continuous ${SALARIED_DAY_MINUTES}-minute block from ${ops.template.start}, weekdays (the Hire form's row)` : `the workday template's start: ${before.workday_start} → ${ops.template.start}; its length, its days and its job focus stay`)
  if (ops.sync) writes.push('sync_salary_clock_sessions_for_user_day for today, so the clock strip shows the salaried sessions now')
  if (ops.logPayload) writes.push(`one more line on the pay log for what set_pay_config does not record: ${Object.keys(ops.logPayload.changes as Json).join(', ')}`)

  const reply: Json = {
    dry_run: true,
    action: 'pay_setup',
    person: { pay_name: payName, user_id: user?.id ?? null, person_id: person?.id ?? null, kind: person?.kind ?? null, role: user?.role ?? null, login: !user ? 'no users row' : user.login_attached_at ? 'attached' : 'none' },
    reason: p.reason,
    // The rows as read: the plan commits to them, so a save by anyone since refuses the apply.
    pay_row: world.payRow ? { exists: true, person_name: world.payRow.person_name, linked: !!world.payRow.person_id, hourly_wage: world.payRow.hourly_wage, office_hourly_wage: world.payRow.office_hourly_wage, is_salary: world.payRow.is_salary, record_hours_but_salary: world.payRow.record_hours_but_salary } : { exists: false },
    employment: person ? { start_date: person.start_date, end_date: person.end_date } : null,
    workday_template: t ? { exists: true, mode: t.mode, start: templateStart(t), minutes: t.segment_a_duration_minutes, exclude_weekends: t.exclude_weekends, timezone: t.timezone, job_focus: !!(t.job_ledger_id || t.bid_id), updated_at: t.updated_at } : { exists: false },
    changes: changes.map((c) => ({ field: c.field, from: c.from, to: c.to, words: `${FIELD_WORDS[c.field]}: ${showValue(c.field, c.from)} → ${showValue(c.field, c.to)}` })),
    unchanged,
    after,
    weekly,
    reaches_back: {
      rule: 'The app keeps no effective date and no wage history: one pay row, read as it stands today for every past day. A change is not dated; it rewrites how the past is priced wherever a report has not already stored it.',
      payroll: { ...weeks, words: payrollWords },
      job_labor: { ...crew, words: laborWords },
      pay_reports: { pay_stubs: world.stubs.length, pay_stub_days: world.stubDays, words: world.stubs.length ? `The ${world.stubs.length} pay report${s(world.stubs.length)} already made (${world.stubDays} day row${s(world.stubDays)}) keep${world.stubs.length === 1 ? 's' : ''} the hours, rates and amounts stored on ${world.stubs.length === 1 ? 'it' : 'them'}; nothing here rewrites a report.` : 'No pay report exists yet, so nothing stored is at stake.' },
    },
    clock: { template: !!t, day_overrides: world.overrides, words: clockWords },
    fixed_day: after.is_salary || moved('workday_start') ? `${FIXED_DAY_WORDS}: a person who works a shorter day (06:00 to 12:00, say) is still paid and shown ${SALARIED_DAY_HOURS} hours.` : null,
    stints: stintWords,
    writes,
    not_written: 'a pay report, logged hours, time off, the vehicle arrangement, show in hours, and a split or shorter workday — each stays on its own screen',
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

/** The workday template the Hire form saves (saveSalaryTemplate): one continuous 8-hour block from the start, weekdays. */
export function workdayTemplateRow(userId: string, start: string, timezone: string): Json {
  return { user_id: userId, timezone, exclude_weekends: true, mode: 'continuous', segment_a_start_local: `${start}:00`, segment_a_duration_minutes: SALARIED_DAY_MINUTES, segment_b_start_local: null, segment_b_duration_minutes: null, use_split_focus: false, job_ledger_id: null, bid_id: null, segment_b_job_ledger_id: null, segment_b_bid_id: null }
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
