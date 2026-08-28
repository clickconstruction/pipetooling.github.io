/**
 * Bid contacts (Per-GC bids Phase 1, docs/PER_GC_BID_PLAN.md): the communications ledger
 * (`bids_submission_entries`) is the one store, and everything else derives.
 *
 * OWNER DECISION (2026-08-27): only entries WITH a contact_method count as contacts —
 * method-less notes are notes; they never move last-contact or silence the quiet-bid nag.
 * Entries with `gc_customer_id` NULL count as the bid's OWN GC (the notes popover's
 * long-standing rule). Pure — no React, no DB; the DB-side twin is the
 * `sync_last_contact_from_entries` trigger.
 */

export type ContactEntryLike = {
  gc_customer_id?: string | null
  contact_method: string | null
  occurred_at: string // ISO timestamptz
}

/** A row counts as a contact only when it carries a real method (call / email / text…). */
export function isContactEntry(e: Pick<ContactEntryLike, 'contact_method'>): boolean {
  return e.contact_method != null && e.contact_method.trim() !== ''
}

/** The bid-level roll-up: latest method entry's occurred_at (what the trigger writes). Null when none. */
export function deriveBidLastContact(entries: ReadonlyArray<ContactEntryLike>): string | null {
  let best: string | null = null
  for (const e of entries) {
    if (!isContactEntry(e)) continue
    if (!best || e.occurred_at > best) best = e.occurred_at
  }
  return best
}

/**
 * Latest contact per GC — keyed by `gc_customer_id`, with `''` for the bid's own GC.
 * NULL-GC entries count toward the own GC only (a call logged without attribution was with
 * the primary GC), and entries stamped with the own GC's customer id fold into `''` too when
 * `ownGcCustomerId` is passed. Entries scoped to another GC never bleed into own freshness.
 */
export function lastContactByGc(
  entries: ReadonlyArray<ContactEntryLike>,
  ownGcCustomerId?: string | null,
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const e of entries) {
    if (!isContactEntry(e)) continue
    const raw = e.gc_customer_id ?? null
    const key = raw == null || (ownGcCustomerId != null && raw === ownGcCustomerId) ? '' : raw
    const prev = out[key]
    if (!prev || e.occurred_at > prev) out[key] = e.occurred_at
  }
  return out
}

export type BidScopedEntryLike = ContactEntryLike & { bid_id: string }

/**
 * One pass over the whole entries table → two per-bid recency maps:
 * `lastContactByBid` sees only method entries (the chase lenses' "last contact"
 * fallback — a method-less note must not silence the never-called bucket), while
 * `lastActivityByBid` sees every entry (the Followup "Last update" surfaces,
 * where a note is an update).
 */
export function buildBidEntryRecencyMaps(entries: ReadonlyArray<BidScopedEntryLike>): {
  lastContactByBid: Record<string, string>
  lastActivityByBid: Record<string, string>
} {
  const lastContactByBid: Record<string, string> = {}
  const lastActivityByBid: Record<string, string> = {}
  for (const e of entries) {
    if (!e.occurred_at) continue
    const prevAny = lastActivityByBid[e.bid_id]
    if (!prevAny || e.occurred_at > prevAny) lastActivityByBid[e.bid_id] = e.occurred_at
    if (!isContactEntry(e)) continue
    const prev = lastContactByBid[e.bid_id]
    if (!prev || e.occurred_at > prev) lastContactByBid[e.bid_id] = e.occurred_at
  }
  return { lastContactByBid, lastActivityByBid }
}

/**
 * The `gc_customer_id` to stamp on an entry from a packet-scoped surface: '' (own packet)
 * → null; 'shared:<cid>' shared-letter keys → the cid; anything else is the customer id.
 */
export function entryGcIdFromPacketKey(packetKey: string | null | undefined): string | null {
  if (!packetKey) return null
  if (packetKey.startsWith('shared:')) return packetKey.slice('shared:'.length) || null
  return packetKey
}
