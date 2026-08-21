/**
 * Bid GC recipients (bid-recipients train PR 2): shared shapes + the pure
 * per-recipient expansion the Followup lenses use, plus the one fetch that
 * builds the bid → recipients map. A bid sent to three GCs should surface in
 * three call queues; the outcome stays per-bid, so working it under any GC
 * clears it everywhere.
 */

import { supabase } from '../supabase'

export type BidGcRecipient = {
  customerId: string
  name: string
  phone: string | null
}

/** bid_id → recipient GCs (the bid-level primary GC is never in this list). */
export type BidGcRecipientsMap = Record<string, BidGcRecipient[]>

type RecipientRow = {
  bid_id: string
  customer_id: string
  customers: { id: string; name: string | null; contact_info: unknown } | { id: string; name: string | null; contact_info: unknown }[] | null
}

function phoneFromContactInfo(info: unknown): string | null {
  if (!info || typeof info !== 'object') return null
  const phone = (info as { phone?: unknown }).phone
  return typeof phone === 'string' && phone.trim() ? phone.trim() : null
}

/**
 * Fetch every bid's recipient list in one query. Degrades to an empty map when
 * the table isn't deployed yet (client ahead of migration) or the read fails —
 * callers render the single-GC world they had before.
 */
export async function fetchBidGcRecipientsMap(): Promise<BidGcRecipientsMap> {
  try {
    const { data, error } = await (supabase as never as {
      from: (t: string) => {
        select: (c: string) => Promise<{ data: RecipientRow[] | null; error: { message: string } | null }>
      }
    })
      .from('bid_gc_recipients')
      .select('bid_id, customer_id, customers(id, name, contact_info)')
    if (error || !data) return {}
    const map: BidGcRecipientsMap = {}
    for (const row of data) {
      const customer = Array.isArray(row.customers) ? row.customers[0] ?? null : row.customers
      if (!customer) continue
      const list = map[row.bid_id] ?? (map[row.bid_id] = [])
      list.push({
        customerId: customer.id,
        name: (customer.name ?? '').trim() || 'Unknown customer',
        phone: phoneFromContactInfo(customer.contact_info),
      })
    }
    return map
  } catch {
    return {}
  }
}

/** The lens-entry fields the expansion rewrites per recipient. */
export type RecipientExpandable = {
  builderKey: string
  builderName: string
}

export type RecipientExpanded<T extends RecipientExpandable> = T & {
  /** Set on recipient copies; null on the primary-GC entry. */
  viaRecipient: BidGcRecipient | null
}

/**
 * Expand one lens entry into per-GC copies: the primary entry plus one copy
 * per recipient (keyed by the recipient's customer id). Recipients matching
 * the primary key are skipped — the primary GC is implied, never duplicated.
 */
export function expandLensBidByRecipients<T extends RecipientExpandable>(
  entry: T,
  recipients: readonly BidGcRecipient[] | undefined,
): RecipientExpanded<T>[] {
  const out: RecipientExpanded<T>[] = [{ ...entry, viaRecipient: null }]
  for (const r of recipients ?? []) {
    if (r.customerId === entry.builderKey) continue
    out.push({ ...entry, builderKey: r.customerId, builderName: r.name, viaRecipient: r })
  }
  return out
}
