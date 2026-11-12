import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { APP_CALENDAR_TZ, calendarYmdInAppTzFromIso, ymdAddDays } from '../_shared/appTimeZone.ts'
import { ESTIMATE_LINK_LOCKED_CODE, ESTIMATE_LINK_LOCKED_WORDS, recordEstimateLinkMiss } from '../_shared/estimateLinkMisses.ts'
import { PORTAL_COMPANY } from '../_shared/portalCompany.ts'
import { refuseArchivedCaller } from '../_shared/refuseArchivedCaller.ts'
import { boxPageOfficePhone } from '../_shared/boxPage.ts'
import { BOXES_SETTINGS_KEY, boxSetting, parseBoxSettings } from '../_shared/gcKernels/lib/messages/boxes.ts'
import { OFFICE_HOURS_KEY, nextOpening, officeOpen, parseOfficeHours } from '../_shared/gcKernels/lib/messages/hasRule.ts'
import {
  FIRST_LOOK_BUCKET,
  FIRST_LOOK_CAPS,
  firstLookClientWords,
  firstLookClosesWords,
  firstLookCode,
  firstLookExpiry,
  firstLookKindOfMime,
  firstLookKeptPath,
  firstLookObjectPath,
  firstLookSampleOf,
  firstLookSamplePayload,
  FIRST_LOOK_SAMPLE_WORDS,
  firstLookSentLine,
  firstLookSignRefusal,
  firstLookSniff,
  firstLookState,
  firstLookThanks,
  firstNameOf,
  hexOf,
  mintFirstLookCode,
  type FirstLookDeskFile,
  type FirstLookDeskRow,
  type FirstLookKind,
} from '../_shared/firstLook.ts'

/**
 * first-look (punch list #319, the spike, v2.6981): a caller is sent a link, and on a page with no sign-in adds photos
 * and a short video of the problem. This function is the only thing that reads or writes a look: the page asks it with
 * the link's ten-letter code, the desk asks it signed in.
 *
 * The page, no auth (`verify_jwt = false`; the code is the capability, as an estimate's link is):
 *   GET  ?code=<ten letters>                    → { ok, look: { askedBy, photos, videos, sentCount }, caps, office }
 *                                                 who asked, how many files the link holds, what it may take, the
 *                                                 office's number and hours. Never a name, an address, a price or a
 *                                                 file. 404 for a code that opens nothing (a miss, counted; 429
 *                                                 `locked` past 20 in the hour), 410 `closed` or `expired`.
 *   POST { code, action: 'sign', mime, bytes, name?, fileId? }
 *                                               → { fileId, bucket, path, token, signedUrl } after the caps: a one-file
 *                                                 upload address into the private bucket. The bytes go from the phone
 *                                                 to storage and never through this function. With `fileId` the same
 *                                                 file is signed again, for an upload that picks up after two hours.
 *   POST { code, action: 'done', fileId, road, resumed, tookMs, seconds? }
 *                                               → { ok, photos, videos } once the object is there and its first bytes
 *                                                 are a picture or a video. Anything else is deleted and refused.
 *   POST { code, action: 'send', place?, words? } → { ok, thanks } stamps the send, keeps their two fields, and writes
 *                                                 one line on the person's thread when the look is tied to one.
 *
 * The desk, signed in, the owner and the developers only while this is a spike (`is_master_or_dev`):
 *   POST { action: 'desk.list' }                → { looks } the newest fifty with their files, each finished file with a
 *                                                 link that opens it for an hour.
 *   POST { action: 'desk.mint', contactId?, label? } → { code, lookId } a new look and its code, handed out once.
 *   POST { action: 'desk.close', lookId }       → the link stops taking files.
 *   POST { action: 'desk.looked', lookId }      → stamps the first look at what came in.
 *   POST { action: 'desk.remove', lookId }      → the look, its rows and its files gone. For test looks.
 *
 * Rate limit: 240 calls a minute per client address and 1,200 across the isolate, in memory, best effort.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const PER_IP_PER_MINUTE = 240
const TOTAL_PER_MINUTE = 1200
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

type LookRow = {
  id: string
  contact_id: string | null
  label: string
  asked_by: string | null
  asked_by_name: string
  made_at: string
  expires_at: string
  opened_at: string | null
  sent_at: string | null
  sent_count: number
  looked_at: string | null
  closed_at: string | null
  place: string | null
  words: string | null
}

type FileRow = {
  id: string
  look_id: string
  kind: FirstLookKind
  mime: string
  name: string
  storage_path: string
  declared_bytes: number
  bytes: number | null
  seconds: number | null
  road: string | null
  resumed: number
  took_ms: number | null
  client: string | null
  signed_at: string
  finished_at: string | null
  removed_at: string | null
}

const LOOK_COLUMNS = 'id, contact_id, label, asked_by, asked_by_name, made_at, expires_at, opened_at, sent_at, sent_count, looked_at, closed_at, place, words'
const FILE_COLUMNS = 'id, look_id, kind, mime, name, storage_path, declared_bytes, bytes, seconds, road, resumed, took_ms, client, signed_at, finished_at, removed_at'

async function sha256Hex(value: string): Promise<string> {
  return hexOf(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))))
}

/** The office's number, as the box page reads it: the team box's line from Settings, else the letterhead's. */
async function officePhone(admin: Admin): Promise<string> {
  let team = ''
  try {
    const { data } = await admin.from('app_settings').select('value_text').eq('key', BOXES_SETTINGS_KEY).maybeSingle()
    team = boxSetting('team', parseBoxSettings((data as { value_text: string | null } | null)?.value_text)).phone
  } catch (e) {
    console.warn('first-look: the boxes did not read', e)
  }
  return boxPageOfficePhone([team, Deno.env.get('QUO_COMPANY_PHONE'), PORTAL_COMPANY.phone])
}

/** Whether the office is open now, when today closes, and when it next opens, in words. */
async function officeNow(admin: Admin, nowIso: string): Promise<{ open: boolean; closesWords: string | null; opensWords: string | null }> {
  try {
    const { data } = await admin.from('app_settings').select('value_text').eq('key', OFFICE_HOURS_KEY).maybeSingle()
    const hours = parseOfficeHours((data as { value_text: string | null } | null)?.value_text)
    const open = officeOpen(nowIso, hours)
    if (open) return { open, closesWords: firstLookClosesWords(hours), opensWords: null }
    const next = nextOpening(nowIso, hours)
    if (!next) return { open: false, closesWords: null, opensWords: null }
    const today = calendarYmdInAppTzFromIso(nowIso)
    const day = calendarYmdInAppTzFromIso(next)
    const at = new Intl.DateTimeFormat('en-US', { timeZone: APP_CALENDAR_TZ, hour: 'numeric', minute: '2-digit' }).format(new Date(next)).replace(':00', '')
    const dayWords = day === today ? 'today' : day === ymdAddDays(today, 1) ? 'tomorrow' : `on ${new Intl.DateTimeFormat('en-US', { timeZone: APP_CALENDAR_TZ, weekday: 'long' }).format(new Date(next))}`
    return { open: false, closesWords: null, opensWords: `${dayWords} at ${at}` }
  } catch (e) {
    console.warn('first-look: the office hours did not read', e)
    return { open: false, closesWords: null, opensWords: null }
  }
}

/** What a look holds: the files that arrived, and the upload addresses it was ever handed for each kind. */
async function countsOf(admin: Admin, lookId: string): Promise<{ photos: number; videos: number; photoSigns: number; videoSigns: number }> {
  const { data, error } = await admin.from('first_look_files').select('kind, finished_at, removed_at').eq('look_id', lookId)
  if (error) throw new Error(error.message)
  const rows = (data ?? []) as Array<{ kind: FirstLookKind; finished_at: string | null; removed_at: string | null }>
  const live = rows.filter((r) => r.finished_at && !r.removed_at)
  return {
    photos: live.filter((r) => r.kind === 'photo').length,
    videos: live.filter((r) => r.kind === 'video').length,
    photoSigns: rows.filter((r) => r.kind === 'photo').length,
    videoSigns: rows.filter((r) => r.kind === 'video').length,
  }
}

/** The first bytes of an object in the bucket, read through a link that opens it for a minute. Never the whole file. */
async function firstBytes(admin: Admin, path: string): Promise<Uint8Array | null> {
  const { data, error } = await admin.storage.from(FIRST_LOOK_BUCKET).createSignedUrl(path, 60)
  if (error || !data?.signedUrl) return null
  const res = await fetch(data.signedUrl, { headers: { Range: 'bytes=0-31' } })
  if (!res.ok || !res.body) return null
  const reader = res.body.getReader()
  const { value } = await reader.read()
  await reader.cancel().catch(() => {})
  return value ? value.slice(0, 32) : null
}

/** The object's size as the bucket lists it, or null when it is not there. */
async function objectBytes(admin: Admin, path: string): Promise<number | null> {
  const slash = path.lastIndexOf('/')
  const folder = path.slice(0, slash)
  const file = path.slice(slash + 1)
  const { data, error } = await admin.storage.from(FIRST_LOOK_BUCKET).list(folder, { search: file, limit: 10 })
  if (error) return null
  const hit = ((data ?? []) as Array<{ name: string; metadata?: { size?: number } | null }>).find((o) => o.name === file)
  if (!hit) return null
  return typeof hit.metadata?.size === 'number' ? hit.metadata.size : 0
}

async function lookByCode(admin: Admin, code: string): Promise<LookRow | null> {
  const { data, error } = await admin.from('first_looks').select(LOOK_COLUMNS).eq('code_hash', await sha256Hex(code)).maybeSingle()
  if (error) throw new Error(error.message)
  return (data as LookRow | null) ?? null
}

/** A look the page may use, or the answer that says why not. */
async function openLook(admin: Admin, req: Request, rawCode: unknown): Promise<{ look: LookRow } | { answer: Response }> {
  const code = firstLookCode(typeof rawCode === 'string' ? rawCode : null)
  if (!code) return { answer: json({ error: 'bad_code' }, 400) }
  // The sample page (What customers see) asks for an upload address like any page: it is told in words that nothing is sent.
  if (firstLookSampleOf(code)) return { answer: json({ error: FIRST_LOOK_SAMPLE_WORDS, code: 'sample' }, 422) }
  const look = await lookByCode(admin, code)
  if (!look) {
    console.log(JSON.stringify({ event: 'first_look_open', state: 'not_found' }))
    const miss = await recordEstimateLinkMiss(admin, req, 'first-look')
    if (miss.locked) return { answer: json({ error: ESTIMATE_LINK_LOCKED_WORDS, code: ESTIMATE_LINK_LOCKED_CODE }, 429) }
    return { answer: json({ error: 'not_found' }, 404) }
  }
  const state = firstLookState(look, new Date().toISOString())
  if (state !== 'open') return { answer: json({ error: state, phone: await officePhone(admin) }, 410) }
  return { look }
}

// ---------------------------------------------------------------------------------------------------------------------
// The desk.

async function deskCaller(req: Request, supabaseUrl: string): Promise<{ userId: string; name: string } | null> {
  const auth = req.headers.get('Authorization') ?? ''
  if (!auth) return null
  const mine = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } })
  const { data: u } = await mine.auth.getUser()
  const userId = u?.user?.id
  if (!userId) return null
  const { data: ok } = await mine.rpc('is_master_or_dev')
  if (ok !== true) return null
  const { data: me } = await mine.from('users').select('name').eq('id', userId).maybeSingle()
  return { userId, name: ((me as { name: string | null } | null)?.name ?? '').trim() }
}

async function deskList(admin: Admin): Promise<FirstLookDeskRow[]> {
  const { data: looksRaw, error } = await admin.from('first_looks').select(LOOK_COLUMNS).order('made_at', { ascending: false }).limit(50)
  if (error) throw new Error(error.message)
  const looks = (looksRaw ?? []) as LookRow[]
  if (looks.length === 0) return []
  const ids = looks.map((l) => l.id)
  const { data: filesRaw, error: fErr } = await admin.from('first_look_files').select(FILE_COLUMNS).in('look_id', ids).is('removed_at', null).order('signed_at', { ascending: true })
  if (fErr) throw new Error(fErr.message)
  const files = (filesRaw ?? []) as FileRow[]
  const contactIds = [...new Set(looks.map((l) => l.contact_id).filter((id): id is string => !!id))]
  const names = new Map<string, string>()
  if (contactIds.length > 0) {
    const { data: cs } = await admin.from('contacts').select('id, name, goes_by').in('id', contactIds)
    for (const c of (cs ?? []) as Array<{ id: string; name: string | null; goes_by: string | null }>) names.set(c.id, (c.goes_by ?? '').trim() || (c.name ?? '').trim())
  }
  const finished = files.filter((f) => f.finished_at)
  const urls = new Map<string, string>()
  if (finished.length > 0) {
    const { data: signed } = await admin.storage.from(FIRST_LOOK_BUCKET).createSignedUrls(finished.map((f) => f.storage_path), 3600)
    for (const s of (signed ?? []) as Array<{ path: string | null; signedUrl: string | null }>) if (s.path && s.signedUrl) urls.set(s.path, s.signedUrl)
  }
  const now = new Date().toISOString()
  return looks.map((l) => ({
    id: l.id,
    label: l.label,
    contactId: l.contact_id,
    contactName: l.contact_id ? names.get(l.contact_id) ?? null : null,
    askedBy: l.asked_by_name,
    madeAt: l.made_at,
    expiresAt: l.expires_at,
    openedAt: l.opened_at,
    sentAt: l.sent_at,
    closedAt: l.closed_at,
    state: firstLookState(l, now),
    place: l.place,
    words: l.words,
    files: files
      .filter((f) => f.look_id === l.id)
      .map(
        (f): FirstLookDeskFile => ({
          id: f.id,
          kind: f.kind,
          mime: f.mime,
          name: f.name,
          bytes: f.bytes,
          seconds: f.seconds,
          road: f.road,
          resumed: f.resumed,
          took_ms: f.took_ms,
          client: f.client,
          finished_at: f.finished_at,
          url: urls.get(f.storage_path) ?? null,
        }),
      ),
  }))
}

async function desk(req: Request, admin: Admin, supabaseUrl: string, body: Record<string, unknown>): Promise<Response> {
  const caller = await deskCaller(req, supabaseUrl)
  if (!caller) return json({ error: 'First looks are for the owner and the developers while this is being tried.' }, 403)
  // A teammate who left is refused here too: the database's own seal sees no caller once this switches to the service role.
  const archived = await refuseArchivedCaller(admin, caller.userId, corsHeaders)
  if (archived) return archived
  const action = String(body.action)
  const lookId = typeof body.lookId === 'string' && UUID_RE.test(body.lookId) ? body.lookId : null

  if (action === 'desk.list') return json({ ok: true, looks: await deskList(admin) })

  if (action === 'desk.mint') {
    const contactId = typeof body.contactId === 'string' && UUID_RE.test(body.contactId) ? body.contactId : null
    if (contactId) {
      const { data: c } = await admin.from('contacts').select('id').eq('id', contactId).maybeSingle()
      if (!c) return json({ error: 'That person is not in Messages.' }, 404)
    }
    const label = (typeof body.label === 'string' ? body.label : '').trim().slice(0, 120)
    const now = new Date().toISOString()
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = mintFirstLookCode((n) => crypto.getRandomValues(new Uint8Array(n)))
      const { data, error } = await admin
        .from('first_looks')
        .insert({ contact_id: contactId, label, asked_by: caller.userId, asked_by_name: firstNameOf(caller.name), code_hash: await sha256Hex(code), expires_at: firstLookExpiry(now) })
        .select('id')
        .maybeSingle()
      if (!error && data) {
        console.log(JSON.stringify({ event: 'first_look_mint', look: (data as { id: string }).id, contact: Boolean(contactId) }))
        return json({ ok: true, code, lookId: (data as { id: string }).id })
      }
      if (error && error.code !== '23505') throw new Error(error.message)
    }
    throw new Error('first look: no free code after five tries')
  }

  if (!lookId) return json({ error: 'bad_look' }, 400)

  if (action === 'desk.close') {
    const { error } = await admin.from('first_looks').update({ closed_at: new Date().toISOString(), closed_by: caller.userId }).eq('id', lookId).is('closed_at', null)
    if (error) throw new Error(error.message)
    return json({ ok: true })
  }

  if (action === 'desk.looked') {
    const { error } = await admin.from('first_looks').update({ looked_at: new Date().toISOString(), looked_by: caller.userId }).eq('id', lookId).is('looked_at', null)
    if (error) throw new Error(error.message)
    return json({ ok: true })
  }

  if (action === 'desk.remove') {
    const { data: filesRaw } = await admin.from('first_look_files').select('storage_path').eq('look_id', lookId)
    const paths = ((filesRaw ?? []) as Array<{ storage_path: string }>).map((f) => f.storage_path)
    if (paths.length > 0) {
      const { error: rmErr } = await admin.storage.from(FIRST_LOOK_BUCKET).remove(paths)
      if (rmErr) console.warn('first-look: a file did not delete', rmErr.message)
    }
    const { error } = await admin.from('first_looks').delete().eq('id', lookId)
    if (error) throw new Error(error.message)
    console.log(JSON.stringify({ event: 'first_look_remove', look: lookId, files: paths.length }))
    return json({ ok: true })
  }

  return json({ error: 'bad_action' }, 400)
}

// ---------------------------------------------------------------------------------------------------------------------

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'GET' && req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  try {
    const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0]?.trim() || req.headers.get('cf-connecting-ip') || 'unknown'
    if (rateLimited(ip, Date.now())) return json({ error: 'Too many requests. Try again in a minute.' }, 429)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })

    // The page opens: who asked, what the link holds and may take, the office's number and hours.
    if (req.method === 'GET') {
      const url = new URL(req.url)
      // Settings → What customers see: the sample page, with the office's own phone and hours and nothing of a look.
      const sample = firstLookSampleOf(url.searchParams.get('code'))
      if (sample) {
        const [phone, office] = await Promise.all([officePhone(admin), officeNow(admin, new Date().toISOString())])
        return json(firstLookSamplePayload(sample, { phone, ...office }))
      }
      const found = await openLook(admin, req, url.searchParams.get('code'))
      if ('answer' in found) return found.answer
      const { look } = found
      const nowIso = new Date().toISOString()
      const [counts, phone, office] = await Promise.all([countsOf(admin, look.id), officePhone(admin), officeNow(admin, nowIso)])
      if (!look.opened_at && url.searchParams.get('preview') !== '1') {
        void admin.from('first_looks').update({ opened_at: nowIso }).eq('id', look.id).is('opened_at', null).then(() => {}, () => {})
      }
      console.log(JSON.stringify({ event: 'first_look_open', state: 'open', look: look.id, photos: counts.photos, videos: counts.videos }))
      return json({
        ok: true,
        look: { askedBy: look.asked_by_name, photos: counts.photos, videos: counts.videos, sentCount: look.sent_count },
        caps: { photos: FIRST_LOOK_CAPS.photos, videos: FIRST_LOOK_CAPS.videos, photoBytes: FIRST_LOOK_CAPS.photoBytes, videoBytes: FIRST_LOOK_CAPS.videoBytes },
        office: { phone, ...office },
      })
    }

    const raw: unknown = await req.json().catch(() => null)
    const body = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>
    const action = typeof body.action === 'string' ? body.action : ''
    if (action.startsWith('desk.')) return await desk(req, admin, supabaseUrl, body)

    const found = await openLook(admin, req, body.code)
    if ('answer' in found) return found.answer
    const { look } = found

    // One upload address, after the caps. The bytes go from the phone to the bucket.
    if (action === 'sign') {
      const again = typeof body.fileId === 'string' && UUID_RE.test(body.fileId) ? body.fileId : null
      if (again) {
        const { data: fRaw } = await admin.from('first_look_files').select(FILE_COLUMNS).eq('id', again).eq('look_id', look.id).maybeSingle()
        const f = fRaw as FileRow | null
        if (!f || f.removed_at) return json({ error: 'not_found' }, 404)
        if (f.finished_at) return json({ error: 'That file is already in.', code: 'finished' }, 409)
        const { data: signed, error: sErr } = await admin.storage.from(FIRST_LOOK_BUCKET).createSignedUploadUrl(f.storage_path, { upsert: true })
        if (sErr || !signed) throw new Error(sErr?.message ?? 'no upload address')
        return json({ ok: true, fileId: f.id, bucket: FIRST_LOOK_BUCKET, path: f.storage_path, token: signed.token, signedUrl: signed.signedUrl })
      }
      const mime = typeof body.mime === 'string' ? body.mime.trim().toLowerCase().split(';')[0] ?? '' : ''
      const bytes = typeof body.bytes === 'number' ? Math.floor(body.bytes) : 0
      const refusal = firstLookSignRefusal({ mime, bytes }, await countsOf(admin, look.id))
      if (refusal) return json({ error: refusal.words, code: refusal.code }, 422)
      const kind = firstLookKindOfMime(mime)!
      const fileId = crypto.randomUUID()
      const path = firstLookObjectPath(look.id, fileId, mime)
      const name = (typeof body.name === 'string' ? body.name : '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, 200)
      const { error: insErr } = await admin.from('first_look_files').insert({ id: fileId, look_id: look.id, kind, mime, name, storage_path: path, declared_bytes: bytes, client: firstLookClientWords(req.headers.get('user-agent')) })
      if (insErr) throw new Error(insErr.message)
      const { data: signed, error: sErr } = await admin.storage.from(FIRST_LOOK_BUCKET).createSignedUploadUrl(path, { upsert: true })
      if (sErr || !signed) throw new Error(sErr?.message ?? 'no upload address')
      return json({ ok: true, fileId, bucket: FIRST_LOOK_BUCKET, path, token: signed.token, signedUrl: signed.signedUrl })
    }

    // The file is in: its size as the bucket has it, and its first bytes a picture or a video.
    if (action === 'done') {
      const fileId = typeof body.fileId === 'string' && UUID_RE.test(body.fileId) ? body.fileId : null
      if (!fileId) return json({ error: 'bad_file' }, 400)
      const { data: fRaw } = await admin.from('first_look_files').select(FILE_COLUMNS).eq('id', fileId).eq('look_id', look.id).maybeSingle()
      const f = fRaw as FileRow | null
      if (!f || f.removed_at) return json({ error: 'not_found' }, 404)
      if (!f.finished_at) {
        const size = await objectBytes(admin, f.storage_path)
        if (size == null) return json({ error: 'The file has not arrived yet.', code: 'not_there' }, 409)
        const head = await firstBytes(admin, f.storage_path)
        const sniffed = head ? firstLookSniff(head) : null
        if (sniffed !== f.kind) {
          await admin.storage.from(FIRST_LOOK_BUCKET).remove([f.storage_path])
          await admin.from('first_look_files').update({ removed_at: new Date().toISOString() }).eq('id', f.id)
          console.log(JSON.stringify({ event: 'first_look_refused', look: look.id, file: f.id, declared: f.kind, sniffed }))
          return json({ error: 'That file is not a photo or a video we can open. It was not kept.', code: 'kind' }, 422)
        }
        const road = body.road === 'pieces' || body.road === 'whole' ? body.road : null
        const whole = (v: unknown, max: number): number | null => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.min(Math.floor(v), max) : null)
        const seconds = typeof body.seconds === 'number' && Number.isFinite(body.seconds) && body.seconds >= 0 ? Math.min(body.seconds, 36_000) : null
        // The checked file moves out from under its upload address, which is good for two hours and may write its
        // place again. A move that fails keeps the file where it is: a customer's photo is never lost to this.
        const keptPath = firstLookKeptPath(look.id, f.id, f.mime)
        const { error: moveErr } = await admin.storage.from(FIRST_LOOK_BUCKET).move(f.storage_path, keptPath)
        if (moveErr) console.error('first-look: the file did not move to its kept place', JSON.stringify({ file: f.id, why: moveErr.message }))
        const { error: upErr } = await admin
          .from('first_look_files')
          .update({ finished_at: new Date().toISOString(), bytes: size, road, resumed: whole(body.resumed, 10_000) ?? 0, took_ms: whole(body.tookMs, 2_000_000_000), seconds, ...(moveErr ? {} : { storage_path: keptPath }) })
          .eq('id', f.id)
        if (upErr) throw new Error(upErr.message)
        console.log(JSON.stringify({ event: 'first_look_file', look: look.id, kind: f.kind, bytes: size, road, resumed: whole(body.resumed, 10_000) ?? 0 }))
      }
      const counts = await countsOf(admin, look.id)
      return json({ ok: true, photos: counts.photos, videos: counts.videos })
    }

    // Sent: the stamp, their two fields, the thread's line when the look is a person's.
    if (action === 'send') {
      const counts = await countsOf(admin, look.id)
      if (counts.photos + counts.videos === 0) return json({ error: 'Add a photo or a video first.', code: 'empty' }, 422)
      const nowIso = new Date().toISOString()
      const place = (typeof body.place === 'string' ? body.place : '').trim().slice(0, 60) || null
      const words = (typeof body.words === 'string' ? body.words : '').trim().slice(0, 1000) || null
      const sentCount = look.sent_count + 1
      const { error: upErr } = await admin.from('first_looks').update({ sent_at: nowIso, sent_count: sentCount, place: place ?? look.place, words: words ?? look.words }).eq('id', look.id)
      if (upErr) throw new Error(upErr.message)
      if (look.contact_id) {
        const line = firstLookSentLine({ lookId: look.id, sentCount, photos: counts.photos, videos: counts.videos })
        const { error: lineErr } = await admin
          .from('messages')
          // Their own line, as a word from their portal page is (`gcPortalThread.ts`): it is the customer's move, so the
          // thread goes to Needs a reply, the header's badge counts it and the reply push's sweep reaches whoever has it.
          .upsert({ contact_id: look.contact_id, channel: 'portal', direction: 'in', body: words ? `${line.body} They wrote: ${words}` : line.body, quo_id: line.key }, { onConflict: 'quo_id', ignoreDuplicates: true })
        if (lineErr) console.error('first-look: the thread line did not write', JSON.stringify(lineErr))
      }
      const office = await officeNow(admin, nowIso)
      console.log(JSON.stringify({ event: 'first_look_send', look: look.id, photos: counts.photos, videos: counts.videos, contact: Boolean(look.contact_id) }))
      return json({ ok: true, thanks: firstLookThanks({ askedBy: look.asked_by_name, photos: counts.photos, videos: counts.videos, officeOpen: office.open, closesWords: office.closesWords, opensWords: office.opensWords }) })
    }

    return json({ error: 'bad_action' }, 400)
  } catch (e) {
    console.error('first-look failed', e)
    return json({ error: 'That did not go through. Try again, or call the office.' }, 500)
  }
})
