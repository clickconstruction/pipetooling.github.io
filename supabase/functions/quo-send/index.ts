import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { REAL_ACCOUNT } from '../_shared/realAccount.ts'
import { parseQuoSendBody, seatOf } from '../_shared/gcKernels/lib/quo/rows.ts'
import { boxForReply, sendBox, stoppedOn, type Mailbox } from '../_shared/gcKernels/lib/messages/boxes.ts'
import { lastOurTextAt, loadBoxes, loadSeats, quoCompany, sendText } from '../_shared/quoLines.ts'
import { isJobModeSend } from '../_shared/gcKernels/lib/quo/techSend.ts'
import { jobModeSend } from '../_shared/quoTechSend.ts'

/**
 * quo-send — Messages, cut 5: a text from the reply box's send window, out through Quo from its box's number. The
 * caller is someone in the office (`gc_office_team()`, asked as them), a real account (never a sample or a digital
 * twin), and never a training account. The body is `parseQuoSendBody`'s: the contact, the number (one of their
 * `contact_channels`), the words, the files as link lines, the opt-out hold and the job it is tied to.
 *
 * `sendText` (`_shared/quoLines.ts`) does the rest, the same path the webhook's HELP answer takes: `planSend` refuses a
 * number that sent STOP and adds the opt-out line when our last text to that number is missing or 30 days old, the text
 * goes to Quo's `POST /v1/messages` as the sender's seat when they have one, and its line is written under the id Quo
 * answers with, so Quo's delivery event lands on the same line whichever comes first. Quo turning a text away for the
 * account's money answers 402 and pauses texts until a text goes (`quo/paused.ts`).
 *
 * The box (R6): the one their newest text on this number came to, else the one their kind of contact is for
 * (`boxForReply`), sent from the company number while that box has no number of its own (`sendBox`). A STOP is read
 * for that box alone (`stoppedOn`), the opt-out line's first-text and silence rule counts our texts from that box, and
 * the line keeps the box. No caller picks the box yet.
 *
 * While Settings → Phone and texts → Send texts is off (`app_settings` `messages_texts_on_v1`), `sendText` refuses with
 * 503 `textsOff` before anything reaches Quo (`quo/textsSwitch.ts`). The send window reads the same row first.
 *
 * Job Mode (R5): a body with `from: 'job_mode'` takes the tech path (`_shared/quoTechSend.ts`) before the office check.
 * A tech on the job, or the office, presses one of the phone's lines with only the blanks they typed. The text is made
 * from the line and the record, the contact found or made through `contact_for_job` (`contact_for_customer` for the
 * office), the number picked from their channels, the line tied to the job with `quick_reply_id`, and a tech's hold
 * on the answer written. Job Mode's door stays off until this is deployed (`JOB_MODE_MESSAGES_ON`).
 *
 * verify_jwt is off in config.toml, as for gc-customer-email: the caller's session is checked here.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

const refuse = (error: string, words: string, status: number) => json({ ok: false, error, words }, status)

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return refuse('badRequest', 'Send the text with POST.', 405)
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    if (!supabaseUrl || !serviceRoleKey || !anonKey) return refuse('failed', 'Texts are not set up yet.', 503)
    const admin = createClient(supabaseUrl, serviceRoleKey)
    const caller = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } })

    const { data: u } = await caller.auth.getUser()
    if (!u?.user) return refuse('signIn', 'Sign in to send a text.', 401)
    const { data: who } = await admin.from('users').select('id, name, read_only').match(REAL_ACCOUNT).eq('id', u.user.id).maybeSingle()
    if (!who || who.read_only) return refuse('readOnly', 'This account cannot send texts.', 403)
    const raw = await req.json().catch(() => null)
    if (isJobModeSend(raw)) {
      const answer = await jobModeSend(admin, caller, { id: who.id, name: who.name ?? null }, raw)
      return json(answer.body, answer.status)
    }

    const { data: office, error: officeError } = await caller.rpc('gc_office_team')
    if (officeError || office !== true) return refuse('officeOnly', 'Only the office sends texts.', 403)

    const input = parseQuoSendBody(raw)
    if (!input) return refuse('badRequest', 'The text is missing its person, number or words.', 400)

    const { data: channel } = await admin
      .from('contact_channels')
      .select('id, contact_id, kind, value, opted_out_at, opted_out_by_box')
      .eq('id', input.channelId)
      .maybeSingle()
    if (!channel || channel.contact_id !== input.contactId || channel.kind !== 'phone') {
      return refuse('notFound', 'That number is not one of theirs.', 404)
    }

    // The box it goes from: the one they last texted on this number, else their kind's, else the company number's.
    const { data: contact, error: contactError } = await admin.from('contacts').select('kind').eq('id', input.contactId).single()
    if (contactError) throw new Error(`contacts: ${contactError.message}`)
    const { data: lastIn, error: lastInError } = await admin
      .from('messages')
      .select('mailbox')
      .eq('channel_id', channel.id)
      .eq('direction', 'in')
      .not('mailbox', 'is', null)
      .order('at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (lastInError) throw new Error(`messages: ${lastInError.message}`)
    const boxes = await loadBoxes(admin)
    const wroteTo = ((lastIn as { mailbox: Mailbox } | null)?.mailbox ?? null) as Mailbox | null
    const box = sendBox(boxForReply(wroteTo, { kind: (contact as { kind: string }).kind }), boxes)
    const stops = { channelId: channel.id, optedOutAt: channel.opted_out_at, optedOutByBox: channel.opted_out_by_box ?? {} }

    const seats = await loadSeats(admin)
    const outcome = await sendText(
      admin,
      {
        purpose: 'reply',
        contactId: input.contactId,
        channelId: channel.id,
        to: channel.value,
        optedOut: stoppedOn(stops, box),
        body: input.body,
        links: input.links,
        lastOurTextAt: await lastOurTextAt(admin, channel.id, box),
        held: input.held,
        now: Date.now(),
        company: quoCompany(),
        sender: { userId: who.id, quoUserId: seatOf(who.id, seats), name: (who.name ?? '').trim() || 'Someone' },
        jobId: input.tie?.jobId ?? null,
      },
      input.tie,
      box,
      boxes,
    )
    if (!outcome.ok) return refuse(outcome.refused, outcome.words, outcome.status)
    return json({ ok: true, messageId: outcome.messageId, quoId: outcome.quoId, segments: outcome.segments, mailbox: box })
  } catch (e) {
    console.error('[quo-send]', e instanceof Error ? e.message : String(e))
    return refuse('failed', 'The text did not go. Try again.', 500)
  }
})
