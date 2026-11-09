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
import {
  ownContactId,
  phoneLinesFromRows,
  type CustomerContactRow,
  type JobModeBlock,
  type PhoneLineRow,
  type ThreadTail,
} from './jobModeMessageCustomer'
import type { PhoneLine } from './quickReplies/phone'
import type { PortalLang } from './gc/portalI18n'
import type { RecipientLine } from './messages/compose'
import { customerLang } from './messages/customerLang'

/** One of the customer's numbers as the To chip lists it (punch list #118, PR 2), a `contact_channels` row. */
export interface JobModeNumber {
  channelId: string
  value: string
  /** When it sent STOP; null when it can be texted. */
  optedOutAt: string | null
  /** When the office or the tech made it their usual; null when never. */
  usualAt: string | null
}

/** The job's customer as the sheet reads them. */
export interface JobModeCustomer {
  /** The job's customer row. Null: the job has none yet. */
  customerId: string | null
  customerName: string | null
  /** Their own thread. Null: the office has not opened one yet. */
  contactId: string | null
  /** Their thread's newest lines, the office's notes left out by the tech's door. */
  tail: ThreadTail[]
  /** The language their lines go in (`customerLang`): theirs once Spanish is on, English until then. */
  lang?: PortalLang
  /**
   * Their numbers (punch list #118, PR 2), read through the tech's door (`contact_channels_tech_read`) or the office's.
   * Empty before that door is pushed, so the sheet draws no chip and `quo-send` picks as before.
   */
  numbers?: JobModeNumber[]
  /** The thread's texts by number, for the chip's *last line* words and the rule's second choice. */
  lines?: RecipientLine[]
}

/**
 * What **Send** asks `quo-send` for: the tech's path, which makes the text itself from the phone line and the record,
 * takes the customer's number from their record, ties the line to the job, keeps which phone line it came from, and
 * holds their answer for the tech. Only the blanks the tech typed go; no words of the line travel from the phone.
 */
/** A line send: the office's line by its id and the blanks the tech typed. */
export interface PhoneLineSend {
  from: 'job_mode'
  kind?: 'line'
  customerId: string
  contactId: string | null
  jobId: string
  quickReplyId: string
  /** The blanks the tech typed, by blank: `{ minutes: '15' }`. Forty characters each at most, on one line. */
  fills: Record<string, string>
  /** The number the To chip picked (punch list #118, PR 2); unset or null lets `quo-send` pick by the rule. */
  channelId?: string | null
}

/** The tech's bio (v2.5590): the second text after their first On my way to a customer, as the picked lines' ids. */
export interface PhoneBioSend {
  from: 'job_mode'
  kind: 'bio'
  customerId: string
  contactId: string | null
  jobId: string
  lineIds: string[]
  /** The same number the line went to (punch list #118, PR 2), so the bio follows it. */
  channelId?: string | null
}

export type PhoneSend = PhoneLineSend | PhoneBioSend

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
        db.from('customers').select('name, language').eq('id', customerId).maybeSingle(),
        db.from('contacts').select('id, name, created_at').eq('customer_id', customerId).eq('kind', 'customer'),
      ])
      checkSupabaseError(customer, 'read the customer’s name')
      checkSupabaseError(contact, 'open their messages')
      const customerName = (customer.data as { name: string | null } | null)?.name ?? null
      const language = (customer.data as { language: string | null } | null)?.language
      const lang = customerLang({ lang: language === 'es' || language === 'en' ? language : undefined })
      const contactId = ownContactId((contact.data ?? []) as CustomerContactRow[])
      if (!contactId) return { customerId, customerName, contactId: null, tail: [], lang }
      const [lines, channels, texts] = await Promise.all([
        db.from('messages').select('direction, at, body').eq('contact_id', contactId).order('at', { ascending: false }).limit(TAIL),
        // The To chip's numbers and texts (punch list #118, PR 2): a tech before the door's push reads none, and the chip stays away.
        db.from('contact_channels').select('id, kind, value, opted_out_at, usual_at').eq('contact_id', contactId).order('created_at'),
        db.from('messages').select('channel_id, at, direction').eq('contact_id', contactId).eq('channel', 'text').order('at', { ascending: false }).limit(200),
      ])
      checkSupabaseError(lines, 'read their messages')
      const rows = channels.error ? [] : ((channels.data ?? []) as Array<{ id: string; kind: string; value: string; opted_out_at: string | null; usual_at?: string | null }>)
      const numbers: JobModeNumber[] = rows.filter((r) => r.kind === 'phone' && r.value.trim()).map((r) => ({ channelId: r.id, value: r.value, optedOutAt: r.opted_out_at, usualAt: r.usual_at ?? null }))
      const textRows = texts.error ? [] : ((texts.data ?? []) as Array<{ channel_id: string | null; at: string; direction: string }>)
      const recipientLines: RecipientLine[] = textRows.map((l) => ({ channelId: l.channel_id, at: l.at, direction: l.direction as RecipientLine['direction'] }))
      return { customerId, customerName, contactId, tail: (lines.data ?? []) as ThreadTail[], lang, numbers, lines: recipientLines }
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
