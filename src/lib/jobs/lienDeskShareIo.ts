import { FunctionsHttpError, type SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import { groupLegalPortalLinks, legalLinkAddress, parseLegalPortalLinks } from '../legal/legalPortalLinks'
import { fetchActiveUsers } from '../people/fetchActiveUsers'
import type { LienStatusPayload } from '../../../supabase/functions/_shared/lienDeskStatus'

/**
 * The Lien desk Share's reads and its one send (v2.4311): who may get the team email, the
 * firm's live portal link, and `send-lien-desk-summary`. The desk itself reads nothing here.
 */

const db = supabase as unknown as SupabaseClient

/** The roles that open the Lien desk; the email goes only to them (the function checks again). */
export const LIEN_SHARE_RECIPIENT_ROLES = ['dev', 'master_technician', 'assistant', 'controller'] as const

export type LienSharePerson = { id: string; name: string; email: string; role: string }

/** Leaders first (they approve), then the owner's dev account, then the office, by name. */
function rank(role: string): number {
  return role === 'master_technician' ? 0 : role === 'dev' ? 1 : 2
}

/** The people who use the Lien desk and have an email. Devs are in: the owner's account is one. */
export async function fetchLienSharePeople(): Promise<LienSharePerson[]> {
  const { data, error } = await fetchActiveUsers<{ id: string; name: string | null; email: string | null; role: string | null }>('id, name, email, role', {
    roles: LIEN_SHARE_RECIPIENT_ROLES.filter((r) => r !== 'dev'),
    includeDev: true,
  })
  if (error) throw new Error(error.message)
  return data
    .filter((u) => (u.email ?? '').includes('@') && (u.name ?? '').trim())
    .map((u) => ({ id: u.id, name: (u.name ?? '').trim(), email: (u.email ?? '').trim(), role: u.role ?? '' }))
    .sort((a, b) => rank(a.role) - rank(b.role) || a.name.localeCompare(b.name))
}

/**
 * The firm's own live portal link, or null when there is none yet. Since v2.4750 the address is read back through
 * `list_legal_portal_links` (the office's list; the key sits in Vault, never in the table), so the share panel can copy
 * it again. Before that RPC is live, or when Vault cannot give the key back, a live link comes back with `url: null`
 * and the panel says to send it from the Legal desk instead of going quiet.
 */
export async function fetchFirmPortalUrl(origin: string): Promise<{ firmName: string; url: string | null } | null> {
  const { data: firm, error: firmErr } = await db.from('legal_firms').select('id, name').eq('active', true).order('created_at').limit(1).maybeSingle()
  if (firmErr || !firm) return null
  const firmId = (firm as { id: string }).id
  const firmName = ((firm as { name: string | null }).name ?? '').trim() || 'the firm'
  const { data, error } = await db.rpc('list_legal_portal_links', { p_firm_id: firmId })
  const rows = error ? null : parseLegalPortalLinks(data)
  if (!rows) {
    const live = await db.from('legal_portal_links').select('id').eq('firm_id', firmId).is('revoked_at', null).limit(1)
    return live.error || !(live.data ?? []).length ? null : { firmName, url: null }
  }
  const own = groupLegalPortalLinks(rows).firm
  return own ? { firmName, url: legalLinkAddress(own, origin) } : null
}

async function fnErrorMessage(e: unknown, fallback: string): Promise<string> {
  if (e instanceof FunctionsHttpError && e.context) {
    try {
      const b = (await e.context.json()) as { error?: string } | null
      if (b?.error) return b.error
    } catch {
      /* fall through */
    }
  }
  return e instanceof Error && e.message ? e.message : fallback
}

/**
 * Email where the liens stand: to the people picked (`send`), or to yourself with [TEST] on the
 * subject (`test`). The function renders the email from the payload; nothing here is HTML.
 */
export async function sendLienStatusEmail(input: {
  mode: 'send' | 'test'
  payload: LienStatusPayload
  recipientIds: readonly string[]
  subject: string
  note: string
}): Promise<{ sentTo: string[]; failed: string[] }> {
  const { data, error } = await supabase.functions.invoke('send-lien-desk-summary', {
    body: { mode: input.mode, payload: input.payload, recipient_user_ids: input.recipientIds, subject: input.subject, note: input.note },
  })
  if (error) throw new Error(await fnErrorMessage(error, 'The email did not send'))
  const d = (data ?? {}) as { error?: string; sent_to?: unknown; failed?: unknown }
  if (d.error) throw new Error(d.error)
  const failed = Array.isArray(d.failed) ? d.failed.map((f) => (f && typeof f === 'object' && typeof (f as { name?: unknown }).name === 'string' ? (f as { name: string }).name : '')).filter(Boolean) : []
  return { sentTo: Array.isArray(d.sent_to) ? d.sent_to.filter((s): s is string => typeof s === 'string') : [], failed }
}
