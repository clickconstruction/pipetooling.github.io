/**
 * Job accounts on the Bid Board (to-dos/bid-board-job-accounts, PR 1a): the
 * page reads `list_bid_job_account_strip` ONCE for every won bid and each won
 * row draws a compact chip cluster from its share. This kernel is the reading:
 * grouping by bid, the chip's word per house, which houses are still missing,
 * and the count the Won section's header shows. Pure; the RPC and the hook
 * (`useBidBoardJobAccountStrips`) stay outside.
 */
import type { BidJobAccountRow } from '../../hooks/useBidJobAccountStrip'

export type JobAccountChipState = 'open' | 'requested' | 'not_needed' | 'none'

export function chipStateOf(row: Pick<BidJobAccountRow, 'status'>): JobAccountChipState {
  if (row.status === 'open') return 'open'
  if (row.status === 'requested') return 'requested'
  if (row.status === 'not_needed') return 'not_needed'
  return 'none'
}

/** The compact label: `Ferguson ✓` · `Moore Supply · asked` · `Reece · quoted` · `Reece · not needed` · `Reece`. */
export function houseChipLabel(row: Pick<BidJobAccountRow, 'house_name' | 'status' | 'quoted'>): string {
  const state = chipStateOf(row)
  if (state === 'open') return `${row.house_name} ✓`
  if (state === 'requested') return `${row.house_name} · asked`
  if (state === 'not_needed') return `${row.house_name} · not needed`
  return row.quoted ? `${row.house_name} · quoted` : row.house_name
}

/** A house still owes the job an account: neither open nor marked not needed. */
export function houseIsMissing(row: Pick<BidJobAccountRow, 'status'>): boolean {
  const s = chipStateOf(row)
  return s !== 'open' && s !== 'not_needed'
}

/** `list_bid_job_account_strip` rows, one list per bid, in the order the RPC returned them. */
export function groupStripRowsByBid(rows: readonly BidJobAccountRow[]): Map<string, BidJobAccountRow[]> {
  const m = new Map<string, BidJobAccountRow[]>()
  for (const r of rows) {
    const list = m.get(r.bid_id)
    if (list) list.push(r)
    else m.set(r.bid_id, [r])
  }
  return m
}

/** The linked job a bid's rows name, or null when no job exists yet. */
export function stripJob(rows: readonly BidJobAccountRow[]): { id: string; hcpNumber: string | null; clickNumber: string | null; name: string | null } | null {
  const r = rows.find((x) => x.job_id)
  return r && r.job_id ? { id: r.job_id, hcpNumber: r.job_hcp_number, clickNumber: r.job_click_number, name: r.job_name } : null
}

/** The houses on the bid's job, in RPC order; empty when there is no job yet. */
export function housesOnJob(rows: readonly BidJobAccountRow[]): BidJobAccountRow[] {
  const job = stripJob(rows)
  return job ? rows.filter((r) => r.job_id === job.id) : []
}

export function missingHouses(rows: readonly BidJobAccountRow[]): BidJobAccountRow[] {
  return housesOnJob(rows).filter(houseIsMissing)
}

/** How many of these bids have a job with at least one house still missing an account — the Won header's count. */
export function countBidsMissingAccounts(bidIds: readonly string[], byBid: ReadonlyMap<string, BidJobAccountRow[]>): number {
  let n = 0
  for (const id of bidIds) {
    const rows = byBid.get(id)
    if (rows && missingHouses(rows).length > 0) n++
  }
  return n
}

export function missingAccountsHeaderNote(count: number): string | null {
  if (count <= 0) return null
  return `${count} missing job account${count === 1 ? '' : 's'}`
}
