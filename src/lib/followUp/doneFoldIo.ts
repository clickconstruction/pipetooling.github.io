/**
 * Done with no reply this week, the read (v2.7030, punch list #324 PR 4): the last `DONE_FOLD_DAYS` days of the grey
 * lines a No reply needed press wrote, and of mail of theirs filed for the record, each for a person whose
 * conversation is Done today. Two reads under the office team's own RLS; the kernel is `doneFold.ts`.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import { checkSupabaseError } from '../../utils/errorHandling'
import { DONE_FOLD_DAYS, type DoneFiledRow, type DoneSaidRow } from './doneFold'
import { NO_REPLY_LIKE } from './noReply'

const CONTACT = 'contact:contacts!inner(name, state, channels:contact_channels(value))'

interface ContactJoin {
  name: string | null
  channels: Array<{ value: string | null }> | null
}

/** The person's name, else the first number or address they have. */
const nameOf = (c: ContactJoin | null): string | null => c?.name?.trim() || c?.channels?.find((ch) => ch.value?.trim())?.value?.trim() || null

export interface DoneFoldRows {
  said: DoneSaidRow[]
  filed: DoneFiledRow[]
}

export async function loadDoneFold(now: Date = new Date(), client: unknown = supabase): Promise<DoneFoldRows> {
  const db = client as SupabaseClient
  const since = new Date(now.getTime() - DONE_FOLD_DAYS * 86_400_000).toISOString()
  const [said, filed] = await Promise.all([
    db
      .from('messages')
      .select(`contact_id, body, at, ${CONTACT}`)
      .eq('channel', 'event')
      .eq('direction', 'team')
      .like('body', NO_REPLY_LIKE)
      .eq('contact.state', 'done')
      .gte('at', since)
      .order('at', { ascending: false })
      .limit(200),
    db
      .from('messages')
      .select(`contact_id, created_at, ${CONTACT}`)
      .eq('history', true)
      .eq('direction', 'in')
      .eq('contact.state', 'done')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(500),
  ])
  checkSupabaseError(said, 'read what was closed with no reply')
  checkSupabaseError(filed, 'read the old mail filed this week')
  return {
    said: ((said.data ?? []) as unknown as Array<{ contact_id: string; body: string; at: string; contact: ContactJoin | null }>).map((r) => ({
      contactId: r.contact_id,
      name: nameOf(r.contact),
      body: r.body,
      at: r.at,
    })),
    filed: ((filed.data ?? []) as unknown as Array<{ contact_id: string; created_at: string; contact: ContactJoin | null }>).map((r) => ({
      contactId: r.contact_id,
      name: nameOf(r.contact),
      landedAt: r.created_at,
    })),
  }
}
