/**
 * Counter tickets (punch list #295, PR 1): a photo of a supply house ticket or a receipt, taken at the counter. The
 * pure rules over a `counter_tickets` row: what state a ticket is in, the words each state reads as, and whether the
 * person who took it may still change it. The bucket path and the Drive name live in
 * `supabase/functions/_shared/ticketNames.ts`, one source for the `photo-save` sweep and the screens; this file
 * re-exports them. How a ticket meets its card charge is `ticketMatch.ts`.
 */
import { formatCurrency } from '../format'

export {
  COUNTER_TICKETS_BUCKET,
  TICKET_FOLDER_PATH,
  TICKET_NAME_MAX,
  TICKET_NAME_SEPARATOR,
  TICKET_PAGE_MIMES,
  ticketDriveName,
  ticketFileExt,
  ticketStoragePath,
  type TicketNameInput,
} from '../../../supabase/functions/_shared/ticketNames'

/** How a ticket met its charge: with no press (`minute`, `total`), on a person's Yes (`asked`), or by the office's pick. */
export type TicketMatchKind = 'minute' | 'total' | 'asked' | 'picked'
/** Where `taken_at` came from: the shutter at the counter, the time the picture carries, or nothing that says when. */
export type TicketTakenAtFrom = 'press' | 'photo' | 'none'
export type TicketSource = 'camera' | 'file' | 'office'
export type TicketPaidOther = 'cash' | 'own_money' | 'another_card' | 'other'

/** A `counter_tickets` row, as the screens read it. */
export interface CounterTicket {
  id: string
  taken_by: string | null
  taken_by_name: string
  taken_at: string
  taken_at_from: TicketTakenAtFrom
  source: TicketSource
  job_id: string | null
  also_job_ids: string[]
  no_one_job: boolean
  po_entry_id: string | null
  total: number | null
  note: string
  added_at: string | null
  mercury_transaction_id: string | null
  match_kind: TicketMatchKind | null
  matched_at: string | null
  matched_by: string | null
  declined_transaction_ids: string[]
  paid_other: TicketPaidOther | null
  paid_other_note: string
  supply_house_invoice_id: string | null
  used_at: string | null
  removed_at: string | null
}

/** The columns of `CounterTicket`, for a select. */
export const COUNTER_TICKET_COLUMNS =
  'id, taken_by, taken_by_name, taken_at, taken_at_from, source, job_id, also_job_ids, no_one_job, po_entry_id, total, note, added_at, mercury_transaction_id, match_kind, matched_at, matched_by, declined_transaction_ids, paid_other, paid_other_note, supply_house_invoice_id, used_at, removed_at'

/** A `counter_ticket_pages` row, as the screens read it. */
export interface CounterTicketPage {
  id: string
  ticket_id: string
  page_no: number
  mime: string
  storage_path: string | null
  drive_file_id: string | null
  filed_at: string | null
  fail_why: string | null
}

export const COUNTER_TICKET_PAGE_COLUMNS = 'id, ticket_id, page_no, mime, storage_path, drive_file_id, filed_at, fail_why'

/**
 * Where a ticket stands, the first that holds:
 * - `removed`: taken by mistake and hidden.
 * - `open`: the sheet was never saved.
 * - `matched`: tied to its card charge.
 * - `billed`: recorded as a supply house bill.
 * - `paid_other`: no card charge will fit, and the office said how it was paid.
 * - `on_account`: bought on a PO code, and the bill has not come.
 * - `waiting`: nothing has met it yet.
 */
export type TicketState = 'removed' | 'open' | 'matched' | 'billed' | 'paid_other' | 'on_account' | 'waiting'

type StateFacts = Pick<CounterTicket, 'removed_at' | 'added_at' | 'mercury_transaction_id' | 'supply_house_invoice_id' | 'paid_other' | 'po_entry_id'>

export function ticketState(t: StateFacts): TicketState {
  if (t.removed_at) return 'removed'
  if (!t.added_at) return 'open'
  if (t.mercury_transaction_id) return 'matched'
  if (t.supply_house_invoice_id) return 'billed'
  if (t.paid_other) return 'paid_other'
  if (t.po_entry_id) return 'on_account'
  return 'waiting'
}

/** A ticket nothing has met yet: the two states the lists keep asking about. */
export function ticketIsOpen(t: StateFacts): boolean {
  const s = ticketState(t)
  return s === 'waiting' || s === 'on_account'
}

/** The charge a matched ticket names, as much of it as the words need. */
export interface TicketChargeFacts {
  /** Signed dollars as the bank feed has them: a purchase is below zero, money back is above. */
  amount: number
  counterparty_name: string | null
}

const PAID_OTHER_WORDS: Readonly<Record<TicketPaidOther, string>> = {
  cash: 'Paid with cash',
  own_money: 'Paid with their own money',
  another_card: 'Paid on another card',
  other: 'Paid another way',
}

/** *$228.58 at Ridgeway Supply*, or *$41.17 back from Cedar Bend Hardware* for money that came back. */
export function ticketChargeWords(charge: TicketChargeFacts): string {
  const money = `$${formatCurrency(Math.abs(charge.amount))}`
  const store = String(charge.counterparty_name ?? '').trim()
  if (charge.amount > 0) return store ? `${money} back from ${store}` : `${money} back`
  return store ? `${money} at ${store}` : money
}

/**
 * The one line a ticket's state reads as on a list. `charge` is the matched charge when the reader can see it, and
 * `invoiceNumber` the bill's number when the ticket became one.
 */
export function ticketStateWords(t: StateFacts & Pick<CounterTicket, 'paid_other'>, facts: { charge?: TicketChargeFacts | null; invoiceNumber?: string | null } = {}): string {
  switch (ticketState(t)) {
    case 'removed':
      return 'Removed'
    case 'open':
      return 'Not saved yet'
    case 'matched':
      return facts.charge ? `Matched to ${ticketChargeWords(facts.charge)}` : 'Matched to its charge'
    case 'billed': {
      const n = String(facts.invoiceNumber ?? '').trim()
      return n ? `Recorded as bill ${n}` : 'Recorded as a bill'
    }
    case 'paid_other':
      return PAID_OTHER_WORDS[t.paid_other ?? 'other']
    case 'on_account':
      return 'On account, waiting for the bill'
    case 'waiting':
      return 'Waiting for its charge or its bill'
  }
}

/** How a match was made, for the office's window: *Matched by the time of the swipe*, and the like. */
export function ticketMatchKindWords(kind: TicketMatchKind): string {
  switch (kind) {
    case 'minute':
      return 'Matched by the time of the swipe'
    case 'total':
      return 'Matched by the total'
    case 'asked':
      return 'Matched on a Yes'
    case 'picked':
      return 'Matched by the office'
  }
}

/** The person who took a ticket changes its job, adds a page or removes it until the office has used it. */
export function takerMayChange(t: Pick<CounterTicket, 'used_at' | 'removed_at'>): boolean {
  return !t.used_at && !t.removed_at
}

/** Every job a ticket names, the first one first, with no job twice. */
export function ticketJobIds(t: Pick<CounterTicket, 'job_id' | 'also_job_ids'>): string[] {
  const out: string[] = []
  for (const id of [t.job_id, ...(t.also_job_ids ?? [])]) if (id && !out.includes(id)) out.push(id)
  return out
}
