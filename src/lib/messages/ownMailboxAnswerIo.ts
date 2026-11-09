/**
 * The thread's *Answered from my own mailbox* strip's three calls (punch list #207, v2.6745): the person's Sent through
 * My email's own door (`gmail-mine`'s list, as the signed-in person, refused in its own words when their switch is off),
 * a tag through the same door, and the hand record through `answered_from_own_mailbox`. One interface, so the render
 * test hands it a fake.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { MyMailJobRef, MyMailListOk, MyMailRefusal, MyMailTagOk } from '../myMail/contract'
import { supabaseMyMailIo, type MyMailIo } from '../myMail/myMailIo'
import { supabase } from '../supabase'
import { checkSupabaseError } from '../../utils/errorHandling'
import type { JobRef } from './jobKeys'

export interface OwnMailboxAnswerIo {
  /** The person's own Sent, newest first, over Gmail's search `q`. A refusal comes back as the function words it. */
  listSent(q: string): Promise<MyMailListOk | MyMailRefusal>
  /** One conversation of theirs tagged onto a job, as the My email tab tags it. */
  tag(threadId: string, job: MyMailJobRef): Promise<MyMailTagOk | MyMailRefusal>
  /** The answer written down as our line; resolves to the line's id. */
  record(contactId: string, words: string | null, job: JobRef | null): Promise<string>
}

export function supabaseOwnMailboxAnswerIo(client: unknown = supabase, mail: MyMailIo = supabaseMyMailIo(client)): OwnMailboxAnswerIo {
  const db = client as SupabaseClient
  return {
    listSent: (q) => mail.list({ view: 'toTag', labels: ['SENT'], q }),
    tag: (threadId, job) => mail.tag({ threadId, job }),
    async record(contactId, words, job) {
      const result = await db.rpc('answered_from_own_mailbox', { p_contact_id: contactId, p_words: words, p_job_kind: job?.kind ?? null, p_job_id: job?.id ?? null })
      checkSupabaseError(result, 'write down an answer')
      return result.data as string
    },
  }
}
