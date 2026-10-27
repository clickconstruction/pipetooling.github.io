/**
 * What went, the reads (v2.5683, punch list #133 PR 2). The customer's thread without making one
 * (`contacts.customer_id`, never the `contact_for_customer` door, which writes), their phones, and the outbound texts
 * carrying this estimate's link: `channel = 'text'`, `direction = 'out'`, a body holding `/estimate/accept`, from ten
 * minutes before the send — then kept only where the link's token hashes to the estimate's `public_token_hash`
 * (`acceptLinkTie.ts`, v2.5697: a body match alone let an older estimate claim a later one's text). Oldest first.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import { checkSupabaseError } from '../../utils/errorHandling'
import { textsCarryingLink } from './acceptLinkTie'
import { loadSentCopiesForSource } from '../sent/sentCopiesIo'
import type { WhatWentEmailAgain, WhatWentText } from './whatWent'

export interface WhatWentRead {
  texts: WhatWentText[]
  contact: { contactId: string; hasPhone: boolean; stopped: boolean } | null
  /** The letters sent again (v2.5997): the sent copies filed from this estimate as a resend or a remail, oldest first. */
  emailsAgain?: WhatWentEmailAgain[]
}

/** The sent copies of this estimate that were a letter again, oldest first; empty when the office cannot read them. */
export async function loadEmailsAgain(estimateId: string | null): Promise<WhatWentEmailAgain[]> {
  if (!estimateId) return []
  const copies = await loadSentCopiesForSource('estimates', estimateId)
  return copies
    .filter((c) => c.kind === 'estimate_resent' || c.kind === 'estimate_remailed')
    .map((c) => ({ id: c.id, atMs: Date.parse(c.sentAt), to: c.recipientEmails[0] ?? null, kind: c.kind === 'estimate_remailed' ? ('remailed' as const) : ('resent' as const) }))
    .filter((e) => !Number.isNaN(e.atMs))
    .sort((a, b) => a.atMs - b.atMs)
}

/** How far before `sent_at` a text still counts as this send's: the sheet texts seconds after the email. */
const BEFORE_MS = 10 * 60 * 1000

export async function loadWhatWent(customerId: string, sentAtIso: string | null, tokenHash: string | null, client: unknown = supabase, estimateId: string | null = null): Promise<WhatWentRead> {
  const db = client as SupabaseClient
  const emailsAgainRead = loadEmailsAgain(estimateId).catch(() => [] as WhatWentEmailAgain[])
  const contacts = await db.from('contacts').select('id').eq('customer_id', customerId).order('created_at').limit(1)
  checkSupabaseError(contacts, 'read their thread')
  const contactId = (contacts.data as Array<{ id: string }> | null)?.[0]?.id ?? null
  if (!contactId) return { texts: [], contact: null, emailsAgain: await emailsAgainRead }
  const sentMs = sentAtIso ? Date.parse(sentAtIso) : NaN
  let lines = db
    .from('messages')
    .select('id, at, channel_id, body')
    .eq('contact_id', contactId)
    .eq('channel', 'text')
    .eq('direction', 'out')
    .ilike('body', '%/estimate/accept%')
    .order('at', { ascending: true })
    .limit(50)
  if (!Number.isNaN(sentMs)) lines = lines.gte('at', new Date(sentMs - BEFORE_MS).toISOString())
  const [channels, texts] = await Promise.all([
    db.from('contact_channels').select('id, kind, value, opted_out_at').eq('contact_id', contactId),
    lines,
  ])
  checkSupabaseError(channels, 'read their numbers')
  checkSupabaseError(texts, 'read what went')
  const phones = ((channels.data ?? []) as Array<{ id: string; kind: string; value: string; opted_out_at: string | null }>).filter((c) => c.kind === 'phone' && c.value.trim())
  const mine = await textsCarryingLink((texts.data ?? []) as Array<{ id: string; at: string; channel_id: string | null; body: string }>, tokenHash)
  return {
    texts: mine.map((m) => ({
      id: m.id,
      atMs: Date.parse(m.at),
      to: phones.find((p) => p.id === m.channel_id)?.value ?? null,
    })),
    contact: { contactId, hasPhone: phones.length > 0, stopped: phones.length > 0 && phones.every((p) => p.opted_out_at != null) },
    emailsAgain: await emailsAgainRead,
  }
}
