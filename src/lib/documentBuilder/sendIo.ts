/**
 * The reads and writes of the Document builder's send (punch list #404, step 5): the trades on a job with who can be
 * sent to and where each one's own page stands, the sends of a sheet, the send itself through the
 * `document-builder-send` function, and a send taken off a page. A dev alone reads or writes any of it. Browser io,
 * not pure; the rules are `send.ts`.
 *
 * The tables are younger than the generated types, so the client is cast once here.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { formatErrorMessage, withSupabaseRetry } from '../../utils/errorHandling'
import type { Landed } from './documentBuildersIo'
import type { PartyContact, PartyPage, SendParty, SendRecord } from './send'
import { DOCUMENT_BUILDER_SEND_REFUSALS, type DocumentBuilderSendWhy } from './sendWords'

const db = supabase as unknown as SupabaseClient
const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string).replace(/\/+$/, '')
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string
const FUNCTION_URL = `${supabaseUrl}/functions/v1/document-builder-send`

const SEND_SELECT = 'id, company_id, customer_id, contact_name, sent_at, sent_revision, times_sent, opened_at, opened_revision'

type SendRow = { id: string; company_id: string | null; customer_id: string | null; contact_name: string; sent_at: string; sent_revision: number; times_sent: number; opened_at: string | null; opened_revision: number | null }

export function sendRecordFromRow(row: { id: string; contact_name: string; sent_at: string; sent_revision: number; times_sent: number; opened_at: string | null; opened_revision: number | null }, about: string | null = null): SendRecord {
  return { id: row.id, contactName: row.contact_name, about, sentOn: calendarYmdInAppTzFromIso(row.sent_at), sentRevision: row.sent_revision, timesSent: row.times_sent, openedOn: row.opened_at ? calendarYmdInAppTzFromIso(row.opened_at) : null, openedRevision: row.opened_revision }
}

/** Where a party's own page stands, from its links: one that is on, none ever made, or every one turned off. */
export function pageFromLinks(links: ReadonlyArray<{ revoked_at: string | null }>): PartyPage {
  if (links.some((l) => !l.revoked_at)) return { state: 'on' }
  if (links.length === 0) return { state: 'none' }
  const last = links.map((l) => l.revoked_at as string).sort().pop() ?? null
  return { state: 'off', offOn: last ? calendarYmdInAppTzFromIso(last) : null }
}

/** Everyone at a company a send can go to: its main contact, then its people, each with an email, none twice. */
export function contactsOf(company: { contact_name: string | null; email: string | null }, people: ReadonlyArray<{ name: string | null; email: string | null; role: string | null }>): PartyContact[] {
  const out: PartyContact[] = []
  const add = (name: string | null, email: string | null, role?: string | null) => {
    const e = (email ?? '').trim()
    if (!e || out.some((c) => c.email.toLowerCase() === e.toLowerCase())) return
    out.push({ name: (name ?? '').trim() || e, email: e, ...(role?.trim() ? { role: role.trim() } : null) })
  }
  add(company.contact_name, company.email)
  for (const p of people) add(p.name, p.email, p.role)
  return out
}

/**
 * The trades on a job, as the send's rows: every company asked on one of the job's trades and not passed, the awarded
 * ones first, each with who can be sent to, where its page stands and its send of this sheet. Throws with the reason.
 */
export async function readSheetParties(projectId: string, sheetId: string | null): Promise<SendParty[]> {
  const packages = ((await withSupabaseRetry<unknown[]>(() => db.from('gc_trade_packages').select('id, trade, awarded_invite_id').eq('project_id', projectId), 'read the trades')) ?? []) as Array<{ id: string; trade: string | null; awarded_invite_id: string | null }>
  if (packages.length === 0) return []
  const invites = ((await withSupabaseRetry<unknown[]>(() => db.from('gc_invites').select('id, company_id, package_id, status').in('package_id', packages.map((p) => p.id)), 'read the trades')) ?? []) as Array<{ id: string; company_id: string; package_id: string; status: string | null }>
  const on = invites.filter((i) => i.status !== 'declined')
  const companyIds = [...new Set(on.map((i) => i.company_id))]
  if (companyIds.length === 0) return []
  const [companies, people, links, sends] = await Promise.all([
    withSupabaseRetry<unknown[]>(() => db.from('gc_companies').select('id, name, contact_name, email').in('id', companyIds), 'read the trades'),
    withSupabaseRetry<unknown[]>(() => db.from('gc_company_people').select('company_id, name, email, role').in('company_id', companyIds).is('removed_at', null), 'read the trades'),
    withSupabaseRetry<unknown[]>(() => db.from('gc_trade_portal_links').select('company_id, revoked_at').in('company_id', companyIds), 'read the trades'),
    sheetId ? withSupabaseRetry<unknown[]>(() => db.from('document_builder_sends').select(SEND_SELECT).eq('sheet_id', sheetId).is('taken_off_at', null), 'read the sends') : Promise.resolve([] as unknown[]),
  ])
  const awardedInvites = new Set(packages.map((p) => p.awarded_invite_id).filter((id): id is string => id != null))
  const awarded = new Set(on.filter((i) => awardedInvites.has(i.id)).map((i) => i.company_id))
  const tradeOf = new Map(packages.map((p) => [p.id, (p.trade ?? '').trim()]))
  return ((companies ?? []) as Array<{ id: string; name: string | null; contact_name: string | null; email: string | null }>)
    .map((c): SendParty & { awarded: boolean } => {
      const trades = [...new Set(on.filter((i) => i.company_id === c.id).map((i) => tradeOf.get(i.package_id) ?? '').filter(Boolean))]
      const send = ((sends ?? []) as SendRow[]).find((s) => s.company_id === c.id)
      const isAwarded = awarded.has(c.id)
      return {
        id: c.id,
        name: (c.name ?? '').trim(),
        sub: [trades.join(', '), isAwarded ? 'awarded' : 'asked, not awarded'].filter(Boolean).join(' · '),
        page: pageFromLinks(((links ?? []) as Array<{ company_id: string; revoked_at: string | null }>).filter((l) => l.company_id === c.id)),
        contacts: contactsOf(c, ((people ?? []) as Array<{ company_id: string; name: string | null; email: string | null; role: string | null }>).filter((p) => p.company_id === c.id)),
        send: send ? sendRecordFromRow(send) : null,
        awarded: isAwarded,
      }
    })
    .sort((a, b) => Number(b.awarded) - Number(a.awarded) || a.name.localeCompare(b.name))
    .map(({ awarded: _awarded, ...party }) => party)
}

/**
 * The words for a send the function refused. The function answers its key's words, and for some refusals the reason
 * beside them (`detail`): the mail service's own answer, or what the database said. One of those is not a refusal of
 * the send at all: the email went and only its record did not land. Its key's words say *Try again*, which would send
 * a second email, so that case reads as what happened.
 */
export function sendRefusalWords(body: unknown): string {
  const b = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>
  const words = typeof b.words === 'string' && b.words ? b.words : DOCUMENT_BUILDER_SEND_REFUSALS.failed.words
  const detail = typeof b.detail === 'string' ? b.detail.trim() : ''
  if (!detail) return words
  const went = /^Sent, but not recorded:?\s*/i
  if (went.test(detail)) {
    const reason = detail.replace(went, '')
    return `The email went, but the send was not recorded here. Do not send it again.${reason ? ` The reason: ${reason}` : ''}`
  }
  return `${words} The reason: ${detail}`
}

export type SheetSendAsk = { builderKey: string; sheetId: string; companyId: string; contactEmail: string; note: string; why: DocumentBuilderSendWhy; anyway: boolean; test?: boolean }

/** One send, through the function. It answers the send's row, or the reason in the function's own words. */
export async function sendSheet(ask: SheetSendAsk): Promise<Landed<SendRecord | { test: true; email: string }>> {
  let token: string | null = null
  try {
    token = (await supabase.auth.getSession()).data.session?.access_token ?? null
  } catch {
    token = null
  }
  if (!token) return { ok: false, error: DOCUMENT_BUILDER_SEND_REFUSALS.notYours.words }
  let res: Response
  try {
    res = await fetch(FUNCTION_URL, { method: 'POST', headers: { apikey: anonKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'send', ...ask }) })
  } catch {
    return { ok: false, error: 'Could not reach the app. Nothing was sent. Check your signal, then try again.' }
  }
  const body = (await res.json().catch(() => null)) as Record<string, unknown> | null
  if (!res.ok || !body) return { ok: false, error: sendRefusalWords(body) }
  if (body.test === true) return { ok: true, value: { test: true, email: String(body.email ?? '') } }
  const s = body.send as Record<string, unknown> | undefined
  if (!s || typeof s.id !== 'string' || typeof s.sentAt !== 'string') return { ok: false, error: DOCUMENT_BUILDER_SEND_REFUSALS.failed.words }
  return {
    ok: true,
    value: sendRecordFromRow({ id: s.id, contact_name: String(s.contactName ?? ''), sent_at: s.sentAt, sent_revision: Number(s.sentRevision ?? 0), times_sent: Number(s.timesSent ?? 1), opened_at: typeof s.openedAt === 'string' ? s.openedAt : null, opened_revision: typeof s.openedRevision === 'number' ? s.openedRevision : null }),
  }
}

/** A send taken off the party's page. The row stays as the record that it went. */
export async function takeSendOff(sendId: string): Promise<Landed<true>> {
  try {
    const { data, error } = await db.from('document_builder_sends').update({ taken_off_at: new Date().toISOString() }).eq('id', sendId).select('id')
    if (error) return { ok: false, error: formatErrorMessage(error, 'It was not taken off their page.') }
    return Array.isArray(data) && data.length > 0 ? { ok: true, value: true } : { ok: false, error: 'It was not on their page any more. Read the page again.' }
  } catch (e) {
    return { ok: false, error: formatErrorMessage(e, 'It was not taken off their page.') }
  }
}
