/**
 * Which sends of a recorded notice still owe a tracking number (v2.4119).
 * A certified or courier send with a blank number is proof of service the
 * affidavit cannot lean on yet; email carries its resend id, hand delivery
 * carries who signed. Shared by the Lien desk's Sent footer, the Lien
 * window's Filings list and the Dashboard's watch — pure.
 */

export type LienSendLike = { recipient: string; method: string; tracking: string; sent_on?: string }

export function sendNeedsTracking(s: Pick<LienSendLike, 'method' | 'tracking'>): boolean {
  return (s.method === 'certified_mail' || s.method === 'traceable_courier') && !(s.tracking ?? '').trim()
}

/** The `sends` JSON of a `job_lien_filings` row as typed sends; anything malformed is skipped. */
export function parseLienSends(raw: unknown): LienSendLike[] {
  if (!Array.isArray(raw)) return []
  const out: LienSendLike[] = []
  for (const v of raw) {
    if (v == null || typeof v !== 'object') continue
    const r = v as Record<string, unknown>
    if (typeof r.recipient !== 'string' || typeof r.method !== 'string') continue
    out.push({ recipient: r.recipient, method: r.method, tracking: typeof r.tracking === 'string' ? r.tracking : '', sent_on: typeof r.sent_on === 'string' ? r.sent_on : undefined })
  }
  return out
}

export function sendsTrackingOwed(raw: unknown): LienSendLike[] {
  return parseLienSends(raw).filter(sendNeedsTracking)
}

/** The same sends with one recipient's number filled in — what the "add the number" door writes back. */
export function withTracking(raw: unknown, recipient: string, tracking: string): LienSendLike[] {
  return parseLienSends(raw).map((s) => (s.recipient === recipient ? { ...s, tracking: tracking.trim() } : s))
}

export const LIEN_SEND_RECIPIENT_WORDS: Record<string, string> = { owner: 'Owner of record', original_contractor: 'Original contractor' }
