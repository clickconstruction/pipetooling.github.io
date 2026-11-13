/**
 * The GC contact's writes (the Gray Fox spike, 2026-11-02): the three fields onto the named bids, read back
 * so a policy's silent refusal is an error, and the way back for the toast: each bid's own fields as they were.
 */
import { supabase } from '../supabase'
import type { GcContactBefore, GcContactValues } from './gcContact'

const REFUSED = 'The change was not applied. The bids may have moved, or you may not have the right to change them.'

/** Put the contact on the bids; the number of rows that took it comes back. */
export async function putGcContactOnBids(bidIds: readonly string[], v: GcContactValues): Promise<number> {
  if (bidIds.length === 0) return 0
  const { data, error } = await supabase.from('bids').update({ gc_contact_name: v.name, gc_contact_phone: v.phone, gc_contact_email: v.email }).in('id', [...bidIds]).select('id')
  if (error) throw new Error(error.message)
  if (!data || data.length === 0) throw new Error(REFUSED)
  return data.length
}

/** The way back: each bid's fields as they were before the write, one update per bid. */
export async function restoreGcContacts(before: readonly GcContactBefore[]): Promise<void> {
  for (const b of before) {
    const { error } = await supabase.from('bids').update({ gc_contact_name: b.gc_contact_name, gc_contact_phone: b.gc_contact_phone, gc_contact_email: b.gc_contact_email }).eq('id', b.id)
    if (error) throw new Error(error.message)
  }
}
