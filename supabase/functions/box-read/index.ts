import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { calendarYmdInAppTzFromIso } from '../_shared/appTimeZone.ts'
import { ESTIMATE_LINK_LOCKED_CODE, readEstimateLinkLock, recordEstimateLinkMiss, type EstimateMissReader } from '../_shared/estimateLinkMisses.ts'
import { publicViewDecision } from '../_shared/publicViewCounting.ts'
import { PORTAL_COMPANY } from '../_shared/portalCompany.ts'
import { BOXES_SETTINGS_KEY, boxSetting, parseBoxSettings } from '../_shared/gcKernels/lib/messages/boxes.ts'
import { BOX_PAGE_COMPANY_KEY, BOX_PAGE_LOCKED_WORDS, BOX_PAGE_SIGN_IN_ERROR, boxPageAsksInside, boxPageCode, boxPageCompanyEmail, boxPageCompanyPhone, boxPageEarlyAnswer, boxPageKind, boxPageOfficePhone, boxPagePlate, boxPageStickerAnswer, buildBoxPagePayload, type BoxPageContainerRow, type BoxPageStickerRow } from '../_shared/boxPage.ts'

/**
 * box-read (punch list #294, v2.6797): what a scanned cage or box label opens with no sign-in. The label's QR reads
 * `PRTS.CO/B/<eight hex>`; prts.co forwards it to the app's `/b/:code`, and signed out the page asks here.
 *
 *   GET ?code=<eight hex, a dash allowed>   → { ok, box: { code, stencil, kind, stickerNumber? }, office: { phone, email?, bidsEmail? } }
 *                                             the live container by its code: its name as the label prints it
 *                                             (`boxPagePlate`), its kind, and `office.phone`, the office's number
 *                                             (the company block's Phone from Settings since v2.7390).
 *   GET ?code=<code>&find=<words>            → 401 { error: 'sign_in' }
 *   GET ?code=<code>&photo=<photo id>        → 401 { error: 'sign_in' }
 *
 * **What is inside needs a sign-in (v2.7379, Taunya's call of 2026-11-15).** From v2.6797 the answer carried the place,
 * the newest photo, every line with its count, the lines that ran out, the Can't find marks and the day of the last
 * count; `?find=` searched every box of the same job (v2.6799) and `?photo=` streamed a photo's bytes from Drive. All of
 * it was a list of what is worth taking and where, open to a photo of the label from anywhere. None of it is read here
 * now: the function selects the container's name, kind and code and no more, and answers the two old doors with 401
 * before the database is touched, whatever the code, so the refusal says nothing about the code. Someone signed in
 * reads the box in the app under its own gate and never comes through here. Never the job, the customer, a price or a
 * person's name, as before.
 *
 * No auth (`verify_jwt = false`): the code is the capability, as the estimate and bill links are. Eight hex characters
 * is 32 bits against a few hundred live boxes; a code that opens nothing counts a miss against its source through the
 * estimate link's guard (`estimate_link_miss`), and past 20 misses in the hour the function answers 429 `locked` to
 * every code from that source — a hit too since v2.7240, and a sticker's blank or lost answer too since v2.7264, the
 * lock read before anything else (`readEstimateLinkLock`, `boxPageEarlyAnswer`: eight characters is short enough that
 * a lock which still answered anything held nothing). A retired box answers 410 `retired` with its name as the label
 * printed it, its kind and the office's number (v2.6874). Each read that opens lands one `public_page_views` row
 * (surface `box_page`); a staff session or `?preview=1` is stamped and not counted, as the portals do. Rate limit: 60
 * reads a minute per client address and 600 across the isolate, in memory, best effort.
 *
 * Since v2.7072 (punch list #329) the code may be a sticker's (`box_stickers.code`, cut from the sticker's own id by the
 * rule a box's code follows). The sticker is read first. One on a box answers that box, every branch above included,
 * with `box.stickerNumber` and the scanned code as `box.code`. A blank one answers 404 `{ error: 'sticker_blank',
 * number }` and nothing else, and counts no miss: it is a real code. A lost one answers 410 `{ error: 'sticker_lost',
 * number, lostOn }`. A sticker read that fails is logged and the code is read as a box's own, so a label printed before
 * stickers opens whatever happens to that read. A locked source is answered before the sticker is read.
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
 * The number the page shows and its presses text and call: the company's number, the Phone of Settings' company block,
 * whatever it is set to (v2.7390, Taunya's word of 2026-11-15). From v2.6910 to then it was the team box's line from
 * Settings → Phone and texts, which is still the next in line when the company block's Phone is blank, before that
 * box's fallback secret and the letterhead's constant. A read that fails falls back the same way.
 */
// deno-lint-ignore no-explicit-any
async function officePhone(admin: any): Promise<string> {
  return (await officeContact(admin)).phone
}

/**
 * The number, and since v2.7405 the two addresses the page's presses write to: the company's own email (the Email of
 * Settings' company block) and the bids box's address from Settings → Phone and texts, where a bid ask lands in the
 * app. The same one read answers all three. An address Settings does not hold is left out and its press is not drawn.
 */
// deno-lint-ignore no-explicit-any
async function officeContact(admin: any): Promise<{ phone: string; email: string; bidsEmail: string }> {
  let company = ''
  let team = ''
  let email = ''
  let bidsEmail = ''
  try {
    const { data } = await admin.from('app_settings').select('key, value_text').in('key', [BOX_PAGE_COMPANY_KEY, BOXES_SETTINGS_KEY])
    const rows = (data ?? []) as Array<{ key: string; value_text: string | null }>
    const block = rows.find((r) => r.key === BOX_PAGE_COMPANY_KEY)?.value_text
    const boxes = parseBoxSettings(rows.find((r) => r.key === BOXES_SETTINGS_KEY)?.value_text)
    company = boxPageCompanyPhone(block)
    email = boxPageCompanyEmail(block)
    team = boxSetting('team', boxes).phone
    bidsEmail = boxSetting('bids', boxes).address
  } catch (e) {
    console.warn('box-read: the settings did not read', e)
  }
  return { phone: boxPageOfficePhone([company, team, Deno.env.get('QUO_COMPANY_PHONE'), PORTAL_COMPANY.phone]), email, bidsEmail }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'GET') return json({ error: 'Method not allowed' }, 405)
  try {
    const url = new URL(req.url)
    const code = boxPageCode(url.searchParams.get('code'))
    if (!code) return json({ error: 'bad_code' }, 400)

    const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0]?.trim() || req.headers.get('cf-connecting-ip') || 'unknown'
    if (rateLimited(ip, Date.now())) return json({ error: 'Too many requests. Try again in a minute.' }, 429)

    // What is inside needs a sign-in (v2.7379): the search and the photo are refused before anything is read, whatever
    // the code is, so the refusal tells a guesser nothing about the code.
    if (boxPageAsksInside({ find: url.searchParams.get('find'), photo: url.searchParams.get('photo') })) {
      console.log(JSON.stringify({ event: 'box_page_open', code, state: 'sign_in' }))
      return json({ error: BOX_PAGE_SIGN_IN_ERROR }, 401)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })

    // The guess lock first (v2.7264): a source past the limit this hour is refused before anything is read — a hit as
    // v2.7240 refused it, a miss, and a sticker's blank or lost answer too, which until then told a locked source
    // which sticker numbers exist. The code is eight characters, so a lock that still answered anything held nothing.
    // Someone signed in never comes through here.
    const lock = await readEstimateLinkLock(admin as unknown as EstimateMissReader, req, 'box-read')

    // Then a sticker's code (v2.7072). A read that fails is not the label's fault: log it and read the code as a box's own.
    let stickerRow: BoxPageStickerRow | null = null
    if (!lock.locked) {
      const { data: sRaw, error: sErr } = await admin.from('box_stickers').select('id, number, code, container_id, lost_at').eq('code', code).maybeSingle()
      if (sErr) console.warn('box-read: the sticker did not read', sErr.message)
      else stickerRow = sRaw as BoxPageStickerRow | null
    }
    const sticker = boxPageStickerAnswer(stickerRow, stickerRow?.lost_at ? calendarYmdInAppTzFromIso(stickerRow.lost_at) : null)
    const early = boxPageEarlyAnswer(lock.locked, sticker)
    if (early) {
      console.log(JSON.stringify({ event: 'box_page_open', code, state: early.state }))
      return json(early.body, early.status)
    }

    const boxQuery = admin.from('job_containers').select('id, label, kind, retired_at, code')
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
    if (row.retired_at) {
      console.log(JSON.stringify({ event: 'box_page_open', code, state: 'retired' }))
      return json({ error: 'retired', retiredOn: calendarYmdInAppTzFromIso(row.retired_at), stencil: boxPagePlate(row.label), kind: boxPageKind(row.kind), phone: await officePhone(admin) }, 410)
    }

    // The name the label prints, the kind, the office's number and its two addresses. Nothing the box holds is read (v2.7379).
    const office = await officeContact(admin)
    const payload = buildBoxPagePayload({
      container: row,
      officePhone: office.phone,
      officeEmail: office.email,
      bidsEmail: office.bidsEmail,
      scannedCode: sticker.kind === 'box' ? code : null,
      stickerNumber: sticker.kind === 'box' ? sticker.number : null,
    })

    // Who looked: the outside counts; a signed-in teammate or a preview is stamped, never counted.
    const decision = await publicViewDecision(req, admin, Deno.env.get('SUPABASE_ANON_KEY'))
    void admin
      .from('public_page_views')
      .insert({ surface: 'box_page', entity_id: row.id, via: 'token', viewer: decision.viewer, viewer_user_id: decision.staffUserId })
      .then(() => {}, () => {})
    console.log(JSON.stringify({ event: 'box_page_open', code, state: 'open', sticker: sticker.kind === 'box', viewer: decision.viewer }))
    return json(payload)
  } catch (e) {
    console.error('box-read failed', e)
    return json({ error: 'The box did not open. Try again, or ask the office.' }, 500)
  }
})
