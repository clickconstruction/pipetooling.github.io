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
import { parsePayCalendarRow, type PayCalendar, type PayCalendarDbRow, type PayCalendarReceipt, type PayCalendarRow } from './payCalendar'

type Db = SupabaseClient<Database>
type CodedError = { code?: string | null; message: string }

const isMissingRelation = (code: string | null | undefined): boolean => code === 'PGRST205' || code === '42P01'

const COLUMNS = 'payer_customer_id, job_id, off, cutoff_day, pay_day, months_after, pay_when_paid, clause, words, set_at, set_by'

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
  const base = db.from('payer_pay_calendars' as never).select(COLUMNS)
  const { data, error } = (await (payerId ? base.eq('payer_customer_id', payerId) : base)) as { data: StoredRow[] | null; error: CodedError | null }
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

/** Every stored calendar, for `indexPayCalendars`. None before the migration is pushed. */
export function loadPayCalendars(db: Db): Promise<PayCalendarRow[]> {
  return readRows(db, null)
}

/** One payer's rows: its own calendar and any a job of theirs carries. */
export function loadPayerPayCalendars(db: Db, payerId: string): Promise<PayCalendarRow[]> {
  return readRows(db, payerId)
}

/** What a save writes: a calendar, a job's off switch, or null to clear the row. */
export type PayCalendarSave = PayCalendar | { off: true } | null

/** Sets, replaces or clears one calendar: the payer's own with no job, else that job's. The server stamps who set it. */
export async function savePayCalendar(db: Db, args: { payerId: string; jobId?: string | null; calendar: PayCalendarSave }): Promise<void> {
  const { error } = await db.rpc('set_payer_pay_calendar' as never, { p_payer_customer_id: args.payerId, p_job_id: args.jobId ?? null, p_calendar: args.calendar } as never)
  if (error) throw error
}

/**
 * The payer's measured payments, newest first, at most 12: the day each bill went in and the day
 * its money landed. Empty when the payer has none, when the reader may not see pay speeds, or
 * when the read fails: the window then says there is no payment on record, never an error.
 */
export async function loadPayerReceipts(db: Db, payerId: string): Promise<PayCalendarReceipt[]> {
  try {
    const { data, error } = await db.rpc('get_customer_pay_speeds' as never, { p_customer_ids: [payerId] } as never)
    if (error) return []
    return (parsePaySpeedsRpc(data as unknown)?.receipts[payerId] ?? []).map((r) => ({ billedYmd: r.billedYmd, paidYmd: r.paidYmd }))
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
