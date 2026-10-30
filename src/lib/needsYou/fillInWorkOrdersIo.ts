import { supabase } from '../supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { emitWorkOrderChanged } from '../../hooks/useJobWorkOrderCoverage'
import { bidSubLaborTotals } from '../subWorkOrders/workOrderDocument'
import { jobAccountFillInIo } from './fillInJobAccountsIo'
import type { WorkOrderBidHint, WorkOrderDraftSource, WorkOrderSources, WorkOrderWrites } from './fillInWorkOrders'

/**
 * The work-order kind's reads and writes (v2.6094, punch list #178): the drafts are the Needs
 * you line's own read (`step_commitments`, draft, no amount); the job names come from the
 * ledger; the bid's sub-labor hint is the assembler's own read, the job's bid's cost estimates'
 * subcontractor rows summed, failing soft to no hint. Save writes the one column the assembler's
 * Save draft writes for a price, `amount`, and raises `work-order-changed` so the line and the
 * job window's chip re-read; Undo clears it the same way.
 */
export type WorkOrderSaved = { commitmentId: string }

export type WorkOrderFillInIo = {
  fetchSources: () => Promise<WorkOrderSources>
  save: (w: WorkOrderWrites) => Promise<WorkOrderSaved>
  undo: (saved: WorkOrderSaved) => Promise<void>
}

async function fetchBidHints(jobIds: string[]): Promise<WorkOrderBidHint[]> {
  if (jobIds.length === 0) return []
  const jobs = ((await withSupabaseRetry(async () => supabase.from('jobs_ledger').select('id, bid_id').in('id', jobIds.slice(0, 200)), 'fill in: work order bids')) ?? []) as Array<{ id: string; bid_id: string | null }>
  const bidIds = [...new Set(jobs.map((j) => j.bid_id).filter((b): b is string => !!b))]
  if (bidIds.length === 0) return []
  const estimates = ((await withSupabaseRetry(async () => supabase.from('cost_estimates').select('id, bid_id').in('bid_id', bidIds), 'fill in: work order estimates')) ?? []) as Array<{ id: string; bid_id: string }>
  if (estimates.length === 0) return []
  const rows = ((await withSupabaseRetry(async () => supabase.from('cost_estimate_subcontractor_rows').select('cost_estimate_id, rough_in, top_out, trim_set').in('cost_estimate_id', estimates.map((e) => e.id)), 'fill in: work order sub rows')) ?? []) as Array<{ cost_estimate_id: string; rough_in: number | null; top_out: number | null; trim_set: number | null }>
  const bidOfEstimate = new Map(estimates.map((e) => [e.id, e.bid_id]))
  const rowsByBid = new Map<string, typeof rows>()
  for (const r of rows) {
    const bidId = bidOfEstimate.get(r.cost_estimate_id)
    if (!bidId) continue
    ;(rowsByBid.get(bidId) ?? rowsByBid.set(bidId, []).get(bidId)!).push(r)
  }
  return jobs
    .filter((j) => j.bid_id && rowsByBid.has(j.bid_id))
    .map((j) => ({ jobId: j.id, ...bidSubLaborTotals(rowsByBid.get(j.bid_id!)!) }))
}

export const workOrderFillInIo: WorkOrderFillInIo = {
  async fetchSources() {
    const drafts = ((await withSupabaseRetry(
      async () => supabase.from('step_commitments').select('id, person_id, display_name, job_id, created_at, offer_scope_snapshot, proposed_start, proposed_end').eq('status', 'draft').is('amount', null).order('created_at', { ascending: true }).limit(200),
      'fill in: unpriced work orders',
    )) ?? []) as WorkOrderDraftSource[]
    const jobIds = [...new Set(drafts.map((d) => d.job_id).filter((j): j is string => !!j))]
    const [jobs, hints] = await Promise.all([jobAccountFillInIo.fetchJobs(jobIds), fetchBidHints(jobIds).catch(() => [] as WorkOrderBidHint[])])
    return { drafts, jobs, hints, nowMs: Date.now() }
  },
  async save(w) {
    const rows = await withSupabaseRetry(async () => supabase.from('step_commitments').update({ amount: w.amount }).eq('id', w.commitmentId).eq('status', 'draft').select('id'), 'fill in: price the work order')
    if (!rows || (rows as unknown[]).length === 0) throw new Error('The draft was not found, or it is no longer a draft.')
    emitWorkOrderChanged()
    return { commitmentId: w.commitmentId }
  },
  async undo(saved) {
    await withSupabaseRetry(async () => supabase.from('step_commitments').update({ amount: null }).eq('id', saved.commitmentId).eq('status', 'draft').select('id'), 'fill in: undo the price')
    emitWorkOrderChanged()
  },
}
