/**
 * A mail piece (the Docsmit train, PR 1 — `docs/DOCSMIT_LIEN_RUN_PLAN.md`): the pure rules the run,
 * the provider function and the poll share. Which envelope a page count takes, the send type the
 * owner chose (D1: electronic return receipt), the client message id, the status fold over what a
 * provider says, and the send-by time a window's last day and the provider's cutoff make.
 */
export type MailProvider = 'docsmit'

export type MailPieceStatus = 'prepared' | 'sent' | 'mailed' | 'in_transit' | 'notice_left' | 'delivered' | 'returned' | 'failed' | 'unknown'

/** Docsmit's send types, as its API spells them. D1: the electronic return receipt by default; the green card is the per-envelope choice. */
export const DOCSMIT_SEND_TYPES = {
  electronic: 'Certified, Electronic Return Receipt',
  card: 'Certified, Return Receipt',
  firstClass: 'First Class',
} as const

export type MailReceipt = 'electronic' | 'card'

export function docsmitSendType(receipt: MailReceipt): string {
  return receipt === 'card' ? DOCSMIT_SEND_TYPES.card : DOCSMIT_SEND_TYPES.electronic
}

/** Docsmit's envelopes by sheet count: a #10 holds 5 sheets, a flat 47; past that the envelope is held with a reason. */
export const MAIL_ENVELOPE_SHEETS = { '#10': 5, Flat: 47 } as const

export type MailEnvelopeChoice = { envelope: '#10' | 'Flat'; sheets: number; problem: null } | { envelope: null; sheets: number; problem: string }

export function mailEnvelopeFor(pages: number, sided: 1 | 2 = 1): MailEnvelopeChoice {
  const sheets = Math.max(0, Math.ceil(pages / sided))
  if (sheets === 0) return { envelope: null, sheets, problem: 'Nothing to mail: the copy has no pages.' }
  if (sheets <= MAIL_ENVELOPE_SHEETS['#10']) return { envelope: '#10', sheets, problem: null }
  if (sheets <= MAIL_ENVELOPE_SHEETS.Flat) return { envelope: 'Flat', sheets, problem: null }
  return { envelope: null, sheets, problem: `${sheets} sheets is more than a flat holds (${MAIL_ENVELOPE_SHEETS.Flat}). Print this one here and carry it.` }
}

/** Our key on the provider's message: the piece's kind and id, so a poll can match what comes back. */
export function mailClientMsgId(kind: string, pieceId: string): string {
  return `${kind}:${pieceId}`
}

export function parseMailClientMsgId(s: string): { kind: string; pieceId: string } | null {
  const i = s.indexOf(':')
  if (i <= 0 || i === s.length - 1) return null
  return { kind: s.slice(0, i), pieceId: s.slice(i + 1) }
}

/**
 * The status fold: what a provider's party record says, in our words. Docsmit returns one
 * `DeliveryStatus` string as USPS wrote it and its `DStatusao` instant; a string the fold has not
 * seen goes to `unknown`, the needs-a-person bucket, never guessed.
 */
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

/** The statuses that still want the poll; the rest are settled. */
export function mailStatusOpen(status: MailPieceStatus): boolean {
  return status === 'sent' || status === 'mailed' || status === 'in_transit' || status === 'notice_left' || status === 'unknown'
}

/**
 * A certified notice is given the day USPS accepts it, and the provider mails each day's batch at
 * a cutoff (Central). So the window's last day becomes a send-by day: the last day less the buffer
 * in business days, at the cutoff. `cutoffLocal` is "15:00".
 */
/** ymd less n business days (Sat/Sun skipped; legal holidays are not modeled, like `addBusinessDays`). */
export function subtractBusinessDays(ymd: string, days: number): string {
  const base = new Date(ymd + 'T12:00:00')
  if (Number.isNaN(base.getTime())) return ymd
  let left = Math.max(0, days)
  while (left > 0) {
    base.setDate(base.getDate() - 1)
    const dow = base.getDay()
    if (dow !== 0 && dow !== 6) left--
  }
  return base.toISOString().slice(0, 10)
}

export function mailSendBy(windowLastYmd: string, opts: { bufferBusinessDays: number; cutoffLocal: string }): { ymd: string; cutoffLocal: string; words: string } {
  const ymd = subtractBusinessDays(windowLastYmd, opts.bufferBusinessDays)
  const [h, m] = opts.cutoffLocal.split(':').map(Number)
  const hour12 = ((h ?? 15) + 11) % 12 + 1
  const ampm = (h ?? 15) >= 12 ? 'pm' : 'am'
  const clock = `${hour12}:${String(m ?? 0).padStart(2, '0')} ${ampm}`
  return { ymd, cutoffLocal: opts.cutoffLocal, words: `Send to Docsmit by ${ymd} at ${clock}` }
}

/** Past the cutoff on the send-by day, or past the day: the month mails late. */
export function mailSendIsLate(nowYmd: string, nowLocal: string, sendBy: { ymd: string; cutoffLocal: string }): boolean {
  if (nowYmd > sendBy.ymd) return true
  if (nowYmd < sendBy.ymd) return false
  return nowLocal >= sendBy.cutoffLocal
}
