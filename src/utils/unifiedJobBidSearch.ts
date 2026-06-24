/** Shared types + label for unified job/bid search (Clock In, Task Dispatch reference, etc.) */

import {
  formatBidLedgerNumberLabel,
  formatJobLedgerNumberLabel,
  type LedgerPrefixMap,
  resolveBidLedgerPrefix,
  resolveJobLedgerPrefix,
} from '../lib/ledgerDisplayPrefixes'

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
  Electrical: { tag: 'elec', color: '#FFD700' },
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
  if (t.startsWith('commercial')) return { tag: 'com', color: '#c7d2fe' }
  if (t.startsWith('residential')) return { tag: 'res', color: '#bbf7d0' }
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

export function formatUnifiedResult(r: UnifiedSearchResult, prefixMap: LedgerPrefixMap): string {
  if (r.source === 'job') {
    const pref = resolveJobLedgerPrefix(r.service_type_id ?? null, prefixMap)
    const prefix = formatJobLedgerNumberLabel(pref, r.hcp_number, r.click_number)
    return `${prefix} · ${r.job_name || '—'} - ${r.job_address || '—'}`
  }
  if (r.source === 'bid') {
    const pref = resolveBidLedgerPrefix(r.service_type_id ?? null, prefixMap)
    const prefix = formatBidLedgerNumberLabel(pref, r.bid_number)
    return `${prefix} · ${r.project_name || '—'} - ${r.address || r.customer_name || '—'}`
  }
  if (r.source === 'customer') {
    const name = (r.name ?? '').trim() || '—'
    const addr = (r.address ?? '').trim()
    return addr ? `C · ${name} - ${addr}` : `C · ${name}`
  }
  const en = r.estimate_number
  const prefix = `E${Number.isFinite(en) ? String(en) : '—'}`
  const tail = (r.subtitle || '').trim() || (r.customer_name || '').trim() || '—'
  return `${prefix} · ${(r.title || '').trim() || '—'} - ${tail}`
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
    address: (r.job_address || '').trim(),
  }
}
