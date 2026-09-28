/**
 * Bid Date Sent attestation — the Bid form's sent-date field, the checklist that must be
 * confirmed before a new date is written, and the follow-up note typed with it.
 *
 * The Bids map's step 4 (`docs/BIDS_TABS_ARCHITECTURE.md` → Recommended extraction order):
 * these twelve states and their handlers lived in `src/pages/Bids.tsx`. The decisions are
 * `lib/bids/bidDateSentAttestation` (tested); this hook holds the state and hands the page
 * what its three save paths, the autosave gate and `BidSentAttestationModal` read.
 */
import { useRef, useState, type ChangeEvent, type FocusEvent } from 'react'
import type { BidDateSentAttestationPayload } from '../types/bidDateSentAttestation'
import { normalizeBidDateInput } from '../lib/bidDateSentDisplay'
import {
  bidDateSentAttestationMerge,
  bidDateSentAttestationPromptDate,
  bidDateSentAttestationSaveError,
  bidDateSentInputDropsPending,
  buildBidDateSentAttestationPayload,
} from '../lib/bids/bidDateSentAttestation'

export type BidSentAckKey = 'email' | 'phone' | 'honesty'

export type BidSentAck = { checked: boolean; checkedAt: string | null }

const NO_ACKS: Record<BidSentAckKey, BidSentAck> = {
  email: { checked: false, checkedAt: null },
  phone: { checked: false, checkedAt: null },
  honesty: { checked: false, checkedAt: null },
}

export function useBidDateSentAttestation(input: {
  /** `bid_date_sent` on the bid being edited; `null` for a new bid. */
  serverBidDateSent: string | null | undefined
  /** The signed-in person — the checklist is stamped with their id. */
  userId: string | null | undefined
}) {
  const [bidDateSent, setBidDateSent] = useState('')
  const savedBidDateSentRef = useRef('')
  const [modalOpen, setModalOpen] = useState(false)
  const [dateForModal, setDateForModal] = useState('')
  const [acks, setAcks] = useState<Record<BidSentAckKey, BidSentAck>>(NO_ACKS)
  const [followupNoteDraft, setFollowupNoteDraft] = useState('')
  const [pending, setPending] = useState<BidDateSentAttestationPayload | null>(null)
  const [pendingForDate, setPendingForDate] = useState<string | null>(null)
  const [pendingFollowupNote, setPendingFollowupNote] = useState<string | null>(null)

  const allAcked = acks.email.checked && acks.phone.checked && acks.honesty.checked

  function resetModal() {
    setModalOpen(false)
    setDateForModal('')
    setAcks(NO_ACKS)
    setFollowupNoteDraft('')
  }

  function dropPending() {
    setPending(null)
    setPendingForDate(null)
    setPendingFollowupNote(null)
  }

  /** Closes the checklist and forgets anything confirmed and not saved. The date field is left alone. */
  function clearFlow() {
    resetModal()
    dropPending()
  }

  /** The form opened on a bid (or a new one), or the per-GC panel wrote the date: this is the field and the saved date now. */
  function resetTo(raw: string | null | undefined) {
    clearFlow()
    savedBidDateSentRef.current = normalizeBidDateInput(raw)
    setBidDateSent(raw ?? '')
  }

  /** A save wrote the date: it is the saved date now, and the confirmed checklist and its note are spent. */
  function markSaved() {
    savedBidDateSentRef.current = normalizeBidDateInput(bidDateSent)
    dropPending()
  }

  const rulesState = { bidDateSent, serverBidDateSent: input.serverBidDateSent ?? null, pending, pendingForDate }

  /** Opens the checklist once when the committed date differs from the last saved one; the field goes back to the saved date until it is confirmed. */
  function promptIfNeeded(proposedRaw: string): boolean {
    const baseline = savedBidDateSentRef.current
    const proposed = bidDateSentAttestationPromptDate({ modalOpen, proposedRaw, baseline, pending, pendingForDate })
    if (!proposed) return false
    setDateForModal(proposed)
    setAcks(NO_ACKS)
    setFollowupNoteDraft('')
    setModalOpen(true)
    setBidDateSent(baseline || '')
    return true
  }

  function handleInputChange(e: ChangeEvent<HTMLInputElement>) {
    const v = e.target.value
    setBidDateSent(v)
    if (bidDateSentInputDropsPending({ value: v, baseline: savedBidDateSentRef.current, pendingForDate })) dropPending()
  }

  function handleBlur(e: FocusEvent<HTMLInputElement>) {
    promptIfNeeded(e.target.value)
  }

  /** Ticking a line stamps it with the moment; unticking clears the stamp. */
  function toggleAck(key: BidSentAckKey, on: boolean) {
    setAcks((prev) => ({ ...prev, [key]: { checked: on, checkedAt: on ? new Date().toISOString() : null } }))
  }

  function confirm() {
    if (!input.userId) return
    if (!allAcked) return
    const payload = buildBidDateSentAttestationPayload({
      userId: input.userId,
      confirmedAt: new Date().toISOString(),
      ackEmailAt: acks.email.checkedAt,
      ackPhoneAt: acks.phone.checkedAt,
      ackHonestyAt: acks.honesty.checkedAt,
    })
    setPending(payload)
    setPendingForDate(dateForModal)
    setBidDateSent(dateForModal)
    setPendingFollowupNote(followupNoteDraft.trim() || null)
    resetModal()
  }

  return {
    bidDateSent,
    /** The last saved date, normalized — the baseline a save prunes against. */
    savedBidDateSent: () => savedBidDateSentRef.current,
    modalOpen,
    pending,
    pendingForDate,
    pendingFollowupNote,
    resetTo,
    clearFlow,
    markSaved,
    getPayloadMerge: () => bidDateSentAttestationMerge(rulesState),
    validateForSave: () => bidDateSentAttestationSaveError(rulesState),
    promptIfNeeded,
    handleInputChange,
    handleBlur,
    /** What `BidSentAttestationModal` draws and calls. */
    modal: {
      acks,
      allAcked,
      followupNoteDraft,
      setFollowupNoteDraft,
      toggleAck,
      cancel: resetModal,
      confirm,
    },
  }
}

export type BidDateSentAttestation = ReturnType<typeof useBidDateSentAttestation>
