/**
 * Declining an estimate — the one kernel the customer page, `accept-estimate`
 * (`action: 'decline'`), and the staff "Record a decline" control all consult.
 *
 * Journey-map J17-F6 / N1 / N2 (2026-09-05): `declined` sat in the status enum
 * with no writer anywhere — the customer's only "no" was silence and the office
 * could not record a phone "no" either, so dead estimates aged in the Sent
 * bucket wearing "sent 7d ago — nudge?" chips. A decline flips `sent →
 * declined` and appends an `estimate_customer_events` row (`event_type =
 * 'declined'`) whose metadata says who said no and, optionally, why.
 *
 * Deno-free on purpose: `src/lib/estimateDecline.test.ts` imports this file
 * directly (same pattern as `estimateLinkResend.ts`).
 */

/** Free-text reason / note cap — a sentence, not a letter. */
export const ESTIMATE_DECLINE_REASON_MAX = 280

export type EstimateDeclineBy = 'customer' | 'staff'

/** How the office heard the "no" when staff record it. */
export type EstimateDeclineChannel = 'phone' | 'in_person' | 'email' | 'text' | 'other'

export const ESTIMATE_DECLINE_CHANNELS: readonly EstimateDeclineChannel[] = ['phone', 'in_person', 'email', 'text', 'other']

export function estimateDeclineChannelLabel(channel: string | null | undefined): string {
  switch (channel) {
    case 'phone':
      return 'by phone'
    case 'in_person':
      return 'in person'
    case 'email':
      return 'by email'
    case 'text':
      return 'by text'
    case 'other':
      return ''
    default:
      return ''
  }
}

export function normalizeEstimateDeclineChannel(raw: unknown): EstimateDeclineChannel {
  const s = typeof raw === 'string' ? raw.trim() : ''
  return (ESTIMATE_DECLINE_CHANNELS as readonly string[]).includes(s) ? (s as EstimateDeclineChannel) : 'other'
}

/** Trim, collapse whitespace, cap at the max. Never throws; non-strings become ''. */
export function normalizeEstimateDeclineReason(raw: unknown): string {
  if (typeof raw !== 'string') return ''
  const collapsed = raw.replace(/\s+/g, ' ').trim()
  return collapsed.length > ESTIMATE_DECLINE_REASON_MAX ? collapsed.slice(0, ESTIMATE_DECLINE_REASON_MAX).trimEnd() : collapsed
}

export type EstimateDeclineBlockReason = 'draft' | 'accepted' | 'already_declined' | 'superseded' | 'unknown_status'

export type EstimateDeclineVerdict = { ok: true } | { ok: false; reason: EstimateDeclineBlockReason }

/** Only a `sent` estimate can be declined — the same gate for the customer door and the staff writer. */
export function canDeclineEstimate(status: string | null | undefined): EstimateDeclineVerdict {
  switch (status) {
    case 'sent':
      return { ok: true }
    case 'draft':
      return { ok: false, reason: 'draft' }
    case 'customer_accepted':
      return { ok: false, reason: 'accepted' }
    case 'declined':
      return { ok: false, reason: 'already_declined' }
    case 'superseded':
      return { ok: false, reason: 'superseded' }
    default:
      return { ok: false, reason: 'unknown_status' }
  }
}

export function estimateDeclineBlockMessage(reason: EstimateDeclineBlockReason): string {
  switch (reason) {
    case 'draft':
      return 'This estimate has not been sent yet — delete the draft instead.'
    case 'accepted':
      return 'The customer already accepted this estimate.'
    case 'already_declined':
      return 'This estimate is already marked declined.'
    case 'superseded':
      return 'This estimate was superseded by a newer one.'
    default:
      return 'This estimate cannot be declined from here.'
  }
}

export type EstimateDeclineEventMetadata = {
  by: EstimateDeclineBy
  /** Customer: the optional "why"; staff: the note the office typed. */
  note: string
  /** Staff only — how the office heard it. */
  channel?: EstimateDeclineChannel
  /** Staff only — who recorded it. */
  user_id?: string
}

/** Read the decline metadata back off an events row; tolerant of shape drift. */
export function parseEstimateDeclineMetadata(raw: unknown): EstimateDeclineEventMetadata | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const m = raw as Record<string, unknown>
  const by: EstimateDeclineBy = m.by === 'staff' ? 'staff' : 'customer'
  const note = normalizeEstimateDeclineReason(m.note ?? m.reason)
  const out: EstimateDeclineEventMetadata = { by, note }
  if (by === 'staff') {
    out.channel = normalizeEstimateDeclineChannel(m.channel)
    if (typeof m.user_id === 'string' && m.user_id) out.user_id = m.user_id
  }
  return out
}

/** "Declined by customer" / "Declined by staff by phone" — the activity-feed and row wording. */
export function estimateDeclinedLabel(meta: EstimateDeclineEventMetadata | null): string {
  if (!meta) return 'Declined'
  if (meta.by === 'customer') return 'Declined by customer'
  const how = estimateDeclineChannelLabel(meta.channel)
  return how ? `Declined — office heard it ${how}` : 'Declined — recorded by office'
}
