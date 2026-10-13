/**
 * Messages, residential R5: what Job Mode's **Message the customer** reads and writes (`jobModeMessageCustomer.ts` is
 * its kernel). One interface, so the sheet's smoke hands it a fake; one implementation on the app's client, read
 * untyped since the Messages tables and the phone's columns join the generated types with the lead's types PR.
 *
 * A tech reads through R5's doors: the job's customer and their own contact (`contacts_tech_read`), the newest lines of
 * their thread without the office's notes (`messages_tech_read`), and the phone's lines (`quick_replies_phone_tech`).
 * A tech makes no contact (`contact_for_customer` is the office's), so a customer with no thread yet reads as no
 * contact, and the send names the customer for `quo-send` to find them. **Something else** is a job thread note,
 * which a tech on the job may already write.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { checkSupabaseError } from '../utils/errorHandling'
import { phoneLinesFromRows, type JobModeBlock, type PhoneLineRow, type ThreadTail } from './jobModeMessageCustomer'
import type { PhoneLine } from './quickReplies/phone'

/** The job's customer as the sheet reads them. */
export interface JobModeCustomer {
  /** The job's customer row. Null: the job has none yet. */
  customerId: string | null
  customerName: string | null
  /** Their own thread. Null: the office has not opened one yet. */
  contactId: string | null
  /** Their thread's newest lines, the office's notes left out by the tech's door. */
  tail: ThreadTail[]
}

/**
 * What **Send** asks `quo-send` for: the tech's path, which takes the customer's number from their record, ties the
 * line to the job, keeps which phone line it came from, and holds their answer for the tech.
 */
export interface PhoneSend {
  from: 'job_mode'
  customerId: string
  contactId: string | null
  jobId: string
  quickReplyId: string
  body: string
}

export interface JobModeMessageIo {
  loadCustomer(jobId: string): Promise<JobModeCustomer>
  loadLines(): Promise<PhoneLine[]>
  /** The tech's own blocks on the job from `fromYmd` on. */
  loadBlocks(jobId: string, userId: string, fromYmd: string): Promise<JobModeBlock[]>
  send(input: PhoneSend): Promise<void>
  noteToOffice(jobId: string, userId: string, body: string): Promise<void>
}

const LINE_COLUMNS = 'id, text, for_kind, step_key, scope, added_by, added_at, removed_at, phone_order, phone_name, text_es'
/** How many of their newest lines the sheet reads for the dot and the answer. */
const TAIL = 20

export function supabaseJobModeMessageIo(client: unknown = supabase): JobModeMessageIo {
  const db = client as SupabaseClient
  return {
    async loadCustomer(jobId) {
      const job = await db.from('jobs_ledger').select('customer_id').eq('id', jobId).maybeSingle()
      checkSupabaseError(job, 'read the job’s customer')
      const customerId = (job.data as { customer_id: string | null } | null)?.customer_id ?? null
      if (!customerId) return { customerId: null, customerName: null, contactId: null, tail: [] }
      const [customer, contact] = await Promise.all([
        db.from('customers').select('name').eq('id', customerId).maybeSingle(),
        db.from('contacts').select('id').eq('customer_id', customerId).eq('kind', 'customer').limit(1),
      ])
      checkSupabaseError(customer, 'read the customer’s name')
      checkSupabaseError(contact, 'open their messages')
      const customerName = (customer.data as { name: string | null } | null)?.name ?? null
      const contactId = ((contact.data ?? []) as Array<{ id: string }>)[0]?.id ?? null
      if (!contactId) return { customerId, customerName, contactId: null, tail: [] }
      const lines = await db.from('messages').select('direction, at, body').eq('contact_id', contactId).order('at', { ascending: false }).limit(TAIL)
      checkSupabaseError(lines, 'read their messages')
      return { customerId, customerName, contactId, tail: (lines.data ?? []) as ThreadTail[] }
    },
    async loadLines() {
      const result = await db.from('quick_replies').select(LINE_COLUMNS)
      checkSupabaseError(result, 'load the phone’s lines')
      return phoneLinesFromRows((result.data ?? []) as PhoneLineRow[])
    },
    async loadBlocks(jobId, userId, fromYmd) {
      const result = await db
        .from('job_schedule_blocks')
        .select('work_date, time_start, time_end')
        .eq('job_id', jobId)
        .eq('assignee_user_id', userId)
        .gte('work_date', fromYmd)
        .order('work_date')
        .order('time_start')
        .limit(20)
      checkSupabaseError(result, 'read your visits to the job')
      return ((result.data ?? []) as Array<{ work_date: string; time_start: string; time_end: string }>).map((b) => ({
        workDate: b.work_date,
        timeStart: b.time_start,
        timeEnd: b.time_end,
      }))
    },
    async send(input) {
      const { data, error } = await db.functions.invoke('quo-send', { body: input })
      const answer = (data ?? null) as { ok?: boolean; words?: string } | null
      if (error || !answer?.ok) throw new Error(answer?.words ?? 'The text did not go. Try again, or use Something else.')
    },
    async noteToOffice(jobId, userId, body) {
      const result = await db.from('jobs_ledger_thread_notes').insert({ job_id: jobId, author_user_id: userId, body })
      checkSupabaseError(result, 'leave the note for the office')
    },
  }
}
