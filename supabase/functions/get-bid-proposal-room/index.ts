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
      await admin.from('bid_proposal_room_events').insert({
        room_id: room.id,
        event_type: 'option_viewed',
        metadata: { option_key: String(body.optionKey ?? '') },
        client_ip: clientIp(req),
        user_agent: req.headers.get('user-agent'),
      })
      return json({ ok: true })
    }

    if (req.method !== 'GET') return json({ error: 'Method not allowed' }, 405)
    const raw = token as string | undefined
    if (!raw) return json({ error: 'Missing token' }, 400)

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
      outcome: (outcomeEvents ?? []).length > 0 ? outcomeEvents![outcomeEvents!.length - 1] : null,
    })
  } catch (e) {
    console.error(e)
    return json({ error: 'Internal error' }, 500)
  }
})
