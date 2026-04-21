import { supabase } from './supabase'
import { withSupabaseRetry } from '../utils/errorHandling'

export type BidBoardNotesUnreadBidInput = {
  id: string
  customer_id: string | null
}

type ReadStateRow = {
  bid_id: string
  last_seen_bid_submission_at: string | null
  last_seen_customer_contact_at: string | null
}

type SubmissionEntryUnreadRow = {
  bid_id: string
  created_at: string | null
  created_by: string | null
}

type CustomerContactUnreadRow = {
  customer_id: string
  created_at: string | null
  created_by: string | null
}

function isUnreadVersusWatermark(watermark: string | null | undefined, noteCreatedAt: string): boolean {
  if (watermark == null || watermark === '') return true
  return Date.parse(noteCreatedAt) > Date.parse(watermark)
}

/** Pure: per-bid sum of unread bid-submission + customer-contact notes from other users. */
export function computeBidBoardNotesUnreadCounts(
  viewerId: string,
  bids: BidBoardNotesUnreadBidInput[],
  readStateRows: ReadStateRow[],
  submissionEntries: SubmissionEntryUnreadRow[],
  customerContacts: CustomerContactUnreadRow[]
): Record<string, number> {
  const readMap = new Map<
    string,
    { last_seen_bid_submission_at: string | null; last_seen_customer_contact_at: string | null }
  >()
  for (const r of readStateRows) {
    readMap.set(r.bid_id, {
      last_seen_bid_submission_at: r.last_seen_bid_submission_at,
      last_seen_customer_contact_at: r.last_seen_customer_contact_at,
    })
  }

  const submissionByBid = new Map<string, number>()
  for (const row of submissionEntries) {
    if (!row.created_by || row.created_by === viewerId) continue
    const ca = row.created_at
    if (!ca) continue
    const wm = readMap.get(row.bid_id)?.last_seen_bid_submission_at
    if (!isUnreadVersusWatermark(wm, ca)) continue
    submissionByBid.set(row.bid_id, (submissionByBid.get(row.bid_id) ?? 0) + 1)
  }

  const bidsByCustomer = new Map<string, string[]>()
  for (const bid of bids) {
    if (bid.customer_id) {
      const list = bidsByCustomer.get(bid.customer_id)
      if (list) list.push(bid.id)
      else bidsByCustomer.set(bid.customer_id, [bid.id])
    }
  }

  const customerByBid = new Map<string, number>()
  for (const row of customerContacts) {
    if (!row.created_by || row.created_by === viewerId) continue
    const ca = row.created_at
    if (!ca) continue
    const bidIds = bidsByCustomer.get(row.customer_id) ?? []
    for (const bidId of bidIds) {
      const wm = readMap.get(bidId)?.last_seen_customer_contact_at
      if (!isUnreadVersusWatermark(wm, ca)) continue
      customerByBid.set(bidId, (customerByBid.get(bidId) ?? 0) + 1)
    }
  }

  const out: Record<string, number> = {}
  for (const bid of bids) {
    out[bid.id] = (submissionByBid.get(bid.id) ?? 0) + (customerByBid.get(bid.id) ?? 0)
  }
  return out
}

export async function fetchBidBoardNotesUnreadCounts(
  viewerId: string,
  bids: BidBoardNotesUnreadBidInput[]
): Promise<Record<string, number>> {
  if (!viewerId || bids.length === 0) return {}

  const uniqueBidsById = new Map<string, BidBoardNotesUnreadBidInput>()
  for (const b of bids) uniqueBidsById.set(b.id, b)
  const uniqueBids = [...uniqueBidsById.values()]
  const bidIds = uniqueBids.map((b) => b.id)

  const [readStateRows, submissionEntries] = await Promise.all([
    withSupabaseRetry(
      async () =>
        supabase
          .from('user_bid_notes_read_state')
          .select('bid_id, last_seen_bid_submission_at, last_seen_customer_contact_at')
          .eq('user_id', viewerId)
          .in('bid_id', bidIds),
      'load bid board notes read state'
    ),
    withSupabaseRetry(
      async () =>
        supabase.from('bids_submission_entries').select('bid_id, created_at, created_by').in('bid_id', bidIds),
      'load bid board submission entries for unread counts'
    ),
  ])

  const customerIds = [
    ...new Set(uniqueBids.map((b) => b.customer_id).filter((cid): cid is string => cid != null && cid !== '')),
  ]

  let customerContacts: CustomerContactUnreadRow[] = []
  if (customerIds.length > 0) {
    customerContacts =
      (await withSupabaseRetry(
        async () =>
          supabase
            .from('customer_contacts')
            .select('customer_id, created_at, created_by')
            .in('customer_id', customerIds),
        'load customer contacts for bid board unread counts'
      )) ?? []
  }

  return computeBidBoardNotesUnreadCounts(
    viewerId,
    uniqueBids,
    (readStateRows ?? []) as ReadStateRow[],
    (submissionEntries ?? []) as SubmissionEntryUnreadRow[],
    customerContacts
  )
}
