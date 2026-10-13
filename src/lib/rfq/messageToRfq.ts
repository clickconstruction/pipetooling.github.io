/**
 * Messages, residential R8 · 10 (supply houses on bids@): an email from a supply house lands on the one open price
 * request it answers, so the RFQ page knows it arrived and the office never names it by hand. Lifted from the Messages
 * integrations mockups (branch spike/gc-mode, `to-dos/gc-mode/messages/customer-messages-integrations-mockups.html`
 * v0.2, card 10). Pure: the bids@ reader (cut 6) hands it the line, the sender and the house's requests.
 *
 * How it matches, strongest first:
 * - the request's token, from the `/q/<token>` link our email carried, quoted back in the reply;
 * - the bid's number, which our subject carries ("Price request · 2210 · …"), on a request to the sender's house, read
 *   in the subject first and then the body, whole numbers only, so "$2,210" or "22100" is never bid 2210;
 * - the house's one open request, when the email names none.
 * A token or a number lands on a request that is out (`sent`) or answered on its page (`quoted`), since a house may send
 * a revised price. The fallback reads `sent` alone. A draft or a closed request never takes a line. Anything else is a
 * plain line on the house's thread, with the reason.
 *
 * Before this, a house's reply was pasted into the Plug-in window by hand (`parseVendorReply`); nothing matched it.
 */
import type { ThreadMessage } from '../messages/thread'

/** The line as the matcher reads it. */
export type RfqMessage = Pick<ThreadMessage, 'channel' | 'direction' | 'subject' | 'body'>

/**
 * Who sent it, by shape: a supply house is a contact whose record is its `supply_houses` row, and a second rep at the
 * house is another contact on the same record. The house's name is the contact's company, or its own name.
 */
export interface RfqSender {
  name: string
  company?: string
  record: { table: string; id: string } | null
}

/** A price request as the matcher reads it: a `bid_rfqs` row with its bid's number and its house's name. */
export interface RfqRow {
  id: string
  /** `bid_rfqs.token`, 32 hex characters, the `/q/<token>` link. */
  token: string | null
  /** `bid_rfqs.status`: draft, sent, quoted or closed. */
  status: string
  supplyHouseId: string | null
  houseName: string
  /** The bid's `bid_number`, as our subject names it. */
  bidNumber: string | null
  /** When it went out, for the newest. */
  sentAt: string
}

export type RfqMatchHow = 'token' | 'number' | 'newest'

export type RfqMissWhy = 'not_an_email_in' | 'not_a_supply_house' | 'other_house' | 'several_named' | 'several_open' | 'none_open'

export type RfqMatch = { rfqId: string; how: RfqMatchHow } | { rfqId: null; why: RfqMissWhy; reason: string }

/** A request a token or a number may land on. */
const TAKES_A_NAMED_LINE = new Set(['sent', 'quoted'])

const TOKEN = /[0-9a-f]{32}/gi

/** The whole number, never inside a longer one, a price or a decimal: "2210" but not "$2210", "22100" or "2210.5". */
function namesNumber(text: string, n: string): boolean {
  const escaped = n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(?<![\\w$.,])${escaped}(?![\\w]|[.,]\\d)`, 'i').test(text)
}

const newestFirst = (a: RfqRow, b: RfqRow) => Date.parse(b.sentAt) - Date.parse(a.sentAt)

const houseOf = (sender: RfqSender) => (sender.company?.trim() || sender.name.trim())

/** The one open price request an email from a supply house answers, and how it matched; or why it lands on none. */
export function rfqForMessage(message: RfqMessage, sender: RfqSender, rfqs: readonly RfqRow[]): RfqMatch {
  if (message.channel !== 'email' || message.direction !== 'in')
    return { rfqId: null, why: 'not_an_email_in', reason: 'Only an email from the house lands on a price request.' }
  const houseId = sender.record?.table === 'supply_houses' ? sender.record.id : null
  if (!houseId) return { rfqId: null, why: 'not_a_supply_house', reason: `${sender.name} is not a supply house.` }
  const house = houseOf(sender)
  const subject = message.subject ?? ''
  const text = `${subject}\n${message.body}`

  // The token: our link, quoted back. A forwarded link is how a wrong price lands on the wrong house, so it must be theirs.
  const tokens = new Set((text.match(TOKEN) ?? []).map((t) => t.toLowerCase()))
  const byToken = rfqs.find((r) => r.token && TAKES_A_NAMED_LINE.has(r.status) && tokens.has(r.token.toLowerCase()))
  if (byToken) {
    if (byToken.supplyHouseId !== houseId)
      return { rfqId: null, why: 'other_house', reason: `The link is ${byToken.houseName}’s, the email is from ${house}.` }
    return { rfqId: byToken.id, how: 'token' }
  }

  // The bid's number, on a request to this house: the subject first, then the body.
  const ours = rfqs.filter((r) => r.supplyHouseId === houseId)
  const named = ours.filter((r) => TAKES_A_NAMED_LINE.has(r.status) && r.bidNumber?.trim())
  for (const where of [subject, message.body]) {
    const hits = named.filter((r) => namesNumber(where, r.bidNumber!.trim()))
    const bids = new Set(hits.map((r) => r.bidNumber!.trim()))
    if (bids.size > 1)
      return { rfqId: null, why: 'several_named', reason: `The email names ${bids.size} of the price requests to ${house}.` }
    if (hits.length) return { rfqId: [...hits].sort(newestFirst)[0]!.id, how: 'number' }
  }

  // The house's one open request.
  const open = ours.filter((r) => r.status === 'sent')
  if (open.length === 1) return { rfqId: open[0]!.id, how: 'newest' }
  if (open.length > 1)
    return { rfqId: null, why: 'several_open', reason: `${house} has ${open.length} open price requests, and the email names none of them.` }
  return { rfqId: null, why: 'none_open', reason: `No price request to ${house} is open.` }
}

/** What the caller knows of the email's files, from cut 6's `message_attachments` or a parse of them. */
export interface RfqLineCounts {
  /** Files on the email. */
  attachments?: number | null
  /** Price lines read from them. */
  lines?: number | null
}

/**
 * The small print under a house's email on the RFQ page, one fact each: "answered RFQ 2210", "pricing attached",
 * "14 lines". With no counts known, the email's subject stands in for them.
 */
export function rfqLineFacts(message: Pick<RfqMessage, 'subject'>, rfq: Pick<RfqRow, 'bidNumber'>, counts: RfqLineCounts = {}): string[] {
  const n = rfq.bidNumber?.trim()
  const facts = [n ? `answered RFQ ${n}` : 'answered the price request']
  const files = counts.attachments ?? 0
  const lines = counts.lines ?? 0
  if (files > 0) facts.push('pricing attached')
  if (lines > 0) facts.push(`${lines} ${lines === 1 ? 'line' : 'lines'}`)
  const subject = message.subject?.trim()
  if (files === 0 && lines === 0 && subject) facts.push(subject)
  return facts
}
