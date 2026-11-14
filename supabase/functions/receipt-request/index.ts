import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { toE164 } from '../_shared/gcKernels/lib/quo/events.ts'
import { lastOurTextAt, loadBoxes, loadSettingText, placeNumber, quoCompany, sendText, textsSwitchOn } from '../_shared/quoLines.ts'
import { receiptHexOf } from '../_shared/receiptLink.ts'
import { runReceiptSweep, type ReceiptSweepDoors } from '../_shared/receiptSweep.ts'

/**
 * receipt-request (punch list #299, PR 2, v2.7142): the sweep that texts a card's holder a receipt link when a charge
 * posts. The cron calls it every five minutes while the switch is on (`app_settings` `receipt_texts_v1`, Settings →
 * Phone and texts, off as it ships) and something waits. It is the only thing that sends these texts.
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
 *
 * A request is claimed (its `texted_at` or `reminded_at` stamped) before its text is sent, so two sweeps that overlap
 * never text one charge twice; a text Quo then turns away gives the claim back. Texts off, texts paused or no company
 * number stops the sweep with nothing lost: the next sweep tries again. `verify_jwt = false`: the cron carries the
 * secret, and nothing else may call it.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'POST only.' }, 405)
  const cronSecret = Deno.env.get('CRON_SECRET')
  const headerSecret = req.headers.get('X-Cron-Secret') ?? req.headers.get('x-cron-secret')
  if (!cronSecret || headerSecret !== cronSecret) return json({ error: 'Only the sweep calls this.' }, 401)
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
  const body = ((await req.json().catch(() => null)) ?? {}) as { dry?: unknown }
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
    return json(await runReceiptSweep(doors, { dry: body.dry === true }))
  } catch (e) {
    console.error('receipt-request failed', e)
    return json({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
