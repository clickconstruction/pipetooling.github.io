/**
 * Email a GC their bid-room link (Signable Bids Phase 1, v2.2468). Staff-authenticated (JWT
 * validated in-body, the send-estimate pattern); the email carries the option ladder — every
 * option's price with the base marked (the estimate-options email precedent) — and the one
 * durable link. Logs a link_sent event and remembers the recipient on the room.
 * v2.2729: the email is the "Letterhead" design — brand banner, fileable subject, option table,
 * bulletproof button, the sender's signature + reply-to, revision note on revised sends
 * (`_shared/bidRoomLinkEmail.ts`, unit-tested from src/lib).
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sendEmailViaResend } from '../_shared/resendSendEmail.ts'
import { brandImageAbsoluteUrl } from '../_shared/estimateEmailBrandImage.ts'
import { parseSharedBidRoomPayload } from '../_shared/bidRoomPayload.ts'
import { buildBidRoomLinkEmail } from '../_shared/bidRoomLinkEmail.ts'
import { APP_CALENDAR_TZ } from '../_shared/appTimeZone.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const authHeader = req.headers.get('authorization') ?? ''
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } })
    const { data: userData, error: authErr } = await userClient.auth.getUser()
    if (authErr || !userData?.user) return json({ error: 'Not signed in' }, 401)

    const body = (await req.json()) as { room_id?: string; email?: string; public_origin?: string }
    const roomId = body.room_id?.trim()
    const email = body.email?.trim() ?? ''
    if (!roomId || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'room_id and a valid email are required' }, 400)

    // RLS check through the caller's own client: staff who can't see the room can't send it.
    const { data: visible } = await userClient.from('bid_proposal_rooms').select('id').eq('id', roomId).maybeSingle()
    if (!visible) return json({ error: 'Room not found or access denied' }, 403)

    const admin = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
    const { data: room } = await admin
      .from('bid_proposal_rooms')
      .select('id, public_token, closed_at')
      .eq('id', roomId)
      .maybeSingle()
    if (!room || room.closed_at) return json({ error: 'Room is closed' }, 410)

    const { data: rev } = await admin
      .from('bid_proposal_room_revisions')
      .select('payload, rev_number, note')
      .eq('room_id', roomId)
      .order('rev_number', { ascending: false })
      .limit(1)
      .maybeSingle()
    const payload = rev ? parseSharedBidRoomPayload(rev.payload) : null
    if (!payload) return json({ error: 'Publish a revision before sending' }, 400)

    const origin =
      (typeof body.public_origin === 'string' && body.public_origin.startsWith('http') ? body.public_origin : null) ??
      Deno.env.get('APP_ORIGIN') ??
      'https://clicktooling.com'
    const link = `${origin.replace(/\/$/, '')}/bid-room?t=${encodeURIComponent(room.public_token)}`

    // Who is sending: signature block + reply-to (null → the email still goes, just unsigned).
    const { data: me } = await admin.from('users').select('name, email, phone').eq('id', userData.user.id).maybeSingle()
    const sender = me
      ? {
          name: String((me as { name?: string | null }).name ?? '').trim(),
          email: String((me as { email?: string | null }).email ?? '').trim(),
          phone: String((me as { phone?: string | null }).phone ?? '').trim(),
        }
      : null
    const dateLabel = new Intl.DateTimeFormat('en-US', { timeZone: APP_CALENDAR_TZ, month: 'short', day: 'numeric', year: 'numeric' }).format(new Date())
    const mail = buildBidRoomLinkEmail({
      payload,
      link,
      brandImageUrl: brandImageAbsoluteUrl(origin, payload.header_brand === 'elec' ? 'elec' : 'plum'),
      revNumber: rev!.rev_number,
      revNote: (rev as { note?: string | null }).note ?? null,
      sender,
      dateLabel,
    })
    const { subject, text, html } = mail

    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    let emailed = false
    if (resendApiKey) {
      const sent = await sendEmailViaResend(email, subject, text, html, resendApiKey, mail.replyTo ? { replyTo: mail.replyTo } : undefined)
      if (!sent.success) return json({ ok: false, error: sent.error ?? 'Email failed' }, 502)
      emailed = true
    }

    await admin.from('bid_proposal_rooms').update({ recipient_email: email }).eq('id', roomId)
    await admin.from('bid_proposal_room_events').insert({
      room_id: roomId,
      event_type: 'link_sent',
      metadata: { email, rev_number: rev!.rev_number, emailed },
    })
    return json({ ok: true, emailed, link })
  } catch (e) {
    console.error(e)
    return json({ error: 'Internal error' }, 500)
  }
})
