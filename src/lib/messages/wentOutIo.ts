/**
 * Went out today, the read (v2.5686, punch list #133 PR 3): today's outbound texts (`channel = 'text'`,
 * `direction = 'out'`, from the app day's start in the company calendar), newest first, with each person's name and
 * kind for the pill. One read, at most 100 rows; RLS shows the office what the thread would.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import { checkSupabaseError } from '../../utils/errorHandling'
import { startOfYmdInAppTzMs, todayYmdInAppTz } from '../../utils/dateUtils'
import type { ContactKind } from '../contacts/kernel'
import type { WentOutLine } from './wentOut'

export async function loadWentOut(now: Date = new Date(), client: unknown = supabase): Promise<WentOutLine[]> {
  const db = client as SupabaseClient
  const fromIso = new Date(startOfYmdInAppTzMs(todayYmdInAppTz(now))).toISOString()
  const result = await db
    .from('messages')
    .select('id, contact_id, body, at, who_text, contact:contacts(name, kind, customer:customers(name))')
    .eq('channel', 'text')
    .eq('direction', 'out')
    .gte('at', fromIso)
    .order('at', { ascending: false })
    .limit(100)
  checkSupabaseError(result, 'read what went out')
  const rows = (result.data ?? []) as unknown as Array<{
    id: string
    contact_id: string
    body: string
    at: string
    who_text: string | null
    contact: { name: string | null; kind: string | null; customer: { name: string | null } | null } | null
  }>
  return rows.map((r) => ({
    id: r.id,
    contactId: r.contact_id,
    name: r.contact?.name ?? null,
    customerName: r.contact?.customer?.name ?? null,
    kind: (r.contact?.kind ?? null) as ContactKind | null,
    body: r.body,
    atMs: Date.parse(r.at),
    who: r.who_text?.trim() ?? '',
  }))
}
