/**
 * Submittals stage 5a — the office's answer reaches the person who asked.
 * POST { message_id } from a signed-in office user (the pricing sharer who can
 * price the bid — the message row is read as the caller, so RLS decides).
 * Sends ONE letterhead email to the person the reply answers: the subject names
 * the bid and the tags, the body is the reply, and the link is the person's
 * PERSONAL room link (minted here if they never had one). Never a staff name —
 * the room shows the company. Reply-to is the sender's address.
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sendEmailViaResend } from '../_shared/resendSendEmail.ts'
import { PORTAL_COMPANY } from '../_shared/portalCompany.ts'
import { appOrigin } from '../_shared/jobContract.ts'
import { buildSubmittalReplyEmail } from '../_shared/submittalReplyEmail.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

function newToken(): string {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    const jwt = authHeader.replace(/^Bearer\s+/i, '')
    if (!jwt) return json({ error: 'Unauthorized' }, 401)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } })
    const { data: { user }, error: authErr } = await userClient.auth.getUser(jwt)
    if (authErr || !user) return json({ error: 'Unauthorized' }, 401)
    const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { autoRefreshToken: false, persistSession: false } })

    const body = (await req.json().catch(() => ({}))) as { message_id?: string; public_origin?: string }
    const messageId = (body.message_id ?? '').trim()
    if (!messageId) return json({ error: 'Missing message_id' }, 400)

    // The reply, read as the caller: RLS admits only pricing sharers on bids they can price.
    const { data: reply } = await userClient.from('bid_submittal_messages').select('id, room_id, body, tags, kind, author_kind, metadata').eq('id', messageId).maybeSingle()
    const r = reply as { id: string; room_id: string; body: string; tags: string[]; kind: string; author_kind: string; metadata: Record<string, unknown> | null } | null
    if (!r) return json({ error: 'Reply not found or access denied' }, 403)
    if (r.author_kind !== 'office' || r.kind !== 'reply') return json({ error: 'Only an office reply can be emailed.' }, 400)
    const answersId = typeof r.metadata?.answers_message_id === 'string' ? r.metadata.answers_message_id : null
    if (!answersId) return json({ error: 'This reply answers no question.' }, 400)
    const { data: ask } = await admin.from('bid_submittal_messages').select('id, body, person_id').eq('id', answersId).maybeSingle()
    const a = ask as { id: string; body: string; person_id: string | null } | null
    if (!a?.person_id) return json({ error: 'The question has no person to answer.' }, 400)
    const { data: person } = await admin.from('bid_submittal_people').select('id, name, email, token, closed_at').eq('id', a.person_id).maybeSingle()
    const p = person as { id: string; name: string; email: string; token: string | null; closed_at: string | null } | null
    if (!p || !p.email) return json({ error: 'No address on file for that person.' }, 400)
    let token = p.token
    if (!token) {
      token = newToken()
      await admin.from('bid_submittal_people').update({ token }).eq('id', p.id)
    }
    const { data: room } = await admin.from('bid_submittal_rooms').select('bid_id').eq('id', r.room_id).maybeSingle()
    const bidId = (room as { bid_id: string } | null)?.bid_id ?? null
    const { data: bid } = bidId ? await admin.from('bids').select('bid_number, project_name').eq('id', bidId).maybeSingle() : { data: null }
    const b = bid as { bid_number: string | null; project_name: string | null } | null
    const bidLabel = [b?.bid_number ? `B${b.bid_number}` : '', b?.project_name ?? ''].filter(Boolean).join(' ') || 'your submittal'
    const { data: sender } = await admin.from('users').select('email').eq('id', user.id).maybeSingle()
    const replyTo = ((sender as { email: string | null } | null)?.email ?? undefined) || undefined

    const resendKey = Deno.env.get('RESEND_API_KEY')
    if (!resendKey) return json({ error: 'Email is not configured on the server.' }, 500)
    const link = `${appOrigin(body.public_origin)}/submittal?t=${encodeURIComponent(token)}`
    const mail = buildSubmittalReplyEmail({ companyName: PORTAL_COMPANY.name, bidLabel, tags: Array.isArray(r.tags) ? r.tags : [], askedBody: a.body, replyBody: r.body, personName: p.name, link, phone: PORTAL_COMPANY.phone })
    const sent = await sendEmailViaResend(p.email, mail.subject, mail.text, mail.html, resendKey, { replyTo, emailType: 'submittal_reply' })
    if (!sent.success) return json({ error: sent.error ?? 'Send failed' }, 502)
    await admin.from('bid_submittal_events').insert({ room_id: r.room_id, person_id: p.id, event_type: 'reply', metadata: { message_id: r.id, answers: a.id, to: p.email, resend_email_id: sent.resendEmailId ?? null } })
    return json({ ok: true, to: p.email })
  } catch (e) {
    console.error('send-submittal-reply-email', e)
    return json({ error: 'Internal error' }, 500)
  }
})
