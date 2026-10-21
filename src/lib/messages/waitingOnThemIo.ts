/**
 * Waiting on them, the read (v2.5704, punch list #139 PR 12): the last `LOOKBACK_DAYS` days of lines either way —
 * texts, emails and calls, theirs and ours — with each person's name and kind for the pill and the number our line
 * went to for the call. The kernel keeps each person's newest line and asks whether it is ours and old enough. One
 * read, at most 1500 rows; RLS shows the office what the thread would.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import { checkSupabaseError } from '../../utils/errorHandling'
import type { ContactKind } from '../contacts/kernel'
import type { WaitLine } from './waitingOnThem'

/** A silence older than this is not a nudge the lane makes; the flow's reminders carry it. */
export const LOOKBACK_DAYS = 30

export async function loadWaitingOnThem(now: Date = new Date(), client: unknown = supabase): Promise<WaitLine[]> {
  const db = client as SupabaseClient
  const fromIso = new Date(now.getTime() - LOOKBACK_DAYS * 86_400_000).toISOString()
  const result = await db
    .from('messages')
    .select('id, contact_id, direction, body, at, number:contact_channels(value), contact:contacts(name, kind, customer:customers(name))')
    .in('direction', ['in', 'out'])
    .in('channel', ['text', 'email', 'call', 'voicemail', 'missed'])
    .gte('at', fromIso)
    .order('at', { ascending: false })
    .limit(1500)
  checkSupabaseError(result, 'read who went quiet')
  const rows = (result.data ?? []) as unknown as Array<{
    id: string
    contact_id: string
    direction: string
    body: string
    at: string
    number: { value: string | null } | null
    contact: { name: string | null; kind: string | null; customer: { name: string | null } | null } | null
  }>
  return rows
    .filter((r) => r.direction === 'in' || r.direction === 'out')
    .map((r) => ({
      id: r.id,
      contactId: r.contact_id,
      name: r.contact?.name ?? null,
      customerName: r.contact?.customer?.name ?? null,
      kind: (r.contact?.kind ?? null) as ContactKind | null,
      direction: r.direction as 'in' | 'out',
      body: r.body,
      atMs: Date.parse(r.at),
      number: r.number?.value ?? null,
    }))
}
