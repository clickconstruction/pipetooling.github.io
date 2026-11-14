import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { calendarYmdInAppTzFromIso } from '../_shared/appTimeZone.ts'
import { ESTIMATE_LINK_LOCKED_CODE, recordEstimateLinkMiss } from '../_shared/estimateLinkMisses.ts'
import {
  PAINTED_MAP_LINKS_OPEN_MAX,
  PAINTED_MAP_LINK_WORDS,
  mintPaintedMapLinkCode,
  paintedMapHexOf,
  paintedMapLinkCode,
  paintedMapLinkExpiry,
  paintedMapLinkOpen,
  sharedMapIsEmpty,
  sharedPaintedMap,
} from '../_shared/paintedMapLink.ts'
import { PORTAL_COMPANY } from '../_shared/portalCompany.ts'
import { refuseArchivedCaller } from '../_shared/refuseArchivedCaller.ts'

/**
 * painted-map-link (punch list #345, PR 4, v2.7223): a link to a painted map. The page at `/way/<code>` opens one map
 * with no sign-in: its name, its lines, and its places with their words and photos. This function is the only door a
 * signed-out reader has to a painted map, and the only thing that writes a link.
 *
 * The page, no auth (`verify_jwt = false`; the ten-letter code is the capability, as an estimate's link is):
 *   GET  ?code=<ten letters>              → { ok, map, company, endsOn } the map as `sharedPaintedMap` tells it: named
 *                                           fields only. Never who painted it, when, the job, the customer, a price or
 *                                           any other thing in the app. 404 `gone` for a wrong code, an ended link and
 *                                           an expired one alike, so a guess learns nothing (a wrong code is a miss,
 *                                           counted; 429 `locked` past 20 in the hour).
 *   GET  ?code=<code>&photo=<place id>    → the bytes of one place's photo, for a place on this link's map alone. From
 *                                           the painted-map-photos bucket. The page never learns the file's name.
 *
 * Whoever painted the map, or the office, signed in:
 *   POST { action: 'desk.mint', mapId }   → { code, endsOn } a new code, handed out once and kept only as its hash.
 *                                           The caller must read the map under their own row security, and must have
 *                                           painted it or work in the office. A map with nothing on it gets no link.
 *   POST { action: 'desk.end', mapId, linkId? } → { ok, ended } End this link now: one link, or every open link of
 *                                           the map. The same two may end one.
 *
 * Rate limit: 60 calls a minute per client address and 600 across the isolate, in memory, best effort. Nothing is
 * texted or mailed from here: the app's own composer carries the link.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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
const PHOTOS_BUCKET = 'painted-map-photos'
/** A photo's name in the bucket: the map's id, then one file. Anything else is not read. */
const PHOTO_PATH_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[A-Za-z0-9_-]{1,80}\.(jpg|jpeg|png|webp)$/i

type LinkRow = { id: string; map_id: string; expires_at: string; ended_at: string | null; opened_at: string | null; open_count: number }

async function sha256(value: string): Promise<string> {
  return paintedMapHexOf(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))))
}

async function findLink(admin: Admin, code: string): Promise<LinkRow | null> {
  const { data, error } = await admin.from('painted_map_links').select('id, map_id, expires_at, ended_at, opened_at, open_count').eq('code_hash', await sha256(code)).maybeSingle()
  if (error) throw new Error(`the link: ${error.message}`)
  return data as LinkRow | null
}

/** The map a link opens, read as the service role, or null when the map itself is gone. */
async function loadMap(admin: Admin, mapId: string) {
  const [mapRes, lineRes, placeRes] = await Promise.all([
    admin.from('painted_maps').select('name, words').eq('id', mapId).maybeSingle(),
    admin.from('painted_map_lines').select('how, points, poor_parts, fixed_by_hand, length_m, margin_m, measured_ft, measured_how, made_at').eq('map_id', mapId),
    admin.from('painted_map_places').select('id, name, words, lat, lng, photo_path, set_at').eq('map_id', mapId),
  ])
  if (mapRes.error) throw new Error(`the map: ${mapRes.error.message}`)
  if (lineRes.error) throw new Error(`the lines: ${lineRes.error.message}`)
  if (placeRes.error) throw new Error(`the places: ${placeRes.error.message}`)
  if (!mapRes.data) return null
  return sharedPaintedMap(mapRes.data, lineRes.data ?? [], placeRes.data ?? [])
}

/**
 * The signed-in caller, and whether this map is theirs to share: they read it under their own row security, and they
 * painted it or work in the office. Null for no session; `mayShare: false` for a map they cannot share.
 */
async function sharer(req: Request, supabaseUrl: string, mapId: string): Promise<{ userId: string; mayShare: boolean } | null> {
  const auth = req.headers.get('Authorization') ?? ''
  if (!auth) return null
  const mine = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } })
  const { data: u } = await mine.auth.getUser()
  const userId = u?.user?.id
  if (!userId) return null
  // Row security answers "may this person read the map": a map they cannot open comes back as no row.
  const { data: map } = await mine.from('painted_maps').select('id, created_by').eq('id', mapId).maybeSingle()
  if (!map) return { userId, mayShare: false }
  if ((map as { created_by: string | null }).created_by === userId) return { userId, mayShare: true }
  const { data: office } = await mine.rpc('is_office_staff')
  return { userId, mayShare: office === true }
}

async function desk(req: Request, admin: Admin, supabaseUrl: string, body: Record<string, unknown>): Promise<Response> {
  const mapId = typeof body.mapId === 'string' ? body.mapId : ''
  if (!UUID_RE.test(mapId)) return json({ error: PAINTED_MAP_LINK_WORDS.failed }, 400)
  const caller = await sharer(req, supabaseUrl, mapId)
  if (!caller) return json({ error: PAINTED_MAP_LINK_WORDS.notYours }, 403)
  const archived = await refuseArchivedCaller(admin, caller.userId, corsHeaders)
  if (archived) return archived
  if (!caller.mayShare) return json({ error: PAINTED_MAP_LINK_WORDS.notYours }, 403)
  // A training account and a twin write nothing: the fences hold them on a table, and this write is the service role's.
  const { data: me } = await admin.from('users').select('read_only, is_digital_twin').eq('id', caller.userId).maybeSingle()
  const flags = me as { read_only?: boolean | null; is_digital_twin?: boolean | null } | null
  if (flags?.read_only || flags?.is_digital_twin) return json({ error: PAINTED_MAP_LINK_WORDS.training }, 403)

  const nowIso = new Date().toISOString()

  if (body.action === 'desk.end') {
    const linkId = typeof body.linkId === 'string' && UUID_RE.test(body.linkId) ? body.linkId : null
    let query = admin.from('painted_map_links').update({ ended_at: nowIso, ended_by: caller.userId }).eq('map_id', mapId).is('ended_at', null)
    if (linkId) query = query.eq('id', linkId)
    const { data, error } = await query.select('id')
    if (error) throw new Error(`ending the link: ${error.message}`)
    console.log(JSON.stringify({ event: 'painted_map_link_end', map: mapId, ended: (data ?? []).length }))
    return json({ ok: true, ended: (data ?? []).length })
  }

  // desk.mint
  const shared = await loadMap(admin, mapId)
  if (!shared) return json({ error: PAINTED_MAP_LINK_WORDS.failed }, 404)
  if (sharedMapIsEmpty(shared)) return json({ error: PAINTED_MAP_LINK_WORDS.empty }, 409)
  const { data: open, error: openErr } = await admin.from('painted_map_links').select('id').eq('map_id', mapId).is('ended_at', null).gt('expires_at', nowIso)
  if (openErr) throw new Error(`the map's links: ${openErr.message}`)
  if ((open ?? []).length >= PAINTED_MAP_LINKS_OPEN_MAX) return json({ error: PAINTED_MAP_LINK_WORDS.tooMany }, 409)
  const expiresAt = paintedMapLinkExpiry(nowIso)
  // A code the table already holds (one chance in 10^14) is minted again.
  for (let attempt = 0; attempt < 3; attempt++) {
    const code = mintPaintedMapLinkCode((n) => crypto.getRandomValues(new Uint8Array(n)))
    const { error } = await admin.from('painted_map_links').insert({ map_id: mapId, code_hash: await sha256(code), made_by: caller.userId, made_at: nowIso, expires_at: expiresAt })
    if (error?.code === '23505') continue
    if (error) throw new Error(`the link: ${error.message}`)
    console.log(JSON.stringify({ event: 'painted_map_link_mint', map: mapId }))
    return json({ ok: true, code, endsOn: calendarYmdInAppTzFromIso(expiresAt) })
  }
  throw new Error('no free code after three tries')
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'GET' && req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  try {
    const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0]?.trim() || req.headers.get('cf-connecting-ip') || 'unknown'
    if (rateLimited(ip, Date.now())) return json({ error: 'Too many requests. Try again in a minute.' }, 429)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const admin: Admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
    const url = new URL(req.url)

    if (req.method === 'POST') {
      const parsed: unknown = await req.json().catch(() => null)
      if (!parsed || typeof parsed !== 'object') return json({ error: PAINTED_MAP_LINK_WORDS.failed }, 400)
      const body = parsed as Record<string, unknown>
      if (body.action === 'desk.mint' || body.action === 'desk.end') return await desk(req, admin, supabaseUrl, body)
      return json({ error: PAINTED_MAP_LINK_WORDS.failed }, 400)
    }

    const gone = () => json({ error: 'gone', words: PAINTED_MAP_LINK_WORDS.gone }, 404)
    const code = paintedMapLinkCode(url.searchParams.get('code'))
    if (!code) return gone()
    const link = await findLink(admin, code)
    if (!link) {
      console.log(JSON.stringify({ event: 'painted_map_link_open', state: 'not_found' }))
      const miss = await recordEstimateLinkMiss(admin, req, 'painted-map-link')
      if (miss.locked) return json({ error: PAINTED_MAP_LINK_WORDS.locked, code: ESTIMATE_LINK_LOCKED_CODE }, 429)
      return gone()
    }
    const nowIso = new Date().toISOString()
    // An ended link and an expired one answer exactly as a wrong code does, without counting as a miss.
    if (!paintedMapLinkOpen(link, nowIso)) {
      console.log(JSON.stringify({ event: 'painted_map_link_open', link: link.id, state: 'closed' }))
      return gone()
    }

    // One place's photo: only a place on this link's map, and only a name of the one shape under that map.
    const photoOf = url.searchParams.get('photo')
    if (photoOf) {
      if (!UUID_RE.test(photoOf)) return gone()
      const { data: place } = await admin.from('painted_map_places').select('photo_path').eq('id', photoOf.toLowerCase()).eq('map_id', link.map_id).maybeSingle()
      const path = (place as { photo_path: string | null } | null)?.photo_path ?? ''
      if (!PHOTO_PATH_RE.test(path) || !path.toLowerCase().startsWith(`${link.map_id.toLowerCase()}/`)) return gone()
      const { data: blob, error: dl } = await admin.storage.from(PHOTOS_BUCKET).download(path)
      if (dl || !blob) return gone()
      const mime = /\.png$/i.test(path) ? 'image/png' : /\.webp$/i.test(path) ? 'image/webp' : 'image/jpeg'
      return new Response(blob, { status: 200, headers: { ...corsHeaders, 'Cache-Control': 'private, max-age=300', 'Content-Type': mime, 'X-Content-Type-Options': 'nosniff' } })
    }

    const shared = await loadMap(admin, link.map_id)
    if (!shared || sharedMapIsEmpty(shared)) return gone()
    // Each open is counted on the link; a `?preview=1` from the sheet that made it is not.
    if (url.searchParams.get('preview') !== '1') {
      void admin.from('painted_map_links').update({ opened_at: link.opened_at ?? nowIso, last_opened_at: nowIso, open_count: (link.open_count ?? 0) + 1 }).eq('id', link.id).then(() => {}, () => {})
    }
    console.log(JSON.stringify({ event: 'painted_map_link_open', link: link.id, state: 'open', lines: shared.lines.length, places: shared.places.length }))
    return json({ ok: true, map: shared, company: { name: PORTAL_COMPANY.name, phone: PORTAL_COMPANY.phone }, endsOn: calendarYmdInAppTzFromIso(link.expires_at) })
  } catch (e) {
    console.error('painted-map-link failed', e)
    return json({ error: PAINTED_MAP_LINK_WORDS.failed }, 500)
  }
})
