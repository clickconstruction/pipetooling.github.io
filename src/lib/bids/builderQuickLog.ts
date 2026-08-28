/**
 * Quick-log kernel for the Followup builder cards (v2.1386): one call to a
 * builder → one customer_contacts row + a bids_submission_entries row and a
 * bids.last_contact stamp for every bid the caller checked. Pure row-building
 * only; the component performs the writes.
 *
 * v2.2051: `includeBuilderLog: false` builds a bids-only log — the checked
 * bids get their notes and last_contact stamps, but `customerContact` is null
 * so the builder's relationship log (and the Oldest-first call queue) doesn't
 * move. For bid-level facts that aren't a conversation with the builder.
 */

export type BuilderQuickLogWrites = {
  customerContact: {
    customer_id: string
    contact_date: string
    details: string
    contact_method: string
    created_by: string
  } | null
  bidEntries: Array<{
    bid_id: string
    /** The builder being logged (Per-GC Phase 1) — folds into the own GC for own-GC bids. */
    gc_customer_id: string | null
    contact_method: string
    notes: string
    occurred_at: string
    created_by: string
  }>
  /** Same instant for every touched bid — bids.last_contact stays in step with the entry. */
  bidLastContactUpdates: Array<{ bidId: string; last_contact: string }>
}

export function buildBuilderQuickLogWrites(args: {
  customerId: string
  checkedBidIds: string[]
  method: string
  note: string
  nowIso: string
  userId: string
  /** false → bids-only: no customer_contacts row (default true). */
  includeBuilderLog?: boolean
}): BuilderQuickLogWrites {
  const { customerId, method, nowIso, userId } = args
  const details = args.note.trim() || `${method} follow-up`
  const bidIds = [...new Set(args.checkedBidIds)]
  return {
    customerContact:
      args.includeBuilderLog === false
        ? null
        : {
            customer_id: customerId,
            contact_date: nowIso,
            details,
            contact_method: method,
            created_by: userId,
          },
    bidEntries: bidIds.map((bid_id) => ({
      bid_id,
      gc_customer_id: customerId,
      contact_method: method,
      notes: details,
      occurred_at: nowIso,
      created_by: userId,
    })),
    bidLastContactUpdates: bidIds.map((bidId) => ({ bidId, last_contact: nowIso })),
  }
}

/** Open pipeline dollars for the header chip: bid_value across unsent + pending bids. */
export function builderOpenPipelineValue(bids: Array<{ bid_value: number | null }>): number {
  let sum = 0
  for (const b of bids) {
    if (typeof b.bid_value === 'number' && Number.isFinite(b.bid_value) && b.bid_value > 0) sum += b.bid_value
  }
  return sum
}

/** "$1.2M" / "$360k" / "$900" formatting for the open-value chip; null under $1. */
export function formatOpenPipelineValue(value: number): string | null {
  if (!Number.isFinite(value) || value < 1) return null
  if (value >= 1_000_000) {
    const m = value / 1_000_000
    return `$${m >= 10 ? Math.round(m) : Math.round(m * 10) / 10}M`
  }
  if (value >= 1_000) return `$${Math.round(value / 1_000)}k`
  return `$${Math.round(value)}`
}
