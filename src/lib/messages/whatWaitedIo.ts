/**
 * Punch list #141 PR 4: the reads under the Dashboard's **While you were off** line (`whatWaited.ts`). The person's own
 * hours (`pushHoursIo.ts`), their own `notification_history` rows written as held since the hours last closed (the
 * own-row policy), the customers' lines those pushes were for, and what went out to those people after, each read
 * fail-soft: a read that fails reads as nothing, so the line is never wrong, only absent. The untyped client is on
 * purpose, as the Push me reads are: the embeds and the held channel are younger than the generated types' habits.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import type { OfficeHours } from './hasRule'
import { pushedNow } from './pushHours'
import { supabasePushHoursIo } from './pushHoursIo'
import { waitedSince, whatWaited, type Answer, type HeldLine, type HeldRow, type WhatWaited } from './whatWaited'

/** The most held rows one read takes: a night is a handful; a week off is still under this. */
export const HELD_ROWS_MAX = 200
const ANSWERS_MAX = 500

export interface WhatWaitedReads {
  /** The person's hours, or null for any time. */
  hours(userId: string): Promise<OfficeHours | null>
  /** Their rows written as held at or after `sinceIso`, oldest first. */
  held(userId: string, sinceIso: string): Promise<HeldRow[]>
  /** The customers' lines by id, with the person's name. */
  lines(messageIds: readonly string[]): Promise<HeldLine[]>
  /** What went out to these people after `fromIso`, with who sent it. */
  answers(contactIds: readonly string[], fromIso: string): Promise<Answer[]>
}

export function supabaseWhatWaitedReads(client: unknown = supabase): WhatWaitedReads {
  const db = client as SupabaseClient
  const hours = supabasePushHoursIo(client)
  return {
    hours: (userId) => hours.load(userId),
    async held(userId, sinceIso) {
      const r = await db
        .from('notification_history')
        .select('message_id, template_type, sent_at')
        .eq('recipient_user_id', userId)
        .eq('channel', 'held')
        .gte('sent_at', sinceIso)
        .order('sent_at', { ascending: true })
        .limit(HELD_ROWS_MAX)
      if (r.error) return []
      const rows = (r.data ?? []) as Array<{ message_id: string | null; template_type: string | null; sent_at: string }>
      return rows.map((row) => ({ messageId: row.message_id ?? null, templateType: row.template_type ?? '', sentAt: row.sent_at }))
    },
    async lines(messageIds) {
      if (messageIds.length === 0) return []
      const r = await db.from('messages').select('id, contact_id, at, contact:contacts(name)').in('id', [...messageIds])
      if (r.error) return []
      const rows = (r.data ?? []) as Array<{ id: string; contact_id: string; at: string; contact: { name: string | null } | { name: string | null }[] | null }>
      return rows.map((row) => {
        const contact = Array.isArray(row.contact) ? row.contact[0] : row.contact
        return { id: row.id, contactId: row.contact_id, at: row.at, name: contact?.name ?? '' }
      })
    },
    async answers(contactIds, fromIso) {
      if (contactIds.length === 0) return []
      const r = await db
        .from('messages')
        .select('contact_id, at, channel, direction, auto, who_user_id')
        .in('contact_id', [...contactIds])
        .eq('direction', 'out')
        .gt('at', fromIso)
        .order('at', { ascending: true })
        .limit(ANSWERS_MAX)
      if (r.error) return []
      const rows = (r.data ?? []) as Array<{ contact_id: string; at: string; channel: string; direction: string; auto: boolean | null; who_user_id: string | null }>
      const whoIds = [...new Set(rows.map((row) => row.who_user_id).filter((id): id is string => !!id))]
      const names = new Map<string, string>()
      if (whoIds.length > 0) {
        const u = await db.from('users').select('id, name').in('id', whoIds)
        if (!u.error) for (const row of (u.data ?? []) as Array<{ id: string; name: string | null }>) names.set(row.id, row.name ?? '')
      }
      return rows.map((row) => ({
        contactId: row.contact_id,
        at: row.at,
        channel: row.channel,
        direction: row.direction,
        auto: row.auto === true,
        whoName: row.who_user_id ? names.get(row.who_user_id) || null : null,
      }))
    },
  }
}

/**
 * The line for one person at `now`: their hours, the rows held since the hours last closed, the lines those were for
 * and the answers after them, through the kernel. Null for any time, for nothing held, and for a read that fails.
 */
export async function loadWhatWaited(userId: string, now: string, reads: WhatWaitedReads = supabaseWhatWaitedReads()): Promise<WhatWaited | null> {
  try {
    const hours = await reads.hours(userId)
    const since = waitedSince(now, hours)
    if (!since) return null
    const held = await reads.held(userId, since)
    if (held.length === 0) return null
    const ids = [...new Set(held.map((h) => h.messageId).filter((id): id is string => !!id))]
    const lines = ids.length > 0 ? await reads.lines(ids) : []
    const earliest = lines.map((l) => l.at).sort()[0]
    const answers = earliest ? await reads.answers([...new Set(lines.map((l) => l.contactId))], earliest) : []
    return whatWaited({ held, lines, answers, since, now, back: pushedNow(now, hours) })
  } catch {
    return null
  }
}
