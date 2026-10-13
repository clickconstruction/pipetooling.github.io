/**
 * Messages, residential R8 · 8's screens: the reads and the write behind *Line on the estimate* (`lineFromMessage.ts`
 * is the kernel, migrations 20261014002000 and 20261014005000 the database). What a thread needs: the person's kind,
 * name and customer, and which of their messages became a line on which estimate (`messages.estimate_id`). What the
 * press needs: the Pipeline job the message is tied to, and the estimates its messages point at, which hold the job's
 * open draft. The save goes through `draft_estimate_line_from_message` with the draft's `updated_at` exactly as read,
 * so a draft someone changed since is refused instead of written over.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import { checkSupabaseError, withSupabaseRetry } from '../../utils/errorHandling'
import { firstName, type ContactKind } from '../contacts/kernel'
import { normalizeEstimateLineItemsFromJson, type EstimateLineItemNormalized } from '../estimateLineItemNormalize'
import type { LineContact, LineEstimate, LineJob } from './lineFromMessage'

// Untyped until the types regenerate after 20261014002000's and 20261014005000's push.
const db = supabase as unknown as SupabaseClient

/** The person a thread is with, as the press reads them: the kernel's contact, with the first name the window says. */
export type LineThreadContact = LineContact & { first: string }

/** A message that became a line: its estimate's id and number. */
export interface BecameLine {
  estimateId: string
  estimateNumber: number
}

/** What a person's thread reads for the press and the chip. */
export interface ThreadEstimateLines {
  contact: LineThreadContact | null
  /** By message id. */
  became: ReadonlyMap<string, BecameLine>
}

/** An estimate as the press reads it: the kernel's, with the `updated_at` it was read at and whether it has options. */
export type LineEstimateRead = LineEstimate & { seenAt: string; hasOptions: boolean }

/** The job a message is tied to and the estimates its messages point at. */
export interface LineJobRead {
  job: LineJob
  estimates: LineEstimateRead[]
}

/** What the press saves: the kernel's line, the draft it joins (null for a new one) and the draft as it was read. */
export interface LineSave {
  estimateId: string | null
  line: EstimateLineItemNormalized
  replacesLast: boolean
  /** The joined draft's `updated_at`, as the read gave it. Null for a new draft. */
  seenAt: string | null
}

export interface LineSaved {
  estimateId: string
  estimateNumber: number
  lineNumber: number
}

export interface LineFromMessageIo {
  loadThread: (contactId: string) => Promise<ThreadEstimateLines>
  loadJob: (jobId: string) => Promise<LineJobRead | null>
  draft: (messageId: string, save: LineSave) => Promise<LineSaved>
}

type ContactRow = { id: string; kind: ContactKind; name: string | null; goes_by: string | null; customer_id: string | null }
type EstimateRow = {
  id: string
  doc_kind: string | null
  status: string | null
  estimate_number: number | null
  line_items_snapshot: unknown
  options_snapshot: unknown
  updated_at: string
}

/** The person as the press reads them, named as the spine names them, with the customer their thread is under. */
export function lineContactOf(row: ContactRow, personCustomerId: string | null = null): LineThreadContact {
  const name = row.name?.trim() || ''
  return {
    id: row.id,
    kind: row.kind,
    name,
    first: firstName({ name, goesBy: row.goes_by, kind: row.kind }) || name,
    customerId: row.customer_id ?? personCustomerId,
  }
}

/** Each message that became a line, by message id, with its estimate's number. One whose estimate is unread is left out. */
export function becameFromRows(
  messages: ReadonlyArray<{ id: string; estimate_id: string | null }>,
  estimates: ReadonlyArray<{ id: string; estimate_number: number | null }>,
): Map<string, BecameLine> {
  const numbers = new Map(estimates.flatMap((e) => (e.estimate_number !== null ? [[e.id, e.estimate_number] as const] : [])))
  const out = new Map<string, BecameLine>()
  for (const m of messages) {
    const n = m.estimate_id ? numbers.get(m.estimate_id) : undefined
    if (m.estimate_id && n !== undefined) out.set(m.id, { estimateId: m.estimate_id, estimateNumber: n })
  }
  return out
}

/** The estimates a job's messages point at, each as the kernel reads it, on that job. */
export function lineEstimatesOf(jobId: string, rows: readonly EstimateRow[]): LineEstimateRead[] {
  return rows.flatMap((r) =>
    r.estimate_number === null
      ? []
      : [
          {
            id: r.id,
            jobId,
            docKind: r.doc_kind ?? 'estimate',
            status: r.status ?? '',
            number: r.estimate_number,
            lines: normalizeEstimateLineItemsFromJson(r.line_items_snapshot),
            seenAt: r.updated_at,
            hasOptions: Array.isArray(r.options_snapshot) && r.options_snapshot.length > 0,
          },
        ],
  )
}

export async function loadThreadEstimateLines(contactId: string): Promise<ThreadEstimateLines> {
  const [contacts, lines] = await Promise.all([
    withSupabaseRetry<(ContactRow & { customer_contact_person_id: string | null })[]>(
      () => db.from('contacts').select('id, kind, name, goes_by, customer_id, customer_contact_person_id').eq('id', contactId).limit(1),
      'read who the thread is with',
    ),
    withSupabaseRetry<{ id: string; estimate_id: string | null }[]>(
      () => db.from('messages').select('id, estimate_id').eq('contact_id', contactId).not('estimate_id', 'is', null),
      'read the estimates from their messages',
    ),
  ])
  const row = contacts?.[0]
  const person =
    row && !row.customer_id && row.customer_contact_person_id
      ? await withSupabaseRetry<{ customer_id: string | null }[]>(
          () => db.from('customer_contact_persons').select('customer_id').eq('id', row.customer_contact_person_id).limit(1),
          'read whose customer they are',
        )
      : []
  const estimateIds = [...new Set((lines ?? []).flatMap((m) => (m.estimate_id ? [m.estimate_id] : [])))]
  const estimates = estimateIds.length
    ? await withSupabaseRetry<{ id: string; estimate_number: number | null }[]>(
        () => db.from('estimates').select('id, estimate_number').in('id', estimateIds),
        'read the estimates’ numbers',
      )
    : []
  return {
    contact: row ? lineContactOf(row, person?.[0]?.customer_id ?? null) : null,
    became: becameFromRows(lines ?? [], estimates ?? []),
  }
}

/** The Pipeline job a message is tied to, and the estimates the job's messages point at. */
export async function loadLineJob(jobId: string): Promise<LineJobRead | null> {
  const [jobs, lines] = await Promise.all([
    withSupabaseRetry<{ id: string; job_name: string | null; status: string | null; customer_id: string | null }[]>(
      () => db.from('jobs_ledger').select('id, job_name, status, customer_id').eq('id', jobId).limit(1),
      'read the job',
    ),
    withSupabaseRetry<{ estimate_id: string | null }[]>(
      () => db.from('messages').select('estimate_id').eq('jobs_ledger_id', jobId).not('estimate_id', 'is', null),
      'read the job’s estimates from its messages',
    ),
  ])
  const job = jobs?.[0]
  if (!job) return null
  const ids = [...new Set((lines ?? []).flatMap((m) => (m.estimate_id ? [m.estimate_id] : [])))]
  const rows = ids.length
    ? await withSupabaseRetry<EstimateRow[]>(
        () => db.from('estimates').select('id, doc_kind, status, estimate_number, line_items_snapshot, options_snapshot, updated_at').in('id', ids),
        'read the job’s estimates',
      )
    : []
  return {
    job: { id: job.id, name: job.job_name?.trim() || 'this job', status: job.status ?? '', customerId: job.customer_id },
    estimates: lineEstimatesOf(job.id, rows ?? []),
  }
}

/** The office's line from a message: saved on the draft, or a new one, with the message's stamp in one call. */
export async function draftLineFromMessage(messageId: string, save: LineSave): Promise<LineSaved> {
  const result = await db.rpc('draft_estimate_line_from_message', {
    p_message_id: messageId,
    p_estimate_id: save.estimateId,
    p_line: save.line,
    p_replaces_last: save.replacesLast,
    p_seen_at: save.seenAt,
  })
  checkSupabaseError(result, 'put the message on the estimate')
  const row = (result.data as { drafted_estimate_id: string; drafted_estimate_number: number; drafted_line_number: number }[] | null)?.[0]
  if (!row) throw new Error('The line was not saved.')
  return { estimateId: row.drafted_estimate_id, estimateNumber: row.drafted_estimate_number, lineNumber: row.drafted_line_number }
}

export const supabaseLineFromMessageIo: LineFromMessageIo = {
  loadThread: loadThreadEstimateLines,
  loadJob: loadLineJob,
  draft: draftLineFromMessage,
}
