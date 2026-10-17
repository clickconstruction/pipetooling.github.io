/**
 * Tell the customer (v2.5593, punch list #115): what the sheet reads and the one thing it writes (`tellCustomer.ts` is
 * the kernel). One interface, so the smoke hands it a fake; one implementation on the app's client. The job and its
 * customer from `jobs_ledger` and `customers`; the customer's own thread through `contact_for_customer` (the office's
 * door, which makes one when there is none) and the numbers on it; the office's quick replies; the texts switch; the
 * signed-in person's name; whether a block is the job's first; and the send, which is the reply box's own path through
 * `quo-send` tied to the job.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import type { Database } from '../../types/database'
import { checkSupabaseError } from '../../utils/errorHandling'
import { customerLang } from '../messages/customerLang'
import { contactForCustomer } from '../messages/messagesIo'
import { jobKey } from '../messages/jobKeys'
import { supabaseReplyIo } from '../messages/replyIo'
import type { PortalLang } from '../gc/portalI18n'
import { supabaseQuickRepliesIo } from '../quickReplies/quickRepliesIo'
import type { QuickReply } from '../quickReplies/kernel'
import { supabaseTextsSwitchIo } from '../quo/textsSwitchIo'

export interface TellJob {
  customerId: string | null
  customerName: string | null
  jobName: string | null
  jobAddress: string | null
  lang: PortalLang
}

export interface TellNumber {
  /** The `contact_channels` row. */
  channelId: string
  value: string
  /** They sent STOP (the older, every-box stamp). */
  stopped: boolean
}

export interface TellContact {
  contactId: string
  /** Their phone numbers, oldest first. */
  numbers: TellNumber[]
}

export interface TellSend {
  contactId: string
  channelId: string
  jobId: string
  body: string
}

export interface TellCustomerIo {
  loadJob(jobId: string): Promise<TellJob>
  loadContact(customerId: string): Promise<TellContact>
  loadLines(): Promise<QuickReply[]>
  loadTextsOn(): Promise<boolean>
  loadMyName(userId: string): Promise<string | null>
  /** True when the job has no other block than the group just saved: the first visit. */
  isFirstVisit(jobId: string, groupId: string | null): Promise<boolean>
  /** Resolves to the text's line id. */
  send(input: TellSend): Promise<string>
}

export function supabaseTellCustomerIo(client: unknown = supabase): TellCustomerIo {
  const db = client as SupabaseClient
  return {
    async loadJob(jobId) {
      const job = await db.from('jobs_ledger').select('customer_id, job_name, job_address').eq('id', jobId).maybeSingle()
      checkSupabaseError(job, 'read the job')
      const row = job.data as { customer_id: string | null; job_name: string | null; job_address: string | null } | null
      const customerId = row?.customer_id ?? null
      let customerName: string | null = null
      let language: string | null = null
      if (customerId) {
        const customer = await db.from('customers').select('name, language').eq('id', customerId).maybeSingle()
        checkSupabaseError(customer, 'read the customer')
        const c = customer.data as { name: string | null; language: string | null } | null
        customerName = c?.name ?? null
        language = c?.language ?? null
      }
      return {
        customerId,
        customerName,
        jobName: row?.job_name ?? null,
        jobAddress: row?.job_address ?? null,
        lang: customerLang({ lang: language === 'es' || language === 'en' ? language : undefined }),
      }
    },
    async loadContact(customerId) {
      const contactId = await contactForCustomer(customerId)
      const channels = await db.from('contact_channels').select('id, kind, value, opted_out_at, created_at').eq('contact_id', contactId).order('created_at')
      checkSupabaseError(channels, 'read their numbers')
      const rows = (channels.data ?? []) as Array<{ id: string; kind: string; value: string; opted_out_at: string | null }>
      return {
        contactId,
        numbers: rows.filter((r) => r.kind === 'phone' && r.value.trim()).map((r) => ({ channelId: r.id, value: r.value, stopped: r.opted_out_at != null })),
      }
    },
    loadLines: () => supabaseQuickRepliesIo(client).loadLines(),
    async loadTextsOn() {
      try {
        return await supabaseTextsSwitchIo(client as SupabaseClient<Database>).load()
      } catch {
        return false
      }
    },
    async loadMyName(userId) {
      const result = await db.from('users').select('name').eq('id', userId).maybeSingle()
      if (result.error) return null
      return (result.data as { name: string | null } | null)?.name ?? null
    },
    async isFirstVisit(jobId, groupId) {
      let query = db.from('job_schedule_blocks').select('id', { count: 'exact', head: true }).eq('job_id', jobId)
      if (groupId) query = query.neq('shared_block_group_id', groupId)
      const result = await query
      if (result.error) return false
      return (result.count ?? 0) === 0
    },
    send: (input) => supabaseReplyIo().sendText({ contactId: input.contactId, channelId: input.channelId, jobKey: jobKey({ kind: 'pipeline', id: input.jobId }), body: input.body, held: false }),
  }
}
