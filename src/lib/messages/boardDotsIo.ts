/**
 * The waiting dot's read (v2.5632): the customers whose conversation is open or snoozed, and their lines in, as Follow
 * up reads them (`followUpIo.ts`'s `loadQueue`, the two reads the queue's Needs a reply needs and nothing else: no
 * channels, notes, promises, owed or calls). The board reads it once per load of its jobs and after a send from the
 * customer's sheet; a read that fails leaves the dots as they were, since the dot is a courtesy, not a record.
 *
 * Each slice of people reads their lines in newest first under PostgREST's cap, so a person's newest line goes
 * unseen only when a thousand newer lines in from the same slice's other people stand before it, and then the job
 * shows no dot rather than a wrong one.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { ContactKind } from '../contacts/kernel'
import { MESSAGE_COLUMNS } from '../followUp/followUpIo'
import { followUpContactOf, followUpMessagesFromRows, type FollowUpContact, type FollowUpLine, type FollowUpMessageRow } from '../followUp/followUpRows'
import type { ContactFollowUpRow } from '../followUp/followUpTypes'
import { supabase } from '../supabase'
import { checkSupabaseError } from '../../utils/errorHandling'

// The spine's own columns: a company is a GC's and comes from a join Follow up makes, which a customer's dot never needs.
const CONTACT_COLUMNS = 'id, kind, name, goes_by, state, snoozed_until, has_user_id, has_since, has_how'
/** People per read of their lines. */
const PEOPLE_SLICE = 100
/** PostgREST's cap, written down so the bound is a choice and not a surprise. */
const LINES_MAX = 1000

type ContactDotRow = ContactFollowUpRow & { id: string; kind: string; name: string | null; goes_by: string | null }

export interface BoardDotRows {
  contacts: FollowUpContact[]
  lines: FollowUpLine[]
}

/** The open customers and their lines in, in the queue's shapes. */
export async function loadBoardDotRows(client: unknown = supabase): Promise<BoardDotRows> {
  const db = client as SupabaseClient
  const people = await db.from('contacts').select(CONTACT_COLUMNS).eq('kind', 'customer').in('state', ['waiting', 'snoozed'])
  checkSupabaseError(people, 'load the customers waiting on us')
  const rows = (people.data ?? []) as unknown as ContactDotRow[]
  const contacts = rows.map((r) => followUpContactOf({ id: r.id, kind: r.kind as ContactKind, name: r.name ?? '', goesBy: r.goes_by, company: '' }, r, {}))
  const lines: FollowUpMessageRow[] = []
  for (let i = 0; i < contacts.length; i += PEOPLE_SLICE) {
    const slice = contacts.slice(i, i + PEOPLE_SLICE).map((c) => c.id)
    const got = await db.from('messages').select(MESSAGE_COLUMNS).eq('direction', 'in').in('contact_id', slice).order('at', { ascending: false }).limit(LINES_MAX)
    checkSupabaseError(got, 'load the lines waiting on us')
    lines.push(...((got.data ?? []) as unknown as FollowUpMessageRow[]))
  }
  const named = contacts.map((c) => ({ id: c.id, name: c.name, goesBy: c.goesBy ?? null, kind: c.kind }))
  return { contacts, lines: followUpMessagesFromRows(lines, { contacts: named }) }
}
