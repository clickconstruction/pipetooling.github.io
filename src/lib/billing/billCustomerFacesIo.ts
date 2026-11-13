/**
 * The reads behind Bill Customer's text face (punch list #343, PR 2; `billCustomerFaces.ts` is the kernel). The job,
 * the office's lines, the texts switch and the sender's name come through the Tell the customer sheet's own reads, so
 * the face and the sheet cannot disagree. The customer's numbers are read here and not through the sheet's
 * `loadContact`: that one goes through the door that makes a contact for a customer who has none, and a look at a
 * picture must write nothing. A customer with no contact yet reads as `contact: null`, and the face says the number is
 * read on the next screen.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import { checkSupabaseError } from '../../utils/errorHandling'
import type { RecipientLine } from '../messages/compose'
import { supabaseTellCustomerIo, type TellCustomerIo } from '../tellCustomer/tellCustomerIo'
import type { BillTextFaceRead } from './billCustomerFaces'

type TellReads = Pick<TellCustomerIo, 'loadJob' | 'loadLines' | 'loadTextsOn' | 'loadMyName'>

async function readContact(db: SupabaseClient, customerId: string): Promise<BillTextFaceRead['contact']> {
  const who = await db.from('contacts').select('id').eq('customer_id', customerId).order('created_at').limit(1)
  checkSupabaseError(who, 'read their contact')
  const contactId = (who.data as Array<{ id: string }> | null)?.[0]?.id ?? null
  if (!contactId) return null
  const [channels, texts] = await Promise.all([
    db.from('contact_channels').select('id, kind, value, opted_out_at, usual_at, created_at').eq('contact_id', contactId).order('created_at'),
    // The thread's texts by number, for the rule's second choice; a read that fails reads as none, as on the sheet.
    db.from('messages').select('channel_id, at, direction').eq('contact_id', contactId).eq('channel', 'text').order('at', { ascending: false }).limit(200),
  ])
  checkSupabaseError(channels, 'read their numbers')
  const rows = (channels.data ?? []) as Array<{ id: string; kind: string; value: string; opted_out_at: string | null; usual_at?: string | null }>
  const lines = texts.error ? [] : ((texts.data ?? []) as Array<{ channel_id: string | null; at: string; direction: string }>)
  return {
    numbers: rows.filter((r) => r.kind === 'phone' && r.value.trim()).map((r) => ({ channelId: r.id, value: r.value, stopped: r.opted_out_at != null, usualAt: r.usual_at ?? null })),
    lines: lines.map((l) => ({ channelId: l.channel_id, at: l.at, direction: l.direction as RecipientLine['direction'] })),
  }
}

export async function loadBillTextFace(jobId: string, userId: string, office: boolean, client: unknown = supabase, tell: TellReads = supabaseTellCustomerIo(client)): Promise<BillTextFaceRead> {
  const [job, lines, textsOn, me] = await Promise.all([tell.loadJob(jobId), tell.loadLines(), tell.loadTextsOn(), tell.loadMyName(userId)])
  const contact = job.customerId && office ? await readContact(client as SupabaseClient, job.customerId) : null
  return { job, lines, textsOn, me, contact }
}
