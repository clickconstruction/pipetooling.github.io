import type { BidEditFormValues } from './useBidEditForm'

/**
 * Edit Bid autosaves (v2.3130): the Edit tab of the Bid window writes each
 * change on its own, the way the Job window's Edit tab does, and the Save
 * button is gone from that tab. New Bid keeps one dedicated button, "Create
 * bid" — a bid row does not exist to autosave into until then.
 *
 * This kernel holds the pure parts: what the autosave watches (the slice
 * JSON), what the footer says about it, and the button labels per mode.
 */

export type BidAutosaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export type BidAutosaveSliceExtras = {
  /** Parent-owned Bid Date Sent input. */
  bidDateSent: string
  /** The attestation the person confirmed for a new sent date (its timestamp), or null. */
  attestedAt: string | null
  /** The optional follow-up note typed on the attestation modal, saved with the date. */
  followupNote: string | null
}

/**
 * The JSON the autosave engine diffs. Only persisted fields — the GC search
 * text and the contact-section toggle are UI state and never reach the row.
 * The attestation rides along so confirming the checklist (same date string,
 * new attestation) re-dirties the slice and the date finally writes.
 */
export function bidAutosaveSliceJson(values: BidEditFormValues, extras: BidAutosaveSliceExtras): string {
  const { gcCustomerSearch: _search, projectContactExpanded: _expanded, ...persisted } = values
  void _search
  void _expanded
  return JSON.stringify({ ...persisted, ...extras })
}

export type BidAutosaveFooterState = {
  status: BidAutosaveStatus
  /** The form differs from what is on the row. */
  dirty: boolean
  /** Required fields still blank — autosave holds until they are filled. */
  missingFields: readonly string[]
}

/** The one line the Edit tab's footer prints about saving. */
export function bidAutosaveStatusLine(s: BidAutosaveFooterState): { text: string; tone: 'muted' | 'warn' | 'error' } {
  if (s.missingFields.length > 0) return { text: `Required: ${s.missingFields.join(', ')} — changes save once it's filled in`, tone: 'warn' }
  if (s.status === 'error') return { text: 'Couldn’t save your latest change', tone: 'error' }
  if (s.status === 'saving') return { text: 'Saving…', tone: 'muted' }
  if (s.dirty) return { text: 'Unsaved change…', tone: 'muted' }
  if (s.status === 'saved') return { text: 'Saved', tone: 'muted' }
  return { text: 'Changes save as you make them', tone: 'muted' }
}

export type BidFormFooterLabels = {
  /** The primary button; null when the mode has none (Edit autosaves). */
  primary: string | null
  /** The "…and open Counts" button. */
  openCounts: string
}

export function bidFormFooterLabels(editing: boolean): BidFormFooterLabels {
  return editing ? { primary: null, openCounts: 'Open Counts' } : { primary: 'Create bid', openCounts: 'Create and open counts' }
}
