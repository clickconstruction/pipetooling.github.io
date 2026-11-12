/**
 * Waiting on them, the read (v2.5704, punch list #139 PR 12): the last `LOOKBACK_DAYS` days of lines either way —
 * texts, emails and calls, theirs and ours — with each person's name and kind for the pill and the number our line
 * went to for the call, and since #140 PR 4 each line's channel and Quo's delivery answer, for the failed text's row. A
 * line the app sent on its own (`messages.auto`, v2.6012: the text back after a missed call) is left out, since it is
 * not our word and must not start the wait. Since v2.6500 a second read brings the thread's event lines that can be
 * their word — the estimate's `estimate:<id>:…` keys and the office's Heard back lines — and the kernel asks of each
 * whether it is their answer (`theirWord`). The kernel keeps each person's newest line and asks whether it is ours and
 * old enough. Two reads, at most 1500 and 500 rows; RLS shows the office what the thread would.
 *
 * The write (v2.6500): `heardBack` puts the gray line on the thread through `follow_up_event`, the writer the thread's
 * menu uses for the customer's say (v2.5597), as the signed-in person, named as `follow_up_user_name` names them.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import { checkSupabaseError } from '../../utils/errorHandling'
import { formatDenverCalendarDayShort } from '../../utils/dateUtils'
import type { ContactKind } from '../contacts/kernel'
import { deliveryOf, type MessageChannel } from './thread'
import { heardBackBody, type HeardHow, type WaitLine } from './waitingOnThem'

/** A silence older than this is not a nudge the lane makes; the flow's reminders carry it. */
export const LOOKBACK_DAYS = 30

/** The event lines that can be their word: the estimate's keys, and the two shapes of a Heard back line. */
export const ANSWER_EVENTS_FILTER = 'quo_id.like.estimate:*,body.ilike.* heard back *,body.ilike.*that no answer is needed*'

export async function loadWaitingOnThem(now: Date = new Date(), client: unknown = supabase): Promise<WaitLine[]> {
  const db = client as SupabaseClient
  const fromIso = new Date(now.getTime() - LOOKBACK_DAYS * 86_400_000).toISOString()
  const result = await db
    .from('messages')
    .select('id, contact_id, direction, body, at, channel, delivery, history, number:contact_channels(value), contact:contacts(name, kind, customer:customers(name))')
    .in('direction', ['in', 'out'])
    .in('channel', ['text', 'email', 'call', 'voicemail', 'missed'])
    .eq('auto', false)
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
    channel: string | null
    delivery: string | null
    history: boolean | null
    number: { value: string | null } | null
    contact: { name: string | null; kind: string | null; customer: { name: string | null } | null } | null
  }>
  const lines: WaitLine[] = rows
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
      channel: (r.channel ?? null) as MessageChannel | null,
      delivery: deliveryOf(r.delivery),
      ...(r.history === true ? { history: true } : {}),
    }))
  // Their answers that are not a line in (v2.6500): the kernel reads each key and body and keeps the ones that count.
  const events = await db.from('messages').select('id, contact_id, body, at, quo_id').eq('channel', 'event').eq('direction', 'team').or(ANSWER_EVENTS_FILTER).gte('at', fromIso).order('at', { ascending: false }).limit(500)
  checkSupabaseError(events, 'read who went quiet')
  for (const e of (events.data ?? []) as Array<{ id: string; contact_id: string; body: string; at: string; quo_id: string | null }>) {
    lines.push({ id: e.id, contactId: e.contact_id, name: null, kind: null, direction: 'event', body: e.body, atMs: Date.parse(e.at), channel: 'event', key: e.quo_id })
  }
  return lines
}

/**
 * Heard back (v2.6500): the gray line on their thread, in the app's words, as the signed-in person — through
 * `follow_up_event`, the thread menu's own writer. Rejects with the refusal's words.
 */
export async function heardBack(contactId: string, how: HeardHow, now: Date = new Date(), client: unknown = supabase): Promise<void> {
  const db = client as SupabaseClient
  const { data: auth } = await db.auth.getUser()
  const me = auth.user?.id ?? null
  const named = me ? await db.rpc('follow_up_user_name', { p_user_id: me }) : null
  const name = typeof named?.data === 'string' ? named.data : ''
  const result = await db.rpc('follow_up_event', { p_contact_id: contactId, p_body: heardBackBody(name, how, formatDenverCalendarDayShort(now.getTime())) })
  checkSupabaseError(result, 'write that you heard back')
}
