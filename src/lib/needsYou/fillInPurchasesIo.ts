import { supabase } from '../supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import type { Json } from '../../types/database'
import { APP_SETTINGS_KEY_JOB_TALLY_MIN_POSTED_YMD, normalizeJobTallyMinPostedYmd } from '../appSettingsKeys'
import { fetchTallyLinkedMercuryRows } from '../tally/fetchTallyLinkedMercuryRows'
import { fetchSortModeDayJobs } from '../tally/fetchSortModeDayJobs'
import type { LedgerPrefixMap } from '../ledgerDisplayPrefixes'
import { purchaseJobOptionFromSearch, type PurchaseJobOption, type PurchaseSource, type PurchaseWrites } from './fillInPurchases'

/**
 * The purchases kind's reads and writes (v2.6071, punch list #178): the rows are the Tally
 * page's own read, paged, with the org's date floor and the payroll marks beside them (the
 * marks fail soft to none, as on the page, where only a payroll approver may read them); the
 * day's jobs are the Sort screen's read; the search is the Assign window's RPC for the holder's
 * own card. Save and Undo are the Sort screen's RPC: the splits replaced, then cleared.
 */
export type PurchaseSources = { rows: PurchaseSource[]; payrollFlagged: string[]; floorYmd: string | null }

export type PurchaseSaved = { txId: string }

export type PurchaseFillInIo = {
  fetchSources: () => Promise<PurchaseSources>
  fetchDayJobs: (userId: string, swipeAtIso: string, prefixMap: LedgerPrefixMap) => Promise<{ data: PurchaseJobOption[]; error: string | null }>
  searchJobs: (q: string) => Promise<PurchaseJobOption[]>
  save: (w: PurchaseWrites) => Promise<PurchaseSaved>
  undo: (saved: PurchaseSaved) => Promise<void>
}

export const purchaseFillInIo: PurchaseFillInIo = {
  async fetchSources() {
    const [rows, floorYmd, payrollFlagged] = await Promise.all([
      fetchTallyLinkedMercuryRows(supabase, 'fill in: card purchases'),
      withSupabaseRetry(async () => supabase.from('app_settings').select('value_text').eq('key', APP_SETTINGS_KEY_JOB_TALLY_MIN_POSTED_YMD).maybeSingle(), 'fill in: tally floor')
        .then((d) => normalizeJobTallyMinPostedYmd((d as { value_text: string | null } | null)?.value_text ?? null))
        .catch(() => null),
      withSupabaseRetry(async () => supabase.from('mercury_tally_payroll_flags').select('mercury_transaction_id, is_payroll'), 'fill in: payroll marks')
        .then((flags) => ((flags ?? []) as Array<{ mercury_transaction_id: string; is_payroll: boolean }>).filter((f) => f.is_payroll).map((f) => f.mercury_transaction_id))
        .catch(() => [] as string[]),
    ])
    return { rows, payrollFlagged, floorYmd }
  },
  fetchDayJobs(userId, swipeAtIso, prefixMap) {
    return fetchSortModeDayJobs(userId, swipeAtIso, prefixMap)
  },
  async searchJobs(q) {
    const data = await withSupabaseRetry(async () => supabase.rpc('search_jobs_for_tally_mercury_assign', { search_text: q }), 'fill in: job search')
    return ((data ?? []) as Array<{ id: string; hcp_number: string | null; job_name: string | null; job_address: string | null }>).map(purchaseJobOptionFromSearch)
  },
  async save(w) {
    await withSupabaseRetry(
      async () => supabase.rpc('replace_mercury_job_splits_for_my_linked_card', { p_mercury_transaction_id: w.txId, p_rows: w.rows as unknown as Json }),
      'fill in: purchase splits',
    )
    return { txId: w.txId }
  },
  async undo(saved) {
    await withSupabaseRetry(
      async () => supabase.rpc('replace_mercury_job_splits_for_my_linked_card', { p_mercury_transaction_id: saved.txId, p_rows: [] as unknown as Json }),
      'fill in: undo purchase splits',
    )
  },
}
