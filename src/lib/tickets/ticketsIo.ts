/**
 * The reads and writes behind a counter ticket (punch list #295, PR 2). The row goes to `counter_tickets` first, then
 * each page's bytes to the private `counter-tickets` bucket as `<uploader>/<ticket_id>/<page_id>.<ext>` with a row in
 * `counter_ticket_pages`, and last the ticket takes `added_at`, which is what the lists and the photo sweep read. Every
 * step is the same write on a second try (the ids are minted on the phone), so a ticket kept with no signal and sent
 * later counts once. Browser io, not pure. The tables are not in the generated types until the types PR, so the client
 * is cast once here, and a database ahead of the push answers a refusal in words.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import { databaseErrorFromResult, errorKindOf, formatErrorMessage, type DatabaseErrorKind } from '../../utils/errorHandling'
import {
  COUNTER_TICKETS_BUCKET,
  COUNTER_TICKET_COLUMNS,
  COUNTER_TICKET_PAGE_COLUMNS,
  ticketStoragePath,
  type CounterTicket,
  type CounterTicketPage,
  type TicketSource,
  type TicketTakenAtFrom,
} from './ticket'

const db = supabase as unknown as SupabaseClient

/** The name the shot-tile rule reads (`sendLostSignal`): a `network` failure is the phone with no signal. */
export const TICKET_SEND_ERROR_NAME = 'TicketSendError'

/** Why a ticket did not send, with its class. */
export class TicketSendError extends Error {
  kind: DatabaseErrorKind
  constructor(message: string, kind: DatabaseErrorKind) {
    super(message)
    this.name = TICKET_SEND_ERROR_NAME
    this.kind = kind
  }
}

/** A ticket as the sheet hands it over: the row's facts, under an id minted on the phone. */
export interface TicketDraft {
  id: string
  takenBy: string
  takenByName: string
  takenAt: string
  takenAtFrom: TicketTakenAtFrom
  source: TicketSource
  jobId: string | null
  alsoJobIds: string[]
  noOneJob: boolean
  poEntryId: string | null
  total: number | null
  note: string
}

/** One page of it: the bytes and where the page stands. */
export interface TicketPageDraft {
  id: string
  pageNo: number
  blob: Blob
  mime: string
  originalBytes: number
  width: number
  height: number
  takenAt: string
}

function offline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false
}

/** The ticket's row, written once: a second try finds it and changes nothing. `added_at` stays empty until it lands. */
export async function sendTicketRow(t: TicketDraft): Promise<void> {
  if (offline()) throw new TicketSendError('The phone has no signal.', 'network')
  const { error } = await db.from('counter_tickets').upsert(
    {
      id: t.id,
      taken_by: t.takenBy,
      taken_by_name: t.takenByName,
      taken_at: t.takenAt,
      taken_at_from: t.takenAtFrom,
      source: t.source,
      job_id: t.jobId,
      also_job_ids: t.alsoJobIds,
      no_one_job: t.noOneJob,
      po_entry_id: t.poEntryId,
      total: t.total,
      note: t.note,
    },
    { onConflict: 'id', ignoreDuplicates: true },
  )
  if (error) throw new TicketSendError(formatErrorMessage(error, 'The ticket did not send.'), errorKindOf(error))
}

/**
 * One page: the bytes to the bucket, then its row. The ticket's row must be there first (`sendTicketRow`), since a page
 * joins only a ticket of the sender's. Throws with the reason; the caller keeps the page on the phone on a lost signal.
 */
export async function sendTicketPage(ticket: { id: string; uploaderId: string }, p: TicketPageDraft): Promise<{ storagePath: string }> {
  if (offline()) throw new TicketSendError('The phone has no signal.', 'network')
  const storagePath = ticketStoragePath({ uploaderId: ticket.uploaderId, ticketId: ticket.id, pageId: p.id, mime: p.mime })
  const { error } = await db.storage.from(COUNTER_TICKETS_BUCKET).upload(storagePath, p.blob, { contentType: p.mime || p.blob.type || 'image/jpeg', upsert: true })
  if (error) throw new TicketSendError(formatErrorMessage(error, 'The page did not send.'), errorKindOf(error))
  const { error: rowError } = await db.from('counter_ticket_pages').upsert(
    {
      id: p.id,
      ticket_id: ticket.id,
      page_no: p.pageNo,
      by_user_id: ticket.uploaderId,
      mime: p.mime || 'image/jpeg',
      bytes: p.blob.size,
      original_bytes: p.originalBytes,
      width: p.width,
      height: p.height,
      storage_path: storagePath,
      taken_at: p.takenAt,
    },
    { onConflict: 'id', ignoreDuplicates: true },
  )
  if (rowError) throw new TicketSendError(formatErrorMessage(rowError, 'The page did not send.'), errorKindOf(rowError))
  return { storagePath }
}

/**
 * The ticket lands: `added_at` on a row that has none, so a repeat changes nothing. Throws the app's `DatabaseError`
 * on a refusal or a lost signal, for the outbox to class.
 */
export async function landTicket(ticketId: string): Promise<{ landed: number }> {
  const { data, error, status } = await db.from('counter_tickets').update({ added_at: new Date().toISOString() }).eq('id', ticketId).is('added_at', null).select('id')
  if (error) throw databaseErrorFromResult(error, 'save the ticket', status)
  return { landed: ((data ?? []) as unknown[]).length }
}

/** The whole ticket with the signal up: the row, every page in order, then the landing. The first failure throws. */
export async function sendTicket(t: TicketDraft, pages: readonly TicketPageDraft[]): Promise<void> {
  await sendTicketRow(t)
  for (const p of pages) await sendTicketPage({ id: t.id, uploaderId: t.takenBy }, p)
  try {
    await landTicket(t.id)
  } catch (e) {
    throw new TicketSendError(formatErrorMessage(e, 'The ticket did not save.'), errorKindOf(e))
  }
}

/** A ticket with its pages, as a list reads it. */
export type TicketWithPages = CounterTicket & { counter_ticket_pages: CounterTicketPage[] }

const TICKET_WITH_PAGES_SELECT = `${COUNTER_TICKET_COLUMNS}, counter_ticket_pages(${COUNTER_TICKET_PAGE_COLUMNS})`

function withSortedPages(rows: unknown): TicketWithPages[] {
  return ((rows ?? []) as TicketWithPages[]).map((t) => ({ ...t, also_job_ids: t.also_job_ids ?? [], declined_transaction_ids: t.declined_transaction_ids ?? [], counter_ticket_pages: [...(t.counter_ticket_pages ?? [])].sort((a, b) => a.page_no - b.page_no) }))
}

/** The saved tickets a person took, newest first, removed ones left out. Throws the app's error for the retry panel. */
export async function listMyTickets(userId: string, limit = 30): Promise<TicketWithPages[]> {
  const { data, error, status } = await db
    .from('counter_tickets')
    .select(TICKET_WITH_PAGES_SELECT)
    .eq('taken_by', userId)
    .is('removed_at', null)
    .not('added_at', 'is', null)
    .order('taken_at', { ascending: false })
    .limit(limit)
  if (error) throw databaseErrorFromResult(error, 'read your tickets', status)
  return withSortedPages(data)
}

/** A link to one page's picture, good for an hour, or null when the page has no copy the reader may open. */
export async function ticketPageUrl(storagePath: string | null): Promise<string | null> {
  if (!storagePath) return null
  const { data, error } = await db.storage.from(COUNTER_TICKETS_BUCKET).createSignedUrl(storagePath, 3600)
  return error || !data?.signedUrl ? null : data.signedUrl
}

/** The taker changes the job of their own ticket. Throws with the reason: the office's use of it is one. */
export async function changeTicketJob(ticketId: string, write: { job_id: string | null; also_job_ids: string[]; no_one_job: boolean; po_entry_id: string | null }): Promise<void> {
  const { error } = await db.from('counter_tickets').update(write).eq('id', ticketId)
  if (error) throw new Error(formatErrorMessage(error, 'The job did not change.'))
}

/** A ticket taken by mistake: hidden, never deleted. Throws with the reason. */
export async function removeTicket(ticketId: string): Promise<void> {
  const { error } = await db.from('counter_tickets').update({ removed_at: new Date().toISOString() }).eq('id', ticketId)
  if (error) throw new Error(formatErrorMessage(error, 'The ticket was not removed.'))
}

/** The total or the note, typed after the save. Throws with the reason. */
export async function editTicketWords(ticketId: string, write: { total?: number | null; note?: string }): Promise<void> {
  const { error } = await db.from('counter_tickets').update(write).eq('id', ticketId)
  if (error) throw new Error(formatErrorMessage(error, 'The ticket did not save.'))
}
