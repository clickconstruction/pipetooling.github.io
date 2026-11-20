import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  DOCUMENT_BUILDER_LINK_WORDS as WORDS,
  documentBuilderHexOf,
  documentBuilderLinkCode,
  documentBuilderLinkCodeFrom,
  documentBuilderLinkOpen,
  documentBuilderLinkSeed,
  type DocumentBuilderLinkAnswer,
  type DocumentBuilderLinkState,
} from '../_shared/documentBuilderLink.ts'
import { publicViewDecision } from '../_shared/publicViewCounting.ts'
import { refuseArchivedCaller } from '../_shared/refuseArchivedCaller.ts'

/**
 * document-builder-link (punch list #404, steps 4 and 8): the Document builder's link. A link is a second way in to a
 * published sheet, or to a published builder, for someone with no page of their own: a sub's insurance agent, say. It
 * opens with no login. `verify_jwt = false`: the page it answers has no session, and the dev's own actions check the
 * caller here.
 *
 * Only the SHA-256 of a link's code is kept (`document_builder_links.code_hash`). The row also keeps a random nonce.
 * The code is HMAC-SHA256 of the row's id and nonce under a secret this function holds (DOCUMENT_BUILDER_LINK_SECRET,
 * or the service role key when that is not set), written in the link alphabet. So the function can make the same
 * code again for a dev who opens the tab on another day, and the database alone cannot.
 *
 *   POST { action: 'open', code }                → { kind: 'sheet', revision, sheet, job } | { kind: 'builder', revision, builder, contents }
 *       No login. What the link opens, as published: never a draft. A wrong code, a link switched off and a link a
 *       new one replaced all answer the same 404 { error: 'gone', words }. A link to something with nothing
 *       published answers 404 { error: 'nothing', words }. An open by someone outside is counted on the link; a
 *       signed-in teammate's and a preview are not.
 *   POST { action: 'desk.state', builderKey, sheetId? } → { link: { on: true, code, madeAt, opened, lastOpenedAt } | { on: false } }
 *   POST { action: 'desk.mint', builderKey, sheetId? }  → { link: { on: true, ... } }   A new link. The old one stops.
 *   POST { action: 'desk.end', builderKey, sheetId? }   → { link: { on: false } }       The link is switched off.
 *       The desk actions are a dev's alone, signed in: 403 for anyone else, for an archived account, for a training
 *       account and for a twin. A link is made only for something that is published: 409 { error } otherwise.
 *
 * Rate limit: 60 calls a minute per client address and 600 across the isolate, in memory, best effort. Nothing is
 * mailed or texted from here.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const PER_IP_PER_MINUTE = 60
const TOTAL_PER_MINUTE = 600
const WINDOW_MS = 60_000
const hits = new Map<string, number[]>()

function rateLimited(ip: string, now: number): boolean {
  let total = 0
  for (const [k, arr] of hits) {
    const kept = arr.filter((t) => now - t < WINDOW_MS)
    if (kept.length === 0) hits.delete(k)
    else {
      hits.set(k, kept)
      total += kept.length
    }
  }
  const mine = hits.get(ip) ?? []
  if (mine.length >= PER_IP_PER_MINUTE || total >= TOTAL_PER_MINUTE) return true
  mine.push(now)
  hits.set(ip, mine)
  return false
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })
}

// deno-lint-ignore no-explicit-any
type Admin = any

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const KEY_RE = /^[a-z][a-z0-9-]{0,39}$/

type LinkRow = { id: string; builder_key: string; sheet_id: string | null; nonce: string; made_at: string; ended_at: string | null; opened_at: string | null; last_opened_at: string | null; open_count: number }
const LINK_COLUMNS = 'id, builder_key, sheet_id, nonce, made_at, ended_at, opened_at, last_opened_at, open_count'

async function sha256(value: string): Promise<string> {
  return documentBuilderHexOf(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))))
}

/** The link's code, made again from its row and the function's secret. */
async function codeOf(linkId: string, nonce: string): Promise<string> {
  const secret = Deno.env.get('DOCUMENT_BUILDER_LINK_SECRET')?.trim() || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  // One round is 32 bytes and nearly always enough. A few more are joined on the rare run of skipped bytes.
  let bytes = new Uint8Array(0)
  for (let round = 0; round < 8; round++) {
    const more = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(documentBuilderLinkSeed(linkId, nonce, round))))
    const joined = new Uint8Array(bytes.length + more.length)
    joined.set(bytes)
    joined.set(more, bytes.length)
    bytes = joined
    const code = documentBuilderLinkCode(bytes)
    if (code) return code
  }
  throw new Error('the link code could not be made')
}

function sheetOf(body: Record<string, unknown>): { builderKey: string; sheetId: string | null } | null {
  const builderKey = typeof body.builderKey === 'string' ? body.builderKey : ''
  if (!KEY_RE.test(builderKey)) return null
  if (body.sheetId == null) return { builderKey, sheetId: null }
  return typeof body.sheetId === 'string' && UUID_RE.test(body.sheetId) ? { builderKey, sheetId: body.sheetId.toLowerCase() } : null
}

async function liveLink(admin: Admin, target: { builderKey: string; sheetId: string | null }): Promise<LinkRow | null> {
  let q = admin.from('document_builder_links').select(LINK_COLUMNS).eq('builder_key', target.builderKey).is('ended_at', null)
  q = target.sheetId ? q.eq('sheet_id', target.sheetId) : q.is('sheet_id', null)
  const { data, error } = await q.maybeSingle()
  if (error) throw new Error(`the link: ${error.message}`)
  return data as LinkRow | null
}

async function stateOf(row: LinkRow | null): Promise<DocumentBuilderLinkState> {
  if (!row) return { on: false }
  return { on: true, code: await codeOf(row.id, row.nonce), madeAt: row.made_at, opened: row.open_count, lastOpenedAt: row.last_opened_at }
}

/** What a link opens, as published, or null when nothing is published. Never a draft. */
async function answerOf(admin: Admin, link: { builder_key: string; sheet_id: string | null }): Promise<DocumentBuilderLinkAnswer | null> {
  if (link.sheet_id) {
    const { data, error } = await admin.from('document_builder_sheets').select('revision, published_sheet, project_id').eq('id', link.sheet_id).maybeSingle()
    if (error) throw new Error(`the sheet: ${error.message}`)
    const sheet = data as { revision: number; published_sheet: unknown; project_id: string } | null
    if (!sheet || sheet.revision < 1 || !sheet.published_sheet) return null
    const { data: project } = await admin.from('projects').select('name').eq('id', sheet.project_id).maybeSingle()
    return { kind: 'sheet', revision: sheet.revision, sheet: sheet.published_sheet, job: String((project as { name: string | null } | null)?.name ?? '') }
  }
  const { data, error } = await admin.from('document_builders').select('key, revision, published').eq('key', link.builder_key).maybeSingle()
  if (error) throw new Error(`the builder: ${error.message}`)
  const builder = data as { key: string; revision: number; published: unknown } | null
  if (!builder || builder.revision < 1 || !builder.published) return null
  return { kind: 'builder', revision: builder.revision, builder: builder.key, contents: builder.published }
}

async function open(req: Request, admin: Admin, body: Record<string, unknown>): Promise<Response> {
  const gone = () => json({ error: 'gone', words: WORDS.gone }, 404)
  const code = documentBuilderLinkCodeFrom(body.code)
  if (!code) return gone()
  const { data, error } = await admin.from('document_builder_links').select(LINK_COLUMNS).eq('code_hash', await sha256(code)).maybeSingle()
  if (error) throw new Error(`the link: ${error.message}`)
  const link = data as LinkRow | null
  if (!link || !documentBuilderLinkOpen(link)) return gone()
  const answer = await answerOf(admin, link)
  if (!answer) return json({ error: 'nothing', words: WORDS.nothing }, 404)

  // An open by someone outside is counted. A signed-in teammate's look and a preview are not.
  const view = await publicViewDecision(req, admin, Deno.env.get('SUPABASE_ANON_KEY'))
  if (view.count) {
    const nowIso = new Date().toISOString()
    const { error: stampError } = await admin
      .from('document_builder_links')
      .update({ opened_at: link.opened_at ?? nowIso, last_opened_at: nowIso, open_count: link.open_count + 1 })
      .eq('id', link.id)
    if (stampError) console.error('document-builder-link open stamp', stampError.message)
  }
  console.log(JSON.stringify({ event: 'document_builder_link_open', link: link.id, kind: answer.kind, revision: answer.revision, viewer: view.viewer }))
  return json(answer)
}

/** The signed-in dev, or the refusal to answer with. */
async function dev(req: Request, admin: Admin, supabaseUrl: string): Promise<{ userId: string } | Response> {
  const auth = req.headers.get('Authorization') ?? ''
  if (!auth) return json({ error: WORDS.notYours }, 403)
  const mine = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } })
  const { data: u } = await mine.auth.getUser()
  const userId = u?.user?.id
  if (!userId) return json({ error: WORDS.notYours }, 403)
  const archived = await refuseArchivedCaller(admin, userId, corsHeaders)
  if (archived) return archived
  const { data: me } = await admin.from('users').select('role, read_only, is_digital_twin').eq('id', userId).maybeSingle()
  const flags = me as { role?: string | null; read_only?: boolean | null; is_digital_twin?: boolean | null } | null
  if (flags?.role !== 'dev') return json({ error: WORDS.notYours }, 403)
  // A training account and a twin write nothing: the fences hold them on a table, and this write is the service role's.
  if (flags.read_only || flags.is_digital_twin) return json({ error: WORDS.training }, 403)
  return { userId }
}

async function desk(req: Request, admin: Admin, supabaseUrl: string, body: Record<string, unknown>): Promise<Response> {
  const target = sheetOf(body)
  if (!target) return json({ error: WORDS.failed }, 400)
  const caller = await dev(req, admin, supabaseUrl)
  if (caller instanceof Response) return caller
  const nowIso = new Date().toISOString()

  if (body.action === 'desk.state') return json({ link: await stateOf(await liveLink(admin, target)) })

  if (body.action === 'desk.end') {
    let q = admin.from('document_builder_links').update({ ended_at: nowIso, ended_by: caller.userId }).eq('builder_key', target.builderKey).is('ended_at', null)
    q = target.sheetId ? q.eq('sheet_id', target.sheetId) : q.is('sheet_id', null)
    const { error } = await q
    if (error) throw new Error(`ending the link: ${error.message}`)
    console.log(JSON.stringify({ event: 'document_builder_link_end', builder: target.builderKey, sheet: target.sheetId }))
    return json({ link: { on: false } })
  }

  // desk.mint. A link opens only what is published, so one is made only once there is something to open.
  const answer = await answerOf(admin, { builder_key: target.builderKey, sheet_id: target.sheetId })
  if (!answer) return json({ error: WORDS.notPublished }, 409)
  // A new link stops the old one.
  let stop = admin.from('document_builder_links').update({ ended_at: nowIso, ended_by: caller.userId }).eq('builder_key', target.builderKey).is('ended_at', null)
  stop = target.sheetId ? stop.eq('sheet_id', target.sheetId) : stop.is('sheet_id', null)
  const { error: stopError } = await stop
  if (stopError) throw new Error(`stopping the old link: ${stopError.message}`)
  const id = crypto.randomUUID()
  const nonce = documentBuilderHexOf(crypto.getRandomValues(new Uint8Array(16)))
  const code = await codeOf(id, nonce)
  const { data, error } = await admin
    .from('document_builder_links')
    .insert({ id, builder_key: target.builderKey, sheet_id: target.sheetId, nonce, code_hash: await sha256(code), made_by: caller.userId, made_at: nowIso })
    .select(LINK_COLUMNS)
    .single()
  if (error) throw new Error(`making the link: ${error.message}`)
  console.log(JSON.stringify({ event: 'document_builder_link_mint', link: id, builder: target.builderKey, sheet: target.sheetId }))
  return json({ link: await stateOf(data as LinkRow) })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  try {
    const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0]?.trim() || req.headers.get('cf-connecting-ip') || 'unknown'
    if (rateLimited(ip, Date.now())) return json({ error: 'Too many requests. Try again in a minute.' }, 429)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const admin: Admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
    const parsed: unknown = await req.json().catch(() => null)
    if (!parsed || typeof parsed !== 'object') return json({ error: WORDS.failed }, 400)
    const body = parsed as Record<string, unknown>
    if (body.action === 'open') return await open(req, admin, body)
    if (body.action === 'desk.state' || body.action === 'desk.mint' || body.action === 'desk.end') return await desk(req, admin, supabaseUrl, body)
    return json({ error: WORDS.failed }, 400)
  } catch (e) {
    console.error('document-builder-link failed', e)
    return json({ error: WORDS.failed }, 500)
  }
})
