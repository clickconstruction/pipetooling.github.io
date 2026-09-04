/**
 * Bid Board ↔ job links (v2.2741). Estimators cannot see jobs, so the J#### link on the board is
 * shown only to the roles that can open one; the kernel is the single place that rule lives.
 */
export type BidBoardJobLink = { jobId: string; hcpNumber: string }

const JOB_LINK_ROLES = new Set(['dev', 'master_technician', 'assistant', 'controller'])

/** Who sees J#### chips on the Bid Board — the roles that can open Jobs. */
export function canSeeBidBoardJobLinks(role: string | null | undefined): boolean {
  return role != null && JOB_LINK_ROLES.has(role)
}

/** "J1234" from a ledger hcp_number; tolerates a stored "J1234" or blanks. */
export function bidBoardJobLinkLabel(hcpNumber: string | null | undefined): string {
  const raw = (hcpNumber ?? '').trim().replace(/^[jJ]\s*/, '')
  return raw ? `J${raw}` : 'Job'
}

/** Index jobs by the bid they came from — one chip per bid (the newest job wins a tie). */
export function indexJobsByBidId(
  rows: ReadonlyArray<{ id: string; hcp_number: string | null; bid_id: string | null; created_at?: string | null }>,
): Map<string, BidBoardJobLink> {
  const out = new Map<string, BidBoardJobLink>()
  const sorted = [...rows].sort((a, b) => String(a.created_at ?? '').localeCompare(String(b.created_at ?? '')))
  for (const r of sorted) {
    if (!r.bid_id) continue
    out.set(r.bid_id, { jobId: r.id, hcpNumber: r.hcp_number ?? '' })
  }
  return out
}
