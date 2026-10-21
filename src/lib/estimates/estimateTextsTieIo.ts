/**
 * The job tie for an estimate's texts (v2.5706, punch list #139 PR 14): the sheet texts an estimate's link "on the
 * person" while the estimate has no job, so when the estimate becomes one, its texts still read *no job* and the
 * job's own thread view never shows them. Once the job exists, the texts carrying this estimate's live link
 * (`acceptLinkTie.ts`) that sit on no job are tied to it through the thread's own `tie_message`. Best effort: it
 * answers how many it tied and never throws into the page that made the job.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import { jobKey } from '../messages/jobKeys'
import { tieMessage } from '../messages/messagesIo'
import { textsCarryingLink } from './acceptLinkTie'

const BEFORE_MS = 10 * 60 * 1000

export async function tieEstimateTextsToJob(
  input: { customerId: string; sentAt: string | null; tokenHash: string | null; jobId: string },
  client: unknown = supabase,
  tie: (messageId: string, key: string) => Promise<void> = tieMessage,
): Promise<number> {
  try {
    if (!input.tokenHash) return 0
    const db = client as SupabaseClient
    const contacts = await db.from('contacts').select('id').eq('customer_id', input.customerId).order('created_at').limit(1)
    const contactId = (contacts.data as Array<{ id: string }> | null)?.[0]?.id ?? null
    if (!contactId) return 0
    const sentMs = input.sentAt ? Date.parse(input.sentAt) : NaN
    let lines = db.from('messages').select('id, body, jobs_ledger_id').eq('contact_id', contactId).eq('channel', 'text').eq('direction', 'out').ilike('body', '%/estimate/accept%').limit(50)
    if (!Number.isNaN(sentMs)) lines = lines.gte('at', new Date(sentMs - BEFORE_MS).toISOString())
    const texts = await lines
    const mine = await textsCarryingLink(((texts.data ?? []) as Array<{ id: string; body: string; jobs_ledger_id: string | null }>).filter((t) => !t.jobs_ledger_id), input.tokenHash)
    const key = jobKey({ kind: 'pipeline', id: input.jobId })
    let tied = 0
    for (const t of mine) {
      try {
        await tie(t.id, key)
        tied += 1
      } catch {
        // one text that will not tie does not stop the rest
      }
    }
    return tied
  } catch {
    return 0
  }
}
