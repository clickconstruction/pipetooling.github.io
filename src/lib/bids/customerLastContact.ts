/**
 * Shared "when did we last talk to this builder" kernel (v2.1385).
 *
 * The Builder Review surface previously computed this twice inline (sort memo
 * + per-card display) with subtly different comparison code. This is the one
 * definition: the latest instant across THREE sources —
 *   1. customer_contacts.contact_date rows for the customer (General contact log)
 *   2. bids.last_contact for every bid of the customer
 *   3. the newest bids_submission_entries.occurred_at per bid (precomputed map)
 *
 * Note: Submission & Followup's per-bid "Last update"
 * (src/lib/submissionFollowupStale.ts) intentionally ignores bids.last_contact;
 * this customer-level kernel intentionally includes it — a phone call logged on
 * the bid form still counts as talking to the builder.
 */

export type CustomerLastContactBid = {
  id: string
  customer_id: string | null
  last_contact: string | null
}

export type CustomerLastContactRow = {
  customer_id: string
  contact_date: string
}

function laterIso(a: string | null, b: string): string {
  if (a === null) return b
  return new Date(b).getTime() > new Date(a).getTime() ? b : a
}

/**
 * One pass over bids + contacts → Map of customerId to latest-contact ISO
 * (null-free: customers with no contact at all simply have no entry).
 */
export function buildCustomerLastContactMap(
  bids: CustomerLastContactBid[],
  customerContacts: CustomerLastContactRow[],
  lastContactFromEntries: Record<string, string>,
): Map<string, string> {
  const map = new Map<string, string>()
  const set = (customerId: string, iso: string) => {
    if (!iso || Number.isNaN(new Date(iso).getTime())) return
    map.set(customerId, laterIso(map.get(customerId) ?? null, iso))
  }
  for (const c of customerContacts) {
    if (c.customer_id) set(c.customer_id, c.contact_date)
  }
  for (const b of bids) {
    if (!b.customer_id) continue
    if (b.last_contact) set(b.customer_id, b.last_contact)
    const entryIso = lastContactFromEntries[b.id]
    if (entryIso) set(b.customer_id, entryIso)
  }
  return map
}

/** Sort comparator for the call queue: oldest contact first (asc) with never-contacted customers always LAST, ties alphabetical. */
export function compareCustomersByLastContact(
  a: { id: string; name: string },
  b: { id: string; name: string },
  lastContactMap: Map<string, string>,
  order: 'oldest-first' | 'newest-first',
): number {
  const aIso = lastContactMap.get(a.id) ?? null
  const bIso = lastContactMap.get(b.id) ?? null
  if (!aIso && !bIso) return a.name.localeCompare(b.name)
  if (!aIso) return 1
  if (!bIso) return -1
  const diff = new Date(aIso).getTime() - new Date(bIso).getTime()
  if (diff !== 0) return order === 'oldest-first' ? diff : -diff
  return a.name.localeCompare(b.name)
}
