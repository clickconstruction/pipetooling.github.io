/**
 * Lean all-jobs search (v2.1825, scoped-load plan PR 4): one no-embed query
 * over every job the caller can see — any status, paid included — returning
 * ids only; the board then fetches full rows for just the hits. Replaces both
 * the search→fetch-every-scope safety net and the # jump's paid-fallback
 * machinery (and retires the v2.1819 "Search Paid in Full too" chip).
 *
 * Matches the flat jobs_ledger columns (number, click number, name, address,
 * customer name — the last is a server-side bonus the client filter never
 * had) and, since v2.6354, the jobs of every development whose name matches:
 * one small read of `developments` first, then their ids ride the same `or`
 * as `development_id.in.(…)`. Before that the name reached a job the board
 * had not loaded only when one of those flat columns also held it. GC names
 * still live on another table and keep matching client-side over loaded rows.
 */
import { supabase } from '../supabase'
import { formatErrorMessage, withSupabaseRetry } from '../../utils/errorHandling'

export const LEAN_JOB_SEARCH_LIMIT = 200

/** Developments read per search: a name matches a handful at most; the cap keeps the `or` short. */
export const LEAN_DEVELOPMENT_MATCH_LIMIT = 50

/**
 * PostgREST `or=` values break on commas/parens/quotes and `*` is the
 * wildcard. Strip the breakers, escape nothing else — a term that loses a
 * comma still matches the same rows in practice (ilike on the remainder).
 */
export function sanitizeLeanSearchTerm(raw: string): string {
  return raw.trim().replace(/[(),"*\\]/g, ' ').replace(/\s+/g, ' ').trim()
}

/** An id the `in.(…)` list can carry unquoted: a uuid, or any id with no comma, paren, quote or space. */
function idSafeInOrList(id: string): boolean {
  return id !== '' && !/[(),"\s]/.test(id)
}

/**
 * The flat-column `or`, plus `development_id.in.(…)` for the developments
 * whose name matched (`fetchDevelopmentIdsMatching`). An id that would break
 * the list is dropped rather than quoted — every real id is a uuid.
 */
export function buildLeanJobSearchOr(term: string, developmentIds: readonly string[] = []): string {
  const t = sanitizeLeanSearchTerm(term)
  const pat = `*${t}*`
  const clauses = [
    `hcp_number.ilike.${pat}`,
    `click_number.ilike.${pat}`,
    `job_name.ilike.${pat}`,
    `job_address.ilike.${pat}`,
    `customer_name.ilike.${pat}`,
  ]
  const ids = developmentIds.filter(idSafeInOrList)
  if (ids.length > 0) clauses.push(`development_id.in.(${ids.join(',')})`)
  return clauses.join(',')
}

/**
 * The developments whose name contains the term, archived ones included (an
 * archived development's jobs still carry its id, and the board's own matcher
 * reads the name either way). RLS scopes the read like every other; a role
 * that sees no developments gets none and the search stays the flat one.
 */
export async function fetchDevelopmentIdsMatching(term: string): Promise<string[]> {
  const t = sanitizeLeanSearchTerm(term)
  if (t.length < 2) return []
  const rows = (await withSupabaseRetry(
    async () => supabase.from('developments').select('id').ilike('name', `%${t}%`).limit(LEAN_DEVELOPMENT_MATCH_LIMIT),
    'lean job search: developments',
  )) as Array<{ id: string }> | null
  return (rows ?? []).map((r) => r.id)
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
  let developmentIds: string[]
  try {
    developmentIds = await fetchDevelopmentIdsMatching(term)
  } catch (e) {
    return { ok: false, error: formatErrorMessage(e, 'Search failed') }
  }
  return runLeanSearch(buildLeanJobSearchOr(term, developmentIds), customerFilter)
}

export async function fetchLeanJobIdsByNumber(
  digits: string,
  customerFilter: string | null,
): Promise<LeanJobSearchResult> {
  if (digits.replace(/\D/g, '') === '') return { ok: true, ids: [] }
  return runLeanSearch(buildLeanJobNumberOr(digits), customerFilter)
}
