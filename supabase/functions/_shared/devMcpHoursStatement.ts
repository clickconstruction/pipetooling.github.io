/**
 * The signed hours statement through the dev MCP (punch list #212, PR 5, v2.6414): `get_hours_statement` as a
 * composite — the same reads the Hours statement window makes (`src/lib/people/hoursStatementRead.ts`), handed to the
 * same kernel (`hoursStatement.ts`), so the answer is the paper's rows, weeks, pay lines, gap and totals with a one-line
 * `reading` first and the statements already made for that job and person — and the shaping behind
 * `plan_hours_statement` → `apply_hours_statement`: `make` (the row the window saves, from a snapshot read here, through
 * `dev_hours_statement_write`), its `send` leg (the form drawn and the link minted through the signing functions as
 * the dev, then the row marked sent), and `file_on_matter` (a signed copy onto a matter's Evidence tab).
 *
 * Nothing here reads the network: it takes the door's `Reader` (dev-mcp passes one that GETs as the dev; the tests
 * pass the catalog-checked fake) and an `invoke` for the function calls. The reads are RLS-bound, so a dev reads what
 * the window would show them.
 */
import { findJob, findPerson, jobNumberOf, type Reader, type Row } from './devMcpComposites.ts'
import type { RowFilter } from './devMcpDoor.ts'
import { APP_CALENDAR_TZ } from './appTimeZone.ts'
import {
  buildHoursStatement,
  hoursStatementGap,
  hoursStatementLongDate,
  hoursStatementRoundHours,
  hoursStatementStanding,
  hoursStatementWeekLabel,
  type HoursStatement,
  type HoursStatementInput,
  type HoursStatementPayGroup,
  type HoursStatementRow,
  type HoursStatementStatedDay,
} from './hoursStatement.ts'
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

export type HoursStatementAsk = { job: string; person: string; from: string; to: string; withPay: boolean; addStatedBlock: boolean }

/** `get_hours_statement`'s arguments checked: the job and the person (an id or a name), the span as days, the switches. */
export function parseHoursStatementAsk(args: Record<string, unknown>): HoursStatementAsk | { error: string } {
  const job = str(args.job).trim()
  const person = str(args.person).trim()
  const from = str(args.from).trim()
  const to = str(args.to).trim()
  if (!job || !person) return { error: 'get_hours_statement needs job (a jobs_ledger.id, or a job number or name find_job resolves) and person (a users.id, or a name find_person resolves).' }
  if (!YMD_RE.test(from) || !YMD_RE.test(to)) return { error: 'get_hours_statement needs from and to as days, YYYY-MM-DD — the period the paper covers.' }
  if (to < from) return { error: 'get_hours_statement: to comes before from — the period runs forward.' }
  return { job, person, from, to, withPay: args.with_pay !== false, addStatedBlock: args.add_stated_block === true }
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

export type HoursStatementReadCounts = { approved: number; pending: number; typedDays: number; quickAddsLeftOff: number }

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
}

type SessionRow = { id: string; work_date: string; clocked_in_at: string; clocked_out_at: string | null; notes: string | null; approved_at: string | null; quick_add_minutes: number | null; approved_by_user: { name: string | null } | Array<{ name: string | null }> | null }

function embeddedName(v: unknown): string {
  const one = Array.isArray(v) ? v[0] : v
  return str(obj(one)?.name).trim()
}

/** Everything the kernel needs for one worker on one job, read as the dev through the catalog-checked door. */
export async function readHoursStatement(reader: Reader, parties: HoursStatementParties, ask: Pick<HoursStatementAsk, 'from' | 'to' | 'withPay' | 'addStatedBlock'>, statedDays: HoursStatementStatedDay[] = []): Promise<HoursStatementDevRead> {
  const { job, user } = parties
  const span: RowFilter[] = [{ column: 'work_date', op: 'gte', value: ask.from }, { column: 'work_date', op: 'lte', value: ask.to }]
  const live: RowFilter[] = [{ column: 'rejected_at', op: 'is', value: null }, { column: 'revoked_at', op: 'is', value: null }]
  const [sessions, peopleRows, settingRows, firstRows, typedRows] = await Promise.all([
    reader.rows('clock_sessions', {
      select: 'id,work_date,clocked_in_at,clocked_out_at,notes,approved_at,quick_add_minutes,approved_by_user:users!clock_sessions_approved_by_fkey(name)',
      filters: [eq('user_id', user.id), eq('job_ledger_id', job.id), ...span, ...live],
      order: [{ column: 'clocked_in_at' }],
      limit: HS_SESSIONS_CAP,
    }),
    reader.rows('people', { select: 'id,name', filters: [eq('account_user_id', user.id)], limit: 1 }),
    reader.rows('app_settings', { select: 'key,value_text', filters: [eq('key', OFFICE_JOB_SETTING_KEY)], limit: 1 }),
    reader.rows('clock_sessions', { select: 'work_date', filters: live, order: [{ column: 'work_date' }], limit: 1 }),
    reader.rows('clock_typed_entries', { select: 'work_date', filters: [eq('user_id', user.id), ...span], limit: HS_SESSIONS_CAP }).catch(() => [] as Row[]),
  ])
  const person = peopleRows[0] ?? null
  const officeJobId = str(settingRows[0]?.value_text).trim() || null
  const isOfficeJob = officeJobId != null && officeJobId === job.id
  const workerName = user.name || str(person?.name).trim() || 'Unnamed'
  const payName = str(person?.name).trim() || user.name

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

  let salaried = false
  let fallbackRate: number | null = null
  const dayRates: Record<string, number> = {}
  const payGroups: HoursStatementPayGroup[] = []
  if (ask.withPay) {
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

  const firstRecordedDay = str(firstRows[0]?.work_date) || null
  const input: HoursStatementInput = {
    kind: salaried ? 'schedule' : 'clock',
    periodStart: ask.from,
    periodEnd: ask.to,
    rows,
    withPay: ask.withPay,
    dayRates,
    fallbackRate,
    payGroups,
    firstRecordedDay,
    statedDays,
    addStatedBlock: ask.addStatedBlock,
    isOfficeJob,
    worker: { name: workerName },
  }
  return { input, worker: { name: workerName, standing: hoursStatementStanding(user.role, salaried) }, approvedBy, isOfficeJob, personId: person ? str(person.id) : null, payName, counts, firstRecordedDay, capped: sessions.length >= HS_SESSIONS_CAP }
}

/** The one line that opens the reply: *118.5 h on 23 days, 4 weeks paid in full; nothing in the app before 2026-03-12*. */
export function hoursStatementReading(s: HoursStatement, counts: HoursStatementReadCounts, firstRecordedDay: string | null, capped: boolean): string {
  const parts: string[] = [`${s.totals.hours} h on ${s.totals.daysWords}`]
  if (s.pay) {
    const paid = s.pay.lines.filter((l) => l.state === 'paid').length
    const open = s.pay.lines.length - paid
    parts.push(s.pay.lines.length === 0 ? 'no pay report touches the span' : open === 0 ? `${paid} ${paid === 1 ? 'week' : 'weeks'} paid in full` : `${paid} of ${s.pay.lines.length} weeks paid in full`)
  } else parts.push('hours only, the pay left off')
  if (counts.quickAddsLeftOff) parts.push(`${counts.quickAddsLeftOff} quick add${counts.quickAddsLeftOff === 1 ? '' : 's'} left off until approved`)
  let line = parts.join(', ')
  if (s.gap) line += `; nothing in the app before ${firstRecordedDay ?? 'its first day'}, so ${hoursStatementLongDate(s.gap.from)} – ${hoursStatementLongDate(s.gap.to)} is the worker's own statement`
  if (capped) line += `; the span holds more than ${HS_SESSIONS_CAP} sessions and the paper is short by the rest — narrow the span`
  return line
}

/** The statements already made for the job and the person, newest first, as the Hours statements list reads them. */
export async function listStatementsMade(reader: Reader, parties: Pick<HoursStatementParties, 'job' | 'user'>): Promise<Array<Record<string, unknown>>> {
  const rows = await reader.rows('hours_statements', {
    select: 'id,record_id,state,period_start,period_end,with_pay,kind,stated_days,contract_document_id,matter_document_id,prepared_at',
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
  const statement = buildHoursStatement(read.input)
  return {
    reading: hoursStatementReading(statement, read.counts, read.firstRecordedDay, read.capped),
    job: parties.job,
    worker: { ...parties.user, standing: read.worker.standing, roster_id: read.personId, pay_name: read.payName },
    period: { from: ask.from, to: ask.to, label: statement.periodLabel },
    with_pay: ask.withPay,
    is_office_job: read.isOfficeJob,
    approved_by: read.approvedBy,
    counts: read.counts,
    first_recorded_day: read.firstRecordedDay,
    statement,
    statements_made: made,
    source: 'buildHoursStatement over the window’s own reads (hoursStatementRead.ts), so a number here is the number on the paper',
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

export const HOURS_STATEMENT_SHAPE = "plan_hours_statement needs statement — { action: make | file_on_matter (make when left out); make: job (a jobs_ledger.id, or what find_job resolves), person (a users.id, or what find_person resolves), from, to (YYYY-MM-DD, not ahead of today), with_pay? (true when left out), add_stated_block?, stated_days? ([{ day, hours?, note?, source? }], the days the office states from outside records, each marked as stated by you), send? ({ how: email | link }: once the row lands, the form is drawn and the link emailed to the worker, or handed back to you); file_on_matter: statement_id (an hours_statements.id, signed), matter_id (a legal_matters.id), title?, shows? }. Plan first; apply re-reads the clock and refuses when it moved."

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
    const ask = parseHoursStatementAsk({ job: st.job, person: st.person, from: st.from, to: st.to, with_pay: st.with_pay, add_stated_block: st.add_stated_block })
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
    const snapshot = hoursStatementSnapshot(read, parties, who.name ?? '', todayYmd)
    const gap = hoursStatementGap(ask.from, ask.to, read.firstRecordedDay)
    const p: Record<string, unknown> = {
      action: 'make',
      job_ledger_id: parties.job.id,
      user_id: parties.user.id,
      person_id: read.personId,
      period_start: ask.from,
      period_end: ask.to,
      with_pay: ask.withPay,
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
