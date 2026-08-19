/**
 * Lean all-jobs search (v2.1825, scoped-load plan PR 4): one no-embed query
 * over every job the caller can see — any status, paid included — returning
 * ids only; the board then fetches full rows for just the hits. Replaces both
 * the search→fetch-every-scope safety net and the # jump's paid-fallback
 * machinery (and retires the v2.1819 "Search Paid in Full too" chip).
 *
 * Matches the flat jobs_ledger columns (number, click number, name, address,
 * customer name — the last is a server-side bonus the client filter never
 * had); GC/development names live on other tables and keep matching
 * client-side over loaded rows.
 */
import { supabase } from '../supabase'
import { formatErrorMessage, withSupabaseRetry } from '../../utils/errorHandling'

export const LEAN_JOB_SEARCH_LIMIT = 200

/**
 * PostgREST `or=` values break on commas/parens/quotes and `*` is the
 * wildcard. Strip the breakers, escape nothing else — a term that loses a
 * comma still matches the same rows in practice (ilike on the remainder).
 */
export function sanitizeLeanSearchTerm(raw: string): string {
  return raw.trim().replace(/[(),"*\\]/g, ' ').replace(/\s+/g, ' ').trim()
}

export function buildLeanJobSearchOr(term: string): string {
  const t = sanitizeLeanSearchTerm(term)
  const pat = `*${t}*`
  return [
    `hcp_number.ilike.${pat}`,
    `click_number.ilike.${pat}`,
    `job_name.ilike.${pat}`,
    `job_address.ilike.${pat}`,
    `customer_name.ilike.${pat}`,
  ].join(',')
}

/** Digits-only variant for the # jump: prefix match on the two number columns. */
export function buildLeanJobNumberOr(digits: string): string {
  const d = digits.replace(/\D/g, '')
  return [`hcp_number.ilike.${d}*`, `click_number.ilike.${d}*`].join(',')
}

export type LeanJobSearchResult =
  | { ok: true; ids: string[] }
  | { ok: false; error: string }

async function runLeanSearch(orExpr: string, customerFilter: string | null): Promise<LeanJobSearchResult> {
  try {
    let q = supabase.from('jobs_ledger').select('id').or(orExpr).limit(LEAN_JOB_SEARCH_LIMIT)
    if (customerFilter) q = q.eq('customer_id', customerFilter)
    const rows = (await withSupabaseRetry(async () => q, 'lean job search')) as Array<{ id: string }> | null
    return { ok: true, ids: (rows ?? []).map((r) => r.id) }
  } catch (e) {
    return { ok: false, error: formatErrorMessage(e, 'Search failed') }
  }
}

export async function fetchLeanJobSearchIds(
  term: string,
  customerFilter: string | null,
): Promise<LeanJobSearchResult> {
  if (sanitizeLeanSearchTerm(term).length < 2) return { ok: true, ids: [] }
  return runLeanSearch(buildLeanJobSearchOr(term), customerFilter)
}

export async function fetchLeanJobIdsByNumber(
  digits: string,
  customerFilter: string | null,
): Promise<LeanJobSearchResult> {
  if (digits.replace(/\D/g, '') === '') return { ok: true, ids: [] }
  return runLeanSearch(buildLeanJobNumberOr(digits), customerFilter)
}
