import { supabase } from '../supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { effectiveJobLedgerNumber } from '../ledgerDisplayPrefixes'
import { lienBilledOpen } from './lienBilledOpen'
import { LIEN_JOB_PATH_COLUMNS, lienJobPathStanding } from './lienJobPath'
import type { LienJobPathFacts, LienJobPathResult } from './lienJobPathWindow'
import type { LienPublicPaper } from './lienPublicProperty'

/**
 * The reads and the one write behind *Take this job off the lien path?* (the *not lienable* train, PR 3). The rule is
 * `lienJobPath.ts`, the words `lienJobPathWindow.ts`; the write is `set_job_lien_path_answer` (migration
 * 20261117080000), which stores the answer with who, when and why, writes the job's activity line and, when asked,
 * puts the job on the attorney's list through the Collections flag.
 */

export type LienJobPathRead = LienJobPathFacts & { jobId: string }

type JobRow = { id: string; hcp_number: string | null; click_number: string | null; job_name: string | null; status: string | null; revenue: number | null; payments_made: number | null; collections_at: string | null; lien_path_answer: string | null; lien_path_answered_at: string | null; lien_path_answered_by: string | null; lien_path_reason: string | null }
type InvoiceRow = { id: string; job_id: string; status: string | null; amount: number | null; sequence_order: number | null; billed_at: string | null }
type PaymentRow = { job_id: string; invoice_id: string | null; amount: number | null }
type LineRow = { name: string | null; count: number | null; line_unit_price: number | null; sequence_order: number | null }

const JOB_COLUMNS = `id, hcp_number, click_number, job_name, status, revenue, payments_made, collections_at, ${LIEN_JOB_PATH_COLUMNS}` as const

/** One line of what the job billed: its words, and its money when the line carries a price. */
export function lienJobPathBillLine(row: LineRow): { name: string; amount: number | null } {
  const price = row.line_unit_price == null ? null : Number(row.line_unit_price)
  const count = Number(row.count ?? 1) || 1
  return { name: (row.name ?? '').trim(), amount: price == null || Number.isNaN(price) ? null : price * count }
}

/** The job as the window needs it: its money by the desk's own rule, what it billed, its lien papers, and where it stands on the path. */
export async function readLienJobPath(jobId: string): Promise<LienJobPathRead> {
  const [jobData, inv, pay, its, lines] = await Promise.all([
    withSupabaseRetry(() => supabase.from('jobs_ledger').select(JOB_COLUMNS).eq('id', jobId).maybeSingle(), 'lien path: the job'),
    withSupabaseRetry(() => supabase.from('jobs_ledger_invoices').select('id, job_id, status, amount, sequence_order, billed_at').eq('job_id', jobId), 'lien path: the bills'),
    withSupabaseRetry(() => supabase.from('jobs_ledger_payments').select('job_id, invoice_id, amount').eq('job_id', jobId), 'lien path: the payments'),
    withSupabaseRetry(() => supabase.from('job_lien_desk_items').select('job_id, kind, status, months, sent_at, approved_at, voided_at').eq('job_id', jobId).is('voided_at', null), 'lien path: the lien papers'),
    withSupabaseRetry(() => supabase.from('jobs_ledger_fixtures').select('name, count, line_unit_price, sequence_order').eq('job_id', jobId).order('sequence_order', { ascending: true }), 'lien path: what the job billed'),
  ])
  const job = (jobData ?? null) as unknown as JobRow | null
  if (!job) throw new Error('The job could not be read.')
  const standing = lienJobPathStanding(job)
  // Who took it off, by name: read only when someone did. A name that cannot be read leaves the line without one.
  let byName = ''
  if (standing.by) {
    const who = await withSupabaseRetry(() => supabase.from('users').select('id, name').eq('id', standing.by as string).maybeSingle(), 'lien path: who decided').catch(() => null)
    byName = ((who as { name?: string | null } | null)?.name ?? '').trim()
  }
  return {
    jobId: job.id,
    number: effectiveJobLedgerNumber(job.hcp_number, job.click_number) || '—',
    name: (job.job_name ?? '').trim(),
    status: job.status,
    unpaid: lienBilledOpen(
      { id: job.id, status: job.status ?? null, revenue: Number(job.revenue ?? 0), payments_made: Number(job.payments_made ?? 0) },
      ((inv ?? []) as InvoiceRow[]).map((i) => ({ ...i, amount: Number(i.amount ?? 0) })),
      ((pay ?? []) as PaymentRow[]).map((p) => ({ ...p, amount: Number(p.amount ?? 0) })),
    ),
    attorneySince: job.collections_at,
    papers: ((its ?? []) as unknown as Array<LienPublicPaper & { job_id: string }>).map(({ kind, status, months, sent_at, approved_at, voided_at }) => ({ kind, status, months, sent_at, approved_at, voided_at })),
    billLines: ((lines ?? []) as LineRow[]).map(lienJobPathBillLine),
    off: standing.off,
    reason: standing.reason,
    since: standing.at,
    byName,
  }
}

export type LienJobPathAnswerInput = {
  jobId: string
  answer: 'off_path' | 'on_path'
  reason: string
  /** On the way off: also put the job on the attorney's list (the Collections flag). */
  attorneyList?: boolean
}

/** The press: the answer stored. Throws the function's own words when it refuses. */
export async function setJobLienPathAnswer(input: LienJobPathAnswerInput): Promise<LienJobPathResult> {
  const data = await withSupabaseRetry(
    () =>
      supabase.rpc('set_job_lien_path_answer', {
        p_job_id: input.jobId,
        p_answer: input.answer,
        p_reason: input.reason.trim(),
        p_attorney_list: input.answer === 'off_path' && input.attorneyList === true,
      }),
    'lien path: the answer',
  )
  const r = (data ?? {}) as { ok?: boolean; error?: string; answer?: unknown; changed?: unknown; on_attorney_list?: unknown; already_on_list?: unknown; held?: unknown }
  if (r.error) throw new Error(r.error)
  if (!r.ok) throw new Error('The answer was not saved.')
  return {
    answer: r.answer === 'off_path' ? 'off_path' : null,
    changed: r.changed === true,
    onAttorneyList: r.on_attorney_list === true,
    alreadyOnList: r.already_on_list === true,
    held: typeof r.held === 'string' && r.held.trim() ? r.held.trim() : null,
  }
}
