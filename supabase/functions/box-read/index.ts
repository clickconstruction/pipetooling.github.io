import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { calendarYmdInAppTzFromIso } from '../_shared/appTimeZone.ts'
import { googleAccessToken } from '../_shared/driveUpload.ts'
import { driveMedia } from '../_shared/driveJobFolder.ts'
import { ESTIMATE_LINK_LOCKED_CODE, readEstimateLinkLock, recordEstimateLinkMiss, type EstimateMissReader } from '../_shared/estimateLinkMisses.ts'
import { publicViewDecision } from '../_shared/publicViewCounting.ts'
import { PORTAL_COMPANY } from '../_shared/portalCompany.ts'
import { BOXES_SETTINGS_KEY, boxSetting, parseBoxSettings } from '../_shared/gcKernels/lib/messages/boxes.ts'
import { BOX_PAGE_LOCKED_WORDS, boxPageCode, boxPageFind, boxPageFindWords, boxPageKind, boxPageOfficePhone, boxPagePhotoUrl, boxPageStickerAnswer, buildBoxPagePayload, type BoxPageContainerRow, type BoxPagePhoto, type BoxPageServerLine, type BoxPageStickerRow } from '../_shared/boxPage.ts'

/**
 * box-read (punch list #294, v2.6797): what a scanned cage or box label opens with no sign-in. The label's QR reads
 * `PRTS.CO/B/<eight hex>`; prts.co forwards it to the app's `/b/:code`, and signed out the page asks here.
 *
 *   GET ?code=<eight hex, a dash allowed>   → { ok, box: { code, stencil, kind, place, where, lines, gone, lastCountedOn, photo, stickerNumber? }, office }
 *                                             the live container by its code, its lines from `on_site_job_summary` (the
 *                                             database's own arithmetic, v2.6743) cut to the container, the newest photo.
 *                                             Since v2.6874 a line carries its Can't find presses since its count, `gone` is
 *                                             the lines emptied since the box's last count, and `office.phone` is the
 *                                             office's number: the team box's line from Settings since v2.6910, the
 *                                             letterhead's before. Never the job, the customer, a price or a person's name.
 *   GET ?code=<code>&find=<words>            → (v2.6799, PR 3) the live boxes of the same job whose stencil, place or lines
 *                                             hold every word, each with the lines that matched: the search a scanned code
 *                                             opens, that site and no other. No code, no search.
 *   GET ?code=<code>&photo=<photo id>        → the photo's bytes: streamed from Drive by `drive_file_id` through the service
 *                                             account once the sweep has filed it, else from the box-photos bucket while it
 *                                             waits, with an hour's cache. No Drive link ever reaches the page.
 *
 * No auth (`verify_jwt = false`): the code is the capability, as the estimate and bill links are. Eight hex characters
 * is 32 bits against a few hundred live boxes, and the page carries nothing worth a guess; a code that opens nothing
 * counts a miss against its source through the estimate link's guard (`estimate_link_miss`), and past 20 misses in the
 * hour the function answers 429 `locked`, to a code that opens a box as well since v2.7240 (`readEstimateLinkLock`:
 * eight characters is short enough that a lock which still answered a right guess held nothing). A retired box answers 410 `retired` with no lines, and since v2.6874 its stencil,
 * kind and the office's number, which the label in the hand already prints or the letterhead already carries. Each read that opens lands
 * one `public_page_views` row (surface `box_page`); a staff session or `?preview=1` is stamped and not counted, as the
 * portals do. Rate limit: 60 reads a minute per client address and 600 across the isolate, in memory, best effort.
 *
 * Since v2.7072 (punch list #329) the code may be a sticker's (`box_stickers.code`, cut from the sticker's own id by the
 * rule a box's code follows). The sticker is read first. One on a box answers that box, every branch above included,
 * with `box.stickerNumber` and the scanned code as `box.code`. A blank one answers 404 `{ error: 'sticker_blank',
 * number }` and nothing else, and counts no miss: it is a real code. A lost one answers 410 `{ error: 'sticker_lost',
 * number, lostOn }`. A sticker read that fails is logged and the code is read as a box's own, so a label printed before
 * stickers opens whatever happens to that read.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
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

/**
 * The number the page's Text the office and Call the office use (v2.6910): the team box's line from Settings → Phone and
 * texts, which the Messages page reads, so a text about a cage lands in front of the office. The letterhead's number was
 * used until then; its texts go to a mailbox nobody reads in the app. A read that fails falls back to the letterhead.
 */
// deno-lint-ignore no-explicit-any
async function officePhone(admin: any): Promise<string> {
  let team = ''
  try {
    const { data } = await admin.from('app_settings').select('value_text').eq('key', BOXES_SETTINGS_KEY).maybeSingle()
    team = boxSetting('team', parseBoxSettings((data as { value_text: string | null } | null)?.value_text)).phone
  } catch (e) {
    console.warn('box-read: the boxes did not read', e)
  }
  return boxPageOfficePhone([team, Deno.env.get('QUO_COMPANY_PHONE'), PORTAL_COMPANY.phone])
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type PhotoRow = { id: string; container_id: string; taken_at: string; status: string; storage_path: string | null; drive_file_id: string | null }

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'GET') return json({ error: 'Method not allowed' }, 405)
  try {
    const url = new URL(req.url)
    const code = boxPageCode(url.searchParams.get('code'))
    if (!code) return json({ error: 'bad_code' }, 400)

    const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0]?.trim() || req.headers.get('cf-connecting-ip') || 'unknown'
    if (rateLimited(ip, Date.now())) return json({ error: 'Too many requests. Try again in a minute.' }, 429)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })

    // A sticker's code first (v2.7072). A read that fails is not the label's fault: log it and read the code as a box's own.
    let stickerRow: BoxPageStickerRow | null = null
    {
      const { data: sRaw, error: sErr } = await admin.from('box_stickers').select('id, number, code, container_id, lost_at').eq('code', code).maybeSingle()
      if (sErr) console.warn('box-read: the sticker did not read', sErr.message)
      else stickerRow = sRaw as BoxPageStickerRow | null
    }
    const sticker = boxPageStickerAnswer(stickerRow, stickerRow?.lost_at ? calendarYmdInAppTzFromIso(stickerRow.lost_at) : null)
    if (sticker.kind === 'blank' || sticker.kind === 'lost') {
      console.log(JSON.stringify({ event: 'box_page_open', code, state: sticker.body.error }))
      return json(sticker.body, sticker.status)
    }

    const boxQuery = admin.from('job_containers').select('id, job_id, label, kind, where_note, place_id, retired_at, code')
    const { data: rowRaw, error: rowErr } = await (sticker.kind === 'box' ? boxQuery.eq('id', sticker.containerId) : boxQuery.eq('code', code)).maybeSingle()
    if (rowErr) throw new Error(rowErr.message)
    const row = rowRaw as BoxPageContainerRow | null
    if (!row && sticker.kind === 'box') {
      // Its box went between the two reads: the foreign key has made the sticker blank.
      console.log(JSON.stringify({ event: 'box_page_open', code, state: 'sticker_blank' }))
      return json({ error: 'sticker_blank', number: sticker.number }, 404)
    }
    if (!row) {
      console.log(JSON.stringify({ event: 'box_page_open', code, state: 'not_found' }))
      const miss = await recordEstimateLinkMiss(admin, req, 'box-read')
      if (miss.locked) return json({ error: BOX_PAGE_LOCKED_WORDS, code: ESTIMATE_LINK_LOCKED_CODE }, 429)
      return json({ error: 'not_found' }, 404)
    }
    // A source past the limit this hour is refused a right guess as well as a wrong one (v2.7240): the code is eight
    // characters, so a lock that still answered a hit held nothing. Someone signed in never comes through here.
    const lock = await readEstimateLinkLock(admin as unknown as EstimateMissReader, req, 'box-read')
    if (lock.locked) {
      console.log(JSON.stringify({ event: 'box_page_open', code, state: 'locked' }))
      return json({ error: BOX_PAGE_LOCKED_WORDS, code: ESTIMATE_LINK_LOCKED_CODE }, 429)
    }
    if (row.retired_at) {
      console.log(JSON.stringify({ event: 'box_page_open', code, state: 'retired' }))
      return json({ error: 'retired', retiredOn: calendarYmdInAppTzFromIso(row.retired_at), stencil: row.label, kind: boxPageKind(row.kind), phone: await officePhone(admin) }, 410)
    }

    // The photo's bytes, for the page's <img>: Drive once filed, the bucket while it waits.
    const photoId = url.searchParams.get('photo')
    if (photoId) {
      if (!UUID_RE.test(photoId)) return json({ error: 'bad_photo' }, 400)
      const { data: pRaw, error: pErr } = await admin
        .from('job_box_photos')
        .select('id, container_id, taken_at, status, storage_path, drive_file_id')
        .eq('id', photoId)
        .eq('container_id', row.id)
        .maybeSingle()
      if (pErr) throw new Error(pErr.message)
      const p = pRaw as PhotoRow | null
      if (!p) return json({ error: 'not_found' }, 404)
      const imgHeaders = { ...corsHeaders, 'Cache-Control': 'public, max-age=3600', 'Content-Type': 'image/jpeg', 'X-Content-Type-Options': 'nosniff' }
      if (p.drive_file_id) {
        const saJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON')
        if (saJson) {
          const google = await googleAccessToken(saJson)
          const file = await driveMedia(google, p.drive_file_id)
          if (file.ok && file.body) {
            const type = file.headers.get('Content-Type') ?? 'image/jpeg'
            return new Response(file.body, { status: 200, headers: { ...imgHeaders, 'Content-Type': type.startsWith('image/') ? type : 'image/jpeg' } })
          }
          console.warn('box-read: Drive did not answer the photo', p.id, file.status)
        }
      }
      if (p.storage_path) {
        const { data: blob, error: dl } = await admin.storage.from('box-photos').download(p.storage_path)
        if (!dl && blob) return new Response(blob, { status: 200, headers: imgHeaders })
      }
      return json({ error: 'not_found' }, 404)
    }

    // Find a part on this site (PR 3): the same job's live boxes, the words typed, nothing of another job.
    const findRaw = url.searchParams.get('find')
    if (findRaw != null) {
      const words = boxPageFindWords(findRaw)
      const [boxesRes, placesRes, sumRes] = await Promise.all([
        admin.from('job_containers').select('id, job_id, label, kind, where_note, place_id, retired_at, code').eq('job_id', row.job_id).is('retired_at', null),
        admin.from('job_places').select('id, name').eq('job_id', row.job_id),
        admin.rpc('on_site_job_summary', { p_job_id: row.job_id }),
      ])
      if (boxesRes.error) throw new Error(boxesRes.error.message)
      if (sumRes.error) throw new Error(sumRes.error.message)
      const sum = (sumRes.data ?? {}) as { lines?: BoxPageServerLine[] }
      const find = boxPageFind({ thisCode: row.code, words, containers: (boxesRes.data ?? []) as BoxPageContainerRow[], places: (placesRes.data ?? []) as Array<{ id: string; name: string }>, lines: sum.lines ?? [] })
      console.log(JSON.stringify({ event: 'box_page_find', code, words: words.length, boxes: find.total }))
      return json({ ok: true, find })
    }

    const [phone, placeRes, summaryRes, photoRes] = await Promise.all([
      officePhone(admin),
      row.place_id ? admin.from('job_places').select('name').eq('id', row.place_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
      admin.rpc('on_site_job_summary', { p_job_id: row.job_id }),
      admin
        .from('job_box_photos')
        .select('id, container_id, taken_at, status, storage_path, drive_file_id')
        .eq('container_id', row.id)
        .in('status', ['sending', 'filed'])
        .order('taken_at', { ascending: false })
        .limit(5),
    ])
    if (summaryRes.error) throw new Error(summaryRes.error.message)
    const summary = (summaryRes.data ?? {}) as { lines?: BoxPageServerLine[]; last_counts?: Array<{ container_id: string; at: string }> }
    const place = ((placeRes.data as { name?: string | null } | null)?.name ?? '').trim()
    const lastCount = (summary.last_counts ?? []).find((c) => c.container_id === row.id)
    const photos = ((photoRes.data ?? []) as PhotoRow[]).filter((p) => p.drive_file_id || p.storage_path)
    const newest = photos[0]
    const photo: BoxPagePhoto | null = newest ? { id: newest.id, takenOn: calendarYmdInAppTzFromIso(newest.taken_at), url: boxPagePhotoUrl(supabaseUrl, code, newest.id) } : null

    const payload = buildBoxPagePayload({
      container: row,
      place,
      lines: summary.lines ?? [],
      lastCountedOn: lastCount ? calendarYmdInAppTzFromIso(lastCount.at) : null,
      photo,
      lastCountAt: lastCount?.at ?? null,
      now: new Date().toISOString(),
      officePhone: phone,
      scannedCode: sticker.kind === 'box' ? code : null,
      stickerNumber: sticker.kind === 'box' ? sticker.number : null,
    })

    // Who looked: the outside counts; a signed-in teammate or a preview is stamped, never counted.
    const decision = await publicViewDecision(req, admin, Deno.env.get('SUPABASE_ANON_KEY'))
    void admin
      .from('public_page_views')
      .insert({ surface: 'box_page', entity_id: row.id, via: 'token', viewer: decision.viewer, viewer_user_id: decision.staffUserId })
      .then(() => {}, () => {})
    console.log(JSON.stringify({ event: 'box_page_open', code, state: 'open', sticker: sticker.kind === 'box', lines: payload.box.lines.length, gone: payload.box.gone.length, photo: Boolean(photo), viewer: decision.viewer }))
    return json(payload)
  } catch (e) {
    console.error('box-read failed', e)
    return json({ error: 'The box did not open. Try again, or ask the office.' }, 500)
  }
})
