/**
 * The reads and the save behind the Pay calendar (punch list #323): the stored calendars, one
 * payer's own, and the payer's measured payments for the record replayed against a calendar.
 * `payCalendar.ts` beside it is the kernel. The table and the function arrive with migration
 * 20261112150000; before it is pushed a read finds no table and answers "none", so every
 * screen stands either side of the push.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database'
import { parsePaySpeedsRpc } from './billedExpectedPay'
import { parseBillDueDayRow, parsePayCalendarRow, payCalendarSavePayload, type BillDueDayDbRow, type PayCalendar, type PayCalendarDbRow, type PayCalendarReceipt, type PayCalendarRow } from './payCalendar'
import { payCalendarJobOf, type PayCalendarJob, type PayCalendarJobInput } from './payCalendarJob'
import { effectiveInvoiceParty, payerCustomerId } from './billToParty'

type Db = SupabaseClient<Database>
type CodedError = { code?: string | null; message: string }

const isMissingRelation = (code: string | null | undefined): boolean => code === 'PGRST205' || code === '42P01'

const COLUMNS_BEFORE_DAYS = 'payer_customer_id, job_id, off, cutoff_day, pay_day, months_after, pay_when_paid, clause, words, set_at, set_by'
/** With `days_after` (punch list #341, PR 5, migration 20261115190000): the terms that are a number of days after the bill. */
const COLUMNS = `${COLUMNS_BEFORE_DAYS}, days_after`

/** The read named a column the database does not have yet: PostgREST's own code, or Postgres's. */
const isMissingColumn = (code: string | null | undefined): boolean => code === '42703' || code === 'PGRST204'

type StoredRow = PayCalendarDbRow & { set_by?: string | null }

async function namesOf(db: Db, ids: ReadonlyArray<string>): Promise<Map<string, string>> {
  const names = new Map<string, string>()
  if (!ids.length) return names
  // Best effort: a reader who cannot read the users row sees the calendar with no name beside it.
  const { data } = await db.from('users').select('id, name').in('id', [...ids])
  for (const u of (data ?? []) as Array<{ id: string; name: string | null }>) if (u.name?.trim()) names.set(u.id, u.name.trim())
  return names
}

async function readRows(db: Db, payerId: string | null): Promise<PayCalendarRow[]> {
  const read = async (columns: string) => {
    const base = db.from('payer_pay_calendars' as never).select(columns)
    return (await (payerId ? base.eq('payer_customer_id', payerId) : base)) as { data: StoredRow[] | null; error: CodedError | null }
  }
  let { data, error } = await read(COLUMNS)
  // Before the days-after migration is pushed the column is not there: read the calendars as they were, so every screen stands either side of the push.
  if (error && isMissingColumn(error.code)) ({ data, error } = await read(COLUMNS_BEFORE_DAYS))
  if (error) {
    if (isMissingRelation(error.code)) return []
    throw error
  }
  const rows = data ?? []
  const names = await namesOf(db, [...new Set(rows.map((r) => r.set_by).filter((id): id is string => !!id))])
  const out: PayCalendarRow[] = []
  for (const r of rows) {
    const parsed = parsePayCalendarRow(r, r.set_by ? names.get(r.set_by) : null)
    if (parsed) out.push(parsed)
  }
  return out
}

type StoredDueDay = BillDueDayDbRow & { marked_by?: string | null }

/**
 * Every bill's own due day (punch list #341, PR 4, `invoice_due_days`), as rows that ride with the calendars.
 * None before migration 20261115170000 is pushed, and none on a read that fails: the days are an extra on top of
 * the calendars, and a screen that cannot read them reads each bill's calendar as before.
 */
async function readBillDueDays(db: Db): Promise<PayCalendarRow[]> {
  try {
    const { data, error } = (await db.from('invoice_due_days' as never).select('invoice_id, due_on, clause, words, marked_at, marked_by')) as { data: StoredDueDay[] | null; error: CodedError | null }
    if (error) return []
    const rows = data ?? []
    const names = await namesOf(db, [...new Set(rows.map((r) => r.marked_by).filter((id): id is string => !!id))])
    const out: PayCalendarRow[] = []
    for (const r of rows) {
      const parsed = parseBillDueDayRow(r, r.marked_by ? names.get(r.marked_by) : null)
      if (parsed) out.push(parsed)
    }
    return out
  } catch {
    return []
  }
}

/**
 * Every stored calendar, and every bill's own due day with them, for `indexPayCalendars`: one read, so each
 * screen that reads a calendar finds a bill's own day too. None before the migrations are pushed.
 */
export async function loadPayCalendars(db: Db): Promise<PayCalendarRow[]> {
  const [calendars, dueDays] = await Promise.all([readRows(db, null), readBillDueDays(db)])
  return dueDays.length ? [...calendars, ...dueDays] : calendars
}

/** One payer's rows: its own calendar and any a job of theirs carries. */
export function loadPayerPayCalendars(db: Db, payerId: string): Promise<PayCalendarRow[]> {
  return readRows(db, payerId)
}

const PAY_CALENDAR_CHANGED_EVENT = 'pay-calendar-changed'

/** Says a pay calendar was saved or cleared in this tab (punch list #341): the window says it once per save, however many jobs it wrote. */
export function dispatchPayCalendarChanged(): void {
  try {
    window.dispatchEvent(new Event(PAY_CALENDAR_CHANGED_EVENT))
  } catch {
    /* non-browser */
  }
}

/**
 * Runs `onChange` after any pay calendar save in this tab, whichever door opened the window, so
 * the board, the job window's row and a line elsewhere never show yesterday's calendar. Returns
 * the unsubscribe.
 */
export function onPayCalendarChanged(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  window.addEventListener(PAY_CALENDAR_CHANGED_EVENT, onChange)
  return () => window.removeEventListener(PAY_CALENDAR_CHANGED_EVENT, onChange)
}

/** What a save writes: a calendar, a job's off switch, or null to clear the row. */
export type PayCalendarSave = PayCalendar | { off: true } | null

/** Sets, replaces or clears one calendar: the payer's own with no job, else that job's. The server stamps who set it. */
export async function savePayCalendar(db: Db, args: { payerId: string; jobId?: string | null; calendar: PayCalendarSave }): Promise<void> {
  // A calendar goes as the function reads it: days after the bill carry no pay day, so a database from before that migration refuses them in words.
  const calendar = args.calendar && !('off' in args.calendar) ? payCalendarSavePayload(args.calendar) : args.calendar
  const { error } = await db.rpc('set_payer_pay_calendar' as never, { p_payer_customer_id: args.payerId, p_job_id: args.jobId ?? null, p_calendar: calendar } as never)
  if (error) throw error
}

/**
 * The payer's measured payments, newest first, at most 12: the day each bill went in, the day
 * its money landed and the job it was for, so a job's own can be picked out (`recordFor`). Empty when the payer has none, when the reader may not see pay speeds, or
 * when the read fails: the window then says there is no payment on record, never an error.
 */
export async function loadPayerReceipts(db: Db, payerId: string): Promise<PayCalendarReceipt[]> {
  try {
    const { data, error } = await db.rpc('get_customer_pay_speeds' as never, { p_customer_ids: [payerId] } as never)
    if (error) return []
    return (parsePaySpeedsRpc(data as unknown)?.receipts[payerId] ?? []).map((r) => ({ billedYmd: r.billedYmd, paidYmd: r.paidYmd, jobId: r.jobId }))
  } catch {
    return []
  }
}

type AcceptanceRow = { invoice_id?: string | null; accepted_on?: string | null }

/**
 * The day a payer accepted each bill that has one (PR 4, `invoice_payer_acceptances`), keyed by the bill's id.
 * Empty before the migration is pushed, so every bill counts from the day it went in.
 */
export async function loadInvoiceAcceptances(db: Db): Promise<Map<string, string>> {
  const { data, error } = (await db.from('invoice_payer_acceptances' as never).select('invoice_id, accepted_on')) as { data: AcceptanceRow[] | null; error: CodedError | null }
  const out = new Map<string, string>()
  if (error) {
    if (isMissingRelation(error.code)) return out
    throw error
  }
  for (const r of data ?? []) if (r.invoice_id && typeof r.accepted_on === 'string') out.set(r.invoice_id, r.accepted_on.slice(0, 10))
  return out
}

/** Sets, replaces or clears (null) the day a payer accepted one bill. The server stamps who marked it. */
export async function saveInvoiceAcceptance(db: Db, args: { invoiceId: string; acceptedYmd: string | null }): Promise<void> {
  const { error } = await db.rpc('set_invoice_payer_accepted_on' as never, { p_invoice_id: args.invoiceId, p_accepted_on: args.acceptedYmd } as never)
  if (error) throw error
}

/** Sets, replaces or clears (null day) one bill's own due day, with its clause and a few of its words. The server stamps who marked it. */
export async function saveInvoiceDueDay(db: Db, args: { invoiceId: string; dueYmd: string | null; clause?: string; words?: string }): Promise<void> {
  const { error } = await db.rpc('set_invoice_due_day' as never, { p_invoice_id: args.invoiceId, p_due_on: args.dueYmd, p_clause: args.clause ?? '', p_words: args.words ?? '' } as never)
  if (error) throw error
}

/** A job that carries a row of its own under a payer, as the payer's window lists it (punch list #341). */
export type PayCalendarJobFacts = {
  job: PayCalendarJob
  /** Who pays the job's bills today, by the job's own rule; null when it names nobody, or the read could not say. */
  payerIdNow: string | null
}

type JobFactsRow = PayCalendarJobInput & { customer_id?: string | null; gc_customer_id?: string | null; bill_to_party?: string | null }

/**
 * The jobs behind a payer's job rows: each one's name as the board says it, its development, and who pays it
 * today, so the window can name each job and say when its calendar is held for a payer who no longer pays it.
 * Keyed by job id. Empty on a read that fails: the window then lists the jobs without their names.
 */
export async function loadPayCalendarJobs(db: Db, jobIds: ReadonlyArray<string>): Promise<Map<string, PayCalendarJobFacts>> {
  const out = new Map<string, PayCalendarJobFacts>()
  if (!jobIds.length) return out
  try {
    const { data, error } = await db.from('jobs_ledger').select('id, hcp_number, click_number, job_name, development_id, customer_id, gc_customer_id, bill_to_party').in('id', [...jobIds])
    if (error) return out
    const rows = (data ?? []) as JobFactsRow[]
    const devIds = [...new Set(rows.map((r) => r.development_id).filter((id): id is string => !!id))]
    const devNames = new Map<string, string | null>()
    if (devIds.length) {
      // Best effort: with no name the window says "this development".
      const { data: devs } = await db.from('developments').select('id, name').in('id', devIds)
      for (const d of (devs ?? []) as Array<{ id: string; name: string | null }>) devNames.set(d.id, d.name)
    }
    for (const r of rows) {
      const development = r.development_id ? { name: devNames.get(r.development_id) ?? null } : null
      out.set(r.id, { job: payCalendarJobOf({ ...r, development }), payerIdNow: payerCustomerId(r, effectiveInvoiceParty(r, null)) })
    }
  } catch {
    // the list still draws, without names
  }
  return out
}

/** The jobs of one development, for *Also set on the other jobs here*: their ids, with no order. Empty on a read that fails. */
export async function loadDevelopmentJobIds(db: Db, developmentId: string): Promise<string[]> {
  try {
    const { data, error } = await db.from('jobs_ledger').select('id').eq('development_id', developmentId)
    if (error) return []
    return ((data ?? []) as Array<{ id: string }>).map((j) => j.id)
  } catch {
    return []
  }
}
