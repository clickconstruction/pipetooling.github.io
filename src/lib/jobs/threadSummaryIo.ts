/**
 * The reads behind the job window's Where it stands card (punch list #186, item 2A, v2.5895): the job's lines as the
 * feed reads them (`loadJobMessages`, under the rows' own policies), then what we owe and the written promises of the
 * customer's people, the same two queries Follow up's thread read makes. Nothing is written here.
 *
 * The customer's people (v2.5973, from the live walk): the customer contacts the job's lines name, and also the job's
 * customer's own contact and the contacts of the people at that customer (`customer_contact_persons`), so a promise or
 * a debt on their thread shows on a job with no line tied to it yet. Those two extra reads fail soft: the lines' people
 * still count.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import { checkSupabaseError } from '../../utils/errorHandling'
import { OWED_COLUMNS } from '../followUp/followUpIo'
import type { ContactOwedRow, MessagePromiseRow } from '../followUp/followUpRows'
import { loadJobMessages } from '../messages/messagesIo'
import type { JobActivityMessage } from './jobActivityMessages'
import { customerContactIds } from './threadSummary'

export interface ThreadSummaryFacts {
  lines: JobActivityMessage[]
  owed: ContactOwedRow[]
  promises: MessagePromiseRow[]
  /** The customer's contacts the owed and promise reads covered. */
  people: string[]
}

export interface ThreadSummaryJob {
  id: string
  status: string | null
  createdAt: string | null
  /** The job's customer; null reads only the people the lines name. */
  customerId?: string | null
}

/** The customer's own contact and the contacts of the people at that customer. Fails soft to none. */
async function customerPeople(db: SupabaseClient, customerId: string): Promise<string[]> {
  try {
    const [direct, persons] = await Promise.all([
      db.from('contacts').select('id').eq('customer_id', customerId),
      db.from('customer_contact_persons').select('id').eq('customer_id', customerId),
    ])
    const ids = ((direct.data ?? []) as { id: string }[]).map((r) => r.id)
    const personIds = ((persons.data ?? []) as { id: string }[]).map((r) => r.id)
    if (personIds.length > 0) {
      const viaPersons = await db.from('contacts').select('id').in('customer_contact_person_id', personIds)
      ids.push(...((viaPersons.data ?? []) as { id: string }[]).map((r) => r.id))
    }
    return ids
  } catch {
    return []
  }
}

/** A promise's columns with its line inner-joined, so a filter on the line's person keeps only theirs. */
const PROMISE_COLUMNS = 'id, message_id, kind, state, day, day_words, writes, decided_by, decided_at, message:messages!inner(contact_id, at)'

export async function loadThreadSummaryFacts(job: ThreadSummaryJob, todayYmd: string, client: unknown = supabase): Promise<ThreadSummaryFacts> {
  const lines = await loadJobMessages(job)
  // The promise read filters on the joined line's person, which the generated types do not name: untyped, as Follow up's read is.
  const db = client as SupabaseClient
  const people = [...new Set([...customerContactIds(lines), ...(job.customerId ? await customerPeople(db, job.customerId) : [])])]
  if (people.length === 0) return { lines, owed: [], promises: [], people }
  const [owed, promises] = await Promise.all([
    db.from('contact_owed').select(OWED_COLUMNS).in('contact_id', people).is('done_at', null),
    db.from('message_promises').select(PROMISE_COLUMNS).in('message.contact_id', people).eq('state', 'written').gte('day', todayYmd),
  ])
  checkSupabaseError(owed, 'load what we owe them')
  checkSupabaseError(promises, 'load the days they promised')
  return {
    lines,
    owed: (owed.data ?? []) as unknown as ContactOwedRow[],
    promises: (promises.data ?? []) as unknown as MessagePromiseRow[],
    people,
  }
}
