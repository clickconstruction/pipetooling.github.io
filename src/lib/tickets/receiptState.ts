/**
 * The receipt's state on a card charge (punch list #299, PR 3): what the Banking ledger and Job Summary's cost
 * drill-down say beside a charge. A charge with its paper says which door the paper came by; a charge the app texted
 * about says when; a charge it could not text says why. A charge with none of these says nothing, since most of the
 * ledger is older than the receipt text. The Team queue draws the same facts as a chip and a line of their own
 * (`receiptLineWords`); this is the short form for a table cell. Pure.
 */
import { receiptLineWords, type ReceiptRequestState } from './receiptText'

/** What is known about one charge: the live ticket on it, and its request. */
export interface ReceiptStateFacts {
  ticket: { source: string | null } | null
  request: ReceiptRequestState | null
}

export type ReceiptStateTone = 'has' | 'waiting' | 'held'

export interface ReceiptState {
  /** The words in the cell: *Ticket*, *Receipt from the link*, *Texted 6:14 PM*, *No text*. */
  chip: string
  tone: ReceiptStateTone
  /** The sentence behind the chip, for its title and for a screen reader. */
  title: string
}

const TICKET_DOOR: Record<string, string> = {
  camera: 'A photo taken at the counter is on this charge.',
  file: 'A photo or a PDF from the phone is on this charge.',
  office: 'A paper handed in at the desk is on this charge.',
  link: 'A photo sent through the receipt link is on this charge.',
}

/** The state of one charge, or null when there is nothing to say. A ticket wins: the paper is what was wanted. */
export function receiptStateOf(facts: ReceiptStateFacts | null | undefined, nowMs: number): ReceiptState | null {
  if (!facts) return null
  if (facts.ticket) {
    const source = facts.ticket.source ?? ''
    return { chip: source === 'link' ? 'Receipt from the link' : 'Ticket', tone: 'has', title: TICKET_DOOR[source] ?? 'A ticket is on this charge.' }
  }
  if (!facts.request) return null
  const line = receiptLineWords(facts.request, nowMs)
  if (!line) return null
  return { chip: line.chip, tone: line.tone, title: [line.words, line.next].filter(Boolean).join(' ') }
}

const CARD_KINDS: ReadonlySet<string> = new Set(['debitCardTransaction', 'creditCardTransaction'])

/** How far back a table asks about receipts. A receipt link closes after 14 days; two months covers a month's close. */
export const RECEIPT_STATE_DAYS = 60
/** The most charges one table asks about, the newest first. */
export const RECEIPT_STATE_MAX = 600

export interface ReceiptStateCharge {
  id: string
  kind?: string | null
  amount?: number | string | null
  /** When the charge was made or posted, whichever the row has. */
  at: string | null | undefined
}

/**
 * The charges of a table worth asking about: card purchases of the last 60 days, the newest 600. A row with no kind
 * (Job Summary's lines are card charges already) is taken as one; money back and anything older are left out, so a
 * ledger of fifteen thousand rows asks about a few hundred.
 */
export function receiptStateChargeIds(rows: readonly ReceiptStateCharge[], nowMs: number): string[] {
  const floor = nowMs - RECEIPT_STATE_DAYS * 24 * 60 * 60 * 1000
  const hits: { id: string; at: number }[] = []
  const seen = new Set<string>()
  for (const r of rows) {
    if (!r.id || seen.has(r.id)) continue
    if (r.kind != null && !CARD_KINDS.has(r.kind)) continue
    if (r.amount != null && !(Number(r.amount) < 0)) continue
    const at = r.at ? Date.parse(r.at) : NaN
    if (!Number.isFinite(at) || at < floor) continue
    seen.add(r.id)
    hits.push({ id: r.id, at })
  }
  return hits
    .sort((a, b) => b.at - a.at || a.id.localeCompare(b.id))
    .slice(0, RECEIPT_STATE_MAX)
    .map((h) => h.id)
}

/** The states of many charges at once. */
export function receiptStatesOf(facts: ReadonlyMap<string, ReceiptStateFacts>, nowMs: number): Map<string, ReceiptState> {
  const out = new Map<string, ReceiptState>()
  for (const [chargeId, f] of facts) {
    const state = receiptStateOf(f, nowMs)
    if (state) out.set(chargeId, state)
  }
  return out
}
