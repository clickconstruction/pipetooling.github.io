/** Shared types + label for unified job/bid search (Clock In, Task Dispatch reference, etc.) */

export type JobSearchResult = { id: string; hcp_number: string; job_name: string; job_address: string }
export type BidSearchResult = {
  id: string
  bid_number: string
  project_name: string
  address: string
  customer_name: string
}
export type UnifiedSearchResult =
  | { source: 'job'; id: string; hcp_number: string; job_name: string; job_address: string }
  | { source: 'bid'; id: string; bid_number: string; project_name: string; address: string; customer_name: string }

export function formatUnifiedResult(r: UnifiedSearchResult): string {
  if (r.source === 'job') {
    const prefix = `J${(r.hcp_number || '').trim() || '—'}`
    return `${prefix} · ${r.job_name || '—'} - ${r.job_address || '—'}`
  }
  const prefix = `B${(r.bid_number || '').trim() || '—'}`
  return `${prefix} · ${r.project_name || '—'} - ${r.address || r.customer_name || '—'}`
}
