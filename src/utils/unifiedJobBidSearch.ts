/** Shared types + label for unified job/bid search (Clock In, Task Dispatch reference, etc.) */

import {
  DEFAULT_BID_LEDGER_PREFIX,
  DEFAULT_JOB_LEDGER_PREFIX,
  formatBidLedgerNumberLabel,
  formatJobLedgerNumberLabel,
  type LedgerPrefixMap,
  resolveBidLedgerPrefix,
  resolveJobLedgerPrefix,
} from '../lib/ledgerDisplayPrefixes'
import { stripTrailingZip } from '../lib/displayAddress'

export type JobSearchResult = {
  id: string
  hcp_number: string
  click_number?: string | null
  job_name: string
  job_address: string
  service_type_id?: string | null
  service_type_name?: string | null
}
export type BidSearchResult = {
  id: string
  bid_number: string
  project_name: string
  address: string
  customer_name: string
  service_type_name?: string | null
  service_type_id?: string | null
}
/** Row from `search_estimates_for_nav` RPC. */
export type EstimateNavSearchResult = {
  id: string
  estimate_number: number
  title: string
  customer_name: string
  subtitle: string | null
}
/** Row from the header search's client-side `customers` query. */
export type CustomerSearchResult = {
  id: string
  name: string | null
  address: string | null
  customer_type: string | null
}
export type UnifiedSearchResult =
  | {
      source: 'job'
      id: string
      hcp_number: string
      click_number?: string | null
      job_name: string
      job_address: string
      service_type_id?: string | null
      service_type_name?: string | null
    }
  | {
      source: 'bid'
      id: string
      bid_number: string
      project_name: string
      address: string
      customer_name: string
      service_type_name?: string | null
      service_type_id?: string | null
    }
  | {
      source: 'estimate'
      id: string
      estimate_number: number
      title: string
      customer_name: string
      subtitle: string | null
    }
  | {
      source: 'customer'
      id: string
      name: string | null
      address: string | null
      customer_type: string | null
    }

export const BID_SERVICE_TYPE_TAGS: Record<string, { tag: string; color: string }> = {
  Plumbing: { tag: 'plum', color: '#e17235' },
  // Amber-orange (owner-picked, 2026-08-11) — the old #FFD700 gold was "too
  // yellow" and white pill text was unreadable on it.
  Electrical: { tag: 'elec', color: '#EE9310' },
  HVAC: { tag: 'hvac', color: '#06b6d4' },
}

export function getBidServiceTypeTag(serviceTypeName: string | null | undefined): { tag: string; color: string } | null {
  if (!serviceTypeName?.trim()) return null
  return BID_SERVICE_TYPE_TAGS[serviceTypeName.trim()] ?? null
}

/** Trade pill for unified job/bid rows (estimates and customers have no service type here). */
export function serviceTypeTagForUnifiedRow(r: UnifiedSearchResult): { tag: string; color: string } | null {
  if (r.source === 'estimate' || r.source === 'customer') return null
  return getBidServiceTypeTag(r.service_type_name)
}

/** Customer-type pill (distinct palette from the trade pills); null for non-customer / unknown type. */
export function customerTypePillForUnifiedRow(r: UnifiedSearchResult): { tag: string; color: string } | null {
  if (r.source !== 'customer') return null
  const t = (r.customer_type ?? '').toLowerCase()
  if (t.startsWith('commercial')) return { tag: 'com', color: 'var(--bg-indigo-200)' }
  if (t.startsWith('residential')) return { tag: 'res', color: 'var(--bg-green-200)' }
  return null
}

/**
 * Escape a user query before interpolating into a PostgREST `ilike` pattern: neutralizes LIKE
 * wildcards (`% _`) and the `.or()` / filter delimiters (`, ( )`) so punctuation in a name can
 * neither over-match nor 400 the request.
 */
export function escapeLike(s: string): string {
  return s.replace(/[%_,()\\]/g, (m) => '\\' + m)
}

/**
 * The identity label split at the " - " joint: `title` is "{prefix} · {name}",
 * `secondary` the address (bids/estimates fall back to customer/subtitle) or
 * null when there is none. `formatUnifiedResult` joins these — rows that give
 * the address its own line (splitAddressLine) consume the parts directly.
 */
export function formatUnifiedResultSplit(
  r: UnifiedSearchResult,
  prefixMap: LedgerPrefixMap,
  opts?: {
    /** Plain J/B prefixes instead of the per-service-type ones (e.g. JP/BP) — for rows
     * that already render a trade pill, where the trade letter would be redundant. */
    plainTradePrefixes?: boolean
  },
): { title: string; secondary: string | null } {
  if (r.source === 'job') {
    const pref = opts?.plainTradePrefixes
      ? DEFAULT_JOB_LEDGER_PREFIX
      : resolveJobLedgerPrefix(r.service_type_id ?? null, prefixMap)
    const prefix = formatJobLedgerNumberLabel(pref, r.hcp_number, r.click_number)
    return { title: `${prefix} · ${r.job_name || '—'}`, secondary: stripTrailingZip(r.job_address) || null }
  }
  if (r.source === 'bid') {
    const pref = opts?.plainTradePrefixes
      ? DEFAULT_BID_LEDGER_PREFIX
      : resolveBidLedgerPrefix(r.service_type_id ?? null, prefixMap)
    const prefix = formatBidLedgerNumberLabel(pref, r.bid_number)
    return { title: `${prefix} · ${r.project_name || '—'}`, secondary: stripTrailingZip(r.address) || r.customer_name || null }
  }
  if (r.source === 'customer') {
    const name = (r.name ?? '').trim() || '—'
    return { title: `C · ${name}`, secondary: stripTrailingZip(r.address) || null }
  }
  const en = r.estimate_number
  const prefix = `E${Number.isFinite(en) ? String(en) : '—'}`
  const tail = (r.subtitle || '').trim() || (r.customer_name || '').trim() || null
  return { title: `${prefix} · ${(r.title || '').trim() || '—'}`, secondary: tail }
}

export function formatUnifiedResult(
  r: UnifiedSearchResult,
  prefixMap: LedgerPrefixMap,
  opts?: {
    /** Plain J/B prefixes instead of the per-service-type ones (e.g. JP/BP) — for rows
     * that already render a trade pill, where the trade letter would be redundant. */
    plainTradePrefixes?: boolean
  },
): string {
  const { title, secondary } = formatUnifiedResultSplit(r, prefixMap, opts)
  // Customers historically omit the " - —" tail when address-less; the other
  // sources keep it (byte-identical to the pre-split output).
  if (r.source === 'customer') return secondary ? `${title} - ${secondary}` : title
  return `${title} - ${secondary ?? '—'}`
}

/** `{prefix}{hcp} · job name` (no address) + trimmed address for two-line schedule quick-picks. */
export function formatUnifiedJobSchedulePrimaryLine(
  r: Extract<UnifiedSearchResult, { source: 'job' }>,
  prefixMap: LedgerPrefixMap,
): { title: string; address: string } {
  const pref = resolveJobLedgerPrefix(r.service_type_id ?? null, prefixMap)
  const prefix = formatJobLedgerNumberLabel(pref, r.hcp_number, r.click_number)
  return {
    title: `${prefix} · ${r.job_name || '—'}`,
    address: stripTrailingZip(r.job_address),
  }
}
