/**
 * Messages, cut 4b's screens: the reads and writes behind *Start a change order* (`fromMessage.ts` is the kernel,
 * migration 20261012180000 the database). What a thread needs: the person's kind and name, and which of their messages
 * became which change order, through the office's view (`gc_change_orders_office`, never a money column). What the
 * press needs: the job the message is tied to, its stage and its change orders' numbers. The office's draft goes
 * through `gc_draft_change_order_from_message`, and the money team prices it through `gc_price_change_order`
 * (20261013020000). The money team's window reads each order's message back for its line (`fromMessageLine`).
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import { checkSupabaseError, withSupabaseRetry } from '../../utils/errorHandling'
import { firstName, type ContactKind } from '../contacts/kernel'
import { stageOf } from '../gc/boardRows'
import type { ChangeOrderDraft } from '../gc/changeOrderRows'
import type { ChangeOrderJob, MessageContact, SourceMessage } from './fromMessage'

// Untyped until the types regenerate after 20261012180000's and 20261013020000's push.
const db = supabase as unknown as SupabaseClient

/** A message that became a change order: its order's id, number and job. */
export interface BecameOrder {
  id: string
  number: number
  projectId: string
}

/** What a person's thread reads for the press and the chip. */
export interface ThreadChangeOrders {
  contact: MessageContact | null
  /** By message id. */
  became: ReadonlyMap<string, BecameOrder>
}

export interface FromMessageIo {
  loadThread: (contactId: string) => Promise<ThreadChangeOrders>
  loadJob: (projectId: string) => Promise<ChangeOrderJob | null>
  draft: (messageId: string, draft: ChangeOrderDraft) => Promise<{ id: string; number: number }>
}

type ContactRow = { id: string; kind: ContactKind; name: string | null; goes_by: string | null }
type BecameRow = { id: string | null; number: number | null; project_id: string | null; source_message_id: string | null }

/** The person as the press reads them, named as the spine names them. */
export function messageContactOf(row: ContactRow): MessageContact {
  const name = row.name?.trim() || ''
  return { id: row.id, kind: row.kind, name, first: firstName({ name, goesBy: row.goes_by, kind: row.kind }) || name }
}

/** Each message that became a change order, by message id. A row the view hides a part of is left out. */
export function becameFromRows(rows: readonly BecameRow[]): Map<string, BecameOrder> {
  const out = new Map<string, BecameOrder>()
  for (const r of rows) {
    if (r.id && r.number !== null && r.project_id && r.source_message_id) out.set(r.source_message_id, { id: r.id, number: r.number, projectId: r.project_id })
  }
  return out
}

export async function loadThreadChangeOrders(contactId: string): Promise<ThreadChangeOrders> {
  const [contacts, rows] = await Promise.all([
    withSupabaseRetry<ContactRow[]>(() => db.from('contacts').select('id, kind, name, goes_by').eq('id', contactId).limit(1), 'read who the thread is with'),
    withSupabaseRetry<BecameRow[]>(
      () =>
        db
          .from('gc_change_orders_office')
          .select('id, number, project_id, source_message_id')
          .eq('signer_contact_id', contactId)
          .not('source_message_id', 'is', null),
      'read the change orders from their messages',
    ),
  ])
  const contact = contacts?.[0]
  return { contact: contact ? messageContactOf(contact) : null, became: becameFromRows(rows ?? []) }
}

/** The job a message is tied to, as the press checks it: its name, its stage, whether it was lost, its orders' numbers. */
export async function loadChangeOrderJob(projectId: string): Promise<ChangeOrderJob | null> {
  const [gc, names, numbers] = await Promise.all([
    withSupabaseRetry<{ project_id: string; stage: string; lost_on: string | null }[]>(
      () => db.from('gc_projects').select('project_id, stage, lost_on').eq('project_id', projectId).limit(1),
      'read the job',
    ),
    withSupabaseRetry<{ id: string; name: string | null }[]>(() => db.from('projects').select('id, name').eq('id', projectId).limit(1), 'read the job’s name'),
    withSupabaseRetry<{ number: number | null }[]>(() => db.from('gc_change_orders_office').select('number').eq('project_id', projectId), 'read the job’s change orders'),
  ])
  const job = gc?.[0]
  if (!job) return null
  return {
    id: job.project_id,
    name: names?.[0]?.name?.trim() || 'this job',
    stage: stageOf(job.stage),
    lostOn: job.lost_on,
    changeOrders: (numbers ?? []).flatMap((n) => (n.number !== null ? [{ number: n.number }] : [])),
  }
}

/** The office's draft from a message: the database numbers it under the job's lock and keeps the message on it. */
export async function draftChangeOrderFromMessage(messageId: string, draft: ChangeOrderDraft): Promise<{ id: string; number: number }> {
  const result = await db.rpc('gc_draft_change_order_from_message', { p_message_id: messageId, p_draft: draft })
  checkSupabaseError(result, 'draft the change order')
  const row = (result.data as { change_order_id: string; change_order_number: number }[] | null)?.[0]
  if (!row) throw new Error('The change order was not drafted.')
  return { id: row.change_order_id, number: row.change_order_number }
}

/** The money team's price on a draft, in whole dollars; refused once it went. */
export async function priceChangeOrder(changeOrderId: string, cost: number, price: number): Promise<void> {
  checkSupabaseError(await db.rpc('gc_price_change_order', { p_id: changeOrderId, p_cost: cost, p_price: price }), 'price the change order')
}

/** Each order's message and the person it is with, by message id, for the money team's line back. */
export async function loadSourceMessages(messageIds: readonly string[]): Promise<Map<string, { message: SourceMessage; contact: MessageContact }>> {
  const ids = [...new Set(messageIds)]
  if (!ids.length) return new Map()
  const messages = await withSupabaseRetry<(Omit<SourceMessage, 'contactId' | 'jobId'> & { contact_id: string; project_id: string | null })[]>(
    () => db.from('messages').select('id, contact_id, project_id, channel, direction, at, body').in('id', ids),
    'read the messages the change orders came from',
  )
  const contactIds = [...new Set((messages ?? []).map((m) => m.contact_id))]
  const contacts = contactIds.length
    ? await withSupabaseRetry<ContactRow[]>(() => db.from('contacts').select('id, kind, name, goes_by').in('id', contactIds), 'read who they came from')
    : []
  const byId = new Map((contacts ?? []).map((c) => [c.id, messageContactOf(c)]))
  const out = new Map<string, { message: SourceMessage; contact: MessageContact }>()
  for (const m of messages ?? []) {
    const contact = byId.get(m.contact_id)
    if (!contact) continue
    out.set(m.id, {
      message: { id: m.id, contactId: m.contact_id, jobId: m.project_id, channel: m.channel, direction: m.direction, at: m.at, body: m.body },
      contact,
    })
  }
  return out
}

export const supabaseFromMessageIo: FromMessageIo = {
  loadThread: loadThreadChangeOrders,
  loadJob: loadChangeOrderJob,
  draft: draftChangeOrderFromMessage,
}
