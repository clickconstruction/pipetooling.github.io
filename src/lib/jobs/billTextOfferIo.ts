/**
 * The reads behind the offer after the bill goes (v2.6772, punch list #291 PR 2; `billTextOffer.ts` is the kernel).
 * The texts the office sent on this job that carry the bill's pay page, for the *Texted* mark (`messages`: tied to the
 * job, a text, outbound, the body holding `/pay/`, newest first), and how the customer asked to hear from us
 * (`contacts.prefers`, read through their own contact by `customer_id`, never the door that makes one). A read that
 * fails reads as nothing, so the row shows no mark and the strip asks.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import type { TellPrefers } from '../tellCustomer/tellCustomer'
import { billTextedAt, type BillText } from './billTextOffer'

export async function loadBillTextedAt(jobId: string, invoiceId: string, otherLinks: readonly string[] = [], client: unknown = supabase): Promise<number | null> {
  try {
    const db = client as SupabaseClient
    const res = await db.from('messages').select('at, body').eq('jobs_ledger_id', jobId).eq('channel', 'text').eq('direction', 'out').ilike('body', '%/pay/%').order('at', { ascending: false }).limit(50)
    if (res.error) return null
    return billTextedAt((res.data ?? []) as BillText[], invoiceId, otherLinks)
  } catch {
    return null
  }
}

export async function loadCustomerPrefers(customerId: string, client: unknown = supabase): Promise<TellPrefers> {
  try {
    const db = client as SupabaseClient
    const res = await db.from('contacts').select('prefers').eq('customer_id', customerId).order('created_at').limit(1)
    if (res.error) return null
    const prefers = (res.data as Array<{ prefers?: string | null }> | null)?.[0]?.prefers ?? null
    return prefers === 'text' || prefers === 'email' || prefers === 'either' ? prefers : null
  } catch {
    return null
  }
}
