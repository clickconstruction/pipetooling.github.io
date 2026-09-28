/**
 * Bid Date Sent attestation — the rules that decide whether `bids.bid_date_sent` and its
 * eight attestation stamps are written.
 *
 * Stage A of the Bids.tsx second pass (`docs/BIDS_TABS_ARCHITECTURE.md` → Recommended
 * extraction order, step 2). A new or changed sent date is written only after the person
 * confirms the three-line checklist for that exact date; clearing the date clears the stamps.
 * The page keeps the state (the date field, the pending attestation, the modal); these are
 * the decisions it reads. Pure: no React, no supabase.
 */
import type { BidDateSentAttestationPayload } from '../../types/bidDateSentAttestation'
import { normalizeBidDateInput } from '../bidDateSentDisplay'

/** Written when the sent date is cleared: every stamp goes with it. */
export const BID_DATE_SENT_ATTESTATION_NULLS: Record<keyof BidDateSentAttestationPayload, null> = {
  bid_date_sent_attested_at: null,
  bid_date_sent_attested_by: null,
  bid_date_sent_ack_email_at: null,
  bid_date_sent_ack_email_by: null,
  bid_date_sent_ack_phone_at: null,
  bid_date_sent_ack_phone_by: null,
  bid_date_sent_ack_honesty_at: null,
  bid_date_sent_ack_honesty_by: null,
}

export const BID_DATE_SENT_ATTESTATION_REQUIRED_MESSAGE = 'Choose a new Bid Date Sent and confirm the attestation checklist, or revert the date.'

export type BidDateSentAttestationState = {
  /** The date field as typed. */
  bidDateSent: string | null | undefined
  /** `bid_date_sent` on the bid being edited; `null` for a new bid. */
  serverBidDateSent: string | null | undefined
  /** The checklist the person confirmed and has not saved yet. */
  pending: BidDateSentAttestationPayload | null
  /** The date that checklist was confirmed for. */
  pendingForDate: string | null
}

/** True when the confirmed checklist is for exactly the date in the field. */
function pendingCoversDate(state: BidDateSentAttestationState, date: string): boolean {
  return state.pending != null && state.pendingForDate === date
}

/**
 * The attestation columns a save spreads over the bid payload: all nulls when the date is
 * cleared, the confirmed stamps when the date changed and was confirmed, nothing otherwise
 * (an unchanged date keeps the stamps it has; an unconfirmed change is refused by
 * `bidDateSentAttestationSaveError`).
 */
export function bidDateSentAttestationMerge(state: BidDateSentAttestationState): Record<string, string | null> {
  const date = normalizeBidDateInput(state.bidDateSent)
  if (!date) return { ...BID_DATE_SENT_ATTESTATION_NULLS }
  if (date !== normalizeBidDateInput(state.serverBidDateSent) && pendingCoversDate(state, date)) {
    return { ...state.pending }
  }
  return {}
}

/** The sentence that refuses a save: the date differs from the saved one and nobody confirmed it. `null` lets the save through. */
export function bidDateSentAttestationSaveError(state: BidDateSentAttestationState): string | null {
  const date = normalizeBidDateInput(state.bidDateSent)
  if (!date) return null
  if (date !== normalizeBidDateInput(state.serverBidDateSent) && !pendingCoversDate(state, date)) {
    return BID_DATE_SENT_ATTESTATION_REQUIRED_MESSAGE
  }
  return null
}

/**
 * The date the checklist should open for, or `null` when it should not open: the modal is
 * already up, the field is empty, the date is the last saved one, or this date was already
 * confirmed.
 */
export function bidDateSentAttestationPromptDate(input: {
  modalOpen: boolean
  proposedRaw: string | null | undefined
  /** The last saved date, normalized (`''` when none). */
  baseline: string
  pending: BidDateSentAttestationPayload | null
  pendingForDate: string | null
}): string | null {
  if (input.modalOpen) return null
  const proposed = normalizeBidDateInput(input.proposedRaw)
  if (!proposed) return null
  if (proposed === input.baseline) return null
  if (input.pending && input.pendingForDate === proposed) return null
  return proposed
}

/**
 * Typing in the date field: does the confirmed checklist (and the follow-up note typed with
 * it) still stand? It is dropped when the field is emptied, and when a checklist is held and
 * the field is back on the saved date or on a date other than the confirmed one.
 */
export function bidDateSentInputDropsPending(input: {
  value: string
  /** The last saved date, normalized (`''` when none). */
  baseline: string
  pendingForDate: string | null
}): boolean {
  if (!input.value) return true
  if (!input.pendingForDate) return false
  const norm = normalizeBidDateInput(input.value)
  return norm === input.baseline || input.pendingForDate !== norm
}

/** The eight stamps a confirmed checklist writes; a line ticked earlier keeps its own time. */
export function buildBidDateSentAttestationPayload(input: {
  userId: string
  confirmedAt: string
  ackEmailAt: string | null
  ackPhoneAt: string | null
  ackHonestyAt: string | null
}): BidDateSentAttestationPayload {
  return {
    bid_date_sent_attested_at: input.confirmedAt,
    bid_date_sent_attested_by: input.userId,
    bid_date_sent_ack_email_at: input.ackEmailAt ?? input.confirmedAt,
    bid_date_sent_ack_email_by: input.userId,
    bid_date_sent_ack_phone_at: input.ackPhoneAt ?? input.confirmedAt,
    bid_date_sent_ack_phone_by: input.userId,
    bid_date_sent_ack_honesty_at: input.ackHonestyAt ?? input.confirmedAt,
    bid_date_sent_ack_honesty_by: input.userId,
  }
}
