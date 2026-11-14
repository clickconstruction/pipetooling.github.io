import { PEOPLE_USERS_PATH } from '../people/peopleEmptyWords'
import { debitCardsHref } from '../banking/debitCards'
import type { NeedsYouSeverity } from '../dashboardNeedsYou'
import { RECEIPT_COMPANY_TZ } from '../tickets/receiptText'
import { fillInRowKey, type FillInRowBase } from './fillIn'

/**
 * The receipt kind (punch list #299, the step after PR 2): the rows behind the Needs you line *N card charges wait on a
 * receipt*. When a charge posts to a card, the app texts its holder a receipt link (`receipt-request`). A row here is a
 * charge that text cannot finish by itself: the holder has no cell on file, the card is tied to no one or to a person
 * who has left, the holder replied STOP, the text was turned away three times, or the holder was texted and reminded
 * and sent nothing. Each row says what happened and names the next press. The answer is one press, **Got it**, which
 * takes the row off the office's list and changes nothing else; **Copy the receipt link** is on the row for sending
 * the link by hand. Pure; `fillInReceiptsIo.ts` reads and writes.
 */
export type ReceiptChaseWhy = 'no_cell' | 'no_person' | 'archived' | 'opted_out' | 'failed' | 'no_answer'

const WHYS: readonly ReceiptChaseWhy[] = ['no_person', 'archived', 'no_cell', 'opted_out', 'failed', 'no_answer']

/** A row of `receipt_requests_to_chase()`. */
export type ReceiptChaseSource = {
  request_id: string
  mercury_transaction_id: string
  why: string
  holder_user_id: string | null
  holder_name: string | null
  store: string | null
  amount: number | string | null
  posted_at: string | null
  texted_at: string | null
  reminded_at: string | null
  closes_at: string | null
}

export type ReceiptFillInRow = FillInRowBase & {
  kind: 'receipt'
  requestId: string
  chargeId: string
  why: ReceiptChaseWhy
  /** *$228.58 at Ridgeway Supply* */
  chargeWords: string
  postedAtMs: number
}

function money(raw: number | string | null | undefined): string {
  const n = Math.abs(Number(raw) || 0)
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function receiptChaseChargeWords(s: Pick<ReceiptChaseSource, 'amount' | 'store'>): string {
  const store = (s.store ?? '').trim()
  return store ? `${money(s.amount)} at ${store}` : money(s.amount)
}

function firstName(name: string | null | undefined): string {
  return (name ?? '').trim().split(/\s+/)[0] ?? ''
}

function fmt(iso: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat('en-US', { timeZone: RECEIPT_COMPANY_TZ, ...options }).format(new Date(Date.parse(iso)))
}

/** *Tue 6:14 PM* on the company's clock. */
function dayClock(iso: string | null): string | null {
  if (!iso || !Number.isFinite(Date.parse(iso))) return null
  return `${fmt(iso, { weekday: 'short' })} ${fmt(iso, { hour: 'numeric', minute: '2-digit' })}`
}

/** *Nov 18* on the company's clock. */
function shortDay(iso: string | null): string | null {
  if (!iso || !Number.isFinite(Date.parse(iso))) return null
  return fmt(iso, { month: 'short', day: 'numeric' })
}

export function receiptChaseWhyOf(raw: string): ReceiptChaseWhy | null {
  return (WHYS as readonly string[]).includes(raw) ? (raw as ReceiptChaseWhy) : null
}

/** The row's sentence: what happened, in the words of the mock-up's frame T7. */
export function receiptChaseTitle(why: ReceiptChaseWhy, who: string, charge: string): string {
  const name = who || 'The holder'
  switch (why) {
    case 'no_cell':
      return `${name} has no cell on file, and ${charge} posted to their card.`
    case 'no_person':
      return `${charge} posted to a card tied to no one.`
    case 'archived':
      return `${charge} posted to ${who ? `${who}'s card` : 'a card'}, and ${who || 'its holder'} has left.`
    case 'opted_out':
      return `${name} asked for no texts, and ${charge} posted to their card.`
    case 'failed':
      return `The text to ${who || 'the holder'} about ${charge} did not go.`
    case 'no_answer':
      return `${name} was texted twice about ${charge} and sent no receipt.`
  }
}

/** What the app knows about the row, and what mends it. */
export function receiptChaseKnows(why: ReceiptChaseWhy, s: Pick<ReceiptChaseSource, 'texted_at' | 'reminded_at' | 'closes_at' | 'posted_at'>): string[] {
  const out: string[] = []
  const posted = dayClock(s.posted_at)
  if (posted) out.push(`The charge posted ${posted}.`)
  switch (why) {
    case 'no_cell':
      out.push('No text could go.', 'Add the cell on People, and the next charge texts them.', 'For this charge, ask for the receipt or send the link yourself.')
      break
    case 'no_person':
      out.push('No text could go.', 'Tie the card to its holder on Banking, and its next charge texts them.')
      break
    case 'archived':
      out.push('No text could go.', 'Tie the card to the person who holds it now on Banking.')
      break
    case 'opted_out':
      out.push('The carriers refuse a text after a STOP, so ask for the receipt another way.', 'A START from their phone brings the texts back.')
      break
    case 'failed':
      out.push('The phone service turned the text away three times.', 'Copy the receipt link and send it yourself.')
      break
    case 'no_answer': {
      const texted = dayClock(s.texted_at)
      const reminded = dayClock(s.reminded_at)
      if (texted && reminded) out.push(`Texted ${texted}, reminded ${reminded}.`)
      const closes = shortDay(s.closes_at)
      if (closes) out.push(`The link is open until ${closes}.`)
      break
    }
  }
  return out
}

/** Job Parts Tally → Transactions → Team: the charge's line, with + Ticket for a paper handed in. */
export const RECEIPT_CHASE_TEAM_HREF = '/tally?tab=transactions'

/** The row's own page: where the press that mends it lives. */
export function receiptChaseDoor(why: ReceiptChaseWhy, who: string): { doorHref: string; doorLabel: string } {
  if (why === 'no_cell') return { doorHref: PEOPLE_USERS_PATH, doorLabel: who ? `Add ${who}'s cell` : 'Add the cell' }
  if (why === 'no_person' || why === 'archived') return { doorHref: debitCardsHref(), doorLabel: 'Tie the card' }
  return { doorHref: RECEIPT_CHASE_TEAM_HREF, doorLabel: 'Open the Team queue' }
}

/** A text that did not go, a missing cell and a card with no holder lead: each is the app unable to ask at all. */
function severityOf(why: ReceiptChaseWhy): NeedsYouSeverity {
  return why === 'no_answer' || why === 'opted_out' ? 'gray' : 'amber'
}

/** The newest charge first. */
export function compareReceiptRows(a: ReceiptFillInRow, b: ReceiptFillInRow): number {
  return b.postedAtMs - a.postedAtMs || a.requestId.localeCompare(b.requestId)
}

export function receiptFillInRows(sources: readonly ReceiptChaseSource[]): ReceiptFillInRow[] {
  const rows: ReceiptFillInRow[] = []
  for (const s of sources) {
    const why = receiptChaseWhyOf(s.why)
    // A reason this build does not know is left off the list, not guessed at.
    if (!why || !s.request_id || !s.mercury_transaction_id) continue
    const who = why === 'no_person' ? '' : firstName(s.holder_name)
    const chargeWords = receiptChaseChargeWords(s)
    const posted = s.posted_at ? Date.parse(s.posted_at) : NaN
    rows.push({
      key: fillInRowKey('receipt', s.request_id),
      kind: 'receipt',
      severity: severityOf(why),
      title: receiptChaseTitle(why, who, chargeWords),
      knows: receiptChaseKnows(why, s),
      ...receiptChaseDoor(why, who),
      requestId: s.request_id,
      chargeId: s.mercury_transaction_id,
      why,
      chargeWords,
      postedAtMs: Number.isFinite(posted) ? posted : 0,
    })
  }
  return rows.sort(compareReceiptRows)
}

export type ReceiptChaseCounts = { count: number; byWhy: Record<ReceiptChaseWhy, number> }

export function receiptChaseCounts(sources: readonly ReceiptChaseSource[]): ReceiptChaseCounts {
  const byWhy: Record<ReceiptChaseWhy, number> = { no_cell: 0, no_person: 0, archived: 0, opted_out: 0, failed: 0, no_answer: 0 }
  let count = 0
  for (const s of sources) {
    const why = receiptChaseWhyOf(s.why)
    if (!why) continue
    byWhy[why] += 1
    count += 1
  }
  return { count, byWhy }
}

/**
 * The Needs you line's detail: how many of each, in the order the office mends them.
 *
 *   2 with no cell on file, 1 on a card tied to no one, 1 after a STOP, 3 texted twice with no answer.
 */
export function receiptChaseDetail(c: ReceiptChaseCounts): string {
  const parts: string[] = []
  const noHolder = c.byWhy.no_person + c.byWhy.archived
  if (c.byWhy.no_cell > 0) parts.push(`${c.byWhy.no_cell} with no cell on file`)
  if (noHolder > 0) parts.push(`${noHolder} on a card tied to no one`)
  if (c.byWhy.opted_out > 0) parts.push(`${c.byWhy.opted_out} after a STOP`)
  if (c.byWhy.failed > 0) parts.push(`${c.byWhy.failed} whose text did not go`)
  if (c.byWhy.no_answer > 0) parts.push(`${c.byWhy.no_answer} texted twice with no answer`)
  return parts.length > 0 ? `${parts.join(', ')}. Each row names its next press.` : 'Each row names its next press.'
}

/** The saved line on the deck's trail. */
export function receiptTrailWords(row: Pick<ReceiptFillInRow, 'chargeWords'>): string {
  return `Got it: ${row.chargeWords}.`
}

export const RECEIPT_CHASE_WORDS = {
  gotIt: 'Got it',
  copyLink: 'Copy the receipt link',
  copying: 'Copying…',
  gotItHint: 'Got it takes the row off this list. The link stays open, and a receipt that comes later still lands on the charge.',
} as const

/** Fired when a Got it or its Undo lands, so the Needs you line counts again. */
export const RECEIPT_CHASE_CHANGED_EVENT = 'receipt-chase-changed'
