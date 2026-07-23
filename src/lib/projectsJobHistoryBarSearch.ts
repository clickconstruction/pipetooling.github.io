/**
 * Projects → Job History: client-side search filter for Gantt bars.
 *
 * Tiny pure helpers used by the page-level toolbar's search `<input>` to filter which bars
 * the timeline renders. Match semantics:
 *
 *  - **Substring**, case-insensitive, on the user's normalized query.
 *  - Fields searched per bar:
 *      1. The full display label (`{prefix}{hcpNumber} · {jobName}`, e.g. `JP740 · San Marcos`).
 *      2. The raw `hcpNumber` alone (lets the user just type `740`).
 *      3. The bar's `serviceTypeId`-resolved prefix + raw number (e.g. `JP740`) — same as #1 minus the name.
 *      4. The raw `jobName`.
 *      5. The raw `jobAddress`.
 *  - Empty / whitespace-only query → match everything (no filtering).
 *
 * The helper is intentionally generic over the bar shape so we don't have to import
 * `ProjectsJobHistoryBar` from the page-level data module — anything with the five field
 * names below works.
 */

import {
  formatJobLedgerNumberLabel,
  resolveJobLedgerPrefix,
  type LedgerPrefixMap,
} from './ledgerDisplayPrefixes'

export type BarSearchInput = {
  hcpNumber: string
  clickNumber?: string | null
  jobName: string
  jobAddress: string
  serviceTypeId: string | null
}

/** Lowercase + collapse runs of whitespace + trim. Returns `''` when the input is blank. */
export function normalizeBarSearchQuery(raw: string | null | undefined): string {
  if (typeof raw !== 'string') return ''
  const trimmed = raw.trim()
  if (trimmed.length === 0) return ''
  return trimmed.toLowerCase().replace(/\s+/g, ' ')
}

/**
 * Returns `true` if `bar` matches `query`. The query is normalized via
 * `normalizeBarSearchQuery`; if the result is empty, this function returns `true` (no
 * filtering). The match is a case-insensitive substring across the five fields described in
 * the module doc-comment.
 */
export function barMatchesSearch<T extends BarSearchInput>(
  bar: T,
  query: string,
  prefixMap: LedgerPrefixMap,
): boolean {
  const q = normalizeBarSearchQuery(query)
  if (q.length === 0) return true

  const prefix = resolveJobLedgerPrefix(bar.serviceTypeId, prefixMap)
  const hcpLabel = formatJobLedgerNumberLabel(prefix, bar.hcpNumber, bar.clickNumber)
  const jobName = (bar.jobName ?? '').trim()
  const jobAddress = (bar.jobAddress ?? '').trim()

  const fields = [
    `${hcpLabel} · ${jobName || '—'}`,
    hcpLabel,
    bar.hcpNumber ?? '',
    jobName,
    jobAddress,
  ]

  for (const f of fields) {
    if (f && f.toLowerCase().includes(q)) return true
  }
  return false
}

/**
 * Convenience wrapper: filter a readonly array of bars in one go. Returns the same array
 * reference when the query is empty so callers can fast-path the no-op case.
 */
export function filterBarsBySearch<T extends BarSearchInput>(
  bars: readonly T[],
  query: string,
  prefixMap: LedgerPrefixMap,
): readonly T[] {
  if (normalizeBarSearchQuery(query).length === 0) return bars
  return bars.filter((b) => barMatchesSearch(b, query, prefixMap))
}
