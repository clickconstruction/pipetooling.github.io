/**
 * The mail-send kernel (the Docsmit train, PR 3 — `docs/DOCSMIT_LIEN_RUN_PLAN.md`): what every
 * mail provider's function shares, pure and free of Deno globals so vitest can hold it next to
 * the app's own `src/lib/mail/mailPiece.ts` (the status fold here must agree with it; a test
 * says so). A provider's HTTP lives beside it (`docsmitClient.ts`); this file never fetches.
 */

export type MailPieceStatus = 'prepared' | 'sent' | 'mailed' | 'in_transit' | 'notice_left' | 'delivered' | 'returned' | 'failed' | 'unknown'

export const MAIL_OPEN_STATUSES: ReadonlyArray<MailPieceStatus> = ['sent', 'mailed', 'in_transit', 'notice_left', 'unknown']

/** The `mail_pieces` row as the functions read and write it. */
export type MailPieceRow = {
  id: string
  kind: string
  source_ids: string[]
  job_id: string | null
  provider: string
  recipient: string
  short_code: string | null
  name: string
  organization: string
  address1: string
  address2: string
  city: string
  state: string
  postal_code: string
  send_type: string
  envelope: string | null
  sheets: number
  provider_message_id: string | null
  client_msg_id: string | null
  price: number | null
  status: MailPieceStatus
  usps_tracking: string | null
  mailed_at: string | null
  delivered_at: string | null
  signed_by: string | null
  delivery_status: string | null
  delivery_as_of: string | null
  events: MailEvent[]
  opened_at: string | null
  pdf_bucket: string
  pdf_path: string | null
  certification_path: string | null
  problem: string | null
}

export type MailEvent = { at: string; kind: string; [k: string]: unknown }

/** What `prepare` takes from the client: the row's own words, nothing the provider decides. */
export type MailPiecePrepareInput = {
  kind: string
  source_ids: string[]
  job_id: string | null
  recipient: string
  short_code?: string | null
  name: string
  organization: string
  address1: string
  address2: string
  city: string
  state: string
  postal_code: string
  send_type: string
  envelope: '#10' | 'Flat' | null
  sheets: number
}

export const MAIL_KINDS = new Set(['lien_notice_53_056', 'lien_retainage_53_057', 'lien_affidavit_copy', 'demand_31_04', 'lien_release', 'collections_demand', 'hazmat_notice', 'hr_letter', 'other'])

/** The kinds whose source rows are `job_lien_filings`, so a USPS number is written into their `sends[]`. */
export const MAIL_FILING_KINDS = new Set(['lien_notice_53_056', 'lien_retainage_53_057', 'lien_affidavit_copy'])

/** What stops a prepare before any provider call; empty when it can go. */
export function mailPrepareProblems(p: Partial<MailPiecePrepareInput>): string[] {
  const out: string[] = []
  if (!p.kind || !MAIL_KINDS.has(p.kind)) out.push('a known kind')
  if (!Array.isArray(p.source_ids)) out.push('the source rows (source_ids)')
  if (!p.recipient || !String(p.recipient).trim()) out.push('the recipient')
  if (!(p.organization ?? '').trim() && !(p.name ?? '').trim()) out.push('a name or an organization')
  if (!(p.address1 ?? '').trim()) out.push('a street line')
  if (!(p.city ?? '').trim()) out.push('a city')
  if (!/^[A-Z]{2}$/.test(p.state ?? '')) out.push('a two-letter state')
  if (!/^\d{5}(-\d{4})?$/.test(p.postal_code ?? '')) out.push('a ZIP or ZIP+4')
  if (p.envelope !== '#10' && p.envelope !== 'Flat') out.push('an envelope (#10 or Flat)')
  if (!Number.isFinite(p.sheets) || (p.sheets as number) <= 0) out.push('a sheet count')
  return out
}

/** Our key on the provider's message: the piece's kind and id. Agrees with `src/lib/mail/mailPiece.ts`. */
export function mailClientMsgId(kind: string, pieceId: string): string {
  return `${kind}:${pieceId}`
}

export function parseMailClientMsgId(s: string): { kind: string; pieceId: string } | null {
  const i = s.indexOf(':')
  if (i <= 0 || i === s.length - 1) return null
  return { kind: s.slice(0, i), pieceId: s.slice(i + 1) }
}

/** The status fold, the same words as `src/lib/mail/mailPiece.ts` `mailStatusFromProvider`. */
export function mailStatusFromProvider(input: { sent: boolean; tracking: string | null; deliveryStatus: string | null; mailedEvent?: boolean; deliveredEvent?: boolean; returnedEvent?: boolean }): MailPieceStatus {
  if (!input.sent) return 'prepared'
  if (input.deliveredEvent) return 'delivered'
  if (input.returnedEvent) return 'returned'
  const s = (input.deliveryStatus ?? '').trim().toLowerCase()
  if (!s) return input.mailedEvent || input.tracking ? 'mailed' : 'sent'
  if (/\bdelivered\b/.test(s) && !/\bnot\b|\bun/.test(s)) return 'delivered'
  if (/return(ed)? to sender|returned|undeliverable|refused/.test(s)) return 'returned'
  if (/notice left|no authorized recipient|available for pickup|held at|unclaimed|reminder/.test(s)) return 'notice_left'
  if (/in transit|arrived|departed|processed|accepted|out for delivery|origin|destination|facility|post office/.test(s)) return 'in_transit'
  if (/pre-shipment|label created|shipping label/.test(s)) return 'mailed'
  return 'unknown'
}

/** A piece's name and address as Docsmit's `physicalParties` item, with what was asked for. */
export function mailPartyFromPiece(p: Pick<MailPieceRow, 'name' | 'organization' | 'address1' | 'address2' | 'city' | 'state' | 'postal_code' | 'send_type' | 'envelope'>): Record<string, string | number> {
  const party: Record<string, string | number> = { address1: p.address1, address2: p.address2, city: p.city, state: p.state, postalCode: p.postal_code, sendType: p.send_type, envelope: p.envelope ?? '#10', sided: 1 }
  if (p.organization.trim()) party.organization = p.organization.trim()
  else {
    const words = p.name.trim().split(/\s+/)
    party.firstName = words.slice(0, -1).join(' ') || words[0] || ''
    party.lastName = words.length > 1 ? words[words.length - 1] ?? '' : ''
  }
  return party
}

/** The same address as `/utils/multiCASS` takes it. */
export function mailCassAddress(p: Pick<MailPieceRow, 'name' | 'organization' | 'address1' | 'address2' | 'city' | 'state' | 'postal_code'>): Record<string, string> {
  const words = p.name.trim().split(/\s+/)
  return {
    firstName: p.organization.trim() ? p.organization.trim() : words.slice(0, -1).join(' ') || words[0] || '',
    lastName: p.organization.trim() ? '' : words.length > 1 ? words[words.length - 1] ?? '' : '',
    address1: p.address1,
    address2: p.address2,
    city: p.city,
    state: p.state,
    zip: p.postal_code,
  }
}

/** What a CASS answer means for the piece: go, go with a correction shown, or hold. */
export function mailCassVerdict(answer: unknown): { mailable: boolean; correction: string | null } {
  const list = Array.isArray(answer) ? answer : Array.isArray((answer as { addresses?: unknown[] })?.addresses) ? (answer as { addresses: unknown[] }).addresses : [answer]
  const a = (list[0] ?? {}) as { nonMailable?: unknown; coarseCorrectionMsg?: unknown }
  const nonMailable = a.nonMailable === true || a.nonMailable === 1 || a.nonMailable === 'true' || a.nonMailable === '1'
  const msg = typeof a.coarseCorrectionMsg === 'string' ? a.coarseCorrectionMsg.trim() : ''
  return { mailable: !nonMailable, correction: msg || null }
}

/** The provider message's title: ours to read on Docsmit's own site and in a list. */
export function mailMessageTitle(p: Pick<MailPieceRow, 'kind' | 'recipient' | 'name' | 'organization' | 'id'>, jobNumber?: string | null): string {
  const who = p.organization.trim() || p.name.trim() || p.recipient
  const kind = p.kind.replace(/_/g, ' ')
  return [jobNumber ? `Job ${jobNumber}` : null, kind, p.recipient.replace(/_/g, ' '), who, p.id.slice(0, 8)].filter(Boolean).join(' · ')
}

export function appendEvent(events: MailEvent[] | null | undefined, event: MailEvent): MailEvent[] {
  return [...(Array.isArray(events) ? events : []), event]
}

/** One party record as Docsmit's `/parties` returns it; only the fields the fold reads. */
export type DocsmitParty = { USPSTrackingID?: string | null; DeliveryStatus?: string | null; DStatusao?: string | null; signedFor?: string | null; delivered?: string | null; mailed?: string | null; returned?: string | null }

/** What one `/parties` read changes on the piece, and the event that records the read. */
export function mailPieceUpdateFromParty(piece: Pick<MailPieceRow, 'status' | 'usps_tracking' | 'mailed_at' | 'delivered_at' | 'signed_by' | 'delivery_status' | 'delivery_as_of'>, party: DocsmitParty, nowIso: string): { patch: Partial<MailPieceRow>; event: MailEvent; changed: boolean } {
  const tracking = (party.USPSTrackingID ?? '').trim() || piece.usps_tracking
  const deliveryStatus = (party.DeliveryStatus ?? '').trim() || null
  const asOf = (party.DStatusao ?? '').trim() || null
  const status = mailStatusFromProvider({ sent: true, tracking, deliveryStatus, mailedEvent: !!party.mailed, deliveredEvent: !!party.delivered, returnedEvent: !!party.returned })
  const patch: Partial<MailPieceRow> = { usps_tracking: tracking, delivery_status: deliveryStatus ?? piece.delivery_status, delivery_as_of: asOf ?? piece.delivery_as_of }
  // prepared never comes back from a sent piece; a settled piece keeps its settled status.
  const settled = piece.status === 'delivered' || piece.status === 'returned' || piece.status === 'failed'
  patch.status = settled ? piece.status : status
  if (!piece.mailed_at && (patch.status === 'mailed' || patch.status === 'in_transit' || patch.status === 'notice_left' || patch.status === 'delivered' || patch.status === 'returned')) {
    patch.mailed_at = (party.mailed ?? '').trim() || asOf || nowIso
  }
  if (!piece.delivered_at && patch.status === 'delivered') patch.delivered_at = (party.delivered ?? '').trim() || asOf || nowIso
  if (!piece.signed_by && (party.signedFor ?? '').trim()) patch.signed_by = (party.signedFor as string).trim()
  const changed = patch.status !== piece.status || patch.usps_tracking !== piece.usps_tracking || patch.delivery_status !== piece.delivery_status || patch.delivery_as_of !== piece.delivery_as_of || !!patch.mailed_at || !!patch.delivered_at || !!patch.signed_by
  const event: MailEvent = { at: nowIso, kind: 'poll', status: patch.status, tracking, delivery_status: deliveryStatus, as_of: asOf }
  return { patch, event, changed }
}

/** A filing's `sends[]` with this piece's send marked: the provider, the piece and the number it has, as `withTracking` writes a typed number. */
export type LienSendLike = { recipient: string; method: string; tracking: string; sent_on?: string; via?: string; piece_id?: string }

export function sendsWithPiece(raw: unknown, recipient: string, piece: { id: string; provider: string; usps_tracking: string | null; mailed_on?: string | null }): LienSendLike[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((v): v is Record<string, unknown> => v != null && typeof v === 'object')
    .map((r) => {
      const s: LienSendLike = { recipient: String(r.recipient ?? ''), method: String(r.method ?? ''), tracking: typeof r.tracking === 'string' ? r.tracking : '' }
      if (typeof r.sent_on === 'string') s.sent_on = r.sent_on
      if (typeof r.via === 'string' && r.via) s.via = r.via
      if (typeof r.piece_id === 'string' && r.piece_id) s.piece_id = r.piece_id
      if (s.recipient !== recipient) return s
      s.via = piece.provider
      s.piece_id = piece.id
      if (piece.usps_tracking) s.tracking = piece.usps_tracking
      if (piece.mailed_on) s.sent_on = piece.mailed_on
      return s
    })
}

/** The day, in a zone, of an instant: the `sent_on` a filing keeps for the day USPS accepted it. */
export function ymdInZone(iso: string, timeZone: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10)
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

/**
 * The charge Docsmit made for a message, from `GET /messages/{id}/transactions` (the Docsmit train, 6b, the cost
 * line): a list (or one object, or `{ transactions: [...] }`) of rows with `price` and `CoR` (C a charge, R a refund).
 * The sum to the cent, or null when no row carries a price — the poll then asks again next hour. The doc shows a
 * `discount` beside `price` and does not say whether `price` is net of it; `price` is taken as what the account paid.
 */
export function mailChargeFromTransactions(raw: unknown): number | null {
  const holder = raw as { transactions?: unknown } | null
  const list: unknown[] = Array.isArray(raw) ? raw : Array.isArray(holder?.transactions) ? (holder!.transactions as unknown[]) : raw && typeof raw === 'object' ? [raw] : []
  let total = 0
  let any = false
  for (const t of list) {
    if (!t || typeof t !== 'object') continue
    const r = t as Record<string, unknown>
    if (r.price === undefined || r.price === null || r.price === '') continue
    const n = typeof r.price === 'number' ? r.price : Number(String(r.price).replace(/[^0-9.\-]/g, ''))
    if (!Number.isFinite(n)) continue
    const refund = String(r.CoR ?? r.cor ?? '').trim().toUpperCase() === 'R'
    total += refund ? -Math.abs(n) : n
    any = true
  }
  return any ? Math.round(total * 100) / 100 : null
}

/** Whether a piece's charge has been read (a `charged` event), so the poll reads it once and never again. */
export function mailChargeRead(events: MailEvent[] | null | undefined): boolean {
  return Array.isArray(events) && events.some((e) => e != null && typeof e === 'object' && e.kind === 'charged')
}
