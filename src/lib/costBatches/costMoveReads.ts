/**
 * Move cost (Banking → Cost batches): the browser's reads and the two RPC calls around the pure
 * kernels (`costMoveRows.ts`, `costMovePlan.ts`, `costBatchDryRunCompare.ts`, `costBatchList.ts`).
 * Every read runs as the signed-in dev under RLS; the RPCs gate the caller themselves
 * (`docs/COST_BATCHES.md` → Access model). A dry run is retried like any read; the real apply and
 * the revert are sent once — a retry after a lost reply could write the batch twice.
 */
import { supabase } from '../supabase'
import type { Json } from '../../types/database'
import { checkSupabaseError, withSupabaseRetry } from '../../utils/errorHandling'
import { chunkIds, fetchAllRows } from '../supabasePaging'
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { mercuryDebitCardIdFromRaw } from '../mercuryRawDebitCard'
import { sessionMinutes } from '../jobs/jobHistoryCalendar'
import { parseCostBatchApplyResult, type CostBatchApplyResult } from './costBatchDryRunCompare'
import { costBatchIdsTouchingJob, costBatchOpRowFromDb, costBatchRowFromDb, sortCostBatchesNewestFirst, type CostBatchOpRow, type CostBatchRow } from './costBatchList'
import type { CostBatchPayload } from './costBatchPayload'
import type { CostMoveBankRow, CostMoveClockRow, CostMoveOtherRow, CostMoveRow, CostMoveSupplyRow } from './costMoveRows'

export type CostMoveJobRow = {
  id: string
  hcp_number: string
  click_number: string
  job_name: string
  job_address: string
  service_type_id: string | null
}

const JOB_SELECT = 'id, hcp_number, click_number, job_name, job_address, service_type_id'

function one<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null
  return Array.isArray(v) ? (v[0] ?? null) : v
}

/** The bank's category as a name: Mercury stores a string or `{ name }`. */
export function mercuryCategoryName(v: unknown): string | null {
  if (typeof v === 'string') return v.trim() || null
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    const name = (v as { name?: unknown }).name
    return typeof name === 'string' && name.trim() ? name.trim() : null
  }
  return null
}

export async function fetchCostMoveJob(jobId: string): Promise<CostMoveJobRow | null> {
  const row = await withSupabaseRetry(async () => await supabase.from('jobs_ledger').select(JOB_SELECT).eq('id', jobId).maybeSingle(), 'load move cost job')
  return (row as CostMoveJobRow | null) ?? null
}

export async function fetchJobWordsByIds(ids: readonly string[]): Promise<Map<string, CostMoveJobRow>> {
  const out = new Map<string, CostMoveJobRow>()
  const wanted = [...new Set(ids.filter((id) => !!id))]
  for (const chunk of chunkIds(wanted)) {
    const rows = await withSupabaseRetry(async () => await supabase.from('jobs_ledger').select(JOB_SELECT).in('id', chunk), 'load move cost job names')
    for (const r of (rows ?? []) as CostMoveJobRow[]) out.set(r.id, r)
  }
  return out
}

/** The app's job search (`search_jobs_ledger`, billing-only jobs included — the Office job is one). */
export async function searchJobsForCostMove(query: string): Promise<CostMoveJobRow[]> {
  const q = query.trim()
  if (!q) return []
  const rows = await withSupabaseRetry(async () => await supabase.rpc('search_jobs_ledger', { search_text: q, include_billing_only: true }), 'search jobs for move cost')
  return ((rows ?? []) as CostMoveJobRow[]).slice(0, 40)
}

type RawTx = { id: string; posted_at: string | null; counterparty_name: string | null; amount: number; raw: unknown; mercury_category: unknown }
type RawAlloc = { id: string; amount: number; note: string | null; mercury_transaction_id: string; mercury_transactions: RawTx | RawTx[] | null }

async function fetchBankRows(jobId: string, nicknameByDebitCard: Record<string, string>): Promise<CostMoveBankRow[]> {
  const label = 'load move cost bank rows'
  const rows = await fetchAllRows<RawAlloc>(
    async (from, to) => ({
      data: (await withSupabaseRetry(
        async () =>
          await supabase
            .from('mercury_transaction_job_allocations')
            .select('id, amount, note, mercury_transaction_id, mercury_transactions(id, posted_at, counterparty_name, amount, raw, mercury_category)')
            .eq('job_id', jobId)
            .order('created_at', { ascending: true })
            .order('id')
            .range(from, to),
        label,
      )) as RawAlloc[] | null,
      error: null,
    }),
    label,
  )
  const out: CostMoveBankRow[] = []
  for (const r of rows) {
    const tx = one(r.mercury_transactions)
    const cardId = tx ? mercuryDebitCardIdFromRaw(tx.raw) : null
    out.push({
      source: 'bank',
      allocationId: r.id,
      txId: r.mercury_transaction_id,
      postedYmd: tx?.posted_at ? calendarYmdInAppTzFromIso(tx.posted_at) : null,
      counterparty: tx?.counterparty_name ?? null,
      cardId,
      cardNickname: cardId ? nicknameByDebitCard[cardId] ?? null : null,
      category: mercuryCategoryName(tx?.mercury_category),
      txAmount: Number(tx?.amount ?? 0),
      allocationAmount: Number(r.amount),
      note: r.note,
    })
  }
  // Newest posting first, so the catch-all's live rows read from the top.
  return out.sort((a, b) => (b.postedYmd ?? '').localeCompare(a.postedYmd ?? '') || a.allocationId.localeCompare(b.allocationId))
}

type RawInvoice = { id: string; invoice_number: string; invoice_date: string; amount: number; is_paid: boolean; purchase_order_number: string | null; supply_houses: { name: string } | { name: string }[] | null }
type RawSupplyAlloc = { invoice_id: string; pct: number; supply_house_invoices: RawInvoice | RawInvoice[] | null }

async function fetchSupplyRows(jobId: string): Promise<CostMoveSupplyRow[]> {
  const rows = await withSupabaseRetry(
    async () =>
      await supabase
        .from('supply_house_invoice_job_allocations')
        .select('invoice_id, pct, supply_house_invoices(id, invoice_number, invoice_date, amount, is_paid, purchase_order_number, supply_houses(name))')
        .eq('job_id', jobId),
    'load move cost supply rows',
  )
  const out: CostMoveSupplyRow[] = []
  for (const r of (rows ?? []) as unknown as RawSupplyAlloc[]) {
    const inv = one(r.supply_house_invoices)
    out.push({
      source: 'supply',
      invoiceId: r.invoice_id,
      supplyHouse: one(inv?.supply_houses)?.name ?? null,
      invoiceNumber: inv?.invoice_number ?? '',
      invoiceYmd: inv?.invoice_date ?? '',
      amount: Number(inv?.amount ?? 0),
      pct: Number(r.pct),
      isPaid: inv?.is_paid === true,
      purchaseOrder: inv?.purchase_order_number ?? null,
    })
  }
  return out.sort((a, b) => b.invoiceYmd.localeCompare(a.invoiceYmd) || a.invoiceNumber.localeCompare(b.invoiceNumber))
}

type RawSession = {
  id: string
  user_id: string
  work_date: string
  clocked_in_at: string | null
  clocked_out_at: string | null
  quick_add_minutes: number | null
  approved_at: string | null
  rejected_at: string | null
  bid_id: string | null
  users: { name: string | null } | { name: string | null }[] | null
}

async function fetchClockRows(jobId: string): Promise<CostMoveClockRow[]> {
  const label = 'load move cost clock rows'
  const rows = await fetchAllRows<RawSession>(
    async (from, to) => ({
      data: (await withSupabaseRetry(
        async () =>
          await supabase
            .from('clock_sessions')
            .select('id, user_id, work_date, clocked_in_at, clocked_out_at, quick_add_minutes, approved_at, rejected_at, bid_id, users!clock_sessions_user_id_fkey(name)')
            .eq('job_ledger_id', jobId)
            .is('revoked_at', null)
            .order('work_date', { ascending: true })
            .order('id')
            .range(from, to),
        label,
      )) as RawSession[] | null,
      error: null,
    }),
    label,
  )
  return rows.map((r) => ({
    source: 'clock',
    sessionId: r.id,
    userId: r.user_id,
    personName: one(r.users)?.name ?? null,
    workYmd: r.work_date,
    minutes: sessionMinutes({ clocked_in_at: r.clocked_in_at, clocked_out_at: r.clocked_out_at, quick_add_minutes: r.quick_add_minutes }),
    approved: r.approved_at !== null,
    rejected: r.rejected_at !== null,
    bidId: r.bid_id,
  }))
}

async function fetchOtherRows(jobId: string): Promise<CostMoveOtherRow[]> {
  const rows = await withSupabaseRetry(
    async () => await supabase.from('jobs_ledger_materials').select('id, description, amount, sequence_order').eq('job_id', jobId).order('sequence_order', { ascending: true }),
    'load move cost other charges',
  )
  return ((rows ?? []) as { id: string; description: string; amount: number }[]).map((r) => ({ source: 'other', chargeId: r.id, description: r.description, amount: Number(r.amount) }))
}

/** Every cost row on a job, the four sources read side by side. */
export async function fetchCostMoveRows(jobId: string, nicknameByDebitCard: Record<string, string>): Promise<CostMoveRow[]> {
  const [bank, supply, clock, other] = await Promise.all([fetchBankRows(jobId, nicknameByDebitCard), fetchSupplyRows(jobId), fetchClockRows(jobId), fetchOtherRows(jobId)])
  return [...bank, ...supply, ...clock, ...other]
}

const BATCH_SELECT = 'id, label, reason, source_ref, author_label, author_user_id, applied_at, reverted_at, revert_reason, op_count, summary'
const OPS_SELECT = 'batch_id, seq, op_type, target, before_image, after_image, reverted_at'

/** Every op that names the job in its target or its images (the filter runs server-side; the kernel re-checks). */
export async function fetchCostBatchOpsTouchingJob(jobId: string): Promise<CostBatchOpRow[]> {
  const label = 'load cost batch ops for job'
  const filter = [`target->>job_id.eq.${jobId}`, `target->>to_job_id.eq.${jobId}`, `target->>from_job_id.eq.${jobId}`, `before_image->>job_ledger_id.eq.${jobId}`, `after_image->>job_ledger_id.eq.${jobId}`].join(',')
  const rows = await fetchAllRows<unknown>(
    async (from, to) => ({
      data: (await withSupabaseRetry(async () => await supabase.from('cost_batch_ops').select(OPS_SELECT).or(filter).order('id', { ascending: true }).range(from, to), label)) as unknown[] | null,
      error: null,
    }),
    label,
  )
  return rows.map(costBatchOpRowFromDb).filter((r): r is CostBatchOpRow => r !== null)
}

export async function fetchCostBatchOps(batchId: string): Promise<CostBatchOpRow[]> {
  const label = 'load cost batch ops'
  const rows = await fetchAllRows<unknown>(
    async (from, to) => ({
      data: (await withSupabaseRetry(async () => await supabase.from('cost_batch_ops').select(OPS_SELECT).eq('batch_id', batchId).order('seq', { ascending: true }).range(from, to), label)) as unknown[] | null,
      error: null,
    }),
    label,
  )
  return rows.map(costBatchOpRowFromDb).filter((r): r is CostBatchOpRow => r !== null)
}

export const COST_BATCH_LIST_LIMIT = 200

export type CostBatchLists = {
  /** The batches that touched the job, newest first; empty when no job is chosen. */
  onJob: CostBatchRow[]
  /** The newest batches company-wide, up to the limit. */
  all: CostBatchRow[]
}

export async function fetchCostBatchLists(jobId: string | null): Promise<CostBatchLists> {
  const allRaw = await withSupabaseRetry(async () => await supabase.from('cost_batches').select(BATCH_SELECT).order('applied_at', { ascending: false }).limit(COST_BATCH_LIST_LIMIT), 'load cost batches')
  const all = sortCostBatchesNewestFirst(((allRaw ?? []) as unknown[]).map(costBatchRowFromDb).filter((r): r is CostBatchRow => r !== null))
  if (!jobId) return { onJob: [], all }
  const ops = await fetchCostBatchOpsTouchingJob(jobId)
  const ids = costBatchIdsTouchingJob(ops, jobId)
  const have = new Map(all.map((b) => [b.id, b]))
  const missing = [...ids].filter((id) => !have.has(id))
  for (const chunk of chunkIds(missing)) {
    const rows = await withSupabaseRetry(async () => await supabase.from('cost_batches').select(BATCH_SELECT).in('id', chunk), 'load cost batches for job')
    for (const b of ((rows ?? []) as unknown[]).map(costBatchRowFromDb)) if (b) have.set(b.id, b)
  }
  const onJob = sortCostBatchesNewestFirst([...ids].map((id) => have.get(id)).filter((b): b is CostBatchRow => !!b))
  return { onJob, all }
}

function summaryOrThrow(data: unknown, what: string): CostBatchApplyResult {
  const parsed = parseCostBatchApplyResult(data)
  if (!parsed) throw new Error(`${what} replied with something other than the batch summary.`)
  return parsed
}

/** `cost_batch_apply(payload, true)`: every write performed and unwound; retried like a read. */
export async function dryRunCostBatch(payload: CostBatchPayload): Promise<CostBatchApplyResult> {
  const data = await withSupabaseRetry(async () => await supabase.rpc('cost_batch_apply', { p: payload as unknown as Json, p_dry_run: true }), 'dry-run cost batch')
  return summaryOrThrow(data, 'The dry run')
}

/** `cost_batch_apply(payload, false)`: sent once, never retried — a lost reply must not become two batches. */
export async function applyCostBatch(payload: CostBatchPayload): Promise<CostBatchApplyResult> {
  const result = await supabase.rpc('cost_batch_apply', { p: payload as unknown as Json, p_dry_run: false })
  checkSupabaseError(result, 'apply cost batch')
  return summaryOrThrow(result.data, 'Apply')
}

/** `cost_batch_revert(batch_id, reason)`: sent once. */
export async function revertCostBatch(batchId: string, reason: string): Promise<void> {
  const result = await supabase.rpc('cost_batch_revert', { p_batch_id: batchId, p_reason: reason.trim() })
  checkSupabaseError(result, 'revert cost batch')
}
