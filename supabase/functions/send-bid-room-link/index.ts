/**
 * Email a GC their bid-room link (Signable Bids Phase 1, v2.2468). Staff-authenticated (JWT
 * validated in-body, the send-estimate pattern); the email carries the option ladder — every
 * option's price with the base marked (the estimate-options email precedent) — and the one
 * durable link. Logs a link_sent event and remembers the recipient on the room.
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sendEmailViaResend } from '../_shared/resendSendEmail.ts'
import { escapeHtmlForEmail } from '../_shared/estimateEmailBrandImage.ts'
import { parseSharedBidRoomPayload } from '../_shared/bidRoomPayload.ts'

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
      .select('payload, rev_number')
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

    const fmt = (cents: number) =>
      new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
    const project = payload.project_name || 'your project'
    const subject = `Proposal — ${project}`
    const optionLine = (o: { name: string; is_base: boolean; total_cents: number }) =>
      `${o.is_base ? '★ ' : ''}${o.name || 'Option'}${o.is_base ? ' (proposed)' : ' (alternate)'} — ${fmt(o.total_cents)}`
    const text =
      `Please review our proposal for ${project}.\n\n` +
      payload.options.map((o) => `  ${optionLine(o)}`).join('\n') +
      `\n\nReview, choose, and sign here (this link stays current if we revise):\n${link}\n\nThank you.`
    const html =
      `<p>Please review our proposal for <strong>${escapeHtmlForEmail(project)}</strong>.</p>` +
      payload.options
        .map(
          (o) =>
            `<div style="display:flex;justify-content:space-between;max-width:380px;padding:0.15rem 0">` +
            `<span>${o.is_base ? '&#9733; ' : ''}${escapeHtmlForEmail(o.name || 'Option')}${o.is_base ? ' (proposed)' : ' (alternate)'}</span>` +
            `<strong>${fmt(o.total_cents)}</strong></div>`,
        )
        .join('') +
      `<p style="margin-top:1rem"><a href="${link}" style="background:#ea580c;color:#fff;padding:0.55rem 1.2rem;border-radius:8px;text-decoration:none;font-weight:700">Review &amp; sign the proposal</a></p>` +
      `<p style="color:#6a7684;font-size:13px">This link stays current if the proposal is revised.</p>`

    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    let emailed = false
    if (resendApiKey) {
      const sent = await sendEmailViaResend(email, subject, text, html, resendApiKey)
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
