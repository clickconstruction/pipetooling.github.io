/**
 * The run's text and their Messages thread (v2.6032, punch list #153): the contact on a prospect's row with its
 * numbers and addresses, read as the signed-in user under the spine's policies, and the door that makes it,
 * `contact_for_prospect` (migration 20261028220000). The door is a definer, since nobody signed in inserts a contact:
 * it finds or makes the lead contact for the Prospects row and puts the card's numbers and address on it as channels,
 * the office team only, said in the function's words. It is not in the generated types until the migration is
 * pushed, so its name goes through `as never`, as `messagesIo` does for the spine's.
 */
import { supabase } from '../supabase'
import { checkSupabaseError } from '../../utils/errorHandling'
import type { ProspectThread, ThreadChannel } from './callRun'

type ChannelRow = { id: string; kind: string; value: string; opted_out_at: string | null }

async function threadOf(contactId: string): Promise<ProspectThread> {
  const res = await supabase.from('contact_channels').select('id, kind, value, opted_out_at').eq('contact_id', contactId)
  checkSupabaseError(res, 'read the numbers on their thread')
  const channels: ThreadChannel[] = ((res.data ?? []) as ChannelRow[]).map((r) => ({ id: r.id, kind: r.kind, value: r.value, optedOutAt: r.opted_out_at }))
  return { contactId, channels }
}

/** Their thread as it stands: null when no contact points at their Prospects row yet. */
export async function loadProspectThread(prospectId: string): Promise<ProspectThread | null> {
  const res = await supabase.from('contacts').select('id').eq('prospect_id', prospectId).limit(1).maybeSingle()
  checkSupabaseError(res, 'find their Messages thread')
  const id = (res.data as { id: string } | null)?.id ?? null
  return id ? threadOf(id) : null
}

/** Start their thread, or put the card's numbers on the one there, and read it back. */
export async function startProspectThread(prospectId: string): Promise<ProspectThread> {
  const res = await supabase.rpc('contact_for_prospect' as never, { p_prospect_id: prospectId } as never)
  checkSupabaseError(res, 'start their Messages thread')
  return threadOf(res.data as unknown as string)
}
