/**
 * Went out, the read (v2.5686, punch list #133 PR 3): the outbound texts and emails (v2.5707) of the last
 * `WENT_OUT_DAYS` days (`channel in ('text','email')`, `direction = 'out'`, from the first day's start in the company
 * calendar), newest first, with each person's name and kind for the pill, Quo's delivery answer and the number a text
 * went to (v2.5703), and — for an estimate email, named by its subject — what the customer did with it, from the
 * thread's own event lines keyed `estimate:<id>:opened|accepted` (v2.5705). Two small reads after the first; a
 * failure on them leaves the rows without the chip. At most 300 rows; RLS shows the office what the thread would.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import { checkSupabaseError } from '../../utils/errorHandling'
import { startOfYmdInAppTzMs, todayYmdInAppTz, ymdAddDays } from '../../utils/dateUtils'
import type { ContactKind } from '../contacts/kernel'
import { estimateDoorFor } from './estimateDoor'
import { deliveryOf } from './thread'
import { WENT_OUT_DAYS, type WentOutLine } from './wentOut'

export async function loadWentOut(now: Date = new Date(), client: unknown = supabase): Promise<WentOutLine[]> {
  const db = client as SupabaseClient
  const fromIso = new Date(startOfYmdInAppTzMs(ymdAddDays(todayYmdInAppTz(now), -(WENT_OUT_DAYS - 1)))).toISOString()
  const result = await db
    .from('messages')
    .select('id, contact_id, channel, subject, body, at, who_text, delivery, number:contact_channels(value), contact:contacts(name, kind, customer:customers(name))')
    .in('channel', ['text', 'email'])
    .eq('direction', 'out')
    .gte('at', fromIso)
    .order('at', { ascending: false })
    .limit(300)
  checkSupabaseError(result, 'read what went out')
  const rows = (result.data ?? []) as unknown as Array<{
    id: string
    contact_id: string
    channel: string
    subject: string | null
    body: string
    at: string
    who_text: string | null
    delivery: string | null
    number: { value: string | null } | null
    contact: { name: string | null; kind: string | null; customer: { name: string | null } | null } | null
  }>
  const lines: WentOutLine[] = rows.map((r) => ({
    id: r.id,
    contactId: r.contact_id,
    name: r.contact?.name ?? null,
    customerName: r.contact?.customer?.name ?? null,
    kind: (r.contact?.kind ?? null) as ContactKind | null,
    channel: r.channel === 'email' ? 'email' : 'text',
    subject: r.subject,
    body: r.body,
    atMs: Date.parse(r.at),
    who: r.who_text?.trim() ?? '',
    delivery: deliveryOf(r.delivery),
    number: r.number?.value ?? null,
    estimate: null,
  }))
  await withEstimateDid(db, lines)
  return lines
}

/** An estimate email's row learns what the customer did with it: the estimate by its number, the thread's event lines by key. */
async function withEstimateDid(db: SupabaseClient, lines: WentOutLine[]): Promise<void> {
  try {
    const numbered = lines.flatMap((l) => {
      const door = l.channel === 'email' ? estimateDoorFor({ channel: 'email', direction: 'out', subject: l.subject ?? null, body: '' }) : null
      return door ? [{ line: l, number: door.number }] : []
    })
    if (numbered.length === 0) return
    const numbers = [...new Set(numbered.map((n) => n.number))]
    const ests = await db.from('estimates').select('id, estimate_number').in('estimate_number', numbers)
    if (ests.error) return
    const idByNumber = new Map(((ests.data ?? []) as Array<{ id: string; estimate_number: number }>).map((e) => [e.estimate_number, e.id]))
    const keys = [...idByNumber.values()].flatMap((id) => [`estimate:${id}:opened`, `estimate:${id}:accepted`])
    if (keys.length === 0) return
    const events = await db.from('messages').select('quo_id').in('quo_id', keys)
    if (events.error) return
    const seen = new Set(((events.data ?? []) as Array<{ quo_id: string | null }>).map((e) => e.quo_id ?? ''))
    for (const { line, number } of numbered) {
      const id = idByNumber.get(number)
      if (!id) continue
      line.estimate = { number, opened: seen.has(`estimate:${id}:opened`), accepted: seen.has(`estimate:${id}:accepted`) }
    }
  } catch {
    // The rows stand without the chip.
  }
}
