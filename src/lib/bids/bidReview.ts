/**
 * Mark reviewed — the Review step of the bid flow (v2.3201).
 *
 * The stamp is three columns on the bid (who, when, notes); the history is a
 * method-less note in the bid's ledger, so it shows in the timeline without
 * moving the chase clock (v2.2413: notes without a method never do).
 */

/** Fired on `window` after a successful stamp so the Bids page reloads its rows. */
export const BID_REVIEWED_EVENT = 'bid-reviewed'

export type BidReviewFields = {
  reviewed_at: string | null
  reviewed_by: string | null
  review_note: string | null
}

/** A bid row may carry the review columns (after the migration) or not (before); read them without lying. */
export function bidReviewFields(bid: object): BidReviewFields | null {
  if (!('reviewed_at' in bid)) return null
  const b = bid as Partial<BidReviewFields>
  return {
    reviewed_at: b.reviewed_at ?? null,
    reviewed_by: b.reviewed_by ?? null,
    review_note: b.review_note ?? null,
  }
}

/** The ledger line the button appends. */
export function buildBidReviewedNoteBody(args: { actorDisplayName: string; note: string | null | undefined }): string {
  const actor = args.actorDisplayName.trim() || 'Unknown user'
  const note = (args.note ?? '').trim()
  return note ? `Reviewed by ${actor}.\nNotes: ${note}` : `Reviewed by ${actor}.`
}

/** The strip's caption under the Review node: "by Wendi · Sep 9". */
export function reviewStampLabel(args: { reviewed_at: string | null; reviewerName: string | null }, formatDate: (iso: string) => string): string | null {
  if (!args.reviewed_at) return null
  const who = args.reviewerName?.trim()
  const when = formatDate(args.reviewed_at)
  return who ? `by ${who} · ${when}` : when
}

/** The tooltip text for the Review step once stamped. */
export function reviewStampTooltip(args: { reviewed_at: string | null; reviewerName: string | null; review_note: string | null }, formatDate: (iso: string) => string): string | null {
  const label = reviewStampLabel(args, formatDate)
  if (!label) return null
  const note = (args.review_note ?? '').trim()
  return note ? `Reviewed ${label}. Notes: ${note}` : `Reviewed ${label}.`
}

/** The columns the button writes. `null` note clears an old note on a re-review. */
export function buildBidReviewPatch(args: { userId: string; note: string | null | undefined; nowIso: string }): BidReviewFields {
  const note = (args.note ?? '').trim()
  return { reviewed_at: args.nowIso, reviewed_by: args.userId, review_note: note || null }
}
