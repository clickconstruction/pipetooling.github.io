import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { calendarYmdInAppTzFromIso } from '../_shared/appTimeZone.ts'
import { ESTIMATE_LINK_LOCKED_CODE, recordEstimateLinkMiss } from '../_shared/estimateLinkMisses.ts'
import {
  PAINTED_MAP_LINKS_OPEN_MAX,
  PAINTED_MAP_LINK_WORDS,
  mintPaintedMapLinkCode,
  paintedMapClip,
  paintedMapDeviceId,
  paintedMapDeviceWords,
  paintedMapHexOf,
  paintedMapLinkCode,
  paintedMapLinkExpiry,
  paintedMapLinkOpen,
  paintedMapLinkReopenable,
  paintedMapVisitPoint,
  paintedMapVisitPointColumns,
  paintedMapVisitorName,
  sharedMapIsEmpty,
  sharedPaintedMap,
} from '../_shared/paintedMapLink.ts'
import { PORTAL_COMPANY } from '../_shared/portalCompany.ts'
import { refuseArchivedCaller } from '../_shared/refuseArchivedCaller.ts'
import { isZzTestName } from '../_shared/zzTestJob.ts'

/**
 * painted-map-link (punch list #345, PR 4, v2.7223): a link to a painted map. The page at `/way/<code>` opens one map
 * with no sign-in: its name, its lines, and its places with their words and photos. This function is the only door a
 * signed-out reader has to a painted map, and the only thing that writes a link.
 *
 * The page, no auth (`verify_jwt = false`; the ten-letter code is the capability, as an estimate's link is):
 *   GET  ?code=<ten letters>              → 403 `name` since v2.7416: the map opens by `way.open` alone, for a reader
 *                                           who gave a name. A page from before v2.7414 reads *This page is out of
 *                                           date. Reload it to open the map.* 404 `gone` for a wrong code, an ended
 *                                           link and an expired one alike, so a guess learns nothing (a wrong code is a
 *                                           miss, counted; 429 `locked` past 20 in the hour).
 *   GET  ?code=<code>&photo=<place id>&device=<id> → the bytes of one place's photo, for a place on this link's map
 *                                           alone, and since v2.7416 only for a device that has a visit on this link.
 *                                           From the painted-map-photos bucket. The page never learns the file's name.
 *
 * Who is looking (v2.7413, Taunya's ask of 2026-11-15). The page opens the map here, as `sharedPaintedMap` tells it:
 * named fields only, never who painted it, when, the job, the customer, a price or any other thing in the app:
 *   POST { action: 'way.open', code, name?, device: { id, screen?, language?, timeZone? } }
 *                                         → { ok, needsName: true, mapName, company, endsOn } when this device has given
 *                                           no name on this link and none came with the call. Nothing of the map but
 *                                           its name. Otherwise { ok, map, company, endsOn, visitor: { name, signedIn } }
 *                                           and one row of `painted_map_link_visits` is made or counted again: the name,
 *                                           the device id the page keeps on that phone, the browser's own words, the
 *                                           screen, the language, the time zone and the address the call came from. A
 *                                           signed-in teammate (their session in Authorization) is named from their
 *                                           account and types nothing.
 *   POST { action: 'way.here', code, deviceId, lat, lng, accuracyM? } → { ok, kept } where the reader is, sent only
 *                                           after they pressed Show where I am on a page that says the company will see
 *                                           it. The first point once, then the latest, never a trail, and never more
 *                                           often than every twenty seconds. 403 `name` for a device with no visit.
 *
 * Whoever painted the map, or the office, signed in:
 *   POST { action: 'desk.mint', mapId }   → { code, endsOn } a new code, handed out once and kept only as its hash.
 *                                           The caller must read the map under their own row security, and must have
 *                                           painted it or work in the office. A map with nothing on it gets no link.
 *   POST { action: 'desk.mint', mapId, code } → { ok, kept: true, endsOn } the phone picked the code (punch list #394,
 *                                           step 3), so the address is known at the press and Messages opens inside
 *                                           it. The code is ten letters of the link's alphabet, kept only as its
 *                                           hash, and never sent back. The same phone asking again for the same code
 *                                           on the same map gets the same answer, so a lost answer can be asked for
 *                                           twice. A code another link holds is 409 `taken`.
 *   POST { action: 'desk.can', mapId }    → { ok } whether a link could be made now, with nothing written: the sheet
 *                                           asks on opening, and hands a text to the phone at once only on a yes.
 *                                           The refusals are desk.mint's own, with the same words.
 *   POST { action: 'desk.end', mapId, linkId? } → { ok, ended } End this link now: one link, or every open link of
 *                                           the map. The same two may end one.
 *   POST { action: 'desk.reopen', mapId, linkId } → { ok, reopened, endsOn } (punch list #443, row 14): a developer
 *                                           puts an ended link of a test map back, when it is not past its day and
 *                                           the map's name starts with ZZ. The same code opens the map again. Refused
 *                                           in words for anyone else, a live link, a link past its day, a real map,
 *                                           and a map at its open-link cap.
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
    admin.from('painted_map_places').select('id, name, words, lat, lng, photo_path, kind, set_at').eq('map_id', mapId),
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

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null
const gone = () => json({ error: 'gone', words: PAINTED_MAP_LINK_WORDS.gone }, 404)

/**
 * The open link a code names, or the answer for a code that names none: a wrong code is a miss, counted, and an ended
 * link and an expired one answer exactly as a wrong code does without counting as one.
 */
async function openLink(admin: Admin, req: Request, rawCode: unknown, nowIso: string): Promise<{ link: LinkRow } | { refused: Response }> {
  const code = paintedMapLinkCode(typeof rawCode === 'string' ? rawCode : null)
  if (!code) return { refused: gone() }
  const link = await findLink(admin, code)
  if (!link) {
    console.log(JSON.stringify({ event: 'painted_map_link_open', state: 'not_found' }))
    const miss = await recordEstimateLinkMiss(admin, req, 'painted-map-link')
    if (miss.locked) return { refused: json({ error: PAINTED_MAP_LINK_WORDS.locked, code: ESTIMATE_LINK_LOCKED_CODE }, 429) }
    return { refused: gone() }
  }
  if (!paintedMapLinkOpen(link, nowIso)) {
    console.log(JSON.stringify({ event: 'painted_map_link_open', link: link.id, state: 'closed' }))
    return { refused: gone() }
  }
  return { link }
}

/**
 * The signed-in teammate reading a link, when the page carried their session: their id and their name. Null for
 * everyone else, and for an account that has left, who types a name as a stranger does.
 */
async function reader(req: Request, admin: Admin, supabaseUrl: string): Promise<{ userId: string; name: string } | null> {
  const auth = req.headers.get('Authorization') ?? ''
  const anon = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  const token = auth.replace(/^Bearer\s+/i, '').trim()
  if (!token || token === anon) return null
  try {
    const mine = createClient(supabaseUrl, anon, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } })
    const { data: u } = await mine.auth.getUser()
    const userId = u?.user?.id
    if (!userId) return null
    const { data: row } = await admin.from('users').select('name, email, archived_at').eq('id', userId).maybeSingle()
    const me = row as { name: string | null; email: string | null; archived_at: string | null } | null
    if (!me || me.archived_at) return null
    const name = paintedMapVisitorName(me.name) ?? paintedMapVisitorName(me.email)
    return name ? { userId, name } : null
  } catch {
    return null
  }
}

/** One column of what the page said, only when it said something. */
const kept = (column: string, raw: unknown, max: number): Record<string, string> => {
  const said = paintedMapClip(raw, max)
  return said ? { [column]: said } : {}
}

type VisitRow = { id: string; visitor_name: string; open_count: number; first_located_at: string | null; last_located_at: string | null }

/** `way.open`: the map for a reader who has given a name, or the ask for one. */
async function wayOpen(req: Request, admin: Admin, supabaseUrl: string, body: Record<string, unknown>, ip: string): Promise<Response> {
  const nowIso = new Date().toISOString()
  const found = await openLink(admin, req, body.code, nowIso)
  if ('refused' in found) return found.refused
  const link = found.link
  const device = isRecord(body.device) ? body.device : {}
  const deviceId = paintedMapDeviceId(device.id)
  if (!deviceId) return json({ error: 'device', words: PAINTED_MAP_LINK_WORDS.needsDevice }, 400)
  const shared = await loadMap(admin, link.map_id)
  if (!shared || sharedMapIsEmpty(shared)) return gone()

  const who = await reader(req, admin, supabaseUrl)
  const { data: seenRow, error: seenErr } = await admin.from('painted_map_link_visits').select('id, visitor_name, open_count, first_located_at, last_located_at').eq('link_id', link.id).eq('device_id', deviceId).maybeSingle()
  if (seenErr) throw new Error(`the visit: ${seenErr.message}`)
  const seen = seenRow as VisitRow | null
  const name = who?.name ?? paintedMapVisitorName(body.name) ?? seen?.visitor_name ?? null
  const about = { company: { name: PORTAL_COMPANY.name, phone: PORTAL_COMPANY.phone }, endsOn: calendarYmdInAppTzFromIso(link.expires_at) }
  // No name yet: the page learns the map's name and who sent it, and nothing else of the map.
  if (!name) return json({ ok: true, needsName: true, mapName: shared.name, ...about })

  const userAgent = req.headers.get('user-agent')
  const said = {
    visitor_name: name,
    device_words: paintedMapDeviceWords(userAgent),
    user_agent: paintedMapClip(userAgent, 400),
    ip: paintedMapClip(ip === 'unknown' ? '' : ip, 64),
    last_opened_at: nowIso,
    ...(who ? { user_id: who.userId } : {}),
    // What the page said of the device is kept when it says it. A call that leaves one out does not wipe what an earlier
    // open kept (seen on the live project, v2.7416).
    ...kept('screen', device.screen, 40),
    ...kept('language', device.language, 40),
    ...kept('time_zone', device.timeZone, 64),
  }
  if (seen) {
    const { error } = await admin.from('painted_map_link_visits').update({ ...said, open_count: (seen.open_count ?? 1) + 1 }).eq('id', seen.id)
    if (error) throw new Error(`counting the visit: ${error.message}`)
  } else {
    const { error } = await admin.from('painted_map_link_visits').insert({ ...said, link_id: link.id, map_id: link.map_id, device_id: deviceId, first_opened_at: nowIso })
    // Two calls from one page at once: the other one made the row.
    if (error && error.code !== '23505') throw new Error(`keeping the visit: ${error.message}`)
  }
  void admin.from('painted_map_links').update({ opened_at: link.opened_at ?? nowIso, last_opened_at: nowIso, open_count: (link.open_count ?? 0) + 1 }).eq('id', link.id).then(() => {}, () => {})
  // The log says that a visit was kept. Never the name, the device or the address.
  console.log(JSON.stringify({ event: 'painted_map_link_open', link: link.id, state: 'open', named: true, signed_in: !!who, again: !!seen, lines: shared.lines.length, places: shared.places.length }))
  return json({ ok: true, map: shared, visitor: { name, signedIn: !!who }, ...about })
}

/** `way.here`: where the reader is, after they chose to show it on a page that says the company will see it. */
async function wayHere(req: Request, admin: Admin, body: Record<string, unknown>): Promise<Response> {
  const nowIso = new Date().toISOString()
  const found = await openLink(admin, req, body.code, nowIso)
  if ('refused' in found) return found.refused
  const deviceId = paintedMapDeviceId(body.deviceId)
  if (!deviceId) return json({ error: 'device', words: PAINTED_MAP_LINK_WORDS.needsDevice }, 400)
  const point = paintedMapVisitPoint(body.lat, body.lng, body.accuracyM)
  if (!point) return json({ error: 'point', words: PAINTED_MAP_LINK_WORDS.badPoint }, 400)
  const { data: row, error: readErr } = await admin.from('painted_map_link_visits').select('id, visitor_name, open_count, first_located_at, last_located_at').eq('link_id', found.link.id).eq('device_id', deviceId).maybeSingle()
  if (readErr) throw new Error(`the visit: ${readErr.message}`)
  const visit = row as VisitRow | null
  // A place is kept only beside a name: a device that gave none has no row to keep it on.
  if (!visit) return json({ error: 'name', words: PAINTED_MAP_LINK_WORDS.needsName }, 403)
  const columns = paintedMapVisitPointColumns(visit, point, nowIso)
  if (columns) {
    const { error } = await admin.from('painted_map_link_visits').update(columns).eq('id', visit.id)
    if (error) throw new Error(`keeping the place: ${error.message}`)
  }
  console.log(JSON.stringify({ event: 'painted_map_link_here', link: found.link.id, kept: !!columns }))
  return json({ ok: true, kept: !!columns })
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

  // Reopen an ended link (punch list #443, row 14): a developer's take-back of End this link now, on a test map alone.
  if (body.action === 'desk.reopen') {
    const linkId = typeof body.linkId === 'string' && UUID_RE.test(body.linkId) ? body.linkId : null
    if (!linkId) return json({ error: PAINTED_MAP_LINK_WORDS.failed }, 400)
    const { data: who } = await admin.from('users').select('role').eq('id', caller.userId).maybeSingle()
    if ((who as { role?: string | null } | null)?.role !== 'dev') return json({ error: PAINTED_MAP_LINK_WORDS.reopenNotDev }, 403)
    const sharedMap = await loadMap(admin, mapId)
    if (!sharedMap) return json({ error: PAINTED_MAP_LINK_WORDS.failed }, 404)
    if (!isZzTestName(sharedMap.name)) return json({ error: PAINTED_MAP_LINK_WORDS.reopenNotTest }, 403)
    const { data: linkRow, error: linkErr } = await admin.from('painted_map_links').select('id, ended_at, expires_at').eq('id', linkId).eq('map_id', mapId).maybeSingle()
    if (linkErr) throw new Error(`the link: ${linkErr.message}`)
    const ended = linkRow as { id: string; ended_at: string | null; expires_at: string } | null
    if (!ended) return json({ error: PAINTED_MAP_LINK_WORDS.failed }, 404)
    if (!ended.ended_at) return json({ error: PAINTED_MAP_LINK_WORDS.reopenNotEnded }, 409)
    if (!paintedMapLinkReopenable(ended, nowIso)) return json({ error: PAINTED_MAP_LINK_WORDS.reopenPastDay }, 409)
    const { data: openNow, error: openNowErr } = await admin.from('painted_map_links').select('id').eq('map_id', mapId).is('ended_at', null).gt('expires_at', nowIso)
    if (openNowErr) throw new Error(`the map's links: ${openNowErr.message}`)
    if ((openNow ?? []).length >= PAINTED_MAP_LINKS_OPEN_MAX) return json({ error: PAINTED_MAP_LINK_WORDS.tooMany }, 409)
    const { data: back, error: backErr } = await admin.from('painted_map_links').update({ ended_at: null, ended_by: null }).eq('id', linkId).eq('map_id', mapId).not('ended_at', 'is', null).select('id')
    if (backErr) throw new Error(`reopening the link: ${backErr.message}`)
    console.log(JSON.stringify({ event: 'painted_map_link_reopen', map: mapId, link: linkId, reopened: (back ?? []).length }))
    return json({ ok: true, reopened: (back ?? []).length, endsOn: calendarYmdInAppTzFromIso(ended.expires_at) })
  }

  // desk.mint and desk.can
  // The phone's own code, when it picked one. A code that is not ten letters of the alphabet is refused, not replaced:
  // the phone has already written it into a text.
  const given = body.code === undefined || body.code === null ? null : paintedMapLinkCode(typeof body.code === 'string' ? body.code : null)
  if (body.code !== undefined && body.code !== null && !given) return json({ error: PAINTED_MAP_LINK_WORDS.failed }, 400)
  const givenHash = given ? await sha256(given) : null
  /** The link that already holds the phone's code, answered: this caller's own open link of this map, or somebody else's. */
  const heldAnswer = async (hash: string): Promise<Response | null> => {
    const { data: held, error: heldErr } = await admin.from('painted_map_links').select('map_id, made_by, expires_at, ended_at').eq('code_hash', hash).maybeSingle()
    if (heldErr) throw new Error(`the link: ${heldErr.message}`)
    const row = held as { map_id: string; made_by: string | null; expires_at: string; ended_at: string | null } | null
    if (!row) return null
    if (row.map_id === mapId && row.made_by === caller.userId && paintedMapLinkOpen(row, nowIso)) return json({ ok: true, kept: true, endsOn: calendarYmdInAppTzFromIso(row.expires_at) })
    return json({ error: PAINTED_MAP_LINK_WORDS.taken }, 409)
  }
  if (givenHash && body.action === 'desk.mint') {
    // The same phone asking twice for the same code: its first answer was lost on the way back.
    const again = await heldAnswer(givenHash)
    if (again) return again
  }
  const shared = await loadMap(admin, mapId)
  if (!shared) return json({ error: PAINTED_MAP_LINK_WORDS.failed }, 404)
  if (sharedMapIsEmpty(shared)) return json({ error: PAINTED_MAP_LINK_WORDS.empty }, 409)
  const { data: open, error: openErr } = await admin.from('painted_map_links').select('id').eq('map_id', mapId).is('ended_at', null).gt('expires_at', nowIso)
  if (openErr) throw new Error(`the map's links: ${openErr.message}`)
  if ((open ?? []).length >= PAINTED_MAP_LINKS_OPEN_MAX) return json({ error: PAINTED_MAP_LINK_WORDS.tooMany }, 409)
  // desk.can stops here: every refusal a mint would give has been given, and nothing is written.
  if (body.action === 'desk.can') return json({ ok: true })
  const expiresAt = paintedMapLinkExpiry(nowIso)
  if (givenHash) {
    const { error } = await admin.from('painted_map_links').insert({ map_id: mapId, code_hash: givenHash, made_by: caller.userId, made_at: nowIso, expires_at: expiresAt })
    // Two asks for one code in the same moment: the other one wrote it, and this one reads what it wrote.
    if (error?.code === '23505') return (await heldAnswer(givenHash)) ?? json({ error: PAINTED_MAP_LINK_WORDS.taken }, 409)
    if (error) throw new Error(`the link: ${error.message}`)
    console.log(JSON.stringify({ event: 'painted_map_link_mint', map: mapId, by: 'phone' }))
    return json({ ok: true, kept: true, endsOn: calendarYmdInAppTzFromIso(expiresAt) })
  }
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
      if (body.action === 'desk.mint' || body.action === 'desk.end' || body.action === 'desk.can' || body.action === 'desk.reopen') return await desk(req, admin, supabaseUrl, body)
      if (body.action === 'way.open') return await wayOpen(req, admin, supabaseUrl, body, ip)
      if (body.action === 'way.here') return await wayHere(req, admin, body)
      return json({ error: PAINTED_MAP_LINK_WORDS.failed }, 400)
    }

    const nowIso = new Date().toISOString()
    const found = await openLink(admin, req, url.searchParams.get('code'), nowIso)
    if ('refused' in found) return found.refused
    const link = found.link

    // One place's photo: only a place on this link's map, only a name of the one shape under that map, and only for
    // a device that gave a name on this link. Anything else reads as a link that is gone.
    const photoOf = url.searchParams.get('photo')
    if (photoOf) {
      if (!UUID_RE.test(photoOf)) return gone()
      const deviceId = paintedMapDeviceId(url.searchParams.get('device'))
      if (!deviceId) return gone()
      const { data: visit } = await admin.from('painted_map_link_visits').select('id').eq('link_id', link.id).eq('device_id', deviceId).maybeSingle()
      if (!visit) return gone()
      const { data: place } = await admin.from('painted_map_places').select('photo_path').eq('id', photoOf.toLowerCase()).eq('map_id', link.map_id).maybeSingle()
      const path = (place as { photo_path: string | null } | null)?.photo_path ?? ''
      if (!PHOTO_PATH_RE.test(path) || !path.toLowerCase().startsWith(`${link.map_id.toLowerCase()}/`)) return gone()
      const { data: blob, error: dl } = await admin.storage.from(PHOTOS_BUCKET).download(path)
      if (dl || !blob) return gone()
      const mime = /\.png$/i.test(path) ? 'image/png' : /\.webp$/i.test(path) ? 'image/webp' : 'image/jpeg'
      return new Response(blob, { status: 200, headers: { ...corsHeaders, 'Cache-Control': 'private, max-age=300', 'Content-Type': mime, 'X-Content-Type-Options': 'nosniff' } })
    }

    // The map itself opens by `way.open` alone, for a reader who gave a name. A page from before the name step asks
    // this way: it is told to reload, and learns nothing of the map.
    console.log(JSON.stringify({ event: 'painted_map_link_open', link: link.id, state: 'old_page' }))
    return json({ error: 'name', words: PAINTED_MAP_LINK_WORDS.reload }, 403)
  } catch (e) {
    console.error('painted-map-link failed', e)
    return json({ error: PAINTED_MAP_LINK_WORDS.failed }, 500)
  }
})
