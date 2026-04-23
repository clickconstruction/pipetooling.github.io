/** Shared types + label for unified job/bid search (Clock In, Task Dispatch reference, etc.) */

export type JobSearchResult = { id: string; hcp_number: string; job_name: string; job_address: string }
export type BidSearchResult = {
  id: string
  bid_number: string
  project_name: string
  address: string
  customer_name: string
  service_type_name?: string | null
}
/** Row from `search_estimates_for_nav` RPC. */
export type EstimateNavSearchResult = {
  id: string
  estimate_number: number
  title: string
  customer_name: string
  subtitle: string | null
}
export type UnifiedSearchResult =
  | { source: 'job'; id: string; hcp_number: string; job_name: string; job_address: string }
  | { source: 'bid'; id: string; bid_number: string; project_name: string; address: string; customer_name: string; service_type_name?: string | null }
  | {
      source: 'estimate'
      id: string
      estimate_number: number
      title: string
      customer_name: string
      subtitle: string | null
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

export function formatUnifiedResult(r: UnifiedSearchResult): string {
  if (r.source === 'job') {
    const prefix = `J${(r.hcp_number || '').trim() || '—'}`
    return `${prefix} · ${r.job_name || '—'} - ${r.job_address || '—'}`
  }
  if (r.source === 'bid') {
    const prefix = `B${(r.bid_number || '').trim() || '—'}`
    return `${prefix} · ${r.project_name || '—'} - ${r.address || r.customer_name || '—'}`
  }
  const en = r.estimate_number
  const prefix = `E${Number.isFinite(en) ? String(en) : '—'}`
  const tail = (r.subtitle || '').trim() || (r.customer_name || '').trim() || '—'
  return `${prefix} · ${(r.title || '').trim() || '—'} - ${tail}`
}

/** J{hcp} · job name (no address) + trimmed address for two-line schedule quick-picks. */
export function formatUnifiedJobSchedulePrimaryLine(
  r: Extract<UnifiedSearchResult, { source: 'job' }>,
): { title: string; address: string } {
  const prefix = `J${(r.hcp_number || '').trim() || '—'}`
  return {
    title: `${prefix} · ${r.job_name || '—'}`,
    address: (r.job_address || '').trim(),
  }
}
