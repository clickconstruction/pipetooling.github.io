/**
 * Bills sent (punch list #327, PR 1): the reads. The rules are `billsSent.ts`.
 *
 * Nothing is written. The page reads the sent copies of every bill-like paper, newest first, then the facts that
 * make a line readable: each bill's amount and status, each job's words, each statement's total, and every other
 * send on record of the same bills, so a second send can say when the first went. The first read throws its reason
 * when it fails, so the screen says so and offers Retry. The reads after it are best effort: a line still draws
 * with what the copy itself says.
 */
import { supabase } from '../supabase'
import { chunkIds } from '../supabasePaging'
import { parseSentCopy } from '../sent/sentCopies'
import { BILLS_SENT_KIND_PREFIX, BILLS_SENT_OTHER_KINDS, type BillsSentBill, type BillsSentCopy, type BillsSentEarlier, type BillsSentInput, type BillsSentJob, type BillsSentStatement } from './billsSent'

const COPY_COLS =
  'id, kind, title, how, recipient_name, recipient_emails, subject, source_table, source_id, copy_path, copy_type, copy_hash, attachments, sent_at, sent_by_name, job_ids, bid_id, source_snapshot, resend_email_id'

/** Ids per `in.(…)` list: a longer list makes an address some networks refuse. */
const IN_CHUNK = 80

const text = (v: unknown): string => (typeof v === 'string' ? v : '')
const numberOrNull = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() && Number.isFinite(Number(v)) ? Number(v) : null)

async function inChunks<T>(ids: string[], read: (chunk: string[]) => PromiseLike<{ data: unknown; error: unknown }>, parse: (raw: Record<string, unknown>) => T | null): Promise<T[]> {
  if (ids.length === 0) return []
  const parts = await Promise.all(
    chunkIds(ids, IN_CHUNK).map(async (chunk) => {
      try {
        const { data, error } = await read(chunk)
        if (error) return []
        return ((data ?? []) as Array<Record<string, unknown>>).map(parse).filter((r): r is T => r != null)
      } catch {
        return []
      }
    }),
  )
  return parts.flat()
}

/**
 * What the screen draws from: the newest `limit` sends of bill-like papers and the facts beside them. Throws when
 * the sends themselves cannot be read.
 */
export async function readBillsSent(opts: { limit: number }): Promise<BillsSentInput> {
  const kinds = [`kind.like.${BILLS_SENT_KIND_PREFIX}*`, `kind.in.(${BILLS_SENT_OTHER_KINDS.join(',')})`].join(',')
  const { data, error } = await supabase
    .from('sent_documents')
    .select(COPY_COLS)
    .or(kinds)
    .order('sent_at', { ascending: false })
    .limit(Math.max(1, Math.min(opts.limit, 1000)))
  if (error) throw error
  const copies: BillsSentCopy[] = ((data ?? []) as unknown[]).flatMap((raw) => {
    const copy = parseSentCopy(raw)
    return copy ? [{ ...copy, resendEmailId: text((raw as Record<string, unknown>).resend_email_id) || null }] : []
  })

  const billIds = [...new Set(copies.filter((c) => c.sourceTable === 'jobs_ledger_invoices' && c.sourceId).map((c) => c.sourceId as string))]
  const resendIds = [...new Set(copies.filter((c) => c.kind.startsWith('gc_statement') && c.resendEmailId).map((c) => c.resendEmailId as string))]

  const [bills, statements, earlier] = await Promise.all([
    inChunks<BillsSentBill>(
      billIds,
      (chunk) => supabase.from('jobs_ledger_invoices').select('id, job_id, amount, status').in('id', chunk),
      (r) => (text(r.id) ? { id: text(r.id), jobId: text(r.job_id) || null, amount: numberOrNull(r.amount), status: text(r.status) } : null),
    ),
    inChunks<BillsSentStatement>(
      resendIds,
      (chunk) => supabase.from('gc_statement_emails').select('resend_email_id, total, job_count').in('resend_email_id', chunk),
      (r) => (text(r.resend_email_id) ? { resendEmailId: text(r.resend_email_id), total: numberOrNull(r.total), jobCount: numberOrNull(r.job_count) } : null),
    ),
    inChunks<BillsSentEarlier>(
      billIds,
      (chunk) => supabase.from('sent_documents').select('source_id, sent_at, kind').eq('source_table', 'jobs_ledger_invoices').in('source_id', chunk).neq('kind', 'bill_copy'),
      (r) => (text(r.source_id) && text(r.sent_at) && text(r.kind).startsWith(BILLS_SENT_KIND_PREFIX) ? { billId: text(r.source_id), atIso: text(r.sent_at) } : null),
    ),
  ])

  const jobIds = [...new Set([...copies.flatMap((c) => c.jobIds ?? []), ...bills.map((b) => b.jobId).filter((id): id is string => !!id)])]
  const jobs = await inChunks<BillsSentJob>(
    jobIds,
    (chunk) => supabase.from('jobs_ledger').select('id, hcp_number, click_number, job_name, job_address, customer_name').in('id', chunk),
    (r) =>
      text(r.id)
        ? { id: text(r.id), hcp_number: text(r.hcp_number) || null, click_number: text(r.click_number) || null, job_name: text(r.job_name) || null, job_address: text(r.job_address) || null, customer_name: text(r.customer_name) || null }
        : null,
  )

  return {
    copies,
    bills: new Map(bills.map((b) => [b.id, b])),
    jobs: new Map(jobs.map((j) => [j.id, j])),
    statements: new Map(statements.map((s) => [s.resendEmailId, s])),
    earlier,
  }
}
