import { supabase } from './supabase'
import { withSupabaseRetry } from '../utils/errorHandling'
import { effectiveJobLedgerNumber } from './ledgerDisplayPrefixes'
import type { UnifiedSearchResult } from '../utils/unifiedJobBidSearch'

export type DispatchSettingsJobOption = {
  value: string
  label: string
  /** Raw search row for standard-row dropdown rendering (absent on label-only paths). */
  row?: Extract<UnifiedSearchResult, { source: 'job' }>
}

type JobLedgerSearchRow = {
  id: string
  hcp_number: string | null
  click_number?: string | null
  job_name: string | null
  job_address?: string | null
  service_type_id?: string | null
  service_type_name?: string | null
}

type JobLedgerByIdsRow = {
  id: string
  hcp_number: string | null
  click_number?: string | null
  job_name: string | null
}

/**
 * Live job search for the Dispatch Settings "Jobs that don't require a note" picker.
 *
 * Hits `search_jobs_ledger` so closed/billed jobs are findable too (the picker is a forward-
 * looking config: a billed job that's about to be re-scheduled should still be addable).
 *
 * The `signal` plumbs through to the Supabase request when supported by the runtime; on
 * cancellation the call rejects with an `AbortError`, which the caller (`ChipsWithSearchPicker`)
 * swallows so a fresh keystroke can fire without flicker.
 */
export async function searchJobsLedgerForDispatchSettings(
  query: string,
  signal: AbortSignal,
): Promise<DispatchSettingsJobOption[]> {
  const trimmed = query.trim()
  if (!trimmed) return []
  let q: unknown = supabase.rpc('search_jobs_ledger', { search_text: trimmed })
  if (signal && q != null && typeof q === 'object' && 'abortSignal' in q) {
    q = (q as { abortSignal: (s: AbortSignal) => unknown }).abortSignal(signal)
  }
  const res = (await (q as Promise<{
    data: JobLedgerSearchRow[] | null
    error: { message: string } | null
  }>)) ?? { data: [], error: null }
  if (res.error) {
    // Aborted requests surface as a normal error from Supabase; let the picker treat it as such.
    throw new Error(res.error.message)
  }
  const rows = res.data ?? []
  return rows.map((r) => ({
    value: r.id,
    label: formatDispatchSettingsJobLabel(r.hcp_number, r.job_name, r.click_number),
    row: {
      source: 'job',
      id: r.id,
      hcp_number: r.hcp_number ?? '',
      click_number: r.click_number ?? null,
      job_name: r.job_name ?? '',
      job_address: r.job_address ?? '',
      service_type_id: r.service_type_id ?? null,
      service_type_name: r.service_type_name ?? null,
    },
  }))
}

/**
 * Resolves labels for a known list of job ids — used by the Dispatch Settings modal to render
 * chips for already-persisted `skip_note_job_ids` without preloading the entire jobs roster.
 *
 * Uses `get_jobs_ledger_by_ids` (broad-access SECURITY DEFINER RPC) so the lookup works for
 * any saved id regardless of current `jobs_ledger.status`.
 */
export async function fetchJobLabelsByIds(ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map()
  const rows = (await withSupabaseRetry(
    async () => supabase.rpc('get_jobs_ledger_by_ids', { p_job_ids: ids }),
    'fetch_dispatch_settings_job_labels_by_ids',
  )) as JobLedgerByIdsRow[] | null
  const map = new Map<string, string>()
  for (const r of rows ?? []) {
    map.set(r.id, formatDispatchSettingsJobLabel(r.hcp_number, r.job_name, r.click_number))
  }
  return map
}

/**
 * Single source of truth for Dispatch Settings job chip / dropdown labels.
 * Standard identity: plain `J` + effective number (HCP, falling back to the
 * Click number — Click-only jobs used to lose their number here) and the
 * app-wide `·` separator.
 *
 * Format priority:
 *   1. `J{num} · {name}` when both are set.
 *   2. `J{num}` when only a number is set.
 *   3. `{name}` when only the job name is set.
 *   4. `(untitled job)` fallback.
 */
export function formatDispatchSettingsJobLabel(
  hcpNumber: string | null,
  jobName: string | null,
  clickNumber?: string | null,
): string {
  const num = effectiveJobLedgerNumber(hcpNumber, clickNumber)
  const name = jobName?.trim() || ''
  if (num && name) return `J${num} · ${name}`
  if (num) return `J${num}`
  if (name) return name
  return '(untitled job)'
}
