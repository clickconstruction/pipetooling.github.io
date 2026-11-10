/**
 * The match between a ticket and its charge, written (punch list #295, PR 3). `ticketMatch.ts` decides; this file
 * turns the app's charge rows into what it reads, writes a match the kernel made with no press, and writes the
 * answers people give: Yes, No, the office's pick, another way it was paid. Whichever screen runs first writes the
 * match: the tech's My tickets over their own card's charges, or the office's Team queue over everyone's. The table's
 * guard refuses a taker a charge that is not on their card, and its unique index refuses the second ticket on one
 * charge, so two screens running at once still leave one match. Browser io, not pure.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import { formatErrorMessage, databaseErrorFromResult } from '../../utils/errorHandling'
import { mercurySwipeAtIso } from '../mercurySwipeTime'
import type { TallyLinkedMercuryRow } from '../mercuryTxRowFromTally'
import type { CardChargeWindowRow } from '../banking/cardChargesWindow'
import type { StaleStaffRow } from '../tally/teamPurchaseRows'
import { COUNTER_TICKET_COLUMNS, COUNTER_TICKET_PAGE_COLUMNS, type CounterTicket, type TicketPaidOther } from './ticket'
import { matchTickets, type MatchCharge, type MatchTicket, type TicketMatch } from './ticketMatch'
import type { TicketWithPages } from './ticketsIo'

const db = supabase as unknown as SupabaseClient

function statusOfRaw(raw: unknown): string {
  const s = raw && typeof raw === 'object' ? (raw as { status?: unknown }).status : null
  return typeof s === 'string' && s ? s : 'sent'
}

function msOf(iso: string | null | undefined): number {
  const ms = iso ? Date.parse(iso) : NaN
  return Number.isFinite(ms) ? ms : NaN
}

/** A charge on the tech's own card, as `list_my_linked_mercury_transactions_for_tally` answers it (pending rows too). */
export function matchChargeFromLinkedRow(row: TallyLinkedMercuryRow, holderId: string): MatchCharge {
  return { id: row.mercury_transaction_id, cardHolderId: holderId, swipeAtMs: msOf(mercurySwipeAtIso(row.raw, row.posted_at) ?? row.posted_at), amount: Number(row.amount), status: statusOfRaw(row.raw) }
}

/** A charge in the office's window (`list_card_charges_window`), posted rows with their holder. */
export function matchChargeFromWindowRow(row: CardChargeWindowRow): MatchCharge {
  return { id: row.id, cardHolderId: row.holderUserId ?? null, swipeAtMs: msOf(row.purchasedAt ?? row.postedAt), amount: Number(row.amount), status: row.status ?? 'sent' }
}

/** A charge on the office's To sort list (`list_stale_unlinked_mercury_transactions_for_tally_staff`). */
export function matchChargeFromStaffRow(row: StaleStaffRow): MatchCharge {
  return { id: row.mercury_transaction_id, cardHolderId: row.target_user_id ?? null, swipeAtMs: msOf(mercurySwipeAtIso(row.raw, row.posted_at) ?? row.posted_at), amount: Number(row.amount), status: statusOfRaw(row.raw) }
}

/** The kernel's view of a ticket. */
export function matchTicketOf(t: CounterTicket): MatchTicket {
  return { id: t.id, takenBy: t.taken_by, takenAtMs: msOf(t.taken_at), takenAtFrom: t.taken_at_from, total: t.total, declined: t.declined_transaction_ids ?? [] }
}

/** Charges once, by id; the first row with an id wins, and a charge a live ticket holds is marked. */
export function mergeMatchCharges(lists: readonly (readonly MatchCharge[])[], held: ReadonlyMap<string, { id: string }>): MatchCharge[] {
  const out = new Map<string, MatchCharge>()
  for (const list of lists) for (const c of list) if (!out.has(c.id)) out.set(c.id, { ...c, ticketId: held.get(c.id)?.id ?? null })
  return [...out.values()]
}

/** A match the kernel made with no press, written where the row has none yet. False when the write was refused. */
export async function writeMadeMatch(ticketId: string, chargeId: string, by: 'minute' | 'total'): Promise<boolean> {
  const { error } = await db.from('counter_tickets').update({ mercury_transaction_id: chargeId, match_kind: by }).eq('id', ticketId).is('mercury_transaction_id', null).is('removed_at', null)
  return !error
}

/**
 * Every open ticket against the charges: the kernel's answers, the made matches written. Answers the map (a written
 * match reads as `made`), and how many were written, so the caller reads again when any were.
 */
export async function runTicketMatches(tickets: readonly CounterTicket[], charges: readonly MatchCharge[]): Promise<{ matches: Map<string, TicketMatch>; written: number }> {
  const open = tickets.filter((t) => !t.removed_at && t.added_at && !t.mercury_transaction_id && !t.paid_other && !t.supply_house_invoice_id)
  const matches = matchTickets(open.map(matchTicketOf), charges)
  let written = 0
  for (const [ticketId, m] of matches) {
    if (m.kind !== 'made') continue
    if (await writeMadeMatch(ticketId, m.chargeId, m.by)) written += 1
  }
  return { matches, written }
}

/** Yes to the one charge that fits: the match, on a person's word. Throws with the reason. */
export async function answerTicketYes(ticketId: string, chargeId: string, by: 'asked' | 'picked' = 'asked'): Promise<void> {
  const { error } = await db.from('counter_tickets').update({ mercury_transaction_id: chargeId, match_kind: by }).eq('id', ticketId)
  if (error) throw new Error(formatErrorMessage(error, 'The match did not save.'))
}

/** No, or Not this charge: the charge joins the ticket's declined list and the match, if it was this charge, comes off. */
export async function answerTicketNo(ticket: Pick<CounterTicket, 'id' | 'declined_transaction_ids' | 'mercury_transaction_id'>, chargeId: string): Promise<void> {
  const declined = [...new Set([...(ticket.declined_transaction_ids ?? []), chargeId])]
  const write: Record<string, unknown> = { declined_transaction_ids: declined }
  if (ticket.mercury_transaction_id === chargeId) write.mercury_transaction_id = null
  const { error } = await db.from('counter_tickets').update(write).eq('id', ticket.id)
  if (error) throw new Error(formatErrorMessage(error, 'The answer did not save.'))
}

/** The office says how a ticket with no charge was paid. Throws with the reason. */
export async function setTicketPaidOther(ticketId: string, how: TicketPaidOther, note = ''): Promise<void> {
  const { error } = await db.from('counter_tickets').update({ paid_other: how, paid_other_note: note.slice(0, 300), used_at: new Date().toISOString() }).eq('id', ticketId)
  if (error) throw new Error(formatErrorMessage(error, 'That did not save.'))
}

/** The office has acted on these charges' tickets (sorted the charge with the ticket in front): they are used. */
export async function markTicketsUsedByCharge(chargeIds: readonly string[]): Promise<void> {
  if (chargeIds.length === 0) return
  await db.from('counter_tickets').update({ used_at: new Date().toISOString() }).in('mercury_transaction_id', [...chargeIds]).is('used_at', null).is('removed_at', null)
}

/** The office leaves a charge where it went, against the ticket's word: the ticket is used and stops asking. */
export async function markTicketUsed(ticketId: string): Promise<void> {
  const { error } = await db.from('counter_tickets').update({ used_at: new Date().toISOString() }).eq('id', ticketId).is('used_at', null)
  if (error) throw new Error(formatErrorMessage(error, 'That did not save.'))
}

/** A ticket's PO code and the house it names, read beside the ticket for the office (PR 4). */
export type TicketPoFacts = { po_code: number | string | null; supply_house_id: string | null } | null

/** Every live, saved ticket taken since a day, with its pages, for the office. Throws the app's error. */
export async function listOfficeTickets(sinceIso: string, limit = 400): Promise<(TicketWithPages & { po?: TicketPoFacts })[]> {
  const { data, error, status } = await db
    .from('counter_tickets')
    .select(`${COUNTER_TICKET_COLUMNS}, counter_ticket_pages(${COUNTER_TICKET_PAGE_COLUMNS}), po:material_po_generator_entries(po_code, supply_house_id)`)
    .is('removed_at', null)
    .not('added_at', 'is', null)
    .gte('taken_at', sinceIso)
    .order('taken_at', { ascending: false })
    .limit(limit)
  if (error) throw databaseErrorFromResult(error, 'read the tickets', status)
  return ((data ?? []) as unknown as (TicketWithPages & { po?: TicketPoFacts })[]).map((t) => ({ ...t, also_job_ids: t.also_job_ids ?? [], declined_transaction_ids: t.declined_transaction_ids ?? [], counter_ticket_pages: [...(t.counter_ticket_pages ?? [])].sort((a, b) => a.page_no - b.page_no) }))
}

/** The job a person's own matched tickets name, by charge: the purchase card's chip and the sort window's first job. */
export async function listMyTicketJobsByCharge(userId: string): Promise<Map<string, { ticketId: string; jobId: string | null }>> {
  const { data } = await db.from('counter_tickets').select('id, mercury_transaction_id, job_id, also_job_ids').eq('taken_by', userId).is('removed_at', null).not('mercury_transaction_id', 'is', null).limit(300)
  const out = new Map<string, { ticketId: string; jobId: string | null }>()
  for (const r of (data ?? []) as Array<{ id: string; mercury_transaction_id: string; job_id: string | null; also_job_ids: string[] | null }>) out.set(r.mercury_transaction_id, { ticketId: r.id, jobId: r.job_id ?? r.also_job_ids?.[0] ?? null })
  return out
}

/**
 * The account tickets a supply house's Add invoice may start from (PR 4): bought on a PO code at this house, saved,
 * live, and not yet a bill or a charge. Newest first. Throws the app's error.
 */
export async function listAccountTicketsForHouse(supplyHouseId: string, limit = 20): Promise<(TicketWithPages & { po: TicketPoFacts })[]> {
  const { data, error, status } = await db
    .from('counter_tickets')
    .select(`${COUNTER_TICKET_COLUMNS}, counter_ticket_pages(${COUNTER_TICKET_PAGE_COLUMNS}), po:material_po_generator_entries!inner(po_code, supply_house_id)`)
    .eq('po.supply_house_id', supplyHouseId)
    .is('removed_at', null)
    .not('added_at', 'is', null)
    .is('supply_house_invoice_id', null)
    .is('mercury_transaction_id', null)
    .order('taken_at', { ascending: false })
    .limit(limit)
  if (error) throw databaseErrorFromResult(error, 'read the tickets on account', status)
  return ((data ?? []) as unknown as (TicketWithPages & { po: TicketPoFacts })[]).map((t) => ({ ...t, also_job_ids: t.also_job_ids ?? [], declined_transaction_ids: t.declined_transaction_ids ?? [], counter_ticket_pages: [...(t.counter_ticket_pages ?? [])].sort((a, b) => a.page_no - b.page_no) }))
}

/** The bill a ticket became: the invoice on the ticket, and the ticket used. Best effort after the save; throws with the reason. */
export async function linkTicketToInvoice(ticketId: string, invoiceId: string): Promise<void> {
  const { error } = await db.from('counter_tickets').update({ supply_house_invoice_id: invoiceId, used_at: new Date().toISOString() }).eq('id', ticketId)
  if (error) throw new Error(formatErrorMessage(error, 'The ticket did not take the bill.'))
}
