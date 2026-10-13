/**
 * Which sends of a recorded notice still owe a tracking number (v2.4119).
 * A certified or courier send with a blank number is proof of service the
 * affidavit cannot lean on yet; email carries its resend id, hand delivery
 * carries who signed. Shared by the Lien desk's Sent footer, the Lien
 * window's Filings list and the Dashboard's watch — pure.
 */

/** A send; `via` and `piece_id` ride on a send a mail provider carries (the Docsmit train, PR 1), so its number is the provider's to fill. */
export type LienSendLike = { recipient: string; method: string; tracking: string; sent_on?: string; via?: string; piece_id?: string }

function trackedMethod(method: string): boolean {
  return method === 'certified_mail' || method === 'traceable_courier'
}

/** A blank number on a send a provider carries is coming, not owed: the office cannot type what USPS has not assigned yet. */
export function sendTrackingComing(s: Pick<LienSendLike, 'method' | 'tracking' | 'via' | 'piece_id'>): boolean {
  return trackedMethod(s.method) && !(s.tracking ?? '').trim() && !!(s.via ?? '').trim() && !!(s.piece_id ?? '').trim()
}

export function sendNeedsTracking(s: Pick<LienSendLike, 'method' | 'tracking' | 'via' | 'piece_id'>): boolean {
  return trackedMethod(s.method) && !(s.tracking ?? '').trim() && !sendTrackingComing(s)
}

/** The `sends` JSON of a `job_lien_filings` row as typed sends; anything malformed is skipped. */
export function parseLienSends(raw: unknown): LienSendLike[] {
  if (!Array.isArray(raw)) return []
  const out: LienSendLike[] = []
  for (const v of raw) {
    if (v == null || typeof v !== 'object') continue
    const r = v as Record<string, unknown>
    if (typeof r.recipient !== 'string' || typeof r.method !== 'string') continue
    const send: LienSendLike = { recipient: r.recipient, method: r.method, tracking: typeof r.tracking === 'string' ? r.tracking : '', sent_on: typeof r.sent_on === 'string' ? r.sent_on : undefined }
    if (typeof r.via === 'string' && r.via.trim()) send.via = r.via
    if (typeof r.piece_id === 'string' && r.piece_id.trim()) send.piece_id = r.piece_id
    out.push(send)
  }
  return out
}

export function sendsTrackingOwed(raw: unknown): LienSendLike[] {
  return parseLienSends(raw).filter(sendNeedsTracking)
}

/** The sends whose number a provider will bring: shown as "coming", never nagged for. */
export function sendsTrackingComing(raw: unknown): LienSendLike[] {
  return parseLienSends(raw).filter(sendTrackingComing)
}

/** The same sends with one recipient's number filled in — what the "add the number" door writes back. */
export function withTracking(raw: unknown, recipient: string, tracking: string): LienSendLike[] {
  return parseLienSends(raw).map((s) => (s.recipient === recipient ? { ...s, tracking: tracking.trim() } : s))
}

export const LIEN_SEND_RECIPIENT_WORDS: Record<string, string> = { owner: 'Owner of record', original_contractor: 'Original contractor' }
