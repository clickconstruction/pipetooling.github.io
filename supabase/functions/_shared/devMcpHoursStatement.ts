/**
 * The signed hours statement through the dev MCP (punch list #212, PR 5, v2.6414): `get_hours_statement` as a
 * composite — the same reads the Hours statement window makes (`src/lib/people/hoursStatementRead.ts`), handed to the
 * same kernel (`hoursStatement.ts`), so the answer is the paper's rows, weeks, pay lines, gap and totals with a one-line
 * `reading` first and the statements already made for that job and person — and the shaping behind
 * `plan_hours_statement` → `apply_hours_statement`: `make` (the row the window saves, from a snapshot read here, through
 * `dev_hours_statement_write`), its `send` leg (the form drawn and the link minted through the signing functions as
 * the dev, then the row marked sent), and `file_on_matter` (a signed copy onto a matter's Evidence tab).
 *
 * Since punch list #212's residuals the read follows the window's two later turns: the **charged basis** (`basis:
 * 'charged'`, punch list #251 over #254's crew-days) prices the person's days as the crew they were part of through the
 * same kernel the window reads with (`hoursStatementCharged.ts`, on the edge copy), and a **sub on the job's sheets**
 * (`kind: 'sheet'`, or left out for a sub) reads the sheets' lines through `hoursStatementSheets.ts`, always as paid.
 *
 * Nothing here reads the network: it takes the door's `Reader` (dev-mcp passes one that GETs as the dev; the tests
 * pass the catalog-checked fake) and an `invoke` for the function calls. The reads are RLS-bound, so a dev reads what
 * the window would show them.
 */
import { findJob, findPerson, jobNumberOf, readAllRows, type Reader, type Row } from './devMcpComposites.ts'
import type { RowFilter } from './devMcpDoor.ts'
import { APP_CALENDAR_TZ, calendarYmdInAppTzFromIso } from './appTimeZone.ts'
import {
  buildHoursStatement,
  hoursStatementGap,
  hoursStatementLongDate,
  hoursStatementRoundHours,
  hoursStatementStanding,
  hoursStatementWeekLabel,
  type HoursStatement,
  type HoursStatementBasis,
  type HoursStatementInput,
  type HoursStatementPayGroup,
  type HoursStatementRow,
  type HoursStatementStatedDay,
} from './hoursStatement.ts'
import { jobChargeRuleFrom, type CrewSessionInput } from './gcKernels/lib/charges/crewDays.ts'
import { RATE_CARD_SETTING_KEYS, parseCrewShape, rateCardFromSettings } from './gcKernels/lib/charges/rateCard.ts'
import { chargeAdjustmentFromRow, type ChargeAdjustment } from './gcKernels/lib/charges/adjustments.ts'
import { standingsById, type ChargeStandingRow } from './gcKernels/lib/charges/chargeStandings.ts'
import { hoursStatementChargedRows, type HoursStatementChargeFacts } from './gcKernels/lib/people/hoursStatementCharged.ts'
import { hoursStatementSheetCounts, hoursStatementSheetPayGroups, hoursStatementSheetRows, type HoursStatementSheet, type HoursStatementSheetLine, type HoursStatementSheetPayment } from './gcKernels/lib/people/hoursStatementSheets.ts'
import { hoursStatementStateWords, isHoursStatementState } from './hoursStatementRecord.ts'
import { parseStatedDayRows, statedByWords } from './hoursStatementForm.ts'
import { hoursStatementEvidenceFileName, hoursStatementEvidenceShows, hoursStatementEvidenceTitle } from './hoursStatementEvidenceWords.ts'

export const OFFICE_JOB_SETTING_KEY = 'overhead_office_job_ledger_id_v1'
/** The door reads at most 200 rows a call; a span with more sessions is cut and the reading says so. */
export const HS_SESSIONS_CAP = 200
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const YMD_RE = /^\d{4}-\d{2}-\d{2}$/

const str = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v))
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : null)
const obj = (v: unknown): Record<string, unknown> | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null)
const eq = (column: string, value: unknown): RowFilter => ({ column, op: 'eq', value })

/** `7:00 am`: a punch's wall-clock time in the app's calendar, as the window labels it. */
export function hoursStatementClockLabel(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('en-US', { timeZone: APP_CALENDAR_TZ, hour: 'numeric', minute: '2-digit' }).format(d).toLowerCase()
}

/** Dollars to the cent, as the pay report nets a week: gross − deductions + additional lines, never below zero. */
export function hoursStatementNetPay(grossPay: number, deductionsSum: number, additionalSum = 0): number {
  return Math.max(0, Math.round((grossPay - deductionsSum + additionalSum) * 100) / 100)
}

// ---------------------------------------------------------------------------
// The ask
// ---------------------------------------------------------------------------

/** Where a person's rows come from: the clock, or a sub's sheets on the job (as the window's Who list decides it). */
export type HoursStatementSource = 'clock' | 'sheet'

export type HoursStatementAsk = { job: string; person: string; from: string; to: string; withPay: boolean; addStatedBlock: boolean; basis: HoursStatementBasis; /** null: a sub on the job's sheets reads the sheets, anyone else the clock. */ kind: HoursStatementSource | null }

/** Why a sheet paper refuses the charged basis, as the window holds the switch. */
export const HS_SHEET_NOT_CHARGED = 'a sub’s sheet is agreed work, so a sheet paper is always as paid — leave basis off, or pass kind clock for the person’s own punches.'

/** `get_hours_statement`'s arguments checked: the job and the person (an id or a name), the span as days, the switches, the basis and the source. */
export function parseHoursStatementAsk(args: Record<string, unknown>): HoursStatementAsk | { error: string } {
  const job = str(args.job).trim()
  const person = str(args.person).trim()
  const from = str(args.from).trim()
  const to = str(args.to).trim()
  if (!job || !person) return { error: 'get_hours_statement needs job (a jobs_ledger.id, or a job number or name find_job resolves) and person (a users.id, or a name find_person resolves).' }
  if (!YMD_RE.test(from) || !YMD_RE.test(to)) return { error: 'get_hours_statement needs from and to as days, YYYY-MM-DD — the period the paper covers.' }
  if (to < from) return { error: 'get_hours_statement: to comes before from — the period runs forward.' }
  const basis = args.basis == null || str(args.basis).trim() === '' ? 'paid' : str(args.basis).trim()
  if (basis !== 'paid' && basis !== 'charged') return { error: 'get_hours_statement: basis must be paid (the wage and the pay reports; the default) or charged (every counted hour at the rate the customer is charged, as the crew it was part of).' }
  const kind = args.kind == null || str(args.kind).trim() === '' ? null : str(args.kind).trim()
  if (kind != null && kind !== 'clock' && kind !== 'sheet') return { error: 'get_hours_statement: kind must be clock (the person’s punches) or sheet (a sub’s sheet lines); left out, a sub on the job’s sheets reads the sheets and anyone else the clock.' }
  if (basis === 'charged' && kind === 'sheet') return { error: `get_hours_statement: ${HS_SHEET_NOT_CHARGED}` }
  return { job, person, from, to, withPay: basis === 'charged' ? false : args.with_pay !== false, addStatedBlock: args.add_stated_block === true, basis, kind }
}

export type HoursStatementParties = {
  job: { id: string; number: string; name: string; customer: string | null; site: string }
  user: { id: string; name: string; role: string; email: string | null; phone: string | null }
}

async function resolveJob(reader: Reader, ref: string): Promise<{ id: string } | { refused: string }> {
  if (UUID_RE.test(ref)) return { id: ref.toLowerCase() }
  const { matches } = await findJob(reader, ref)
  const rows = matches as Row[]
  if (rows.length === 1) return { id: str(rows[0]!.id) }
  const exact = rows.filter((m) => str(m.label).toLowerCase() === ref.toLowerCase())
  if (exact.length === 1) return { id: str(exact[0]!.id) }
  if (rows.length === 0) return { refused: `No job matches "${ref}".` }
  return { refused: `"${ref}" matches ${rows.length} jobs — pass the id of one: ${rows.slice(0, 8).map((m) => `${str(m.label)} (${str(m.id)})`).join('; ')}` }
}

async function resolvePerson(reader: Reader, ref: string): Promise<{ id: string } | { refused: string }> {
  if (UUID_RE.test(ref)) return { id: ref.toLowerCase() }
  const { matches } = await findPerson(reader, ref)
  const rows = matches as Row[]
  if (rows.length === 1) return { id: str(rows[0]!.id) }
  const exact = rows.filter((m) => str(m.name).toLowerCase() === ref.toLowerCase())
  if (exact.length === 1) return { id: str(exact[0]!.id) }
  if (rows.length === 0) return { refused: `No person matches "${ref}".` }
  return { refused: `"${ref}" matches ${rows.length} people — pass the id of one: ${rows.slice(0, 8).map((m) => `${str(m.name)} (${str(m.id)})`).join('; ')}` }
}

/** The job and the worker, by id or by the words find_job / find_person resolve, read as the dev. */
export async function resolveHoursStatementParties(reader: Reader, ask: Pick<HoursStatementAsk, 'job' | 'person'>): Promise<HoursStatementParties | { refused: string }> {
  const [job, person] = await Promise.all([resolveJob(reader, ask.job), resolvePerson(reader, ask.person)])
  if ('refused' in job) return job
  if ('refused' in person) return person
  const [jobRows, userRows] = await Promise.all([
    reader.rows('jobs_ledger', { select: 'id,hcp_number,click_number,job_name,job_address,customer_name', filters: [eq('id', job.id)], limit: 1 }),
    reader.rows('users', { select: 'id,name,role,email,phone', filters: [eq('id', person.id)], limit: 1 }),
  ])
  const j = jobRows[0]
  const u = userRows[0]
  if (!j) return { refused: `No job ${job.id} — it does not exist, or RLS hides it from you.` }
  if (!u) return { refused: `No person ${person.id} — it does not exist, or RLS hides it from you.` }
  return {
    job: { id: str(j.id), number: jobNumberOf(j.hcp_number, j.click_number) || str(j.id).slice(0, 8), name: str(j.job_name).trim() || 'Unnamed job', customer: j.customer_name == null ? null : str(j.customer_name), site: str(j.job_address).trim() },
    user: { id: str(u.id), name: str(u.name).trim() || 'Unnamed', role: str(u.role), email: u.email == null ? null : str(u.email), phone: u.phone == null ? null : str(u.phone) },
  }
}

// ---------------------------------------------------------------------------
// The read, as the window makes it
// ---------------------------------------------------------------------------

export type HoursStatementReadCounts = { approved: number; pending: number; typedDays: number; quickAddsLeftOff: number; /** A sub's paper: the sheets in the span (`approved` is then the lines). Missing on a clock paper. */ sheets?: number }

export type HoursStatementDevRead = {
  input: HoursStatementInput
  worker: { name: string; standing: string }
  approvedBy: string | null
  isOfficeJob: boolean
  personId: string | null
  payName: string
  counts: HoursStatementReadCounts
  firstRecordedDay: string | null
  /** The span held more sessions than one read returns; the paper is short by the rest. */
  capped: boolean
  /** Where the rows came from: the clock, or a sub's sheets. */
  source: HoursStatementSource
  /** On the charged basis, what the paper was priced by; null on the paid basis. */
  charge: HoursStatementChargeFacts | null
}

type SheetReads = { sheets: HoursStatementSheet[]; lines: HoursStatementSheetLine[]; payments: HoursStatementSheetPayment[] }
const NO_SHEETS: SheetReads = { sheets: [], lines: [], payments: [] }

/** A sub's sheets on the job (the roster rows behind the login, assigned to a sheet there), their lines and their payments. */
async function readSheets(reader: Reader, jobId: string, personIds: string[]): Promise<SheetReads> {
  if (personIds.length === 0) return NO_SHEETS
  const links = await reader.rows('people_labor_job_assignees', { select: 'labor_job_id,person_id', filters: [{ column: 'person_id', op: 'in', value: personIds }], limit: HS_SESSIONS_CAP }).catch(() => [] as Row[])
  const linked = Array.from(new Set(links.map((l) => str(l.labor_job_id)).filter(Boolean)))
  if (linked.length === 0) return NO_SHEETS
  const sheetRows = await reader.rows('people_labor_jobs', { select: 'id,job_date,created_at,labor_rate', filters: [eq('job_ledger_id', jobId), { column: 'id', op: 'in', value: linked }], limit: HS_SESSIONS_CAP })
  const sheets: HoursStatementSheet[] = sheetRows.map((r) => ({ id: str(r.id), jobDate: r.job_date == null ? null : str(r.job_date), createdYmd: r.created_at ? calendarYmdInAppTzFromIso(str(r.created_at)) : null, laborRate: num(r.labor_rate) }))
  const ids = sheets.map((x) => x.id)
  if (ids.length === 0) return NO_SHEETS
  const [items, pays] = await Promise.all([
    reader.rows('people_labor_job_items', { select: 'id,job_id,fixture,count,hrs_per_unit,is_fixed,labor_rate,direct_labor_amount,sequence_order', filters: [{ column: 'job_id', op: 'in', value: ids }], order: [{ column: 'sequence_order' }], limit: HS_SESSIONS_CAP }),
    reader.rows('people_labor_job_payments', { select: 'job_id,amount,payment_date,created_at,memo', filters: [{ column: 'job_id', op: 'in', value: ids }], order: [{ column: 'payment_date' }], limit: HS_SESSIONS_CAP }).catch(() => [] as Row[]),
  ])
  const lines: HoursStatementSheetLine[] = items.map((i, idx) => ({ sheetId: str(i.job_id), fixture: str(i.fixture), count: num(i.count) ?? 0, hrsPerUnit: num(i.hrs_per_unit) ?? 0, isFixed: i.is_fixed === true, laborRate: num(i.labor_rate), directLaborAmount: num(i.direct_labor_amount), order: num(i.sequence_order) ?? idx }))
  const payments: HoursStatementSheetPayment[] = pays.map((p) => ({ sheetId: str(p.job_id), amount: num(p.amount) ?? 0, on: p.payment_date ? str(p.payment_date) : p.created_at ? calendarYmdInAppTzFromIso(str(p.created_at)) : null, memo: p.memo == null ? null : str(p.memo) }))
  return { sheets, lines, payments }
}

type CrewSessionRow = { id: string; user_id: string; work_date: string; clocked_in_at: string; clocked_out_at: string | null; origin: string | null; users: { name: string | null } | Array<{ name: string | null }> | null }

/**
 * The charged basis as the window prices it (`hoursStatementChargedRows`): every approved session on the job in the span,
 * whoever punched it, with each person's standing from `charge_standings()`; the rate card from `app_settings`; the job's
 * rule; the Charges window's open adjustments. `approved_at` on or after the epoch stands for not null, the door having
 * no not-null filter; a read of the card, the standings or the adjustments that fails leaves them empty, as the window's does.
 */
async function readChargedRows(reader: Reader, jobId: string, userId: string, rows: HoursStatementRow[], span: { from: string; to: string }): Promise<{ rows: HoursStatementRow[]; charge: HoursStatementChargeFacts; capped: boolean }> {
  const [crewRead, standingRows, cardRows, jobRows, adjRows] = await Promise.all([
    readAllRows(reader, 'clock_sessions', {
      select: 'id,user_id,work_date,clocked_in_at,clocked_out_at,origin,users!clock_sessions_user_id_fkey(name)',
      filters: [eq('job_ledger_id', jobId), { column: 'work_date', op: 'gte', value: span.from }, { column: 'work_date', op: 'lte', value: span.to }, { column: 'approved_at', op: 'gte', value: '1970-01-01T00:00:00Z' }],
    }),
    reader.rpc('charge_standings', {}, HS_SESSIONS_CAP).catch(() => [] as unknown),
    reader.rows('app_settings', { select: 'key,value_num', filters: [{ column: 'key', op: 'in', value: [...RATE_CARD_SETTING_KEYS] }], limit: 20 }).catch(() => [] as Row[]),
    reader.rows('jobs_ledger', { select: 'id,charge_rule,charge_shape,hourly_charge_rate', filters: [eq('id', jobId)], limit: 1 }),
    reader.rows('job_charge_adjustments', { select: 'id,job_id,kind,target,shape,amount,reason,created_at,reverted_at,made_by_user:users!job_charge_adjustments_made_by_fkey(name)', filters: [eq('job_id', jobId), { column: 'reverted_at', op: 'is', value: null }], order: [{ column: 'created_at' }], limit: HS_SESSIONS_CAP }).catch(() => [] as Row[]),
  ])
  const standings = standingsById((Array.isArray(standingRows) ? standingRows : []) as ChargeStandingRow[])
  const crew: CrewSessionInput[] = (crewRead.rows as unknown as CrewSessionRow[])
    .filter((r) => r.clocked_out_at)
    .map((r) => ({
      userId: str(r.user_id),
      name: embeddedName(r.users).split(' ')[0] || 'someone',
      standing: standings.get(str(r.user_id)) ?? 'none',
      workDate: str(r.work_date),
      hours: Math.max(0, (new Date(r.clocked_out_at as string).getTime() - new Date(r.clocked_in_at).getTime()) / 3.6e6),
      imported: r.origin === 'imported',
    }))
  const card = rateCardFromSettings(cardRows as Array<{ key: string; value_num: unknown }>)
  const rule = jobChargeRuleFrom((jobRows[0] ?? {}) as { charge_rule?: unknown; charge_shape?: unknown; hourly_charge_rate?: unknown }, parseCrewShape)
  const adjustments = adjRows.map(chargeAdjustmentFromRow).filter((a): a is ChargeAdjustment => a != null)
  const priced = hoursStatementChargedRows({ rows, userId, crew, card, rule, adjustments, span })
  return { rows: priced.rows, charge: priced.charge, capped: crewRead.capped }
}

type SessionRow = { id: string; work_date: string; clocked_in_at: string; clocked_out_at: string | null; notes: string | null; approved_at: string | null; quick_add_minutes: number | null; approved_by_user: { name: string | null } | Array<{ name: string | null }> | null }

function embeddedName(v: unknown): string {
  const one = Array.isArray(v) ? v[0] : v
  return str(obj(one)?.name).trim()
}

/**
 * Everything the kernel needs for one worker on one job, read as the dev through the catalog-checked door: the clock
 * (and on the charged basis the crew it was part of), or a sub's sheets on the job. Refused in words when a sub's sheet
 * paper is asked for on the charged basis.
 */
export async function readHoursStatement(reader: Reader, parties: HoursStatementParties, ask: Pick<HoursStatementAsk, 'from' | 'to' | 'withPay' | 'addStatedBlock'> & Partial<Pick<HoursStatementAsk, 'basis' | 'kind'>>, statedDays: HoursStatementStatedDay[] = []): Promise<HoursStatementDevRead | { refused: string }> {
  const { job, user } = parties
  const basis: HoursStatementBasis = ask.basis === 'charged' ? 'charged' : 'paid'
  const live: RowFilter[] = [{ column: 'rejected_at', op: 'is', value: null }, { column: 'revoked_at', op: 'is', value: null }]
  const [peopleRows, settingRows, firstRows] = await Promise.all([
    reader.rows('people', { select: 'id,name,kind', filters: [eq('account_user_id', user.id)], limit: 20 }),
    reader.rows('app_settings', { select: 'key,value_text', filters: [eq('key', OFFICE_JOB_SETTING_KEY)], limit: 1 }),
    reader.rows('clock_sessions', { select: 'work_date', filters: live, order: [{ column: 'work_date' }], limit: 1 }),
  ])
  const person = peopleRows[0] ?? null
  const officeJobId = str(settingRows[0]?.value_text).trim() || null
  const isOfficeJob = officeJobId != null && officeJobId === job.id
  const workerName = user.name || str(person?.name).trim() || 'Unnamed'
  const payName = str(person?.name).trim() || user.name
  const firstClockDay = str(firstRows[0]?.work_date) || null

  // Where the rows come from, as the window's Who list decides it: a sub on the job's sheets reads the sheets unless the
  // clock is asked for by name; anyone else reads the clock. A sub with no sheet on this job reads the clock too.
  const isSub = peopleRows.some((p) => str(p.kind) === 'sub')
  const sheetReads = ask.kind === 'sheet' || (ask.kind == null && isSub) ? await readSheets(reader, job.id, peopleRows.map((p) => str(p.id))) : null
  if (ask.kind === 'sheet' || (ask.kind == null && sheetReads != null && sheetReads.sheets.length > 0)) {
    if (basis === 'charged') return { refused: `${user.name} is on this job’s sheets: ${HS_SHEET_NOT_CHARGED}` }
    const reads = sheetReads ?? NO_SHEETS
    const span = { from: ask.from, to: ask.to }
    // A sheet may predate the first punch (2026-03-11 on the live data): the first recorded day is the earlier of the two.
    const firstSheetRows = await reader.rows('people_labor_jobs', { select: 'job_date', filters: [{ column: 'job_date', op: 'gte', value: '2000-01-01' }], order: [{ column: 'job_date' }], limit: 1 }).catch(() => [] as Row[])
    const firstSheetDay = str(firstSheetRows[0]?.job_date) || null
    const firstRecordedDay = [firstClockDay, firstSheetDay].filter((d): d is string => Boolean(d)).sort()[0] ?? null
    const sheetCounts = hoursStatementSheetCounts(reads.sheets, reads.lines, span)
    const input: HoursStatementInput = {
      kind: 'sheet',
      periodStart: ask.from,
      periodEnd: ask.to,
      rows: hoursStatementSheetRows(reads.sheets, reads.lines, span),
      withPay: ask.withPay,
      basis: 'paid',
      payGroups: ask.withPay ? hoursStatementSheetPayGroups(reads.sheets, reads.lines, reads.payments, span) : [],
      firstRecordedDay,
      statedDays,
      addStatedBlock: ask.addStatedBlock,
      isOfficeJob,
      worker: { name: workerName },
    }
    return {
      input,
      worker: { name: workerName, standing: hoursStatementStanding(user.role || 'subcontractor', false) },
      approvedBy: null,
      isOfficeJob,
      personId: person ? str(person.id) : null,
      payName: workerName,
      counts: { approved: sheetCounts.lines, pending: 0, typedDays: 0, quickAddsLeftOff: 0, sheets: sheetCounts.sheets },
      firstRecordedDay,
      capped: false,
      source: 'sheet',
      charge: null,
    }
  }

  const span: RowFilter[] = [{ column: 'work_date', op: 'gte', value: ask.from }, { column: 'work_date', op: 'lte', value: ask.to }]
  const [sessions, typedRows] = await Promise.all([
    reader.rows('clock_sessions', {
      select: 'id,work_date,clocked_in_at,clocked_out_at,notes,approved_at,quick_add_minutes,approved_by_user:users!clock_sessions_approved_by_fkey(name)',
      filters: [eq('user_id', user.id), eq('job_ledger_id', job.id), ...span, ...live],
      order: [{ column: 'clocked_in_at' }],
      limit: HS_SESSIONS_CAP,
    }),
    reader.rows('clock_typed_entries', { select: 'work_date', filters: [eq('user_id', user.id), ...span], limit: HS_SESSIONS_CAP }).catch(() => [] as Row[]),
  ])

  const rows: HoursStatementRow[] = []
  const approvers = new Map<string, number>()
  const counts: HoursStatementReadCounts = { approved: 0, pending: 0, typedDays: 0, quickAddsLeftOff: 0 }
  for (const raw of sessions as unknown as SessionRow[]) {
    if (!raw.clocked_out_at) continue
    const hours = hoursStatementRoundHours((new Date(raw.clocked_out_at).getTime() - new Date(raw.clocked_in_at).getTime()) / 3_600_000)
    if (hours <= 0) continue
    const pending = raw.approved_at == null
    if (pending && raw.quick_add_minutes != null) {
      counts.quickAddsLeftOff += 1
      continue
    }
    if (pending) counts.pending += 1
    else counts.approved += 1
    rows.push({ day: raw.work_date, hours, note: str(raw.notes).trim(), inLabel: hoursStatementClockLabel(raw.clocked_in_at), outLabel: hoursStatementClockLabel(raw.clocked_out_at), pending })
    const who = embeddedName(raw.approved_by_user)
    if (raw.approved_at && who) approvers.set(who, (approvers.get(who) ?? 0) + 1)
  }
  const countedDays = new Set(rows.filter((r) => !r.pending).map((r) => r.day))
  counts.typedDays = new Set((typedRows as Row[]).map((t) => str(t.work_date)).filter((d) => countedDays.has(d))).size
  const approvedBy = Array.from(approvers.entries()).sort((a, b) => b[1] - a[1]).map(([n]) => n).slice(0, 2).join(', ') || null

  // The charged paper carries no pay, so its reads are skipped as the window skips them.
  const withPay = basis === 'charged' ? false : ask.withPay
  let salaried = false
  let fallbackRate: number | null = null
  const dayRates: Record<string, number> = {}
  const payGroups: HoursStatementPayGroup[] = []
  if (withPay) {
    const configRows = payName ? await reader.rows('people_pay_config', { select: 'hourly_wage,office_hourly_wage,is_salary', filters: [eq('person_name', payName)], limit: 1 }).catch(() => [] as Row[]) : []
    const config = configRows[0] ?? null
    salaried = config?.is_salary === true
    const wage = isOfficeJob ? (num(config?.office_hourly_wage) ?? num(config?.hourly_wage)) : num(config?.hourly_wage)
    fallbackRate = wage != null && wage > 0 ? wage : null
    const stubFilter: RowFilter = person ? eq('person_id', str(person.id)) : eq('person_name', payName)
    const stubs = await reader.rows('pay_stubs', { select: 'id,period_start,period_end,gross_pay', filters: [stubFilter, { column: 'period_start', op: 'lte', value: ask.to }, { column: 'period_end', op: 'gte', value: ask.from }], order: [{ column: 'period_start' }], limit: 100 }).catch(() => [] as Row[])
    const ids = stubs.map((s) => str(s.id))
    if (ids.length > 0) {
      const inIds: RowFilter = { column: 'pay_stub_id', op: 'in', value: ids }
      const [days, deductions, additional, payments] = await Promise.all([
        reader.rows('pay_stub_days', { select: 'pay_stub_id,work_date,rate_at_time,job_rate,office_rate', filters: [inIds], limit: HS_SESSIONS_CAP }).catch(() => [] as Row[]),
        reader.rows('pay_stub_deductions', { select: 'pay_stub_id,amount', filters: [inIds], limit: HS_SESSIONS_CAP }).catch(() => [] as Row[]),
        reader.rows('pay_stub_additional_lines', { select: 'pay_stub_id,line_total', filters: [inIds], limit: HS_SESSIONS_CAP }).catch(() => [] as Row[]),
        reader.rows('pay_stub_payments', { select: 'pay_stub_id,paid_at,amount,memo,source_kind,source_id', filters: [inIds], order: [{ column: 'paid_at' }], limit: HS_SESSIONS_CAP }).catch(() => [] as Row[]),
      ])
      for (const d of days) {
        const rate = isOfficeJob ? (num(d.office_rate) ?? num(d.rate_at_time)) : (num(d.job_rate) ?? num(d.rate_at_time))
        if (rate != null && rate > 0) dayRates[str(d.work_date)] = rate
      }
      const sum = (list: Row[], id: string, key: string) => list.filter((x) => str(x.pay_stub_id) === id).reduce((s, x) => s + (num(x[key]) ?? 0), 0)
      for (const st of stubs) {
        const id = str(st.id)
        payGroups.push({
          key: id,
          label: hoursStatementWeekLabel(str(st.period_start)),
          from: str(st.period_start),
          to: str(st.period_end),
          due: hoursStatementNetPay(num(st.gross_pay) ?? 0, sum(deductions, id, 'amount'), sum(additional, id, 'line_total')),
          payments: payments.filter((p) => str(p.pay_stub_id) === id).map((p) => ({ on: str(p.paid_at).slice(0, 10), amount: num(p.amount) ?? 0, memo: p.memo == null ? null : str(p.memo), sourceKind: p.source_kind == null ? null : str(p.source_kind), sourceId: p.source_id == null ? null : str(p.source_id) })),
        })
      }
    }
  }

  // The charged basis: the person's counted days as the crew-days they were part of, priced by the kernel the window reads with.
  let charge: HoursStatementChargeFacts | null = null
  let chargedRows: HoursStatementRow[] | null = null
  let crewCapped = false
  if (basis === 'charged') {
    const priced = await readChargedRows(reader, job.id, user.id, rows, { from: ask.from, to: ask.to })
    chargedRows = priced.rows
    charge = priced.charge
    crewCapped = priced.capped
  }

  const firstRecordedDay = firstClockDay
  const input: HoursStatementInput = {
    kind: salaried ? 'schedule' : 'clock',
    periodStart: ask.from,
    periodEnd: ask.to,
    rows: chargedRows ?? rows,
    withPay,
    basis,
    chargeWords: charge?.words ?? null,
    dayRates,
    fallbackRate,
    payGroups,
    firstRecordedDay,
    statedDays,
    addStatedBlock: ask.addStatedBlock,
    isOfficeJob,
    worker: { name: workerName },
  }
  return { input, worker: { name: workerName, standing: hoursStatementStanding(user.role, salaried) }, approvedBy, isOfficeJob, personId: person ? str(person.id) : null, payName, counts, firstRecordedDay, capped: sessions.length >= HS_SESSIONS_CAP || crewCapped, source: 'clock', charge }
}

/**
 * The one line that opens the reply: *118.5 h on 23 days, 4 weeks paid in full; nothing in the app before 2026-03-12*. On
 * the charged basis: *118.5 h on 23 days, charged 118.5 h at $285.00 an hour = $33,772.50 · 2 days not priced*. For a
 * sub: *12 h on 4 lines over 2 sheets, 2 sheets paid in full*.
 */
export function hoursStatementReading(s: HoursStatement, counts: HoursStatementReadCounts, firstRecordedDay: string | null, capped: boolean): string {
  const sheet = counts.sheets != null
  const parts: string[] = [sheet ? `${s.totals.hours} h on ${counts.approved} ${counts.approved === 1 ? 'line' : 'lines'} over ${counts.sheets} ${counts.sheets === 1 ? 'sheet' : 'sheets'}` : `${s.totals.hours} h on ${s.totals.daysWords}`]
  if (s.basis === 'charged' && s.charged) {
    const unpriced = s.charged.lines.reduce((n, l) => n + (l.amount == null && l.hours > 0 ? 1 : 0), 0)
    parts.push(s.charged.total != null ? `charged ${s.charged.totalWords}` : 'charged, but no rate is given, so the paper carries hours alone')
    if (s.charged.total != null && unpriced > 0) parts.push(`${unpriced} ${unpriced === 1 ? 'group' : 'groups'} not priced`)
  } else if (s.pay) {
    const noun = sheet ? ['sheet', 'sheets'] : ['week', 'weeks']
    const paid = s.pay.lines.filter((l) => l.state === 'paid').length
    const open = s.pay.lines.length - paid
    parts.push(s.pay.lines.length === 0 ? (sheet ? 'no sheet in the span' : 'no pay report touches the span') : open === 0 ? `${paid} ${paid === 1 ? noun[0] : noun[1]} paid in full` : `${paid} of ${s.pay.lines.length} ${noun[1]} paid in full`)
  } else parts.push('hours only, the pay left off')
  if (counts.quickAddsLeftOff) parts.push(`${counts.quickAddsLeftOff} quick add${counts.quickAddsLeftOff === 1 ? '' : 's'} left off until approved`)
  let line = parts.join(', ')
  if (s.gap) line += `; nothing in the app before ${firstRecordedDay ?? 'its first day'}, so ${hoursStatementLongDate(s.gap.from)} – ${hoursStatementLongDate(s.gap.to)} is the worker's own statement`
  if (capped) line += `; the span holds more than ${HS_SESSIONS_CAP} sessions and the paper is short by the rest — narrow the span`
  if (s.basis === 'charged' && s.charged?.leftOut.length) line += `; left out: ${s.charged.leftOut.join('; ')}`
  return line
}

/** The statements already made for the job and the person, newest first, as the Hours statements list reads them. */
export async function listStatementsMade(reader: Reader, parties: Pick<HoursStatementParties, 'job' | 'user'>): Promise<Array<Record<string, unknown>>> {
  const rows = await reader.rows('hours_statements', {
    select: 'id,record_id,state,period_start,period_end,with_pay,basis,kind,stated_days,contract_document_id,matter_document_id,prepared_at',
    filters: [eq('job_ledger_id', parties.job.id), eq('user_id', parties.user.id)],
    order: [{ column: 'prepared_at', ascending: false }],
    limit: 50,
  }).catch(() => [] as Row[])
  return rows.map((r) => {
    const state = isHoursStatementState(r.state) ? r.state : 'draft'
    return {
      id: r.id,
      record_id: r.record_id,
      state,
      state_words: hoursStatementStateWords(state).words,
      period_start: r.period_start,
      period_end: r.period_end,
      with_pay: r.with_pay,
      basis: r.basis ?? 'paid',
      kind: r.kind,
      stated_days: Array.isArray(r.stated_days) ? r.stated_days.length : 0,
      signed_copy: r.contract_document_id ?? null,
      on_matter: r.matter_document_id ?? null,
      prepared_at: r.prepared_at,
    }
  })
}

/** The window's read as a saved row keeps it (`HoursStatementSnapshot`); `asOf` is stamped by the server at apply. */
export type HoursStatementDevSnapshot = {
  input: HoursStatementInput
  worker: { name: string; standing: string }
  job: { number: string; name: string; customer: string | null; site: string; isOfficeJob: boolean }
  approvedBy: string | null
  preparedBy: string
  preparedOn: string
  asOf: string
}

export function hoursStatementSnapshot(read: HoursStatementDevRead, parties: HoursStatementParties, preparedBy: string, todayYmd: string, asOf = ''): HoursStatementDevSnapshot {
  return {
    input: read.input,
    worker: read.worker,
    job: { number: parties.job.number, name: parties.job.name, customer: parties.job.customer, site: parties.job.site, isOfficeJob: read.isOfficeJob },
    approvedBy: read.approvedBy,
    preparedBy: preparedBy.trim() || 'the dev seat',
    preparedOn: hoursStatementLongDate(todayYmd),
    asOf,
  }
}

// ---------------------------------------------------------------------------
// get_hours_statement
// ---------------------------------------------------------------------------

export async function getHoursStatement(reader: Reader, args: Record<string, unknown>): Promise<Record<string, unknown> | { refused: string }> {
  const ask = parseHoursStatementAsk(args)
  if ('error' in ask) return { refused: ask.error }
  const parties = await resolveHoursStatementParties(reader, ask)
  if ('refused' in parties) return parties
  const [read, made] = await Promise.all([readHoursStatement(reader, parties, ask), listStatementsMade(reader, parties)])
  if ('refused' in read) return read
  const statement = buildHoursStatement(read.input)
  return {
    reading: hoursStatementReading(statement, read.counts, read.firstRecordedDay, read.capped),
    job: parties.job,
    worker: { ...parties.user, standing: read.worker.standing, roster_id: read.personId, pay_name: read.payName },
    period: { from: ask.from, to: ask.to, label: statement.periodLabel },
    basis: statement.basis,
    kind: statement.kind,
    rows_from: read.source,
    with_pay: statement.withPay,
    is_office_job: read.isOfficeJob,
    approved_by: read.approvedBy,
    counts: read.counts,
    first_recorded_day: read.firstRecordedDay,
    /** On the charged basis: the headline rate, the words under the signature, the days the card could not price, who counts as nobody. */
    charge: read.charge,
    statement,
    statements_made: made,
    source: 'buildHoursStatement over the window’s own reads (hoursStatementRead.ts: the clock and the pay reports, the crew-days on the charged basis, a sub’s sheets), so a number here is the number on the paper',
  }
}

// ---------------------------------------------------------------------------
// plan_hours_statement / apply_hours_statement: the shaping the server runs before writeRpcBody
// ---------------------------------------------------------------------------

export type HoursStatementSend = { how: 'email' | 'link' }

export type HoursStatementPrepared = {
  /** The verb's input with `statement` replaced by the row facts the RPC takes (`p`). */
  args: Record<string, unknown>
  /** The send leg after a `make` applies, or null. */
  send: HoursStatementSend | null
  /** The signed PDF to store under the matter before a `file_on_matter` applies, or null. */
  file: { name: string; bytes: Uint8Array; mime: string } | null
  /** The snapshot without its as-of, stamped at apply. */
  snapshot: HoursStatementDevSnapshot | null
}

export type HoursStatementPrepareIo = {
  reader: Reader
  /** The signed PDF's bytes through `open-contract-form-pdf` as the dev. */
  signedPdf: (contractDocumentId: string) => Promise<{ bytes: Uint8Array; mime: string } | { error: string }>
  sha256: (bytes: Uint8Array) => Promise<string>
}

export const HOURS_STATEMENT_SHAPE = "plan_hours_statement needs statement — { action: make | file_on_matter (make when left out); make: job (a jobs_ledger.id, or what find_job resolves), person (a users.id, or what find_person resolves), from, to (YYYY-MM-DD, not ahead of today), with_pay? (true when left out), basis? (paid when left out; charged prices every counted hour at the rate the customer is charged, as the crew it was part of, and carries no pay), kind? (clock | sheet; left out, a sub on the job's sheets reads the sheets, always as paid), add_stated_block?, stated_days? ([{ day, hours?, note?, source? }], the days the office states from outside records, each marked as stated by you), send? ({ how: email | link }: once the row lands, the form is drawn and the link emailed to the worker, or handed back to you); file_on_matter: statement_id (an hours_statements.id, signed), matter_id (a legal_matters.id), title?, shows? }. Plan first; apply re-reads the clock and refuses when it moved."

/**
 * The agent's `statement` into the RPC's `p`: for `make`, the job and the worker resolved and the clock read into a
 * snapshot (the plan hash commits to it, so a changed clock refuses the apply); for `file_on_matter`, the signed PDF
 * read through the gate into the file facts the document wrapper checks (the bytes stored only at apply).
 */
export async function prepareHoursStatementWrite(io: HoursStatementPrepareIo, args: Record<string, unknown>, who: { userId: string; name: string | null }, todayYmd: string): Promise<HoursStatementPrepared | { error: string }> {
  const st = obj(args.statement)
  if (!st) return { error: HOURS_STATEMENT_SHAPE }
  const action = str(st.action).trim() || 'make'
  if (action === 'mark_sent') return { error: 'mark_sent is the server’s own step after it sends the link; plan a make with send instead.' }
  if (action !== 'make' && action !== 'file_on_matter') return { error: HOURS_STATEMENT_SHAPE }
  const rest = { ...args }
  delete rest.statement

  if (action === 'make') {
    const ask = parseHoursStatementAsk({ job: st.job, person: st.person, from: st.from, to: st.to, with_pay: st.with_pay, add_stated_block: st.add_stated_block, basis: st.basis, kind: st.kind })
    if ('error' in ask) return { error: ask.error.replace('get_hours_statement', 'plan_hours_statement') }
    if (ask.to > todayYmd) return { error: 'plan_hours_statement: to cannot be ahead of today.' }
    let send: HoursStatementSend | null = null
    if (st.send != null) {
      const how = str(obj(st.send)?.how).trim()
      if (how !== 'email' && how !== 'link') return { error: 'plan_hours_statement: send.how must be email (the signing email to the worker) or link (the signing link handed back to you).' }
      send = { how }
    }
    const statedBy = statedByWords(who.name ?? '', todayYmd)
    const statedDays: HoursStatementStatedDay[] = []
    if (st.stated_days != null) {
      if (!Array.isArray(st.stated_days)) return { error: 'plan_hours_statement: stated_days must be a list of { day, hours?, note?, source? }.' }
      const yearHint = Number(ask.from.slice(0, 4)) || undefined
      for (const [i, raw] of st.stated_days.entries()) {
        const parsed = parseStatedDayRows([raw], statedBy, { yearHint })
        if ('error' in parsed) return { error: `plan_hours_statement: ${parsed.error.replace('row 1', `row ${i + 1}`)}` }
        const source = str(obj(raw)?.source).trim()
        for (const d of parsed) statedDays.push(source ? { ...d, statedBy: `${statedBy} · ${source.slice(0, 80)}` } : d)
      }
      statedDays.sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0))
    }
    const parties = await resolveHoursStatementParties(io.reader, ask)
    if ('refused' in parties) return { error: parties.refused }
    const read = await readHoursStatement(io.reader, parties, ask, statedDays)
    if ('refused' in read) return { error: `plan_hours_statement: ${read.refused}` }
    const snapshot = hoursStatementSnapshot(read, parties, who.name ?? '', todayYmd)
    const gap = hoursStatementGap(ask.from, ask.to, read.firstRecordedDay)
    const p: Record<string, unknown> = {
      action: 'make',
      job_ledger_id: parties.job.id,
      user_id: parties.user.id,
      person_id: read.personId,
      period_start: ask.from,
      period_end: ask.to,
      with_pay: read.input.withPay,
      // The basis and what it was priced by (punch list #251's columns), as the window saves them; null off the charged basis.
      basis: read.input.basis ?? 'paid',
      charge_rate: read.charge?.rate ?? null,
      charge_words: read.charge?.words ?? null,
      kind: read.input.kind,
      stated_days: statedDays,
      gap_from: gap?.from ?? null,
      gap_to: gap?.to ?? null,
      snapshot,
      ...(send ? { send } : {}),
    }
    return { args: { ...rest, statement: p }, send, file: null, snapshot }
  }

  const statementId = str(st.statement_id).trim()
  const matterId = str(st.matter_id).trim()
  if (!UUID_RE.test(statementId) || !UUID_RE.test(matterId)) return { error: HOURS_STATEMENT_SHAPE }
  const rows = await io.reader.rows('hours_statements', {
    select: 'id,record_id,state,job_ledger_id,user_id,period_start,period_end,with_pay,kind,stated_days,snapshot,contract_document_id,matter_document_id,updated_at',
    filters: [eq('id', statementId)],
    limit: 1,
  })
  const row = rows[0]
  if (!row) return { error: `No statement ${statementId} — it does not exist, or RLS hides it from you.` }
  if (str(row.state) !== 'signed') return { error: `${str(row.record_id)} is ${str(row.state)}: only a signed statement goes on the matter.` }
  const contractDocumentId = str(row.contract_document_id)
  if (!contractDocumentId) return { error: `${str(row.record_id)} has no signed copy to file.` }
  if (row.matter_document_id) return { error: `${str(row.record_id)} is on a matter already (document ${str(row.matter_document_id)}).` }
  const pdf = await io.signedPdf(contractDocumentId)
  if ('error' in pdf) return { error: pdf.error }
  const snap = obj(row.snapshot)
  const input = obj(snap?.input)
  let hours = 0
  let periodLabel = `${str(row.period_start)} – ${str(row.period_end)}`
  try {
    if (input) {
      const s = buildHoursStatement(input as unknown as HoursStatementInput)
      hours = s.totals.hours
      periodLabel = s.periodLabel
    }
  } catch {
    hours = 0
  }
  const workerName = str(obj(snap?.worker)?.name).trim() || 'Worker'
  const jobFacts = obj(snap?.job)
  const facts = { recordId: str(row.record_id), workerName, hours, periodLabel, withPay: row.with_pay === true, statedDays: Array.isArray(row.stated_days) ? row.stated_days.length : 0 }
  const fileName = hoursStatementEvidenceFileName(str(row.record_id))
  const p: Record<string, unknown> = {
    action: 'file_on_matter',
    statement_id: statementId,
    matter_id: matterId,
    title: str(st.title).trim() || hoursStatementEvidenceTitle(facts),
    shows: str(st.shows).trim() || hoursStatementEvidenceShows(facts, { label: str(jobFacts?.number).trim() || '—', site: str(jobFacts?.site).trim() || null }),
    original_name: fileName,
    mime: pdf.mime,
    size_bytes: pdf.bytes.length,
    sha256: await io.sha256(pdf.bytes),
    dated_on: str(row.updated_at).slice(0, 10) || null,
  }
  return { args: { ...rest, statement: p }, send: null, file: { name: fileName, bytes: pdf.bytes, mime: pdf.mime }, snapshot: null }
}

// ---------------------------------------------------------------------------
// The send leg after a make applies
// ---------------------------------------------------------------------------

export type HoursStatementInvoke = (fn: string, body: Record<string, unknown>) => Promise<{ ok: boolean; status: number; body: unknown }>

export type HoursStatementSigningReply = { how: 'email' | 'link'; document_id: string | null; emailed: boolean; accept_url: string | null; worker_email: string | null; marked_sent: boolean; problem: string | null }

/**
 * The signing link as the window sends it, as the dev: the form drawn (`hours-statement-signing` prepare), the link
 * minted (`send-contract-for-signature`: emailed, or `mode: 'link'` handed back), then the row marked sent through the
 * wrapper. A leg that fails leaves the row a draft and says why; the row stands either way.
 */
export async function sendHoursStatementAsDev(invoke: HoursStatementInvoke, markSent: (statementId: string) => Promise<boolean>, args: { statementId: string; how: 'email' | 'link'; publicOrigin: string | null }): Promise<HoursStatementSigningReply> {
  const reply: HoursStatementSigningReply = { how: args.how, document_id: null, emailed: false, accept_url: null, worker_email: null, marked_sent: false, problem: null }
  const prep = await invoke('hours-statement-signing', { action: 'prepare', statement_id: args.statementId, how: args.how })
  const prepBody = obj(prep.body)
  if (!prep.ok || !prepBody || typeof prepBody.document_id !== 'string') {
    reply.problem = `The form could not be drawn: ${str(prepBody?.error) || `hours-statement-signing answered ${prep.status}`}`
    return reply
  }
  reply.document_id = prepBody.document_id
  reply.worker_email = str(obj(prepBody.worker)?.email).trim() || null
  if (args.how === 'email' && !reply.worker_email) {
    reply.problem = 'The worker has no email on the roster or the login; plan again with send.how link, or add the address first.'
    return reply
  }
  const sendBody: Record<string, unknown> = { person_contract_document_id: prepBody.document_id, ...(args.publicOrigin ? { public_origin: args.publicOrigin } : {}) }
  if (args.how === 'email') sendBody.signer_email = reply.worker_email
  else sendBody.mode = 'link'
  const sent = await invoke('send-contract-for-signature', sendBody)
  const sentBody = obj(sent.body)
  if (!sent.ok || !sentBody || typeof sentBody.accept_url !== 'string') {
    reply.problem = `The link could not be minted: ${str(sentBody?.error) || `send-contract-for-signature answered ${sent.status}`}`
    return reply
  }
  reply.emailed = sentBody.emailed === true
  reply.accept_url = args.how === 'link' || !reply.emailed ? sentBody.accept_url : null
  if (args.how === 'email' && !reply.emailed) reply.problem = `The email did not go${sentBody.email_error ? `: ${str(sentBody.email_error)}` : ''}; the link is here to hand on.`
  reply.marked_sent = await markSent(args.statementId)
  return reply
}
