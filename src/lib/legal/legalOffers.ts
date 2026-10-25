/**
 * Offers on a legal matter (punch list #172, v2.5847): made or received, an amount, the day, the day it
 * expires, a status. An OFFER is a `legal_matter_entries` row of kind `offer` — `amount` the offer,
 * `occurred_on` the day made or received, `meta` `{ direction, expires_on, status, notes, source }` —
 * written by `legal_offer_add`, its status by `legal_offer_set_status`. The office logs them while a
 * case is in house or with the firm; an open offer's expiry day lands on the Timeline. Pure.
 */
import type { LegalEntryRow } from './legalMatters'

export const OFFER_STATUSES = ['open', 'countered', 'accepted', 'withdrawn', 'expired'] as const
export type OfferStatus = (typeof OFFER_STATUSES)[number]
export type OfferDirection = 'made' | 'received'

export type LegalOfferMeta = {
  direction: OfferDirection
  /** `YYYY-MM-DD` or null. */
  expiresOn: string | null
  status: OfferStatus
  notes: string
  statusNote: string
  source: 'office' | 'mcp'
}

const YMD = /^\d{4}-\d{2}-\d{2}$/

function isRecord(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === 'object' && !Array.isArray(v)
}

export function isOfferEntry(e: Pick<LegalEntryRow, 'kind'>): boolean {
  return e.kind === 'offer'
}

export function offerHoldKey(entryId: string): string {
  return `offer:${entryId}`
}

/** An offer's meta, read defensively. */
export function offerMetaOf(meta: unknown): LegalOfferMeta {
  const m = isRecord(meta) ? meta : {}
  return {
    direction: m.direction === 'received' ? 'received' : 'made',
    expiresOn: typeof m.expires_on === 'string' && YMD.test(m.expires_on) ? m.expires_on : null,
    status: typeof m.status === 'string' && (OFFER_STATUSES as readonly string[]).includes(m.status) ? (m.status as OfferStatus) : 'open',
    notes: typeof m.notes === 'string' ? m.notes : '',
    statusNote: typeof m.status_note === 'string' ? m.status_note : '',
    source: m.source === 'mcp' ? 'mcp' : 'office',
  }
}

export type LegalOfferDraft = { direction: OfferDirection; amountText: string; on: string; expiresOn: string; notes: string }

/** The amount typed: "12,500" → 12500; null when it is not a positive number. */
export function offerAmountOf(text: string): number | null {
  const n = Number(text.replace(/[$,\s]/g, ''))
  return Number.isFinite(n) && n > 0 && n < 1e10 ? Math.round(n * 100) / 100 : null
}

/** Why the draft cannot be saved; null when it can. The RPC holds the same rules. */
export function offerDraftProblem(d: LegalOfferDraft, todayYmd: string): string | null {
  if (offerAmountOf(d.amountText) == null) return 'Type the offer’s amount.'
  if (!YMD.test(d.on)) return 'Pick the day.'
  if (d.on > todayYmd) return 'The day cannot be ahead of today.'
  if (d.expiresOn && !YMD.test(d.expiresOn)) return 'Pick the day it expires, or leave it blank.'
  if (d.expiresOn && d.expiresOn < d.on) return 'An offer cannot expire before it was made.'
  if (d.notes.trim().length > 4000) return 'Keep the notes under 4,000 characters.'
  return null
}

/** *offer made* · *offer received* — the kind words on the office's side. */
export function offerKindWords(meta: LegalOfferMeta): string {
  return meta.direction === 'received' ? 'offer received' : 'offer made'
}

/** The firm's words: *offer the office made* · *offer the office received*. */
export function offerFirmKindWords(meta: LegalOfferMeta): string {
  return meta.direction === 'received' ? 'offer the office received' : 'offer the office made'
}

export function offerStatusWords(status: OfferStatus): string {
  switch (status) {
    case 'open': return 'Open'
    case 'countered': return 'Countered'
    case 'accepted': return 'Accepted'
    case 'withdrawn': return 'Withdrawn'
    default: return 'Expired'
  }
}

/** The status an open offer may move to, in the buttons' order. */
export const OFFER_NEXT_STATUSES: ReadonlyArray<OfferStatus> = ['countered', 'accepted', 'withdrawn', 'expired']

/** Whether an open offer's expiry day still matters on the line: open, with a day. */
export function offerExpiryOnLine(meta: LegalOfferMeta): string | null {
  return meta.status === 'open' && meta.expiresOn ? meta.expiresOn : null
}

/** *Offer made expires · $12,500* — the expiry item's title. */
export function offerExpiryWhat(meta: LegalOfferMeta, amountWords: string): string {
  return `${meta.direction === 'received' ? 'Offer received' : 'Offer made'} expires · ${amountWords}`
}

/** The in-house header's words: *In house since Oct 25 · counsel away until Nov 3*. */
export function inHouseWords(sinceDay: string, why: string): string {
  return [`In house${sinceDay ? ` since ${sinceDay}` : ''}`, why.trim()].filter(Boolean).join(' · ')
}
