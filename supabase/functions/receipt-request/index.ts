import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { toE164 } from '../_shared/gcKernels/lib/quo/events.ts'
import { lastOurTextAt, loadBoxes, loadSettingText, placeNumber, quoCompany, sendText, textsSwitchOn } from '../_shared/quoLines.ts'
import { receiptHexOf } from '../_shared/receiptLink.ts'
import { runReceiptAgain, runReceiptSweep, type ReceiptSweepDoors } from '../_shared/receiptSweep.ts'
import { receiptAgainRefusalWords } from '../_shared/receiptText.ts'
import { refuseArchivedCaller } from '../_shared/refuseArchivedCaller.ts'

/**
 * receipt-request (punch list #299, PR 2, v2.7142): the sweep that texts a card's holder a receipt link when a charge
 * posts. The cron calls it every five minutes while the switch is on (`app_settings` `receipt_texts_v1`, Settings →
 * Phone and texts, off as it ships) and something waits. It is the only thing that sends these texts: the sweep's two,
 * and the office's Text again (v2.8697).
 *
 *   POST (X-Cron-Secret) → { ok, state, made, texted, reminded, held, closed }
 *     1. A request whose charge the bank failed or took back is closed, and never texts.
 *     2. Every card purchase that has posted since the switch went on, at most 48 hours back, with no request and no
 *        ticket gets its request (`receipt_request_ensure`).
 *     3. Each request that waits is texted or says why not: the card tied to no one, the holder gone, no cell that
 *        reads as ten digits, a STOP. A holder's charges that wait together and post inside one hour share one text
 *        and one link. The text goes through `sendText` to the holder's own contact (`quo_place_number` puts a
 *        roster number on its team contact), purpose `nudge`, so Send texts gates it, the carriers' opt-out line rides
 *        the first one, and it lands on Messages as any text.
 *     4. One reminder, between six and nine the evening at least twelve hours after the text, for a charge still
 *        without a receipt. A charge that got its ticket from Tally meanwhile is marked answered instead.
 *   POST { dry: true } (X-Cron-Secret) → { ok, state: 'dry', posted, asked, withTicket, wouldAsk } counts over the last
 *     48 hours as if the switch were on. It writes nothing and sends nothing.
 *   POST { again: <request id> } (the office's JWT, no secret) → { ok: true, state: 'sent', segments, againCount }, or
 *     { ok: false, why, words } when no text went. **Text again** on the office's Needs you row: one more text, with a
 *     new link, to a holder who was texted and reminded and sent no receipt (`runReceiptAgain`). The caller must be
 *     the office (`is_office_staff`), not archived and not a training account. Both switches hold it as they hold the
 *     sweep, and so does a trial. At most two a charge, twelve hours apart, claimed by the request's count before the
 *     text goes, so two presses at once send one text.
 *
 * A request is claimed (its `texted_at` or `reminded_at` stamped) before its text is sent, so two sweeps that overlap
 * never text one charge twice; a text Quo then turns away gives the claim back. Texts off, texts paused or no company
 * number stops the sweep with nothing lost: the next sweep tries again. `verify_jwt = false`: the cron carries the
 * secret, and the one other caller is the office's Text again, whose JWT the function checks itself.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'POST only.' }, 405)
  const cronSecret = Deno.env.get('CRON_SECRET')
  const headerSecret = req.headers.get('X-Cron-Secret') ?? req.headers.get('x-cron-secret')
  const isSweep = Boolean(cronSecret) && headerSecret === cronSecret
  const body = ((await req.json().catch(() => null)) ?? {}) as { dry?: unknown; again?: unknown }
  // The one call with no secret is the office's Text again, and it names its request.
  if (!isSweep && typeof body.again !== 'string') return json({ error: 'Only the sweep calls this.' }, 401)
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
  const company = quoCompany()
  // The boxes are read once, and only when a text is about to go.
  let boxes: Awaited<ReturnType<typeof loadBoxes>> | null = null
  const doors: ReceiptSweepDoors = {
    admin,
    nowMs: Date.now(),
    settingText: (key) => loadSettingText(admin, key),
    textsOn: () => textsSwitchOn(admin),
    cellOf: toE164,
    // A roster number lands on its own team contact (`quo_place_number`), with its STOP to the team box.
    place: async (cell) => {
      const placed = await placeNumber(admin, cell, 'team')
      return placed ? { contactId: placed.contactId, channelId: placed.channelId, number: placed.number, optedOut: placed.optedOut } : null
    },
    lastTextAt: (channelId) => lastOurTextAt(admin, channelId, 'team'),
    send: async (to, text, last) => {
      boxes = boxes ?? (await loadBoxes(admin))
      const out = await sendText(admin, { purpose: 'nudge', contactId: to.contactId, channelId: to.channelId, to: to.number, optedOut: to.optedOut, body: text, lastOurTextAt: last, now: Date.now(), company, sender: null, jobId: null }, null, 'team', boxes)
      return out.ok ? { ok: true, segments: out.segments } : { ok: false, refused: out.refused, words: out.words }
    },
    companyName: company.name,
    randomBytes: (n) => crypto.getRandomValues(new Uint8Array(n)),
    sha256Hex: async (value) => receiptHexOf(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))),
    log: (line) => console.log(JSON.stringify(line)),
  }
  try {
    if (isSweep) return json(await runReceiptSweep(doors, { dry: body.dry === true }))

    // Text again: the office, signed in. The caller is read by their own JWT, then everything is the service role's.
    const requestId = String(body.again)
    if (!UUID_RE.test(requestId)) return json({ error: 'Pick a charge first.' }, 400)
    const auth = req.headers.get('Authorization') ?? ''
    const mine = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } })
    const { data: u } = auth ? await mine.auth.getUser() : { data: null }
    const userId = u?.user?.id
    const { data: office } = userId ? await mine.rpc('is_office_staff') : { data: false }
    if (!userId || office !== true) return json({ error: receiptAgainRefusalWords('not_office', '') }, 403)
    const archived = await refuseArchivedCaller(admin, userId, corsHeaders)
    if (archived) return archived
    // A training account sends nothing: the fences hold it on a table, and this write is the service role's.
    const { data: me } = await admin.from('users').select('read_only').eq('id', userId).maybeSingle()
    if ((me as { read_only?: boolean | null } | null)?.read_only) return json({ error: receiptAgainRefusalWords('training', '') }, 403)
    return json(await runReceiptAgain(doors, { requestId, byUserId: userId }))
  } catch (e) {
    console.error('receipt-request failed', e)
    return json({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
