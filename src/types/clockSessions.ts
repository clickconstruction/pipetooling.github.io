export type ClockSessionRow = {
  id: string
  user_id: string
  clocked_in_at: string
  clocked_out_at: string | null
  work_date: string
  notes: string
  job_ledger_id: string | null
  bid_id: string | null
  clock_in_lat: number | null
  clock_in_lng: number | null
  clock_out_lat: number | null
  clock_out_lng: number | null
  approved_at: string | null
  approved_by: string | null
  rejected_at: string | null
  rejected_by: string | null
  revoked_at: string | null
  revoked_by: string | null
  users: { name: string | null } | null
  approved_by_user: { name: string | null } | null
  rejected_by_user: { name: string | null } | null
  revoked_by_user: { name: string | null } | null
  jobs_ledger: { hcp_number: string | null; job_name: string | null; job_address: string | null } | null
  bids: { bid_number: string | null; project_name: string | null; address: string | null; customers: { name: string | null } | null } | null
}

export type ClockSessionJobBidEmbeds = Pick<ClockSessionRow, 'jobs_ledger' | 'bids'>

/** Two-line label for Session actions modal: HCP · name, then address (or bid equivalent). */
export function formatClockSessionJobOrBidModalLinesFromEmbeds(
  embeds: ClockSessionJobBidEmbeds,
): { line1: string; line2: string | null } | null {
  if (embeds.jobs_ledger) {
    const hcp = (embeds.jobs_ledger.hcp_number || '').trim() || '—'
    const name = (embeds.jobs_ledger.job_name || '—').trim()
    const addr = (embeds.jobs_ledger.job_address || '').trim()
    return {
      line1: `J${hcp} · ${name}`,
      line2: addr.length > 0 ? addr : null,
    }
  }
  if (embeds.bids) {
    const bn = (embeds.bids.bid_number || '').trim() || '—'
    const pn = (embeds.bids.project_name || '—').trim()
    const addr = (embeds.bids.address || embeds.bids.customers?.name || '').trim()
    return {
      line1: `B${bn} · ${pn}`,
      line2: addr.length > 0 ? addr : null,
    }
  }
  return null
}

/** Full job/bid one-line label from embedded rows only. */
export function formatClockSessionJobOrBidLabelFromEmbeds(embeds: ClockSessionJobBidEmbeds): string | null {
  if (embeds.jobs_ledger) {
    return `J${(embeds.jobs_ledger.hcp_number || '').trim() || '—'} · ${embeds.jobs_ledger.job_name || '—'} - ${embeds.jobs_ledger.job_address || '—'}`
  }
  if (embeds.bids) {
    return `B${(embeds.bids.bid_number || '').trim() || '—'} · ${embeds.bids.project_name || '—'} - ${embeds.bids.address || embeds.bids.customers?.name || '—'}`
  }
  return null
}

/** Short label for dense tables (e.g. clock strip). */
export function shortJobOrBidLabelFromEmbeds(embeds: ClockSessionJobBidEmbeds): string | null {
  if (embeds.jobs_ledger) {
    const hcp = (embeds.jobs_ledger.hcp_number || '').trim() || '—'
    const name = (embeds.jobs_ledger.job_name || '—').trim()
    return `J${hcp} · ${name}`
  }
  if (embeds.bids) {
    const bn = (embeds.bids.bid_number || '').trim() || '—'
    const pn = (embeds.bids.project_name || '—').trim()
    return `B${bn} · ${pn}`
  }
  return null
}

/** Job or bid one-line label for display; null if neither is linked. */
export function formatClockSessionJobOrBidLabel(s: ClockSessionRow): string | null {
  return formatClockSessionJobOrBidLabelFromEmbeds(s)
}
