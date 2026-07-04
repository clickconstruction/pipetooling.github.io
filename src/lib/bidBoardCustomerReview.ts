import { getSubmissionSectionKey, type SubmissionSectionKey } from './bids/submissionSections'

/**
 * Pure kernel for the Bid Board → Customer review modal: groups bids by
 * customer (customers row, legacy gc-builder fallback, or "No customer"),
 * counts bids per submission section, and merges per-bid estimating hours
 * (RPC list_bid_estimators_all_time_hours) + per-customer job hours
 * (RPC list_customer_review_job_hours). No React, no Supabase.
 */

export type CustomerReviewBidInput = {
  id: string
  outcome: string | null
  bid_date_sent: string | null
  customerId: string | null
  customerName: string | null
  gcBuilderId: string | null
  gcBuilderName: string | null
}

export type CustomerReviewBidHoursRow = { bid_id: string; hours: number | string | null }

export type CustomerReviewJobHoursRow = {
  customer_id: string
  customer_name: string | null
  hours: number | string | null
}

export type CustomerReviewSectionCounts = Record<SubmissionSectionKey, number>

export type CustomerReviewRow = {
  /** Stable group key: `c:{customerId}`, `g:{gcBuilderId}`, or `none`. */
  key: string
  customerName: string
  counts: CustomerReviewSectionCounts
  totalBids: number
  estimatingHours: number
  jobHours: number
  totalHours: number
}

export const CUSTOMER_REVIEW_NO_CUSTOMER_LABEL = 'No customer'

export function customerReviewGroupKey(bid: Pick<CustomerReviewBidInput, 'customerId' | 'gcBuilderId'>): string {
  if (bid.customerId) return `c:${bid.customerId}`
  if (bid.gcBuilderId) return `g:${bid.gcBuilderId}`
  return 'none'
}

function toFiniteHours(value: number | string | null): number {
  const n = typeof value === 'string' ? Number(value) : value
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : 0
}

function emptyCounts(): CustomerReviewSectionCounts {
  return { unsent: 0, pending: 0, won: 0, startedOrComplete: 0, lost: 0 }
}

export function buildCustomerReviewRows(
  bids: CustomerReviewBidInput[],
  bidHours: CustomerReviewBidHoursRow[],
  jobHours: CustomerReviewJobHoursRow[],
): CustomerReviewRow[] {
  const hoursByBidId = new Map<string, number>()
  for (const r of bidHours) {
    if (!r.bid_id) continue
    hoursByBidId.set(r.bid_id, (hoursByBidId.get(r.bid_id) ?? 0) + toFiniteHours(r.hours))
  }

  const rowsByKey = new Map<string, CustomerReviewRow>()
  const ensureRow = (key: string, name: string): CustomerReviewRow => {
    let row = rowsByKey.get(key)
    if (!row) {
      row = { key, customerName: name, counts: emptyCounts(), totalBids: 0, estimatingHours: 0, jobHours: 0, totalHours: 0 }
      rowsByKey.set(key, row)
    }
    return row
  }

  for (const bid of bids) {
    const key = customerReviewGroupKey(bid)
    const name = bid.customerName?.trim() || bid.gcBuilderName?.trim() || CUSTOMER_REVIEW_NO_CUSTOMER_LABEL
    const row = ensureRow(key, name)
    const section = getSubmissionSectionKey(bid)
    if (section) row.counts[section] += 1
    row.totalBids += 1
    row.estimatingHours += hoursByBidId.get(bid.id) ?? 0
  }

  // Customers with job hours but no bids still get a row — the review is
  // "hours per customer across estimating and jobs", not bids-only.
  for (const r of jobHours) {
    if (!r.customer_id) continue
    const row = ensureRow(`c:${r.customer_id}`, r.customer_name?.trim() || CUSTOMER_REVIEW_NO_CUSTOMER_LABEL)
    row.jobHours += toFiniteHours(r.hours)
  }

  const rows = [...rowsByKey.values()]
  for (const row of rows) row.totalHours = row.estimatingHours + row.jobHours
  rows.sort(
    (a, b) =>
      b.totalHours - a.totalHours ||
      b.totalBids - a.totalBids ||
      a.customerName.localeCompare(b.customerName, undefined, { sensitivity: 'base' }),
  )
  return rows
}

export function filterCustomerReviewRows(rows: CustomerReviewRow[], query: string): CustomerReviewRow[] {
  const q = query.trim().toLowerCase()
  if (!q) return rows
  return rows.filter((r) => r.customerName.toLowerCase().includes(q))
}

export function sumCustomerReviewRows(rows: CustomerReviewRow[]): CustomerReviewRow {
  const total: CustomerReviewRow = {
    key: 'total',
    customerName: 'Total',
    counts: emptyCounts(),
    totalBids: 0,
    estimatingHours: 0,
    jobHours: 0,
    totalHours: 0,
  }
  for (const r of rows) {
    total.counts.unsent += r.counts.unsent
    total.counts.pending += r.counts.pending
    total.counts.won += r.counts.won
    total.counts.startedOrComplete += r.counts.startedOrComplete
    total.counts.lost += r.counts.lost
    total.totalBids += r.totalBids
    total.estimatingHours += r.estimatingHours
    total.jobHours += r.jobHours
    total.totalHours += r.totalHours
  }
  return total
}

/** "—" for zero; one decimal under 10h; whole hours with thousands separators above. */
export function formatCustomerReviewHours(hours: number): string {
  if (!Number.isFinite(hours) || hours <= 0) return '—'
  if (hours < 10) {
    const s = hours.toFixed(1)
    return s.endsWith('.0') ? s.slice(0, -2) : s
  }
  return Math.round(hours).toLocaleString('en-US')
}
