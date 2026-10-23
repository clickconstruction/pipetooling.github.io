import { supabase } from '../supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import type { JobSupplyHouseAccountRow } from '../materials/jobSupplyHouseAccounts'
import type { JobAccountGapSource, JobAccountJobLabel, JobAccountWrites } from './fillInJobAccounts'

/**
 * The job-account kind's reads and writes (v2.5776, punch list #145): the gaps from the
 * evidence rule's own RPC, the job names from the ledger; the save is the Mark opened sheet's
 * upsert on (job_id, supply_house_id), plus the house roster's flag on the job's invoices at
 * that house when opened. Undo puts back the row that was there (a counter's ask, say) or
 * removes the one it made, and unflags the invoices it flagged.
 */
const ACCOUNT_COLUMNS = 'id, job_id, supply_house_id, status, account_ref, opened_via, rep_contact_id, requested_by, requested_at, requested_from_counter, opened_by, opened_at, note'

export type JobAccountSaved = {
  jobId: string
  houseId: string
  /** The row on record before the save; null when there was none. */
  previous: JobSupplyHouseAccountRow | null
  flaggedInvoiceIds: string[]
}

export type JobAccountFillInIo = {
  fetchGaps: () => Promise<JobAccountGapSource[]>
  fetchJobs: (ids: string[]) => Promise<JobAccountJobLabel[]>
  save: (w: JobAccountWrites) => Promise<JobAccountSaved>
  undo: (saved: JobAccountSaved) => Promise<void>
}

export const jobAccountFillInIo: JobAccountFillInIo = {
  async fetchGaps() {
    const rows = await withSupabaseRetry(async () => await supabase.rpc('list_job_account_evidence_gaps'), 'fill in: job account gaps')
    return (Array.isArray(rows) ? rows : []) as JobAccountGapSource[]
  },
  async fetchJobs(ids) {
    if (ids.length === 0) return []
    const out: JobAccountJobLabel[] = []
    for (let i = 0; i < ids.length; i += 200) {
      const chunk = ids.slice(i, i + 200)
      const rows = await withSupabaseRetry(async () => supabase.from('jobs_ledger').select('id, hcp_number, click_number, job_name, job_address').in('id', chunk), 'fill in: job names')
      out.push(...((rows ?? []) as JobAccountJobLabel[]))
    }
    return out
  },
  async save(w) {
    const before = await withSupabaseRetry(async () => supabase.from('job_supply_house_accounts').select(ACCOUNT_COLUMNS).eq('job_id', w.jobId).eq('supply_house_id', w.houseId).limit(1), 'fill in: job account before')
    const previous = ((before ?? []) as JobSupplyHouseAccountRow[])[0] ?? null
    const rows = await withSupabaseRetry(async () => supabase.from('job_supply_house_accounts').upsert(w.row, { onConflict: 'job_id,supply_house_id' }).select('id'), 'fill in: job account')
    if (!rows || (rows as unknown[]).length === 0) throw new Error('Nothing was saved.')
    let flaggedInvoiceIds: string[] = []
    if (w.flagInvoices) {
      // The job's invoices at this house that are not on the account yet, as the roster's open flags them.
      const allocations = await withSupabaseRetry(async () => supabase.from('supply_house_invoice_job_allocations').select('invoice_id, pct').eq('job_id', w.jobId), 'fill in: job allocations')
      const ids = ((allocations ?? []) as Array<{ invoice_id: string; pct: number }>).filter((a) => Number(a.pct) > 0).map((a) => a.invoice_id)
      if (ids.length > 0) {
        const invoices = await withSupabaseRetry(async () => supabase.from('supply_house_invoices').select('id').in('id', ids).eq('supply_house_id', w.houseId).not('on_job_account', 'is', true), 'fill in: invoices at the house')
        flaggedInvoiceIds = ((invoices ?? []) as Array<{ id: string }>).map((r) => r.id)
        if (flaggedInvoiceIds.length > 0) await withSupabaseRetry(async () => supabase.from('supply_house_invoices').update({ on_job_account: true }).in('id', flaggedInvoiceIds).select('id'), 'fill in: flag invoices')
      }
    }
    return { jobId: w.jobId, houseId: w.houseId, previous, flaggedInvoiceIds }
  },
  async undo(saved) {
    if (saved.flaggedInvoiceIds.length > 0) await withSupabaseRetry(async () => supabase.from('supply_house_invoices').update({ on_job_account: false }).in('id', saved.flaggedInvoiceIds).select('id'), 'fill in: unflag invoices')
    if (saved.previous) {
      const p = saved.previous
      await withSupabaseRetry(async () => supabase.from('job_supply_house_accounts').upsert({ job_id: p.job_id, supply_house_id: p.supply_house_id, status: p.status, account_ref: p.account_ref ?? '', opened_via: p.opened_via ?? null, rep_contact_id: p.rep_contact_id ?? null, note: p.note ?? '' }, { onConflict: 'job_id,supply_house_id' }).select('id'), 'fill in: undo job account')
    } else {
      await withSupabaseRetry(async () => supabase.from('job_supply_house_accounts').delete().eq('job_id', saved.jobId).eq('supply_house_id', saved.houseId), 'fill in: undo job account')
    }
  },
}
