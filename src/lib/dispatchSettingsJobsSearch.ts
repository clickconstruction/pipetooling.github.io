import { supabase } from './supabase'
import { withSupabaseRetry } from '../utils/errorHandling'

export type DispatchSettingsJobOption = {
  value: string
  label: string
}

type JobLedgerSearchRow = {
  id: string
  hcp_number: string | null
  job_name: string | null
}

type JobLedgerByIdsRow = {
  id: string
  hcp_number: string | null
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
    label: formatDispatchSettingsJobLabel(r.hcp_number, r.job_name),
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
    map.set(r.id, formatDispatchSettingsJobLabel(r.hcp_number, r.job_name))
  }
  return map
}

/**
 * Single source of truth for Dispatch Settings job chip / dropdown labels.
 *
 * Format priority:
 *   1. `J{hcp} - {name}` when both are set.
 *   2. `J{hcp}` when only the HCP number is set.
 *   3. `{name}` when only the job name is set.
 *   4. `(untitled job)` fallback.
 */
export function formatDispatchSettingsJobLabel(
  hcpNumber: string | null,
  jobName: string | null,
): string {
  const hcp = hcpNumber?.trim() || ''
  const name = jobName?.trim() || ''
  if (hcp && name) return `J${hcp} - ${name}`
  if (hcp) return `J${hcp}`
  if (name) return name
  return '(untitled job)'
}
