import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database'
import { withSupabaseRetry, type SupabaseClientResult } from '../../utils/errorHandling'
import { SUPABASE_IN_CHUNK_SIZE, fetchAllRows } from '../supabasePaging'
import type { PctFactsRead } from './pctFacts'

/**
 * The read behind `pctFacts.ts` (v2.7221): for the jobs named, their lines, the schedule's days, their bills, the
 * percents written down and, since v2.7232, their addresses. Five reads side by side, each paged past the API's 1,000 rows, then one read for the names
 * of the people on the schedule. Nothing here is read for a job that is not on the list.
 */

type LineRow = { id: string; job_id: string; name: string | null; count: number | null; line_unit_price: number | null; line_kind: string | null; invoice_id: string | null; sequence_order: number | null }
type BlockRow = { job_id: string | null; assignee_user_id: string; work_date: string }
type InvoiceRow = { id: string; job_id: string; amount: number | null; status: string }
type EventRow = { job_id: string; pct: number | null; changed_at: string }
type AddressRow = { id: string; job_address: string | null }

const chunks = <T,>(arr: ReadonlyArray<T>, n: number): T[][] => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n))

export async function loadPctFacts(db: SupabaseClient<Database>, jobIds: ReadonlyArray<string>, ymdOf: (iso: string) => string): Promise<PctFactsRead> {
  const ids = [...new Set(jobIds)]
  const out: PctFactsRead = { lines: [], blocks: [], invoices: [], events: [], addresses: [] }
  if (ids.length === 0) return out
  // One paged read: every page goes through the app's retry, and a failure throws with its reason.
  const paged = <T,>(label: string, page: (from: number, to: number) => PromiseLike<SupabaseClientResult<unknown>>): Promise<T[]> =>
    fetchAllRows(async (from, to) => ({ data: (await withSupabaseRetry(async () => page(from, to), label)) as T[] | null, error: null }), label)
  const blocks: BlockRow[] = []
  for (const part of chunks(ids, SUPABASE_IN_CHUNK_SIZE)) {
    const [lineRows, blockRows, invoiceRows, eventRows, addressRows] = await Promise.all([
      paged<LineRow>('bridge percent facts lines', (from, to) => db.from('jobs_ledger_fixtures').select('id, job_id, name, count, line_unit_price, line_kind, invoice_id, sequence_order').in('job_id', part).order('id').range(from, to)),
      paged<BlockRow>('bridge percent facts schedule', (from, to) => db.from('job_schedule_blocks').select('job_id, assignee_user_id, work_date').in('job_id', part).order('id').range(from, to)),
      paged<InvoiceRow>('bridge percent facts bills', (from, to) => db.from('jobs_ledger_invoices').select('id, job_id, amount, status').in('job_id', part).order('id').range(from, to)),
      paged<EventRow>('bridge percent facts percents', (from, to) => db.from('job_pct_events').select('job_id, pct, changed_at').in('job_id', part).not('pct', 'is', null).order('id').range(from, to)),
      paged<AddressRow>('bridge percent facts addresses', (from, to) => db.from('jobs_ledger').select('id, job_address').in('id', part).order('id').range(from, to)),
    ])
    for (const l of lineRows) out.lines.push({ jobId: l.job_id, id: l.id, name: l.name, count: l.count == null ? null : Number(l.count), unitPrice: l.line_unit_price == null ? null : Number(l.line_unit_price), lineKind: l.line_kind, invoiceId: l.invoice_id, sequence: Number(l.sequence_order ?? 0) })
    blocks.push(...blockRows)
    for (const a of addressRows) out.addresses.push({ jobId: a.id, address: a.job_address })
    for (const i of invoiceRows) out.invoices.push({ jobId: i.job_id, id: i.id, usd: Number(i.amount ?? 0), status: i.status })
    for (const e of eventRows) if (e.pct != null) out.events.push({ jobId: e.job_id, pct: Number(e.pct), at: e.changed_at, ymd: ymdOf(e.changed_at) })
  }
  // The people on the schedule, by name: one read for everyone the blocks name.
  const names = new Map<string, string>()
  for (const part of chunks([...new Set(blocks.map((b) => b.assignee_user_id))], SUPABASE_IN_CHUNK_SIZE)) {
    const users = (await withSupabaseRetry(async () => db.from('users').select('id, name').in('id', part), 'bridge percent facts names')) as Array<{ id: string; name: string | null }> | null
    for (const u of users ?? []) if (u.name) names.set(u.id, u.name)
  }
  for (const b of blocks) if (b.job_id) out.blocks.push({ jobId: b.job_id, userId: b.assignee_user_id, name: names.get(b.assignee_user_id) ?? 'Someone', ymd: b.work_date })
  return out
}
