/**
 * The last 7 days, the read (punch list #140 PR 5): the lines either way of the last two weeks (this week's for the
 * numbers, last week's for the share beside them) — texts, emails, calls, voicemails and missed calls, with each
 * person's kind for the pill, who sent ours and Quo's delivery answer — and this week's estimates with what the
 * customer did with each: the `estimate_customer_events` rows the office may read, else, when the read is refused,
 * the thread's own event lines keyed `estimate:<id>:opened|accepted`, as Went out reads them. The page's view is not
 * loaded on a plain `/messages` visit and reads every message ever, so the strip reads its own fourteen days. RLS
 * shows the office what the thread would.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import { checkSupabaseError } from '../../utils/errorHandling'
import type { ContactKind } from '../contacts/kernel'
import { deliveryOf, type MessageChannel } from './thread'
import { stripWindows, type StripEstimate, type StripLine } from './weekStrip'

export interface WeekStripRead {
  lines: StripLine[]
  estimates: StripEstimate[]
}

/** The channels a turn is made of: what they send us, and what one of ours sends back. A note never reaches them. */
export const STRIP_CHANNELS: readonly MessageChannel[] = ['text', 'email', 'call', 'voicemail', 'missed']

export async function loadWeekStrip(now: Date = new Date(), client: unknown = supabase): Promise<WeekStripRead> {
  const db = client as SupabaseClient
  const { thisWeek, lastWeek } = stripWindows(now)
  const result = await db
    .from('messages')
    .select('id, contact_id, direction, channel, at, who_text, delivery, contact:contacts(kind)')
    .in('direction', ['in', 'out'])
    .in('channel', [...STRIP_CHANNELS])
    .gte('at', new Date(lastWeek.fromMs).toISOString())
    .order('at', { ascending: false })
    .limit(3000)
  checkSupabaseError(result, 'read the last 7 days')
  const rows = (result.data ?? []) as unknown as Array<{
    id: string
    contact_id: string
    direction: string
    channel: string
    at: string
    who_text: string | null
    delivery: string | null
    contact: { kind: string | null } | null
  }>
  const lines: StripLine[] = rows
    .filter((r) => r.direction === 'in' || r.direction === 'out')
    .map((r) => ({
      id: r.id,
      contactId: r.contact_id,
      kind: (r.contact?.kind ?? null) as ContactKind | null,
      direction: r.direction as 'in' | 'out',
      channel: r.channel as MessageChannel,
      atMs: Date.parse(r.at),
      who: r.who_text?.trim() ?? '',
      delivery: deliveryOf(r.delivery),
    }))
  return { lines, estimates: await loadFunnel(db, new Date(thisWeek.fromMs).toISOString()) }
}

/**
 * This week's estimates and what the customer did with each. A refusal on the estimates leaves the tile reading none
 * (the strip is the office's read; the lines still stand); a refusal on the events falls back to the thread's lines.
 */
async function loadFunnel(db: SupabaseClient, fromIso: string): Promise<StripEstimate[]> {
  const ests = await db.from('estimates').select('id, estimate_number, sent_at, status').gte('sent_at', fromIso).limit(500)
  if (ests.error) return []
  const rows = (ests.data ?? []) as Array<{ id: string; estimate_number: number; sent_at: string | null; status: string | null }>
  if (rows.length === 0) return []
  const ids = rows.map((r) => r.id)
  const opened = new Set<string>()
  const accepted = new Set<string>()
  const events = await db.from('estimate_customer_events').select('estimate_id, event_type').in('estimate_id', ids).in('event_type', ['public_link_view', 'public_accept_submitted'])
  if (!events.error) {
    for (const e of (events.data ?? []) as Array<{ estimate_id: string; event_type: string }>) {
      if (e.event_type === 'public_accept_submitted') accepted.add(e.estimate_id)
      else opened.add(e.estimate_id)
    }
  } else {
    const keys = ids.flatMap((id) => [`estimate:${id}:opened`, `estimate:${id}:accepted`])
    const lines = await db.from('messages').select('quo_id').in('quo_id', keys)
    if (!lines.error) {
      for (const l of (lines.data ?? []) as Array<{ quo_id: string | null }>) {
        const m = /^estimate:(.+):(opened|accepted)$/.exec(l.quo_id ?? '')
        if (!m) continue
        if (m[2] === 'accepted') accepted.add(m[1]!)
        else opened.add(m[1]!)
      }
    }
  }
  return rows.map((r) => {
    const took = accepted.has(r.id) || r.status === 'customer_accepted'
    return { id: r.id, number: r.estimate_number, sentAtMs: r.sent_at ? Date.parse(r.sent_at) : null, opened: took || opened.has(r.id), accepted: took }
  })
}
