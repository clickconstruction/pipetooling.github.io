import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sendEmailViaResend } from '../_shared/resendSendEmail.ts'
import { fileSentEmailBestEffort } from '../_shared/fileSentCopy.ts'
import { COMPANY_EMAIL_FROM } from '../_shared/emailFrom.ts'
import { PORTAL_COMPANY } from '../_shared/portalCompany.ts'
import {
  buildSubmittalRoomLinkEmail,
  parseRoomLinkRequest,
  roomLinkBidLabel,
  roomLinkKeptHtml,
  roomLinkRefusal,
  roomLinkUrl,
  ROOM_LINK_ERRORS,
  ROOM_LINK_EVENT,
  ROOM_LINK_KIND,
  type RoomLinkErrorKey,
} from '../_shared/submittalRoomLinkEmail.ts'

/**
 * send-submittal-room-link — Submittals decision 11 (v2.5026, the owner's call of 2026-10-09): the app may send the
 * room link. The Share step's Send the link door, and the Share window's box, email one named reviewer their own link.
 *
 *   POST { person_id, note? }   staff JWT
 *     → { ok: true, to, sentAt }
 *     → { error: key, detail? } with ROOM_LINK_ERRORS' status
 *
 * In order: the caller (signed in; never a training account or a digital twin), the shape, the person read AS THE
 * CALLER (RLS admits the pricing sharers on bids they can price, as on the tab), the room, the refusals
 * (`roomLinkRefusal`), the person's token (minted when they never had one, as send-submittal-reply-email does), the
 * email, the send through the one sender (`sendEmailViaResend`, as gc-trade-email sends), the sent copy with the token
 * kept as `?t=…`, then the `link_sent` event the Share step reads. A failed send writes nothing. The address is on
 * APP_ORIGIN, never an origin from the body.
 *
 * Secrets: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, EMAIL_FROM, APP_ORIGIN.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

const refuse = (key: RoomLinkErrorKey, detail?: string) => json({ error: key, ...(detail ? { detail } : {}) }, ROOM_LINK_ERRORS[key])

/** A personal token, as the Share window mints one (`newRoomToken`): 24 random bytes in hex. */
function newToken(): string {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

type PersonRow = { id: string; room_id: string; name: string; email: string | null; may_decide: boolean; token: string | null; closed_at: string | null }
type RoomRow = { id: string; bid_id: string; status: string; shared_at: string | null }

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'badRequest' }, 405)
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (!serviceRoleKey) return refuse('failed', 'SUPABASE_SERVICE_ROLE_KEY is not set')
    if (!resendApiKey) return refuse('failed', 'Email is not configured yet: set RESEND_API_KEY')
    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })

    // The caller: a staff session, never a training account or a twin.
    const auth = req.headers.get('Authorization') ?? ''
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } })
    const { data: u } = await userClient.auth.getUser()
    if (!u?.user) return refuse('signIn')
    const { data: who } = await admin.from('users').select('email, read_only, is_digital_twin').eq('id', u.user.id).maybeSingle()

    const parsed = parseRoomLinkRequest(await req.json().catch(() => null))
    if (!parsed) return refuse('badRequest')

    // The person, read as the caller: RLS admits the pricing sharers on bids they can price, as on the tab.
    const { data: personRow } = await userClient.from('bid_submittal_people').select('id, room_id, name, email, may_decide, token, closed_at').eq('id', parsed.personId).maybeSingle()
    const person = personRow as PersonRow | null
    const { data: roomRow } = person ? await admin.from('bid_submittal_rooms').select('id, bid_id, status, shared_at').eq('id', person.room_id).maybeSingle() : { data: null }
    const room = roomRow as RoomRow | null
    const why = roomLinkRefusal({ caller: who as { read_only?: boolean | null; is_digital_twin?: boolean | null } | null, person, room })
    if (why || !person || !room) return refuse(why ?? 'notFound')

    // Their own link: the token on file, or a new one. Two presses at once keep whichever landed first.
    let token = person.token
    if (!token) {
      const { error: mintError } = await admin.from('bid_submittal_people').update({ token: newToken() }).eq('id', person.id).is('token', null)
      if (mintError) return refuse('failed', `The link was not made: ${mintError.message}`)
      token = ((await admin.from('bid_submittal_people').select('token').eq('id', person.id).maybeSingle()).data as { token: string | null } | null)?.token ?? null
      if (!token) return refuse('failed', 'The link was not made.')
    }

    const [{ data: bid }, { data: shown }] = await Promise.all([
      admin.from('bids').select('bid_number, project_name').eq('id', room.bid_id).maybeSingle(),
      // The revision the page shows now: the newest shared.
      admin.from('bid_submittals').select('rev_number').eq('bid_id', room.bid_id).eq('status', 'shared').order('rev_number', { ascending: false }).limit(1).maybeSingle(),
    ])
    const replyTo = String((who as { email?: string | null } | null)?.email ?? '').trim() || undefined
    const origin = Deno.env.get('APP_ORIGIN') ?? 'https://clicktooling.com'
    const mail = buildSubmittalRoomLinkEmail({
      companyName: PORTAL_COMPANY.name,
      phone: PORTAL_COMPANY.phone,
      bidLabel: roomLinkBidLabel(bid as { bid_number?: string | null; project_name?: string | null } | null),
      revNumber: (shown as { rev_number?: number | null } | null)?.rev_number ?? null,
      personName: person.name,
      mayDecide: person.may_decide,
      link: roomLinkUrl(origin, token),
      note: parsed.note,
    })

    const to = (person.email ?? '').trim()
    const sent = await sendEmailViaResend(to, mail.subject, mail.text, mail.html, resendApiKey, {
      from: COMPANY_EMAIL_FROM,
      ...(replyTo ? { replyTo } : {}),
      emailType: ROOM_LINK_KIND,
    })
    if (!sent.success) return refuse('sendFailed', sent.error ?? 'Resend said no')
    const sentAt = new Date().toISOString()

    // Sent copies (docs/SENT_COPIES.md): kept under the bid, by the person's row, with the token kept as ?t=….
    await fileSentEmailBestEffort(
      { kind: ROOM_LINK_KIND, title: `Submittal link for ${person.name}`, recipientName: person.name, bidId: room.bid_id, source: { table: 'bid_submittal_people', id: person.id }, sentBy: u.user.id },
      { to: [to], from: COMPANY_EMAIL_FROM, subject: mail.subject, html: roomLinkKeptHtml(mail.html), resendEmailId: sent.resendEmailId ?? null },
    )
    const { error: eventError } = await admin.from('bid_submittal_events').insert({
      room_id: room.id,
      person_id: person.id,
      event_type: ROOM_LINK_EVENT,
      metadata: { to, by: u.user.id, resend_email_id: sent.resendEmailId ?? null, with_note: parsed.note !== '' },
    })
    // The email went: say so, and say the Share step will not show it.
    if (eventError) return json({ ok: true, to, sentAt, recorded: false, detail: eventError.message })
    return json({ ok: true, to, sentAt })
  } catch (e) {
    return refuse('failed', e instanceof Error ? e.message : String(e))
  }
})
