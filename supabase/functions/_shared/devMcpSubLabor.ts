// Sub labor on a job from the dev seat (punch list #293's step-by-step; the owner, 2026-11-11: "Do we have the dev
// verbs to add sub labor?" then "Can you help me add those verbs?"). The seat could read a job's sub labor (get_job
// counts the sheets, get_hours_statement reads a sub's sheets) and could not write a sheet or what was paid on one.
//
// plan_sub_labor → apply_sub_labor, three actions, each the rows the screen writes, as the dev under RLS:
//   add    — Jobs → Subs → Pay → New Sub Labor (JobsSubLaborFormModal.saveLaborJob): the people_labor_jobs row, the
//            assignee row as the form's backup to the name trigger, then the lines (people_labor_job_items).
//   change — the Edit window's save: the sheet's day, or its lines replaced whole (every line deleted, the new ones
//            inserted, the sheet's rate following the first line), as saveEditedLaborJob does.
//   remove — the Edit window's Delete: the sheet row deleted, its lines with it. Held here while the sheet carries a
//            payment, which the screen would delete without a trace.
// plan_sub_labor_payment → apply_sub_labor_payment, two actions:
//   record — Make Payment (useSubLaborLedger.recordLaborJobPayment): one people_labor_job_payments row.
//   remove — the payment's Remove with a reason (remove_labor_job_payment), which keeps a trace and a 30-day Undo.
//
// A sheet has no column for a note, for a span of days or for where its days came from, and a payment has none for a
// method, a reference or a bank row. So a day and the stated mark ride in the line's own words, the note and the span
// on the job's activity, and the method and reference in the payment's memo. The bank row is read, never written: the
// plan says whether it is already allocated to a job as cost, where the same dollars would then count twice.
//
// No wrapper RPC and no migration: the dry run is this server's read of the job, the person, the job's sheets with
// their lines and payments, and the bank row, hashed with the payload. Pure: no env reads, no network; the test runs a
// recording fake (src/lib/devMcp/devMcpSubLabor.test.ts).

import { laborItemsSubtotal } from './peopleLaborJobItemLineCost.ts'
import { laborJobSubCost } from './subLaborCost.ts'
import { DEFAULT_DRIVE_MILEAGE_COST, DEFAULT_DRIVE_TIME_PER_MILE, DRIVE_SETTING_KEYS } from './jobSubLaborInputs.ts'

export const SUB_LABOR_VERBS = ['plan_sub_labor', 'apply_sub_labor'] as const
export type SubLaborVerb = (typeof SUB_LABOR_VERBS)[number]
export function isSubLaborVerb(name: string): name is SubLaborVerb {
  return (SUB_LABOR_VERBS as readonly string[]).includes(name)
}
export const SUB_LABOR_PAYMENT_VERBS = ['plan_sub_labor_payment', 'apply_sub_labor_payment'] as const
export type SubLaborPaymentVerb = (typeof SUB_LABOR_PAYMENT_VERBS)[number]
export function isSubLaborPaymentVerb(name: string): name is SubLaborPaymentVerb {
  return (SUB_LABOR_PAYMENT_VERBS as readonly string[]).includes(name)
}

/** The RPC behind a sheet payment's Remove (migration 20260917140000): the row goes, its snapshot is kept for 30 days. */
export const SHEET_PAYMENT_REMOVE_RPC = 'remove_labor_job_payment'
/** Between the names on a sheet (src/lib/combinePeople.ts). */
export const LABOR_ASSIGNED_DELIMITER = ' | '
/** The office's default rate (Settings), which a flat sheet carries as the form's rows do. */
export const DEFAULT_LABOR_RATE_KEY = 'default_labor_rate'
/** The form's rate when Settings holds none. */
export const FORM_DEFAULT_LABOR_RATE = 20
export const SUB_LABOR_SETTING_KEYS = [...DRIVE_SETTING_KEYS, DEFAULT_LABOR_RATE_KEY] as const

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const YMD_RE = /^\d{4}-\d{2}-\d{2}$/
const LINES_MAX = 40
const WHAT_MAX = 160
const NOTE_MAX = 500
const SOURCE_MAX = 120
const SPAN_MAX_DAYS = 62
const IDS_PER_READ = 80
const MEMO_MAX = 300

export type Json = Record<string, unknown>
const obj = (v: unknown): Json | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : null)
const cents = (v: unknown): number => Math.round((Number(v) || 0) * 100)
const has = (v: string | null | undefined): boolean => (v ?? '').trim().length > 0
const validYmd = (s: string): boolean => YMD_RE.test(s) && !Number.isNaN(Date.parse(`${s}T12:00:00Z`))
const dayMs = (s: string): number => Date.parse(`${s}T12:00:00Z`)
/** $1,234.50 — the words a plan reads back. */
export const laborDollars = (c: number): string => `${c < 0 ? '-' : ''}$${(Math.abs(c) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

// ── the payloads ─────────────────────────────────────────────────────────────────────────────────────────────────

/** A flat amount (the form's simple line) or hours at a rate (its itemized line). `day` is the day the line is about. */
export type LaborLine = { what: string; day?: string; amount: number } | { what: string; day?: string; hours: number; rate: number; count?: number }
/** The days come from a record outside the app and not from a punch; `source` names the record. */
export type LaborStated = { source: string }

export type SubLaborAdd = { action: 'add'; job_id: string; person: string; date: string; through?: string; lines: LaborLine[]; note?: string; stated?: LaborStated; second_sheet_ok?: true }
export type SubLaborChange = { action: 'change'; sheet_id: string; date?: string; lines?: LaborLine[]; stated?: LaborStated; reason?: string }
export type SubLaborRemove = { action: 'remove'; sheet_id: string; reason: string }
export type SubLaborPayload = SubLaborAdd | SubLaborChange | SubLaborRemove

export type SubLaborInput = { ok: true; p: SubLaborPayload; target: string; planHash: string | null } | { ok: false; error: string }

const LINE_SHAPE = '{ what (the work in words), day? (YYYY-MM-DD, the day the line is about), amount (a flat dollar amount) } or { what, day?, hours, rate (dollars an hour), count? (units, when hours is per unit) }'
const LABOR_SHAPE =
  `needs labor — { action?: 'add', job_id (a jobs_ledger.id — find_job), person (a people.id, a users.id or the name of one sub — find_person), date (YYYY-MM-DD, the day the work happened or its first day, never ahead of today), through? (the last day, when the work ran several days), lines: [${LINE_SHAPE}] (1 to ${LINES_MAX}, all flat or all hours at a rate), note? (under ${NOTE_MAX}, kept on the job's activity), stated?: { source } (the days come from a record outside the app and not a punch: name the record), second_sheet_ok? (true when they already hold a sheet on the job for those days and this is other work) } ` +
  `| { action: 'change', sheet_id (a people_labor_jobs.id — plan_sub_labor lists a job's sheets), date?, lines? (replaces every line, as the Edit window's save does), stated?, reason? } ` +
  `| { action: 'remove', sheet_id, reason (why it comes off, kept on the job's activity) }`

function readPlanHash(verb: string, planVerb: string, input: Json): { ok: true; planHash: string | null } | { ok: false; error: string } {
  if (!verb.startsWith('apply_')) return { ok: true, planHash: null }
  const h = typeof input.plan_hash === 'string' ? input.plan_hash.trim().toLowerCase() : ''
  if (!/^[0-9a-f]{64}$/.test(h)) return { ok: false, error: `${verb} needs plan_hash — the 64-hex value ${planVerb} replied with.` }
  return { ok: true, planHash: h }
}

function readAmount(raw: unknown): number {
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' && /^\$?[\d,]+(\.\d{1,2})?$/.test(raw.trim()) ? Number(raw.trim().replace(/[$,]/g, '')) : NaN
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN
}

/** The lines as asked, shaped: every line named, all flat or all hours at a rate (the form holds one mode a sheet). */
export function laborLinesInput(raw: unknown, verb: string, todayYmd: string): { ok: true; lines: LaborLine[] } | { ok: false; error: string } {
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > LINES_MAX) return { ok: false, error: `${verb}: lines is a list of 1 to ${LINES_MAX}, each ${LINE_SHAPE}.` }
  const lines: LaborLine[] = []
  for (let i = 0; i < raw.length; i++) {
    const src = obj(raw[i])
    const at = `${verb}: line ${i + 1}`
    if (!src) return { ok: false, error: `${at} is ${LINE_SHAPE}.` }
    const what = typeof src.what === 'string' ? src.what.trim().replace(/\s+/g, ' ') : ''
    if (!what) return { ok: false, error: `${at} needs what — the work in words, as the sheet's line reads.` }
    if (what.length > WHAT_MAX) return { ok: false, error: `${at}: what is under ${WHAT_MAX} characters.` }
    const day = typeof src.day === 'string' ? src.day.trim() : ''
    if (day && !validYmd(day)) return { ok: false, error: `${at}: day is YYYY-MM-DD, the day the line is about.` }
    if (day && day > todayYmd) return { ok: false, error: `${at}: day ${day} is ahead of today (${todayYmd}). A sheet records work that happened.` }
    const flat = src.amount !== undefined && src.amount !== null
    const timed = src.hours !== undefined && src.hours !== null
    if (flat === timed) return { ok: false, error: `${at} carries amount (a flat dollar amount) or hours with rate, one of the two.` }
    if (flat) {
      const amount = readAmount(src.amount)
      if (!(amount > 0) || amount > 9_999_999) return { ok: false, error: `${at}: amount is dollars, more than 0. The form takes no line at $0, and a backcharge is a payment line in the app, not a sheet line.` }
      lines.push({ what, ...(day ? { day } : {}), amount })
    } else {
      const hours = Number(src.hours)
      const rate = readAmount(src.rate)
      if (!(hours > 0) || hours > 9_999) return { ok: false, error: `${at}: hours is a number more than 0.` }
      if (!(rate > 0) || rate > 99_999) return { ok: false, error: `${at}: rate is dollars an hour, more than 0. A line at a flat price takes amount in place of hours and rate.` }
      const count = src.count === undefined || src.count === null ? null : Number(src.count)
      if (count !== null && (!(count > 0) || count > 9_999)) return { ok: false, error: `${at}: count is the number of units, more than 0; hours is then the hours a unit.` }
      lines.push({ what, ...(day ? { day } : {}), hours: Math.round(hours * 100) / 100, rate, ...(count !== null && count !== 1 ? { count: Math.round(count * 100) / 100 } : {}) })
    }
  }
  const flatLines = lines.filter((l) => 'amount' in l).length
  if (flatLines !== 0 && flatLines !== lines.length) return { ok: false, error: `${verb}: a sheet is all flat amounts or all hours at a rate, as the form's switch holds it. The Edit window opens a mixed sheet as hours and would blank the flat amounts on its next save. Make two sheets, or price every line one way.` }
  return { ok: true, lines }
}

function statedInput(raw: unknown, verb: string): { ok: true; stated?: LaborStated } | { ok: false; error: string } {
  if (raw === undefined || raw === null || raw === false) return { ok: true }
  const src = obj(raw)
  const source = src && typeof src.source === 'string' ? src.source.trim().replace(/\s+/g, ' ') : ''
  if (!source) return { ok: false, error: `${verb}: stated is { source } — the record the days come from, in words (their own day log, a text thread, an invoice). Leave stated out when the days are the office's own.` }
  if (source.length > SOURCE_MAX) return { ok: false, error: `${verb}: stated.source is under ${SOURCE_MAX} characters. The whole account goes in note.` }
  return { ok: true, stated: { source } }
}

/** plan_sub_labor / apply_sub_labor's input, shaped. `todayYmd` is the app's day: a sheet is never dated ahead of it. */
export function subLaborInput(verb: SubLaborVerb, input: Json, todayYmd: string): SubLaborInput {
  const src = obj(input.labor)
  const shape = `${verb} ${LABOR_SHAPE}`
  if (!src) return { ok: false, error: shape }
  const str = (k: string) => (typeof src[k] === 'string' ? (src[k] as string).trim() : '')
  const action = (str('action') || 'add').toLowerCase()
  if (action !== 'add' && action !== 'change' && action !== 'remove') return { ok: false, error: shape }
  const hash = readPlanHash(verb, 'plan_sub_labor', input)
  if (!hash.ok) return hash
  const dayOf = (k: string, what: string): { ok: true; day: string } | { ok: false; error: string } => {
    const d = str(k)
    if (!validYmd(d)) return { ok: false, error: `${verb}: ${k} is YYYY-MM-DD, ${what}.` }
    if (d > todayYmd) return { ok: false, error: `${verb}: ${k} ${d} is ahead of today (${todayYmd}). A sheet records work that happened.` }
    return { ok: true, day: d }
  }
  const reason = str('reason')
  if (reason.length > NOTE_MAX) return { ok: false, error: `${verb}: reason is under ${NOTE_MAX} characters.` }

  if (action === 'add') {
    const jobId = str('job_id').toLowerCase()
    if (!UUID_RE.test(jobId)) return { ok: false, error: shape }
    const person = str('person').replace(/\s+/g, ' ')
    if (!person || person.length > 120) return { ok: false, error: `${verb}: person is a people.id, a users.id or the name of one sub (find_person lists them).` }
    if (/[*%]/.test(person)) return { ok: false, error: `${verb}: person is a whole name or an id, with no wildcard.` }
    const date = dayOf('date', 'the day the work happened, or its first day')
    if (!date.ok) return date
    let through: string | undefined
    if (str('through')) {
      const t = dayOf('through', 'the last day of the work')
      if (!t.ok) return t
      if (t.day < date.day) return { ok: false, error: `${verb}: through ${t.day} is before date ${date.day}.` }
      if ((dayMs(t.day) - dayMs(date.day)) / 86_400_000 > SPAN_MAX_DAYS) return { ok: false, error: `${verb}: a sheet covers at most ${SPAN_MAX_DAYS} days. Make a sheet a month.` }
      if (t.day !== date.day) through = t.day
    }
    const built = laborLinesInput(src.lines, verb, todayYmd)
    if (!built.ok) return built
    const last = through ?? date.day
    const outside = built.lines.find((l) => l.day && (l.day < date.day || l.day > last))
    if (outside) return { ok: false, error: `${verb}: the line "${outside.what}" is dated ${outside.day}, outside the sheet's ${through ? `days ${date.day} to ${through}` : `day ${date.day}`}. Widen date and through, or put that day on its own sheet.` }
    const note = str('note')
    if (note.length > NOTE_MAX) return { ok: false, error: `${verb}: note is under ${NOTE_MAX} characters.` }
    const stated = statedInput(src.stated, verb)
    if (!stated.ok) return stated
    const p: SubLaborAdd = { action: 'add', job_id: jobId, person: UUID_RE.test(person) ? person.toLowerCase() : person, date: date.day, ...(through ? { through } : {}), lines: built.lines, ...(note ? { note } : {}), ...(stated.stated ? { stated: stated.stated } : {}), ...(src.second_sheet_ok === true ? { second_sheet_ok: true as const } : {}) }
    return { ok: true, p, target: jobId, planHash: hash.planHash }
  }

  const sheetId = str('sheet_id').toLowerCase()
  if (!UUID_RE.test(sheetId)) return { ok: false, error: shape }
  if (action === 'remove') {
    if (!reason) return { ok: false, error: `${verb}: a remove needs reason — why the sheet comes off, in words the office will read on the job's activity.` }
    return { ok: true, p: { action: 'remove', sheet_id: sheetId, reason }, target: sheetId, planHash: hash.planHash }
  }
  let date: string | undefined
  if (str('date')) {
    const d = dayOf('date', 'the day the work happened')
    if (!d.ok) return d
    date = d.day
  }
  let lines: LaborLine[] | undefined
  if (src.lines !== undefined && src.lines !== null) {
    const built = laborLinesInput(src.lines, verb, todayYmd)
    if (!built.ok) return built
    lines = built.lines
  }
  const stated = statedInput(src.stated, verb)
  if (!stated.ok) return stated
  if (stated.stated && !lines) return { ok: false, error: `${verb}: the stated mark rides in the lines' own words, so a change that names stated sends the lines again.` }
  if (!date && !lines) return { ok: false, error: `${verb}: a change names date, lines or both. Nothing to do.` }
  const p: SubLaborChange = { action: 'change', sheet_id: sheetId, ...(date ? { date } : {}), ...(lines ? { lines } : {}), ...(stated.stated ? { stated: stated.stated } : {}), ...(reason ? { reason } : {}) }
  return { ok: true, p, target: sheetId, planHash: hash.planHash }
}

export type SheetPaymentRecord = { action: 'record'; sheet_id: string; amount: number; paid_on: string; method?: string; reference?: string; note?: string; mercury_transaction_id?: string; hidden_from_sub?: true; duplicate_ok?: true }
export type SheetPaymentRemove = { action: 'remove'; payment_id: string; reason: string }
export type SubLaborPaymentPayload = SheetPaymentRecord | SheetPaymentRemove
export type SubLaborPaymentInput = { ok: true; p: SubLaborPaymentPayload; target: string; planHash: string | null } | { ok: false; error: string }

const PAYMENT_SHAPE =
  `needs payment — { action?: 'record', sheet_id (a people_labor_jobs.id — plan_sub_labor lists a job's sheets), amount (dollars paid, more than 0), paid_on (YYYY-MM-DD, the day it was sent, never ahead of today), method? (ACH, Check, Zelle, Cash, …), reference? (a check number, a confirmation), note?, mercury_transaction_id? (the bank row that paid it: read and checked, never written), hidden_from_sub? (true hides the memo on their portal; the amount always shows), duplicate_ok? (true when the sheet really was paid the same amount twice on one day) } ` +
  `| { action: 'remove', payment_id (a people_labor_job_payments.id), reason }`

/** plan_sub_labor_payment / apply_sub_labor_payment's input, shaped. */
export function subLaborPaymentInput(verb: SubLaborPaymentVerb, input: Json, todayYmd: string): SubLaborPaymentInput {
  const src = obj(input.payment)
  const shape = `${verb} ${PAYMENT_SHAPE}`
  if (!src) return { ok: false, error: shape }
  const str = (k: string) => (typeof src[k] === 'string' ? (src[k] as string).trim().replace(/\s+/g, ' ') : '')
  const action = (str('action') || 'record').toLowerCase()
  if (action !== 'record' && action !== 'remove') return { ok: false, error: action === 'backcharge' ? `${verb}: a backcharge is the payment window's own press in the app, with its memo to the sub. The seat has no verb for it.` : shape }
  const hash = readPlanHash(verb, 'plan_sub_labor_payment', input)
  if (!hash.ok) return hash
  if (action === 'remove') {
    const paymentId = str('payment_id').toLowerCase()
    if (!UUID_RE.test(paymentId)) return { ok: false, error: shape }
    const reason = str('reason')
    if (!reason) return { ok: false, error: `${verb}: a remove needs reason — why the payment comes off. It is kept on the payment's trace, where both the office and the sub's portal read it.` }
    if (reason.length > NOTE_MAX) return { ok: false, error: `${verb}: reason is under ${NOTE_MAX} characters.` }
    return { ok: true, p: { action: 'remove', payment_id: paymentId, reason }, target: paymentId, planHash: hash.planHash }
  }
  const sheetId = str('sheet_id').toLowerCase()
  if (!UUID_RE.test(sheetId)) return { ok: false, error: shape }
  const amount = readAmount(src.amount)
  if (!(amount > 0) || amount > 99_999_999) return { ok: false, error: `${verb}: amount is dollars paid, more than 0. A payment comes off with action remove, and a backcharge is the app's own press.` }
  const paidOn = str('paid_on')
  if (!validYmd(paidOn)) return { ok: false, error: `${verb}: paid_on is YYYY-MM-DD, the day the money was sent.` }
  if (paidOn > todayYmd) return { ok: false, error: `${verb}: paid_on ${paidOn} is ahead of today (${todayYmd}). A payment is recorded once it has been sent.` }
  const words: { method?: string; reference?: string; note?: string } = {}
  for (const [k, max] of [['method', 40], ['reference', 80], ['note', 160]] as const) {
    const v = str(k)
    if (v.length > max) return { ok: false, error: `${verb}: ${k} is under ${max} characters.` }
    if (v) words[k] = v
  }
  const bank = str('mercury_transaction_id').toLowerCase()
  if (bank && !UUID_RE.test(bank)) return { ok: false, error: `${verb}: mercury_transaction_id is a mercury_transactions.id (read_rows on mercury_transactions finds the row by amount and day).` }
  const p: SheetPaymentRecord = { action: 'record', sheet_id: sheetId, amount, paid_on: paidOn, ...words, ...(bank ? { mercury_transaction_id: bank } : {}), ...(src.hidden_from_sub === true ? { hidden_from_sub: true as const } : {}), ...(src.duplicate_ok === true ? { duplicate_ok: true as const } : {}) }
  return { ok: true, p, target: sheetId, planHash: hash.planHash }
}

// ── the rows ─────────────────────────────────────────────────────────────────────────────────────────────────────

export type LaborJobRow = { id: string; job_name: string | null; job_address: string | null; click_number: string | null; hcp_number: string | null; status: string | null; revenue: number | string | null; customer_name: string | null }
export type LaborPersonRow = { id: string; name: string | null; kind: string | null; email: string | null; end_date: string | null; archived_at: string | null; account_user_id: string | null }
export type LaborUserRow = { id: string; name: string | null; email: string | null; role: string | null; archived_at: string | null; is_sample: boolean | null; is_digital_twin: boolean | null }
export type SheetRow = { id: string; master_user_id: string | null; assigned_to_name: string | null; address: string | null; job_number: string | null; job_ledger_id: string | null; labor_rate: number | string | null; distance_miles: number | string | null; job_date: string | null; created_at: string | null; stage: string | null; step_id: string | null }
export type SheetItemRow = { id: string; job_id: string; fixture: string | null; count: number | string | null; hrs_per_unit: number | string | null; is_fixed: boolean | null; labor_rate: number | string | null; direct_labor_amount: number | string | null; sequence_order: number | null }
export type SheetPayRow = { id: string; job_id: string; amount: number | string; memo: string | null; payment_date: string | null; hidden_from_sub: boolean | null; sequence_order: number | null; created_at: string | null }
export type SheetAssigneeRow = { labor_job_id: string; person_id: string }
export type LaborSettingRow = { key: string; value_num: number | null }
/** A bank row's split onto a job, with the row itself embedded (the Job window's own read). */
export type BankLineRow = { id: string; amount: number | string; note: string | null; job_id: string; mercury_transaction_id: string; mercury_transactions: { posted_at: string | null; counterparty_name: string | null; amount: number | string | null } | null }
export type BankRow = { id: string; amount: number | string; posted_at: string | null; status: string | null; kind: string | null; counterparty_name: string | null }

export const LABOR_JOB_COLS = 'id,job_name,job_address,click_number,hcp_number,status,revenue,customer_name'
export const LABOR_PERSON_COLS = 'id,name,kind,email,end_date,archived_at,account_user_id'
export const LABOR_USER_COLS = 'id,name,email,role,archived_at,is_sample,is_digital_twin'
export const SHEET_COLS = 'id,master_user_id,assigned_to_name,address,job_number,job_ledger_id,labor_rate,distance_miles,job_date,created_at,stage,step_id'
export const SHEET_ITEM_COLS = 'id,job_id,fixture,count,hrs_per_unit,is_fixed,labor_rate,direct_labor_amount,sequence_order'
export const SHEET_PAY_COLS = 'id,job_id,amount,memo,payment_date,hidden_from_sub,sequence_order,created_at'
export const BANK_LINE_SELECT = 'id,amount,note,job_id,mercury_transaction_id,mercury_transactions(posted_at,counterparty_name,amount)'
export const LABOR_BANK_COLS = 'id,amount,posted_at,status,kind,counterparty_name'

/** The job's profit band as get_job works it out (buildJobProfitSummary over the Job window's reads). */
export type JobMoney = { profit: { laborCost: number; partsCost: number; totalBill: number; profit: number } } | { error: string }

export type SubLaborReads = {
  rows(table: string, query: string): Promise<Json[]>
  /** get_job's money for one job; left out, the plan says the profit band was not read. */
  money?(jobId: string): Promise<JobMoney>
}

async function rowsIn<T>(reads: SubLaborReads, table: string, select: string, column: string, ids: readonly string[], order = ''): Promise<T[]> {
  const out: T[] = []
  for (let i = 0; i < ids.length; i += IDS_PER_READ) out.push(...((await reads.rows(table, `select=${select}&${column}=in.(${ids.slice(i, i + IDS_PER_READ).join(',')})${order ? `&order=${order}` : ''}&limit=1000`)) as unknown as T[]))
  return out
}

const uniqueById = <T extends { id: string }>(rows: T[]): T[] => [...new Map(rows.map((r) => [r.id, r])).values()]

// ── who ──────────────────────────────────────────────────────────────────────────────────────────────────────────

export type PersonRead = { asked: string; people: LaborPersonRow[]; users: LaborUserRow[] }

/** The roster rows and accounts an ask could mean: by id either way, or by the whole name in any case, each with its other half. */
export async function readLaborPerson(reads: SubLaborReads, asked: string): Promise<PersonRead> {
  let people: LaborPersonRow[]
  let users: LaborUserRow[]
  if (UUID_RE.test(asked)) {
    const [byId, byAccount, accounts] = await Promise.all([
      reads.rows('people', `select=${LABOR_PERSON_COLS}&id=eq.${asked}`),
      reads.rows('people', `select=${LABOR_PERSON_COLS}&account_user_id=eq.${asked}`),
      reads.rows('users', `select=${LABOR_USER_COLS}&id=eq.${asked}`),
    ])
    people = [...byId, ...byAccount] as unknown as LaborPersonRow[]
    users = accounts as unknown as LaborUserRow[]
  } else {
    const name = encodeURIComponent(asked)
    const [byName, accounts] = await Promise.all([reads.rows('people', `select=${LABOR_PERSON_COLS}&name=ilike.${name}&limit=50`), reads.rows('users', `select=${LABOR_USER_COLS}&name=ilike.${name}&limit=50`)])
    people = byName as unknown as LaborPersonRow[]
    users = accounts as unknown as LaborUserRow[]
  }
  const have = new Set(users.map((u) => u.id))
  const otherAccounts = [...new Set(people.map((p) => p.account_user_id).filter((id): id is string => !!id && !have.has(id)))]
  if (otherAccounts.length) users = [...users, ...(await rowsIn<LaborUserRow>(reads, 'users', LABOR_USER_COLS, 'id', otherAccounts))]
  if (users.length) people = [...people, ...(await rowsIn<LaborPersonRow>(reads, 'people', LABOR_PERSON_COLS, 'account_user_id', users.map((u) => u.id)))]
  return { asked, people: uniqueById(people), users: uniqueById(users) }
}

export type LaborPerson = {
  /** The name the sheet is written under: the account's, else the roster row's (the form's picker names them so). */
  name: string
  /** The roster row the assignee row names; null for an account with no roster row. */
  people_id: string | null
  user_id: string | null
  kind: string | null
  role: string | null
  sample: boolean
  /** Every roster row of theirs, for finding their sheets. */
  people_ids: string[]
  /** Every name they go by, for finding their sheets by the name on a sheet. */
  names: string[]
}

type Candidate = { user: LaborUserRow | null; roster: LaborPersonRow[] }

/**
 * The one person an ask means, as a sub the form would offer: a roster row of kind sub whose account, if any, is a
 * subcontractor's (`isRosterSub`), or a subcontractor's account with no roster row. Refused in words for nobody,
 * several, a teammate who is not a sub (their sheet is Crew pay, paid through payroll), an archived person, a sub on
 * the bench and a twin.
 */
export function laborPersonFacts(read: PersonRead): { ok: true; person: LaborPerson } | { ok: false; refused: string } {
  const candidates: Candidate[] = read.users.map((user) => ({ user, roster: read.people.filter((p) => p.account_user_id === user.id) }))
  const accountIds = new Set(read.users.map((u) => u.id))
  for (const p of read.people) if (!p.account_user_id || !accountIds.has(p.account_user_id)) candidates.push({ user: null, roster: [p] })
  const nameOf = (c: Candidate): string => (c.user?.name ?? '').trim() || (c.roster[0]?.name ?? '').trim() || 'a person with no name'
  if (candidates.length === 0) return { ok: false, refused: `No person "${read.asked}" is visible to you — find_person lists the team by name, and a sub with no login is on People → Subs. Pass a people.id, a users.id or the whole name.` }
  if (candidates.length > 1) {
    const list = candidates.slice(0, 8).map((c) => `${nameOf(c)} (${c.user ? `users.id ${c.user.id}` : `people.id ${c.roster[0]!.id}`}${c.roster.some((r) => r.kind === 'sub') ? ', a sub' : ''})`)
    return { ok: false, refused: `"${read.asked}" matches ${candidates.length} people — pass the id of one: ${list.join('; ')}.` }
  }
  const c = candidates[0]!
  const name = nameOf(c)
  const subRow = c.roster.find((r) => r.kind === 'sub' && !r.archived_at) ?? c.roster.find((r) => r.kind === 'sub') ?? null
  const role = (c.user?.role ?? '').trim() || null
  if (c.user?.is_digital_twin) return { ok: false, refused: `${name} is a digital twin, not a person the company pays.` }
  const isSub = subRow ? !role || role === 'subcontractor' : role === 'subcontractor'
  if (!isSub) {
    const what = subRow ? `a roster sub whose account is ${role}` : `${role ? `a ${role.replace(/_/g, ' ')}` : `on the roster as ${c.roster.map((r) => r.kind).filter(Boolean).join(', ') || 'no kind'}`}`
    return { ok: false, refused: `${name} is not a subcontractor (${what}). A sheet for a teammate is a Crew pay sheet, paid through payroll from their hours; the seat writes sub sheets only. Their hours are plan_clock_sessions; a new sub is plan_account with kind sub.` }
  }
  if (c.user?.archived_at || subRow?.archived_at) return { ok: false, refused: `${name} is archived. People → Archived → Bring back restores them; a sheet is not written for someone who has left.` }
  if (subRow && has(subRow.end_date)) return { ok: false, refused: `${name} is on the bench since ${String(subRow.end_date).slice(0, 10)}, and the form offers no benched sub for a new sheet. People → Subs takes them off the bench first.` }
  const names = [...new Set([c.user?.name, ...c.roster.map((r) => r.name)].map((n) => (n ?? '').trim()).filter(Boolean))]
  return { ok: true, person: { name, people_id: subRow?.id ?? c.roster[0]?.id ?? null, user_id: c.user?.id ?? null, kind: subRow?.kind ?? null, role, sample: c.user?.is_sample === true, people_ids: c.roster.map((r) => r.id), names } }
}

// ── the world ────────────────────────────────────────────────────────────────────────────────────────────────────

export type SubLaborWorld = {
  /** The dev, who a new sheet belongs to (`master_user_id`) and who the note is by. */
  devUserId: string
  /** The sheet a change or a remove names; null for an add, or when RLS shows none. */
  sheet: SheetRow | null
  job: LaborJobRow | null
  /** An add's person as read; null otherwise. */
  person: PersonRead | null
  /** Every sheet on the job (a sheet with no job: itself alone), with its lines, payments and assignee rows. */
  sheets: SheetRow[]
  items: SheetItemRow[]
  payments: SheetPayRow[]
  assignees: SheetAssigneeRow[]
  settings: LaborSettingRow[]
  /** The job's allocated bank rows, as the Job window reads its card lines. */
  bankLines: BankLineRow[]
  money: JobMoney | null
}

async function readJobSide(reads: SubLaborReads, jobId: string | null, lone: SheetRow | null): Promise<Pick<SubLaborWorld, 'job' | 'sheets' | 'items' | 'payments' | 'assignees' | 'settings' | 'bankLines' | 'money'>> {
  const settingsRead = reads.rows('app_settings', `select=key,value_num&key=in.(${SUB_LABOR_SETTING_KEYS.join(',')})&limit=10`)
  const [jobs, sheetRows, settings, bankLines, money] = await Promise.all([
    jobId ? reads.rows('jobs_ledger', `select=${LABOR_JOB_COLS}&id=eq.${jobId}`) : Promise.resolve([]),
    jobId ? reads.rows('people_labor_jobs', `select=${SHEET_COLS}&job_ledger_id=eq.${jobId}&order=created_at.asc,id.asc&limit=1000`) : Promise.resolve([]),
    settingsRead,
    jobId ? reads.rows('mercury_transaction_job_allocations', `select=${BANK_LINE_SELECT}&job_id=eq.${jobId}&limit=1000`) : Promise.resolve([]),
    jobId && reads.money ? reads.money(jobId).catch((e): JobMoney => ({ error: e instanceof Error ? e.message : String(e) })) : Promise.resolve(null),
  ])
  const sheets = uniqueById([...(sheetRows as unknown as SheetRow[]), ...(lone ? [lone] : [])])
  const ids = sheets.map((s) => s.id)
  const [items, payments, assignees] = ids.length
    ? await Promise.all([
        rowsIn<SheetItemRow>(reads, 'people_labor_job_items', SHEET_ITEM_COLS, 'job_id', ids, 'sequence_order.asc'),
        rowsIn<SheetPayRow>(reads, 'people_labor_job_payments', SHEET_PAY_COLS, 'job_id', ids, 'sequence_order.asc'),
        rowsIn<SheetAssigneeRow>(reads, 'people_labor_job_assignees', 'labor_job_id,person_id', 'labor_job_id', ids),
      ])
    : [[], [], []]
  return { job: (jobs[0] as unknown as LaborJobRow | undefined) ?? null, sheets, items, payments, assignees, settings: settings as unknown as LaborSettingRow[], bankLines: bankLines as unknown as BankLineRow[], money }
}

export async function readSubLaborWorld(reads: SubLaborReads, p: SubLaborPayload, devUserId: string): Promise<SubLaborWorld> {
  if (p.action === 'add') {
    const [person, side] = await Promise.all([readLaborPerson(reads, p.person), readJobSide(reads, p.job_id, null)])
    return { devUserId, sheet: null, person, ...side }
  }
  const sheet = ((await reads.rows('people_labor_jobs', `select=${SHEET_COLS}&id=eq.${p.sheet_id}`))[0] as unknown as SheetRow | undefined) ?? null
  if (!sheet) return { devUserId, sheet: null, job: null, person: null, sheets: [], items: [], payments: [], assignees: [], settings: [], bankLines: [], money: null }
  return { devUserId, sheet, person: null, ...(await readJobSide(reads, sheet.job_ledger_id, sheet)) }
}

// ── the sheet's math, from the screens' own kernels ──────────────────────────────────────────────────────────────

const settingNum = (settings: readonly LaborSettingRow[], key: string): number | null => {
  const v = settings.find((s) => s.key === key)?.value_num
  return v == null || !Number.isFinite(Number(v)) ? null : Number(v)
}

type CostItem = { count: number; hrs_per_unit: number; is_fixed: boolean; labor_rate: number | null; direct_labor_amount: number | null }
const costItem = (i: Pick<SheetItemRow, 'count' | 'hrs_per_unit' | 'is_fixed' | 'labor_rate' | 'direct_labor_amount'>): CostItem => ({
  count: Number(i.count) || 0,
  hrs_per_unit: Number(i.hrs_per_unit) || 0,
  is_fixed: i.is_fixed === true,
  labor_rate: i.labor_rate == null ? null : Number(i.labor_rate),
  direct_labor_amount: i.direct_labor_amount == null ? null : Number(i.direct_labor_amount),
})

/** What a sheet owes its sub, in cents: the lines priced as the Sub Labor screens price them (`laborItemsSubtotal`). */
export function sheetOwedCents(rate: number | string | null, items: readonly Pick<SheetItemRow, 'count' | 'hrs_per_unit' | 'is_fixed' | 'labor_rate' | 'direct_labor_amount'>[]): number {
  return cents(laborItemsSubtotal(items.map(costItem), rate == null ? 0 : Number(rate) || 0))
}

/** What a sheet costs its job, in cents: the lines and the drive, as the Job window's profit band counts it (`laborJobSubCost`). */
export function sheetJobCostCents(sheet: Pick<SheetRow, 'labor_rate' | 'distance_miles'>, items: readonly Pick<SheetItemRow, 'count' | 'hrs_per_unit' | 'is_fixed' | 'labor_rate' | 'direct_labor_amount'>[], settings: readonly LaborSettingRow[]): number {
  return cents(
    laborJobSubCost(
      { labor_rate: sheet.labor_rate == null ? null : Number(sheet.labor_rate), distance_miles: sheet.distance_miles == null ? null : Number(sheet.distance_miles), items: items.map(costItem) },
      settingNum(settings, 'drive_mileage_cost') ?? DEFAULT_DRIVE_MILEAGE_COST,
      settingNum(settings, 'drive_time_per_mile') ?? DEFAULT_DRIVE_TIME_PER_MILE,
    ),
  )
}

/** Paid, backcharged and still owed on a sheet, as the Pay ledger works its balance (`subLaborJobBalance`). */
export function sheetBalance(owedCents: number, payments: readonly Pick<SheetPayRow, 'amount'>[]): { owed: number; paid: number; backcharged: number; open: number } {
  const paid = payments.filter((p) => Number(p.amount) >= 0).reduce((s, p) => s + cents(p.amount), 0)
  const backcharged = payments.filter((p) => Number(p.amount) < 0).reduce((s, p) => s + Math.abs(cents(p.amount)), 0)
  const owed = owedCents === 0 && (paid > 0 || backcharged > 0) ? paid + backcharged : owedCents
  return { owed, paid, backcharged, open: owed - paid - backcharged }
}

/** The day a sheet counts on: its job date, else the day it was made (the first ten characters of the stamp). */
export const sheetDay = (s: Pick<SheetRow, 'job_date' | 'created_at'>): string => (s.job_date ? String(s.job_date).slice(0, 10) : String(s.created_at ?? '').slice(0, 10))

const sheetNames = (s: Pick<SheetRow, 'assigned_to_name'>): string[] => (s.assigned_to_name ?? '').split(LABOR_ASSIGNED_DELIMITER).map((n) => n.trim()).filter(Boolean)

/** One sheet as a plan lists it. */
export function sheetCard(sheet: SheetRow, world: Pick<SubLaborWorld, 'items' | 'payments' | 'settings'>): Json {
  const items = world.items.filter((i) => i.job_id === sheet.id)
  const bal = sheetBalance(sheetOwedCents(sheet.labor_rate, items), world.payments.filter((p) => p.job_id === sheet.id))
  return {
    id: sheet.id,
    who: (sheet.assigned_to_name ?? '').trim() || null,
    day: sheetDay(sheet) || null,
    dated: !!sheet.job_date,
    lines: items.length,
    owed: bal.owed / 100,
    paid: bal.paid / 100,
    ...(bal.backcharged ? { backcharged: bal.backcharged / 100 } : {}),
    open: bal.open / 100,
    job_cost: sheetJobCostCents(sheet, items, world.settings) / 100,
    stage: sheet.stage,
  }
}

/** A person's sheets among a job's: by the assignee row, or by the name the sheet is written under. */
export function sheetsOfPerson(world: Pick<SubLaborWorld, 'sheets' | 'assignees'>, person: Pick<LaborPerson, 'people_ids' | 'names'>): SheetRow[] {
  const mine = new Set(world.assignees.filter((a) => person.people_ids.includes(a.person_id)).map((a) => a.labor_job_id))
  const names = new Set(person.names.map((n) => n.toLowerCase()))
  return world.sheets.filter((s) => mine.has(s.id) || sheetNames(s).some((n) => names.has(n.toLowerCase())))
}

// ── the rows a write makes ───────────────────────────────────────────────────────────────────────────────────────

/** A line's words on the sheet: its day first when it has one, the work, then the stated mark with its source. */
export function laborLineWords(line: LaborLine, stated?: LaborStated): string {
  return `${line.day ? `${line.day} · ` : ''}${line.what}${stated ? ` (stated, ${stated.source})` : ''}`
}

export type SheetItemInsert = { fixture: string; count: number; hrs_per_unit: number; is_fixed: boolean; labor_rate: number | null; direct_labor_amount: number | null; sequence_order: number }

/** The lines as the form writes them: a flat line as its simple mode does, hours at a rate as its itemized mode does. */
export function sheetItemRows(lines: readonly LaborLine[], stated?: LaborStated): SheetItemInsert[] {
  return lines.map((l, i) =>
    'amount' in l
      ? { fixture: laborLineWords(l, stated), count: 1, hrs_per_unit: 0, is_fixed: false, labor_rate: null, direct_labor_amount: l.amount, sequence_order: i + 1 }
      : { fixture: laborLineWords(l, stated), count: l.count ?? 1, hrs_per_unit: l.hours, is_fixed: false, labor_rate: l.rate, direct_labor_amount: null, sequence_order: i + 1 },
  )
}

/** The sheet's own rate, as the form sets it from its first row: that line's rate, or on a flat sheet the office's default. */
export function sheetRateFor(lines: readonly LaborLine[], settings: readonly LaborSettingRow[]): number {
  const first = lines[0]
  if (first && 'rate' in first) return first.rate
  const fromSettings = settingNum(settings, DEFAULT_LABOR_RATE_KEY)
  return fromSettings && fromSettings > 0 ? fromSettings : FORM_DEFAULT_LABOR_RATE
}

/** The number a sheet shows for its job: the HCP number, else the Click number (`subLaborJobNumberForStorage`). */
export const sheetJobNumber = (job: Pick<LaborJobRow, 'hcp_number' | 'click_number'>): string | null => (job.hcp_number ?? '').trim() || (job.click_number ?? '').trim() || null

export const laborJobLabel = (job: Pick<LaborJobRow, 'click_number' | 'hcp_number' | 'job_name'>): string => {
  const n = (job.click_number ?? '').trim() || (job.hcp_number ?? '').trim()
  if (n) return /^\d+$/.test(n) ? `JP${n}` : n
  return (job.job_name ?? '').trim() || 'this job'
}

/** The sheet row New Sub Labor inserts (`saveLaborJob`): yours, on the job, no miles (the form no longer asks). */
export function sheetInsertRow(p: SubLaborAdd, job: LaborJobRow, person: LaborPerson, world: Pick<SubLaborWorld, 'devUserId' | 'settings'>): Json {
  return {
    master_user_id: world.devUserId,
    assigned_to_name: person.name,
    address: (job.job_address ?? '').trim(),
    job_number: sheetJobNumber(job),
    job_ledger_id: job.id,
    labor_rate: sheetRateFor(p.lines, world.settings),
    job_date: p.date,
    distance_miles: 0,
    invoice_link: null,
  }
}

const hoursOf = (lines: readonly LaborLine[]): number => Math.round(lines.reduce((s, l) => s + ('hours' in l ? l.hours * (l.count ?? 1) : 0), 0) * 100) / 100

const dayWords = (date: string, through?: string): string => (through ? `${date} to ${through}` : date)

// ── bank rows that may be the same dollars ───────────────────────────────────────────────────────────────────────

/** A bank row's split as a plan names it. Money out reads as a cost of the positive amount (`cardChargeCostUsd`'s sign). */
function bankLineCard(line: BankLineRow, why: string): Json {
  return {
    allocation_id: line.id,
    mercury_transaction_id: line.mercury_transaction_id,
    cost_on_the_job: (0 - cents(line.amount)) / 100,
    bank_row_amount: line.mercury_transactions?.amount == null ? null : cents(line.mercury_transactions.amount) / 100,
    posted_on: (line.mercury_transactions?.posted_at ?? '').slice(0, 10) || null,
    paid_to: (line.mercury_transactions?.counterparty_name ?? '').trim() || null,
    note: has(line.note) ? line.note : null,
    why,
  }
}

const wordsOf = (s: string): string[] => s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 3)

/** True when a bank row's payee reads like one of the names: every word of the name (three letters and up) is in the payee. */
export function payeeReadsLike(payee: string | null | undefined, names: readonly string[]): boolean {
  const have = new Set(wordsOf(payee ?? ''))
  if (have.size === 0) return false
  return names.some((n) => {
    const need = wordsOf(n)
    return need.length > 0 && need.every((w) => have.has(w))
  })
}

/**
 * The job's allocated bank rows that may be this same pay: money out to a payee that reads like the person, or money
 * out of the same amount. Each already counts on the job as a card charge, beside the sheet's labor.
 */
export function bankLinesLikeThisPay(lines: readonly BankLineRow[], names: readonly string[], amountCents: number | null): Json[] {
  const out: Json[] = []
  for (const line of lines) {
    const cost = 0 - cents(line.amount)
    if (cost <= 0) continue
    const byName = payeeReadsLike(line.mercury_transactions?.counterparty_name, names)
    const byAmount = amountCents != null && amountCents > 0 && (cost === amountCents || Math.abs(cents(line.mercury_transactions?.amount)) === amountCents)
    if (byName || byAmount) out.push(bankLineCard(line, byName && byAmount ? 'paid to a name that reads like theirs, for the same amount' : byName ? 'paid to a name that reads like theirs' : 'money out of the same amount'))
  }
  return out
}

const TWICE_FIX = "This verb does not move an allocation: plan_cost_batch takes it off the job, and the office's rule for a bank row that pays contract labor is to label it Payroll in Banking, never to split it onto the job."

// ── plan_sub_labor ───────────────────────────────────────────────────────────────────────────────────────────────

export type DryRun = { ok: true; reply: Json } | { ok: false; refused: string }

/** What the plan hash commits to: everything the plan says but the profit band, which a cost elsewhere on the job moves. */
export function subLaborCommitment(reply: Json): Json {
  const { job_money: _money, ...rest } = reply
  return rest
}

function jobCard(job: LaborJobRow): Json {
  return { id: job.id, label: laborJobLabel(job), name: (job.job_name ?? '').trim() || null, address: (job.job_address ?? '').trim() || null, customer: (job.customer_name ?? '').trim() || null, status: job.status }
}

/** The job's sub labor from its sheets and the profit band, before and after a change of `deltaCents` in sheet cost. */
function laborAndMoney(world: SubLaborWorld, deltaCents: number): { job_labor: Json; job_money: Json } {
  const before = world.sheets.reduce((s, sh) => s + sheetJobCostCents(sh, world.items.filter((i) => i.job_id === sh.id), world.settings), 0)
  const job_labor = { source: 'laborJobSubCost over every sheet on the job — the Job window\'s own kernel', sheets: world.sheets.length, cost_before: before / 100, cost_after: (before + deltaCents) / 100 }
  const money = world.money
  if (!money) return { job_labor, job_money: { read: false, why: 'The profit band was not read. get_job shows it.' } }
  if ('error' in money) return { job_labor, job_money: { read: false, why: `The profit band could not be read: ${money.error}` } }
  const b = money.profit
  return {
    job_labor,
    job_money: {
      source: 'buildJobProfitSummary, as get_job and the Job window work it out. Not part of the plan hash: a cost elsewhere on the job may move it before the apply.',
      before: { total_bill: cents(b.totalBill) / 100, parts_cost: cents(b.partsCost) / 100, sub_labor: cents(b.laborCost) / 100, profit: cents(b.profit) / 100 },
      after: { total_bill: cents(b.totalBill) / 100, parts_cost: cents(b.partsCost) / 100, sub_labor: (cents(b.laborCost) + deltaCents) / 100, profit: (cents(b.profit) - deltaCents) / 100 },
    },
  }
}

function linesCard(items: readonly SheetItemInsert[], rate: number): Json[] {
  return items.map((it) => ({ words: it.fixture, ...(it.direct_labor_amount != null ? { amount: it.direct_labor_amount } : { hours: Math.round(it.count * it.hrs_per_unit * 100) / 100, rate: it.labor_rate, ...(it.count !== 1 ? { count: it.count } : {}) }), costs: sheetOwedCents(rate, [it]) / 100 }))
}

const ONE_DAY = 'The app keeps one day a sheet. A signed hours statement counts every line of this sheet on that day, whatever day a line names in its words. For hours on their own days, make a sheet a day.'

/** The line apply leaves on the job's Job activity / notes; null when an add carries no note, no span and no stated mark, or a change no reason. */
export function subLaborNoteBody(p: SubLaborPayload, world: SubLaborWorld, personName: string): string | null {
  if (p.action === 'add') {
    if (!p.note && !p.stated && !p.through) return null
    const total = sheetOwedCents(sheetRateFor(p.lines, world.settings), sheetItemRows(p.lines, p.stated))
    const hours = hoursOf(p.lines)
    return `Sub labor sheet for ${personName}: ${dayWords(p.date, p.through)}, ${laborDollars(total)} on ${p.lines.length} ${p.lines.length === 1 ? 'line' : 'lines'}${hours ? `, ${hours} h` : ''}.${p.stated ? ` The days are stated from ${p.stated.source}, not punched.` : ''}${p.note ? ` ${p.note}` : ''}`
  }
  if (!world.sheet) return null
  const who = (world.sheet.assigned_to_name ?? '').trim() || personName
  const day = sheetDay(world.sheet)
  if (p.action === 'remove') {
    const owed = sheetOwedCents(world.sheet.labor_rate, world.items.filter((i) => i.job_id === world.sheet!.id))
    return `Sub labor sheet removed: ${who}, ${day}, ${laborDollars(owed)}. Reason: ${p.reason}`
  }
  if (!p.reason) return null
  const parts = [p.date && p.date !== day ? `its day ${day} → ${p.date}` : '', p.lines ? `its lines replaced (${p.lines.length})` : ''].filter(Boolean)
  return `Sub labor sheet for ${who} (${day}) changed: ${parts.join(', ') || 'no change'}.${p.stated ? ` The days are stated from ${p.stated.source}, not punched.` : ''} Reason: ${p.reason}`
}

const noteWords = (body: string | null, label: string): Json => (body ? { note_on_activity: body, note_shows: `${label}'s Job activity / notes, as a note by you` } : { note_on_activity: null })

const ADD_DOES_NOT = [
  'It tells nobody: no email, no text, no push. The sub sees the sheet on their portal when they have one.',
  'It records no payment. plan_sub_labor_payment records what was paid against the sheet.',
  'It moves no bank row. A bank row already allocated to this job stays allocated: plan_cost_batch moves it.',
  'It writes no miles (the form no longer asks), no invoice link, and no work order or agreement for the sub to sign.',
  'It leaves the stage at Working, where the form starts a sheet. Jobs → Subs moves the stage; Paid sets itself once the balance is $0.',
  'It writes a sheet for one subcontractor. A sheet for several people, or for a teammate who is not a sub, is the form\'s own.',
]

/**
 * What the plan says and what the hash commits to (all of it but the profit band): the job and the person as they
 * stand, the sheet and its lines as they would land, the person's other sheets on the job, every sheet on the job,
 * the job's sub labor before and after, the bank rows that may be the same dollars, and what the verb does not do.
 */
export function subLaborDryRun(p: SubLaborPayload, world: SubLaborWorld): DryRun {
  if (p.action === 'add') {
    if (!world.job) return { ok: false, refused: `No job ${p.job_id} is visible to you — find_job resolves a number or a name.` }
    const job = world.job
    const label = laborJobLabel(job)
    const facts = laborPersonFacts(world.person ?? { asked: p.person, people: [], users: [] })
    if (!facts.ok) return { ok: false, refused: facts.refused }
    const person = facts.person
    if (!has(job.job_address)) return { ok: false, refused: `${label} has no address, and the form takes no sheet without one. plan_job_update sets job_address first.` }
    const mine = sheetsOfPerson(world, person)
    const last = p.through ?? p.date
    const overlap = mine.filter((s) => {
      const d = sheetDay(s)
      return d >= p.date && d <= last
    })
    if (overlap.length && !p.second_sheet_ok) {
      const o = overlap[0]!
      const owed = sheetOwedCents(o.labor_rate, world.items.filter((i) => i.job_id === o.id))
      return { ok: false, refused: `${person.name} already has ${overlap.length === 1 ? 'a sheet' : `${overlap.length} sheets`} on ${label} for ${p.through ? 'those days' : 'that day'}: ${sheetDay(o)}, ${laborDollars(owed)} (${o.id}${overlap.length > 1 ? `, and ${overlap.length - 1} more` : ''}). A second sheet for the same days counts the labor twice. Change that sheet with action change, or pass second_sheet_ok: true when this is other work on the same days.` }
    }
    const row = sheetInsertRow(p, job, person, world)
    const rate = Number(row.labor_rate)
    const items = sheetItemRows(p.lines, p.stated)
    const owed = sheetOwedCents(rate, items)
    const cost = sheetJobCostCents({ labor_rate: rate, distance_miles: 0 }, items, world.settings)
    const hours = hoursOf(p.lines)
    const bank = bankLinesLikeThisPay(world.bankLines, person.names, owed)
    const warnings: string[] = []
    if (bank.length) warnings.push(`${label} already carries ${bank.length === 1 ? 'a bank row' : `${bank.length} bank rows`} allocated as cost that may be this same pay (bank_rows_that_may_be_this_pay). Each counts in the job's profit as a card charge, and the sheet would count as sub labor: the same dollars twice. ${TWICE_FIX}`)
    if (overlap.length) warnings.push(`${person.name} already has ${overlap.length === 1 ? 'a sheet' : `${overlap.length} sheets`} on ${label} in these days; this one is written beside ${overlap.length === 1 ? 'it' : 'them'} because second_sheet_ok is true.`)
    if (p.through && !p.lines.some((l) => l.day)) warnings.push(`The sheet covers ${dayWords(p.date, p.through)} and no line names its day. Give each line its day so the sheet says which day was which.`)
    if (!person.people_id) warnings.push(`${person.name} has an account and no roster row on People, so no assignee row would tie the sheet to them: their portal and get_hours_statement find a sheet by that row. The sheet still counts on ${label} and in the Pay ledger under their name. People → Subs adds the roster row; then plan again.`)
    if (person.sample) warnings.push(`${person.name} is a sample account: this is a practice sheet on real job cost. Remove it with action remove when the walk is done.`)
    const noteBody = subLaborNoteBody(p, world, person.name)
    return {
      ok: true,
      reply: {
        action: 'add',
        job: jobCard(job),
        person: { name: person.name, people_id: person.people_id, user_id: person.user_id, kind: person.kind ?? 'sub', ...(person.sample ? { sample: true } : {}) },
        sheet: row,
        lines: linesCard(items, rate),
        totals: { owed_to_them: owed / 100, cost_on_the_job: cost / 100, ...(hours ? { hours } : {}), priced: 'amount' in p.lines[0]! ? 'flat amounts' : 'hours at a rate' },
        days: { sheet_day: p.date, ...(p.through ? { through: p.through } : {}), reads: ONE_DAY },
        stated: p.stated ? { source: p.stated.source, reads: `Every line ends "(stated, ${p.stated.source})", so the mark travels with the line onto the sub's portal, the printed sheet and an hours statement.` } : null,
        their_sheets_on_this_job: mine.map((s) => sheetCard(s, world)),
        job_sheets: world.sheets.map((s) => sheetCard(s, world)),
        ...laborAndMoney(world, cost),
        bank_rows_that_may_be_this_pay: bank,
        door: 'the rows New Sub Labor writes (Jobs → Subs → Pay), as you under RLS: one people_labor_jobs row, its assignee row, then its lines in people_labor_job_items',
        sets_off: [
          person.people_id ? 'the name trigger ties the sheet to their roster row (people_labor_job_assignees), which is how their portal and get_hours_statement find it' : 'no assignee row is written: they have no roster row for the name trigger to find',
          `the sheet counts on ${label} as sub labor at once: the Job window's profit band, the Cost Timeline and get_job`,
          'the sheet stands in the Pay ledger as owed until a payment covers it',
        ],
        ...noteWords(noteBody, label),
        does_not: ADD_DOES_NOT,
        ...(warnings.length ? { warnings } : {}),
      },
    }
  }

  if (!world.sheet) return { ok: false, refused: `No sheet ${p.sheet_id} is visible to you — plan_sub_labor's plan lists a job's sheets with their ids, and read_rows on people_labor_jobs finds one by job_ledger_id.` }
  const sheet = world.sheet
  const label = world.job ? laborJobLabel(world.job) : 'no job'
  const who = (sheet.assigned_to_name ?? '').trim() || 'nobody named'
  const oldItems = world.items.filter((i) => i.job_id === sheet.id)
  const pays = world.payments.filter((x) => x.job_id === sheet.id)
  const oldOwed = sheetOwedCents(sheet.labor_rate, oldItems)
  const oldCost = sheetJobCostCents(sheet, oldItems, world.settings)
  const before = { ...sheetCard(sheet, world), lines_now: oldItems.map((i) => ({ words: i.fixture, costs: sheetOwedCents(sheet.labor_rate, [i]) / 100 })) }
  const noJob = world.job ? [] : ['This sheet is tied to no job, so nothing lands on a job\'s activity and no profit band moves. Jobs → Subs → Work links it.']

  if (p.action === 'remove') {
    if (pays.length) {
      const bal = sheetBalance(oldOwed, pays)
      return { ok: false, refused: `This sheet for ${who} on ${label} (${sheetDay(sheet)}) carries ${pays.length} payment ${pays.length === 1 ? 'line' : 'lines'}: ${laborDollars(bal.paid)} paid${bal.backcharged ? `, ${laborDollars(bal.backcharged)} backcharged` : ''}. The Edit window's Delete would take them with the sheet and leave no trace. Remove each with plan_sub_labor_payment { action: 'remove', payment_id, reason } (${pays.map((x) => x.id).join(', ')}), which keeps one, then plan the remove again.` }
    }
    const noteBody = world.job ? subLaborNoteBody(p, world, who) : null
    return {
      ok: true,
      reply: {
        action: 'remove',
        job: world.job ? jobCard(world.job) : null,
        removes: before,
        job_sheets: world.sheets.map((s) => sheetCard(s, world)),
        ...laborAndMoney(world, -oldCost),
        door: 'the Edit window\'s Delete (Jobs → Subs → Pay): the people_labor_jobs row deleted as you under RLS',
        sets_off: [
          'its lines and its assignee rows go with it',
          'a work order made from this sheet that sits on no project step is dropped with it (people_labor_jobs_drop_sheet_work_orders)',
          'the sheet and its lines are kept in deleted_records',
          ...(world.job ? [`${label}'s sub labor drops by ${laborDollars(oldCost)} at once`] : []),
        ],
        ...noteWords(noteBody, label),
        no_undo: 'A removed sheet is not restored from here. Make it again with action add.',
        ...(sheet.step_id || noJob.length ? { warnings: [...(sheet.step_id ? ['This sheet belongs to a project step. Removing it leaves the step with no sheet.'] : []), ...noJob] } : {}),
      },
    }
  }

  // change
  const dayNow = sheetDay(sheet)
  const dateMoves = !!p.date && p.date !== String(sheet.job_date ?? '').slice(0, 10)
  const newItems = p.lines ? sheetItemRows(p.lines, p.stated) : null
  const newRate = p.lines ? sheetRateFor(p.lines, world.settings) : Number(sheet.labor_rate) || 0
  const sameLines = !!newItems && newItems.length === oldItems.length && newItems.every((n, i) => {
    const o = oldItems[i]!
    return n.fixture === (o.fixture ?? '') && cents(n.count) === cents(o.count) && cents(n.hrs_per_unit) === cents(o.hrs_per_unit) && n.is_fixed === (o.is_fixed === true) && (n.labor_rate == null ? o.labor_rate == null : o.labor_rate != null && cents(n.labor_rate) === cents(o.labor_rate)) && (n.direct_labor_amount == null ? o.direct_labor_amount == null : o.direct_labor_amount != null && cents(n.direct_labor_amount) === cents(o.direct_labor_amount))
  }) && cents(newRate) === cents(sheet.labor_rate)
  if (!dateMoves && (!newItems || sameLines)) return { ok: false, refused: `That sheet already reads that way. Nothing to change.` }
  const patch: Json = { ...(dateMoves ? { job_date: p.date } : {}), ...(newItems && !sameLines && cents(newRate) !== cents(sheet.labor_rate) ? { labor_rate: newRate } : {}) }
  const linesMove = !!newItems && !sameLines
  const owedAfter = linesMove ? sheetOwedCents(newRate, newItems!) : oldOwed
  const costAfter = linesMove ? sheetJobCostCents({ labor_rate: newRate, distance_miles: sheet.distance_miles }, newItems!, world.settings) : oldCost
  const bal = sheetBalance(owedAfter, pays)
  const warnings: string[] = [...noJob]
  if (linesMove && bal.paid + bal.backcharged > owedAfter && owedAfter > 0) warnings.push(`The sheet has ${laborDollars(bal.paid)} paid${bal.backcharged ? ` and ${laborDollars(bal.backcharged)} backcharged` : ''}, more than the ${laborDollars(owedAfter)} it would owe: it would read overpaid by ${laborDollars(bal.paid + bal.backcharged - owedAfter)}.`)
  if (linesMove && sheet.step_id) warnings.push('This sheet belongs to a project step, whose agreed amount its line carries. Changing the line leaves the step and the sheet apart.')
  if (linesMove && sheetNames(sheet).length > 1) warnings.push(`This sheet is shared by ${sheetNames(sheet).join(' and ')}. The new lines replace the lines for all of them.`)
  const noteBody = world.job ? subLaborNoteBody(p, world, who) : null
  return {
    ok: true,
    reply: {
      action: 'change',
      job: world.job ? jobCard(world.job) : null,
      before,
      after: {
        day: p.date && dateMoves ? p.date : dayNow,
        ...(linesMove ? { lines: linesCard(newItems!, newRate), sheet_rate: newRate } : { lines: 'as they are' }),
        owed: owedAfter / 100,
        paid: bal.paid / 100,
        open: bal.open / 100,
        job_cost: costAfter / 100,
      },
      sheet_patch: patch,
      replaces_lines: linesMove,
      job_sheets: world.sheets.map((s) => sheetCard(s, world)),
      ...laborAndMoney(world, costAfter - oldCost),
      door: [Object.keys(patch).length ? 'the sheet row patched as you under RLS' : '', linesMove ? 'every line deleted and the new lines inserted, as the Edit window\'s save does' : ''].filter(Boolean).join('; then '),
      sets_off: [...(linesMove && world.job ? [`${label}'s sub labor moves by ${laborDollars(costAfter - oldCost)} at once`] : []), ...(dateMoves ? ['the sheet counts on its new day in the Pay ledger and on an hours statement'] : []), 'the sheet\'s payments, stage, people and job stay as they are'],
      ...noteWords(noteBody, label),
      does_not: ['It changes no payment, no person and no job on the sheet: those are the Edit window\'s own presses (a payment is plan_sub_labor_payment).', 'It tells nobody.'],
      ...(warnings.length ? { warnings } : {}),
    },
  }
}

/** The apply's reply. */
export function subLaborAppliedWords(p: SubLaborPayload, label: string, result: { ok: true; detail: Json; note: { id: string } | { error: string } | null } | { ok: false; error: string }): Json {
  if (!result.ok) return { action: p.action, job: label, ok: false, error: result.error }
  const note = result.note === null ? null : 'id' in result.note ? { written: true, id: result.note.id } : { written: false, why: result.note.error, next: 'the sheet itself landed; plan_activity_note leaves the words by hand' }
  const next =
    p.action === 'add'
      ? `The sheet is on ${label}. get_job counts it in the profit band; plan_sub_labor_payment { sheet_id, amount, paid_on } records what was paid against it.`
      : p.action === 'change'
        ? `The sheet reads as planned. get_job shows ${label}'s profit band; get_hours_statement with kind sheet reads the sheet's lines.`
        : `The sheet is off ${label}. get_job shows the profit band without it.`
  return { action: p.action, job: label, ok: true, ...result.detail, ...(note ? { note_on_activity: note } : {}), next }
}

// ── plan_sub_labor_payment ───────────────────────────────────────────────────────────────────────────────────────

/** A bank row's split onto any job, with the job named. */
export type BankAllocationRow = { id: string; job_id: string; amount: number | string; note: string | null; jobs_ledger: { job_name: string | null; click_number: string | null; hcp_number: string | null } | null }
export const BANK_ALLOCATION_SELECT = 'id,job_id,amount,note,jobs_ledger(job_name,click_number,hcp_number)'

export type SubLaborPaymentWorld = {
  /** The payment a remove names; null for a record, or when RLS shows none. */
  payment: SheetPayRow | null
  sheet: SheetRow | null
  job: LaborJobRow | null
  items: SheetItemRow[]
  payments: SheetPayRow[]
  /** The bank row a record names, when it names one. */
  bank: BankRow | null
  bankAsked: string | null
  /** Every job that bank row is already allocated to. */
  bankAllocations: BankAllocationRow[]
  /** The sheet's job's allocated bank rows, for a payment that names no bank row. */
  bankLines: BankLineRow[]
}

export async function readSubLaborPaymentWorld(reads: SubLaborReads, p: SubLaborPaymentPayload): Promise<SubLaborPaymentWorld> {
  const payment = p.action === 'remove' ? (((await reads.rows('people_labor_job_payments', `select=${SHEET_PAY_COLS}&id=eq.${p.payment_id}`))[0] as unknown as SheetPayRow | undefined) ?? null) : null
  const sheetId = p.action === 'record' ? p.sheet_id : payment?.job_id ?? null
  const bankAsked = p.action === 'record' ? p.mercury_transaction_id ?? null : null
  const empty: SubLaborPaymentWorld = { payment, sheet: null, job: null, items: [], payments: [], bank: null, bankAsked, bankAllocations: [], bankLines: [] }
  if (!sheetId) return empty
  const sheet = ((await reads.rows('people_labor_jobs', `select=${SHEET_COLS}&id=eq.${sheetId}`))[0] as unknown as SheetRow | undefined) ?? null
  if (!sheet) return empty
  const jobId = sheet.job_ledger_id
  const [items, payments, jobs, banks, bankAllocations, bankLines] = await Promise.all([
    reads.rows('people_labor_job_items', `select=${SHEET_ITEM_COLS}&job_id=eq.${sheet.id}&order=sequence_order.asc&limit=1000`),
    reads.rows('people_labor_job_payments', `select=${SHEET_PAY_COLS}&job_id=eq.${sheet.id}&order=sequence_order.asc&limit=1000`),
    jobId ? reads.rows('jobs_ledger', `select=${LABOR_JOB_COLS}&id=eq.${jobId}`) : Promise.resolve([]),
    bankAsked ? reads.rows('mercury_transactions', `select=${LABOR_BANK_COLS}&id=eq.${bankAsked}`) : Promise.resolve([]),
    bankAsked ? reads.rows('mercury_transaction_job_allocations', `select=${BANK_ALLOCATION_SELECT}&mercury_transaction_id=eq.${bankAsked}&limit=200`) : Promise.resolve([]),
    jobId && p.action === 'record' && !bankAsked ? reads.rows('mercury_transaction_job_allocations', `select=${BANK_LINE_SELECT}&job_id=eq.${jobId}&limit=1000`) : Promise.resolve([]),
  ])
  return { payment, sheet, job: (jobs[0] as unknown as LaborJobRow | undefined) ?? null, items: items as unknown as SheetItemRow[], payments: payments as unknown as SheetPayRow[], bank: (banks[0] as unknown as BankRow | undefined) ?? null, bankAsked, bankAllocations: bankAllocations as unknown as BankAllocationRow[], bankLines: bankLines as unknown as BankLineRow[] }
}

/** The memo a payment carries, where the sub reads it: the method, the reference, the note. Null when none was given, as the window leaves it. */
export function sheetPaymentMemo(p: Pick<SheetPaymentRecord, 'method' | 'reference' | 'note'>): string | null {
  const memo = [p.method ?? '', p.reference ? `ref ${p.reference}` : '', p.note ?? ''].filter(Boolean).join(' · ')
  return memo ? memo.slice(0, MEMO_MAX) : null
}

/** The row Make Payment inserts (`recordLaborJobPayment`), after the sheet's last; `hidden_from_sub` rides on the row when asked, as a restored payment carries it. */
export function sheetPaymentInsertRow(p: SheetPaymentRecord, world: Pick<SubLaborPaymentWorld, 'payments'>): Json {
  const next = world.payments.length ? world.payments.reduce((m, r) => Math.max(m, Number(r.sequence_order ?? 0)), 0) + 1 : 0
  return { job_id: p.sheet_id, amount: p.amount, memo: sheetPaymentMemo(p), sequence_order: next, payment_date: p.paid_on, ...(p.hidden_from_sub ? { hidden_from_sub: true } : {}) }
}

function paymentCard(row: SheetPayRow): Json {
  return { id: row.id, amount: cents(row.amount) / 100, kind: Number(row.amount) < 0 ? 'backcharge' : 'payment', paid_on: row.payment_date ? String(row.payment_date).slice(0, 10) : null, memo: has(row.memo) ? row.memo : null, hidden_from_sub: row.hidden_from_sub === true, typed_in_on: row.created_at ? String(row.created_at).slice(0, 10) : null }
}

const allocationJobLabel = (a: BankAllocationRow): string => (a.jobs_ledger ? laborJobLabel(a.jobs_ledger) : `job ${a.job_id}`)

const PAYMENT_DOES_NOT = [
  'It ties no bank row to the payment: a sheet payment has no column for one. The bank row is read for this plan and written nowhere; put what identifies it in reference.',
  'It moves no allocation. plan_cost_batch moves a bank row off a job.',
  'It sends nothing. The sub sees the amount on their portal when they have one.',
  'It records no backcharge, and moves no payment to another sheet: those are the payment window\'s own presses.',
]

/**
 * What the plan says and what the hash commits to: the sheet with every payment on it, the payment as it would land,
 * the balance before and after, the bank row and every job it is already allocated to as cost, and what the write
 * does not do.
 */
export function subLaborPaymentDryRun(p: SubLaborPaymentPayload, world: SubLaborPaymentWorld): DryRun {
  if (p.action === 'remove' && !world.payment) return { ok: false, refused: `No sheet payment ${p.payment_id} is visible to you — plan_sub_labor_payment's plan lists a sheet's payments with their ids.` }
  if (!world.sheet) return { ok: false, refused: p.action === 'record' ? `No sheet ${p.sheet_id} is visible to you — plan_sub_labor's plan lists a job's sheets with their ids.` : 'The sheet this payment is on is not visible to you.' }
  const sheet = world.sheet
  const label = world.job ? laborJobLabel(world.job) : 'no job'
  const who = (sheet.assigned_to_name ?? '').trim() || 'nobody named'
  const owed = sheetOwedCents(sheet.labor_rate, world.items)
  const now = sheetBalance(owed, world.payments)
  const base = {
    action: p.action,
    job: world.job ? jobCard(world.job) : null,
    sheet: { id: sheet.id, who, day: sheetDay(sheet) || null, lines: world.items.length, owed: now.owed / 100, paid: now.paid / 100, ...(now.backcharged ? { backcharged: now.backcharged / 100 } : {}), open: now.open / 100, stage: sheet.stage },
    payments: world.payments.map(paymentCard),
  }
  const paidWords = (open: number): string => (open === 0 ? 'paid in full: the Pay ledger shows it Paid by itself' : open < 0 ? `overpaid by ${laborDollars(-open)}` : `${laborDollars(open)} still owed`)

  if (p.action === 'remove') {
    const row = world.payment!
    const after = sheetBalance(owed, world.payments.filter((x) => x.id !== row.id))
    return {
      ok: true,
      reply: {
        ...base,
        removes: paymentCard(row),
        after: { paid: after.paid / 100, ...(after.backcharged ? { backcharged: after.backcharged / 100 } : {}), open: after.open / 100, reads: paidWords(after.open) },
        door: `${SHEET_PAYMENT_REMOVE_RPC} as you — the payment's Remove with a reason`,
        sets_off: ['the row is deleted and its snapshot kept on the payment\'s trace with your name and the reason', 'the sheet and the sub\'s portal show a grey removed line', 'Undo in the app puts it back within 30 days'],
        reason: p.reason,
        does_not: ['It moves no bank row and tells nobody.'],
      },
    }
  }

  const amount = cents(p.amount)
  const twin = world.payments.find((r) => cents(r.amount) === amount && String(r.payment_date ?? '').slice(0, 10) === p.paid_on)
  if (twin && !p.duplicate_ok) return { ok: false, refused: `This sheet already holds a payment of ${laborDollars(amount)} dated ${p.paid_on} (${twin.id}). A second row for the same money pays it twice. Pass duplicate_ok: true only when ${who} was paid the same amount twice that day.` }
  const row = sheetPaymentInsertRow(p, world)
  const after = sheetBalance(owed, [...world.payments, { amount: p.amount }])
  const warnings: string[] = []
  let bankRow: Json | null = null
  let countsTwice: Json[] = []
  let mayCountTwice: Json[] = []
  if (p.mercury_transaction_id) {
    const bank = world.bank
    if (!bank) return { ok: false, refused: `No bank row ${p.mercury_transaction_id} is visible to you — read_rows on mercury_transactions finds the row by its amount and day.` }
    const out = 0 - cents(bank.amount)
    if (out <= 0) return { ok: false, refused: `That bank row is ${laborDollars(cents(bank.amount))}: money in, not a payment out to a sub.` }
    if ((bank.status ?? '') === 'failed') return { ok: false, refused: 'The bank returned that payment. A returned payment did not pay the sheet.' }
    const posted = (bank.posted_at ?? '').slice(0, 10)
    bankRow = { id: bank.id, amount_out: out / 100, posted_on: posted || null, paid_to: (bank.counterparty_name ?? '').trim() || null, kind: bank.kind, status: bank.status, written: 'nowhere — the payment has no column for a bank row' }
    if (out !== amount) warnings.push(`The bank row is ${laborDollars(out)} out and this payment ${laborDollars(amount)}. That is right when one bank row paid several sheets or one sheet was paid in several rows; say which in note.`)
    if (posted && Math.abs(dayMs(posted) - dayMs(p.paid_on)) > 10 * 86_400_000) warnings.push(`The bank row posted ${posted} and the payment is dated ${p.paid_on}, more than ten days apart.`)
    if (!payeeReadsLike(bank.counterparty_name, sheetNames(sheet)) && has(bank.counterparty_name)) warnings.push(`The bank row was paid to ${bank.counterparty_name!.trim()}, which does not read like ${who}.`)
    countsTwice = world.bankAllocations.map((a) => ({ allocation_id: a.id, job_id: a.job_id, job: allocationJobLabel(a), cost_on_the_job: (0 - cents(a.amount)) / 100, note: has(a.note) ? a.note : null, same_job_as_the_sheet: a.job_id === sheet.job_ledger_id }))
    if (countsTwice.length) {
      const named = world.bankAllocations.map((a) => `${laborDollars(0 - cents(a.amount))} on ${allocationJobLabel(a)} (allocation ${a.id})`).join('; ')
      warnings.unshift(`These dollars would count twice. The bank row is already allocated to ${world.bankAllocations.length === 1 ? 'a job' : 'jobs'} as cost: ${named}. An allocated bank row counts in a job's profit as a card charge, and this sheet already counts on ${label} as sub labor for what it owes. ${TWICE_FIX}`)
    }
  } else {
    mayCountTwice = bankLinesLikeThisPay(world.bankLines, sheetNames(sheet), amount)
    if (mayCountTwice.length) warnings.push(`${label} carries ${mayCountTwice.length === 1 ? 'a bank row' : `${mayCountTwice.length} bank rows`} allocated as cost that may be this same payment (may_count_twice). If one is, its dollars count twice: as a card charge and as this sheet's sub labor. Name the row as mercury_transaction_id to check it. ${TWICE_FIX}`)
    else warnings.push('No bank row was named, so nothing was checked against Banking. Pass mercury_transaction_id (the row that paid it) and the plan says whether that row is already allocated to a job as cost.')
  }
  if (after.open < 0 && owed > 0) warnings.push(`The sheet owes ${laborDollars(owed)} and would hold ${laborDollars(after.paid)} paid: overpaid by ${laborDollars(-after.open)}.`)
  if (owed === 0) warnings.push('The sheet has no priced line, so the Pay ledger reads what was paid as what was owed.')
  if (row.memo && !p.hidden_from_sub) warnings.push(`The memo "${String(row.memo)}" shows to ${who} on their portal. hidden_from_sub: true hides it; the amount always shows.`)
  return {
    ok: true,
    reply: {
      ...base,
      records: row,
      after: { paid: after.paid / 100, ...(after.backcharged ? { backcharged: after.backcharged / 100 } : {}), open: after.open / 100, reads: paidWords(after.open) },
      bank_row: bankRow,
      counts_twice: countsTwice,
      ...(p.mercury_transaction_id ? {} : { may_count_twice: mayCountTwice }),
      job_profit: 'unchanged — a sheet counts on its job for what it owes, paid or not. Only the balance owed to the sub moves.',
      door: `one row into people_labor_job_payments as you, as Make Payment writes it (Jobs → Subs → Pay)${p.hidden_from_sub ? ', its memo hidden from the sub as the payment window\'s switch hides one' : ''}`,
      sets_off: ['the sheet\'s balance moves wherever the app shows what a sub is owed, the Pay ledger first', 'the sub\'s portal shows the payment with its date'],
      does_not: PAYMENT_DOES_NOT,
      ...(warnings.length ? { warnings } : {}),
    },
  }
}

/** The apply's reply. `after` is the sheet's payments read back. */
export function subLaborPaymentAppliedWords(p: SubLaborPaymentPayload, who: string, result: { ok: true; detail: Json; after: { paid: number; open: number } | null } | { ok: false; error: string }): Json {
  if (!result.ok) return { action: p.action, sheet_of: who, ok: false, error: result.error }
  const after = result.after ? { paid: result.after.paid, open: result.after.open, reads: result.after.open === 0 ? 'paid in full' : result.after.open < 0 ? `overpaid by ${laborDollars(cents(-result.after.open))}` : `${laborDollars(cents(result.after.open))} still owed` } : null
  const next = p.action === 'record' ? `${who}'s sheet carries the payment. plan_sub_labor_payment { action: 'remove', payment_id, reason } takes it off again with a trace.` : `The payment is off ${who}'s sheet, kept on its trace. Undo in the app restores it within 30 days.`
  return { action: p.action, sheet_of: who, ok: true, ...result.detail, ...(after ? { after } : {}), next }
}
