/**
 * What went, the reads (v2.5683, punch list #133 PR 2). The customer's thread without making one
 * (`contacts.customer_id`, never the `contact_for_customer` door, which writes), their phones, and the outbound
 * estimate-link texts since the send: `channel = 'text'`, `direction = 'out'`, a body holding `/estimate/accept`
 * (the texts are not stamped with the estimate, so the body and the send's time are the tie), oldest first.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import { checkSupabaseError } from '../../utils/errorHandling'
import type { WhatWentText } from './whatWent'

export interface WhatWentRead {
  texts: WhatWentText[]
  contact: { contactId: string; hasPhone: boolean; stopped: boolean } | null
}

/** How far before `sent_at` a text still counts as this send's: the sheet texts seconds after the email. */
const BEFORE_MS = 10 * 60 * 1000

export async function loadWhatWent(customerId: string, sentAtIso: string | null, client: unknown = supabase): Promise<WhatWentRead> {
  const db = client as SupabaseClient
  const contacts = await db.from('contacts').select('id').eq('customer_id', customerId).order('created_at').limit(1)
  checkSupabaseError(contacts, 'read their thread')
  const contactId = (contacts.data as Array<{ id: string }> | null)?.[0]?.id ?? null
  if (!contactId) return { texts: [], contact: null }
  const sentMs = sentAtIso ? Date.parse(sentAtIso) : NaN
  let lines = db
    .from('messages')
    .select('id, at, channel_id')
    .eq('contact_id', contactId)
    .eq('channel', 'text')
    .eq('direction', 'out')
    .ilike('body', '%/estimate/accept%')
    .order('at', { ascending: true })
    .limit(20)
  if (!Number.isNaN(sentMs)) lines = lines.gte('at', new Date(sentMs - BEFORE_MS).toISOString())
  const [channels, texts] = await Promise.all([
    db.from('contact_channels').select('id, kind, value, opted_out_at').eq('contact_id', contactId),
    lines,
  ])
  checkSupabaseError(channels, 'read their numbers')
  checkSupabaseError(texts, 'read what went')
  const phones = ((channels.data ?? []) as Array<{ id: string; kind: string; value: string; opted_out_at: string | null }>).filter((c) => c.kind === 'phone' && c.value.trim())
  return {
    texts: ((texts.data ?? []) as Array<{ id: string; at: string; channel_id: string | null }>).map((m) => ({
      id: m.id,
      atMs: Date.parse(m.at),
      to: phones.find((p) => p.id === m.channel_id)?.value ?? null,
    })),
    contact: { contactId, hasPhone: phones.length > 0, stopped: phones.length > 0 && phones.every((p) => p.opted_out_at != null) },
  }
}
