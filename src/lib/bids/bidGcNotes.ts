/**
 * Per-GC bid notes (v2.2217): a bid note can be about ONE GC on the bid
 * (bids_submission_entries.gc_customer_id; NULL = whole-bid). The Bid Board's
 * GC lines open a small popover of that GC's notes; the bid's own feed tags
 * scoped notes with the GC's name. Pure helpers here so counts/partitioning
 * are tested.
 */

export type BidGcScopedRef = { bid_id: string; gc_customer_id: string | null }

export function gcNoteCountKey(bidId: string, gcCustomerId: string): string {
  return `${bidId}:${gcCustomerId}`
}

/** `${bidId}:${gcId}` → scoped-note count (NULL-scoped rows don't count — they're whole-bid). */
export function countGcNotes(rows: ReadonlyArray<BidGcScopedRef>): Record<string, number> {
  const out: Record<string, number> = {}
  for (const r of rows) {
    if (!r.gc_customer_id) continue
    const k = gcNoteCountKey(r.bid_id, r.gc_customer_id)
    out[k] = (out[k] ?? 0) + 1
  }
  return out
}

/**
 * Split a bid's entries for one GC's popover: `scoped` = that GC's notes;
 * `context` = whole-bid notes (shown greyed under them). For the bid's own GC
 * (gcId null — a bids_gc_builders entity, not a customer) the whole-bid notes
 * ARE the notes: scoped = NULL-scoped entries, no separate context.
 */
export function partitionNotesForGc<T extends { gc_customer_id?: string | null }>(
  entries: ReadonlyArray<T>,
  gcId: string | null,
): { scoped: T[]; context: T[] } {
  if (!gcId) return { scoped: entries.filter((e) => !e.gc_customer_id), context: [] }
  return {
    scoped: entries.filter((e) => e.gc_customer_id === gcId),
    context: entries.filter((e) => !e.gc_customer_id),
  }
}
