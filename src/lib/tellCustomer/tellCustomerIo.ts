/**
 * Tell the customer (v2.5593, punch list #115): what the sheet reads and the one thing it writes (`tellCustomer.ts` is
 * the kernel). One interface, so the smoke hands it a fake; one implementation on the app's client. The job and its
 * customer from `jobs_ledger` and `customers` (or the customer alone, for an estimate); the customer's own thread
 * through `contact_for_customer` (the office's door, which makes one when there is none) and the numbers on it; the
 * office's quick replies; the texts switch; the signed-in person's name; whether a block is the job's first; and the
 * send, which is the reply box's own path through `quo-send`, tied to the job when there is one.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import type { Database } from '../../types/database'
import { checkSupabaseError } from '../../utils/errorHandling'
import { customerLang } from '../messages/customerLang'
import { contactForCustomer } from '../messages/messagesIo'
import { jobKey } from '../messages/jobKeys'
import { supabaseReplyIo } from '../messages/replyIo'
import { supabaseOffersIo } from '../offers/offersIo'
import { supabaseCallTasksIo, type CallTaskAdd } from '../calls/callTasksIo'
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
  /** The pipeline job the line ties to, or null on the person alone (an estimate before a job). */
  jobId: string | null
  body: string
}

export interface TellCustomerIo {
  loadJob(jobId: string): Promise<TellJob>
  /** The customer alone, for an estimate (v2.5594): their name and the language they read. */
  loadCustomer(customerId: string): Promise<{ name: string | null; lang: PortalLang }>
  loadContact(customerId: string): Promise<TellContact>
  loadLines(): Promise<QuickReply[]>
  loadTextsOn(): Promise<boolean>
  loadMyName(userId: string): Promise<string | null>
  /** True when the job has no other block than the group just saved: the first visit. */
  isFirstVisit(jobId: string, groupId: string | null): Promise<boolean>
  /** Resolves to the text's line id. */
  send(input: TellSend): Promise<string>
  /** Send in the morning (v2.5595): the text waits on Today's sends and the morning run sends it on its day. Resolves to the offer's id. */
  makeOffer(input: TellOffer): Promise<string>
  /** The step's call script and whether the receipt suggests the call at all (v2.5596); null before the push or on a step with no row. */
  loadCallScript(stepKey: string): Promise<TellCallScript | null>
  /** Add to my calls (v2.5596): a call task in Follow up's We owe them. Resolves to the task's id. */
  addCall(input: CallTaskAdd): Promise<string>
}

/** What the residential flow's step says about the call after its text. */
export interface TellCallScript {
  /** The office's script in both languages; null uses the app's own. */
  script: { text: string; textEs: string } | null
  suggest: boolean
}

/** A text the office hands to a morning, from the sheet. */
export interface TellOffer {
  contactId: string
  channelId: string
  jobId: string | null
  /** The step the text is for (`MOMENT_STEP`), so the run never doubles it. */
  stepKey: string
  body: string
  /** YYYY-MM-DD, the morning it goes. */
  sendOn: string
}

const langOf = (language: string | null | undefined): PortalLang => customerLang({ lang: language === 'es' || language === 'en' ? language : undefined })

export function supabaseTellCustomerIo(client: unknown = supabase): TellCustomerIo {
  const db = client as SupabaseClient
  const customerRow = async (customerId: string) => {
    const customer = await db.from('customers').select('name, language').eq('id', customerId).maybeSingle()
    checkSupabaseError(customer, 'read the customer')
    return customer.data as { name: string | null; language: string | null } | null
  }
  return {
    async loadJob(jobId) {
      const job = await db.from('jobs_ledger').select('customer_id, job_name, job_address').eq('id', jobId).maybeSingle()
      checkSupabaseError(job, 'read the job')
      const row = job.data as { customer_id: string | null; job_name: string | null; job_address: string | null } | null
      const customerId = row?.customer_id ?? null
      const c = customerId ? await customerRow(customerId) : null
      return { customerId, customerName: c?.name ?? null, jobName: row?.job_name ?? null, jobAddress: row?.job_address ?? null, lang: langOf(c?.language) }
    },
    async loadCustomer(customerId) {
      const c = await customerRow(customerId)
      return { name: c?.name ?? null, lang: langOf(c?.language) }
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
    async loadCallScript(stepKey) {
      const result = await db.from('flow_steps').select('call_script, call_script_es, suggest_call, flows!inner(kind)').eq('step_key', stepKey).eq('flows.kind', 'residential').maybeSingle()
      if (result.error) return null
      const r = result.data as unknown as { call_script: string | null; call_script_es: string | null; suggest_call: boolean | null } | null
      if (!r) return null
      return { script: r.call_script ? { text: r.call_script, textEs: r.call_script_es ?? '' } : null, suggest: r.suggest_call ?? true }
    },
    addCall: (input) => supabaseCallTasksIo(db).add(input),
    makeOffer: (input) =>
      supabaseOffersIo(db).make({
        contactId: input.contactId,
        stepKey: input.stepKey,
        jobKey: input.jobId ? jobKey({ kind: 'pipeline', id: input.jobId }) : null,
        body: input.body,
        channelId: input.channelId,
        sendOn: input.sendOn,
      }),
    send: (input) =>
      supabaseReplyIo().sendText({
        contactId: input.contactId,
        channelId: input.channelId,
        jobKey: input.jobId ? jobKey({ kind: 'pipeline', id: input.jobId }) : null,
        body: input.body,
        held: false,
      }),
  }
}
