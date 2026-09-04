/**
 * The Bid Room, public fetch (Signable Bids Phase 1, v2.2468). GET serves the room's latest
 * published revision by its durable plaintext token (the portal-links precedent) and logs a
 * room_view; POST logs an option_viewed event. Room state (signed/declined, Phase 2) rides the
 * response so the page can render the closed states. No JWT — the token is the credential;
 * service role behind it.
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { parseSharedBidRoomPayload } from '../_shared/bidRoomPayload.ts'
import { publicEventGate } from '../_shared/publicEventThrottle.ts'
import { sampleStateFromToken } from '../_shared/customerSample.ts'
import { BID_COVER_LETTER_EXCLUSIONS_KEY, BID_COVER_LETTER_TERMS_KEY, sampleBidRoomResponse } from '../_shared/customerSampleFixtures.ts'
import { todayYmdInAppTz } from '../_shared/appTimeZone.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

function clientIp(req: Request): string | null {
  const fwd = req.headers.get('x-forwarded-for')
  return fwd ? fwd.split(',')[0]?.trim() ?? null : null
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const token =
      req.method === 'GET'
        ? new URL(req.url).searchParams.get('t')?.trim()
        : ((await req.json().catch(() => ({}))) as { token?: string; event?: string; optionKey?: string })

    if (req.method === 'POST') {
      const body = token as { token?: string; event?: string; optionKey?: string }
      const raw = body.token?.trim()
      if (!raw || body.event !== 'option_viewed') return json({ ok: true })
      const { data: room } = await admin.from('bid_proposal_rooms').select('id, closed_at').eq('public_token', raw).maybeSingle()
      if (!room || room.closed_at) return json({ ok: true })
      // v2.2697: the key must be one of the room's CURRENT options (the estimate endpoint
      // always checked; this one took any string), then the same throttle as estimates —
      // duplicate inside the dedupe window or an IP over the cap is dropped, still 200.
      const optionKey = String(body.optionKey ?? '').trim()
      const { data: rev } = await admin
        .from('bid_proposal_room_revisions')
        .select('payload')
        .eq('room_id', room.id)
        .order('rev_number', { ascending: false })
        .limit(1)
        .maybeSingle()
      const payload = rev ? parseSharedBidRoomPayload(rev.payload) : null
      const chosen = payload?.options.find((o) => o.key === optionKey)
      if (!chosen) return json({ ok: true })
      const ip = clientIp(req)
      const gate = await publicEventGate(admin, {
        table: 'bid_proposal_room_events',
        subjectColumn: 'room_id',
        subjectId: room.id,
        eventType: 'option_viewed',
        optionKey: chosen.key,
        clientIp: ip,
      })
      if (!gate.record) return json({ ok: true })
      await admin.from('bid_proposal_room_events').insert({
        room_id: room.id,
        event_type: 'option_viewed',
        metadata: { option_key: chosen.key, option_name: chosen.name },
        client_ip: ip,
        user_agent: req.headers.get('user-agent'),
      })
      return json({ ok: true })
    }

    if (req.method !== 'GET') return json({ error: 'Method not allowed' }, 405)
    const raw = token as string | undefined
    if (!raw) return json({ error: 'Missing token' }, 400)

    // What customers see (Settings dev tab): the sample token renders the fixture over the live
    // cover-letter defaults for a signed-in office user. No room, no room_view logged.
    const sample = sampleStateFromToken(raw)
    if (sample) {
      const { data: rows } = await admin.from('app_settings').select('key, value_text').in('key', [BID_COVER_LETTER_TERMS_KEY, BID_COVER_LETTER_EXCLUSIONS_KEY])
      return json(sampleBidRoomResponse((rows ?? []) as { key: string; value_text: string | null }[], sample, new Date().toISOString(), todayYmdInAppTz()))
    }

    const { data: room } = await admin
      .from('bid_proposal_rooms')
      .select('id, bid_id, closed_at, attachment_url, attachment_label')
      .eq('public_token', raw)
      .maybeSingle()
    if (!room) return json({ error: 'Not found' }, 404)
    if (room.closed_at) return json({ error: 'This proposal has been withdrawn.', code: 'closed' }, 410)

    const { data: rev } = await admin
      .from('bid_proposal_room_revisions')
      .select('id, rev_number, note, payload, published_at')
      .eq('room_id', room.id)
      .order('rev_number', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (!rev) return json({ error: 'Nothing published yet.', code: 'empty' }, 404)
    const payload = parseSharedBidRoomPayload(rev.payload)
    if (!payload) return json({ error: 'Nothing published yet.', code: 'empty' }, 404)

    // Phase 2 stamps signed/declined events; the page renders the closed state from these.
    const { data: outcomeEvents } = await admin
      .from('bid_proposal_room_events')
      .select('event_type, metadata, occurred_at')
      .eq('room_id', room.id)
      .in('event_type', ['signed', 'declined'])
      .order('occurred_at', { ascending: true })
    const proposalOutcomes = (outcomeEvents ?? []).filter(
      (e) => !(e.metadata && typeof e.metadata === 'object' && (e.metadata as { kind?: string }).kind === 'change_order'),
    )

    // Phase 4: change orders published into the room — the documents thread.
    const { data: coRows } = await admin
      .from('estimates')
      .select('id, title, change_order_fields, line_items_snapshot, terms_snapshot, total_cents, status, sent_at, acceptor_printed_name, acceptor_consented_at')
      .eq('bid_room_id', room.id)
      .eq('doc_kind', 'change_order')
      .order('sent_at', { ascending: true })

    await admin.from('bid_proposal_room_events').insert({
      room_id: room.id,
      event_type: 'room_view',
      metadata: { rev_number: rev.rev_number },
      client_ip: clientIp(req),
      user_agent: req.headers.get('user-agent'),
    })

    return json({
      revision: { id: rev.id, rev_number: rev.rev_number, note: rev.note, published_at: rev.published_at },
      payload,
      attachment: room.attachment_url ? { url: room.attachment_url, label: room.attachment_label ?? null } : null,
      outcome: proposalOutcomes.length > 0 ? proposalOutcomes[proposalOutcomes.length - 1] : null,
      documents: coRows ?? [],
    })
  } catch (e) {
    console.error(e)
    return json({ error: 'Internal error' }, 500)
  }
})
