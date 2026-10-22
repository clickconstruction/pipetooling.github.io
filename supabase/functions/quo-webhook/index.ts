import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { planQuoEvent, readQuoEvent, sentKey, type QuoPlan, type QuoPlanContext, type QuoReading } from '../_shared/gcKernels/lib/quo/events.ts'
import { keepTextMedia } from '../_shared/quoMedia.ts'
import { verifySignature, webhookAnswer, type WebhookOutcome } from '../_shared/gcKernels/lib/quo/webhook.ts'
import { boxOfInbound, sendBox, type BoxSettings, type Mailbox } from '../_shared/gcKernels/lib/messages/boxes.ts'
import { loadBoxes, loadSeats, notePauseRow, placeNumber, quoCompany, sendText, writeLine, writeStops, type Placed } from '../_shared/quoLines.ts'
import { isOwnNumber, ownChannels, type OwnChannels } from '../_shared/gcKernels/lib/messages/ownChannels.ts'
import { numberPlan, type WalkKit } from '../_shared/gcKernels/lib/walk/kit.ts'
import { loadWalkKit } from '../_shared/walkKit.ts'

/**
 * quo-webhook — Messages, cut 5: Quo's calls and texts land in a person's thread. Quo posts every event of our numbers
 * here (`message.received`, `message.delivered`, `message.failed`, `message.undelivered`, `call.completed`,
 * `call.missed`, `call.voicemail.completed`, `call.recording.completed`, `call.transcript.completed`,
 * `call.summary.completed`), signed with the webhook's `whsec_` key (QUO_WEBHOOK_SECRET). A thin wrapper over the
 * kernels in src/lib/quo (webhook.ts, events.ts, send.ts, rows.ts), in their order:
 *
 * 1. verifySignature over the raw body. A refusal answers 401 and records nothing.
 * 2. quo_webhook_claim with the delivery's webhook-id. A repeat answers 200 and does nothing.
 * 3. readQuoEvent. An event the webhook does not take answers 200 with its reason.
 * 4. The box it came to (R6): our number's Quo id (`phoneNumberId`) against Settings' boxes (`messages_boxes_v1`, with
 *    QUO_PHONE_NUMBER_ID as the team box's until the row has it), else the team box, today's one number.
 * 5. For each number the event is about: quo_place_number (the contact, made when nobody has the number) with its STOP
 *    to that box. A number of our own (either box's, `ownChannels`) is placed only while the walk kit's contact carries
 *    it (punch list #142 PR 1, `numberPlan`): a text between two of our own numbers otherwise makes a Who is this? row
 *    for each. Not carried, a sent event skips that recipient and a text or a call in is ignored with its reason. Then
 *    planQuoEvent merged and written through quo_write_line over the revision read, stamped with the box, then the
 *    number's STOP or START for that box alone (`opted_out_by_box`; both boxes when our number is not
 *    placed), a team event, and the app's own answer through quo-send's path from the same box's number (HELP, or the
 *    one confirmation of a stop Quo did not catch), the answer last. A text of ours that reached a phone ends a pause
 *    for the balance (`notePauseRow`). A failed or undelivered one never pauses: its code is the carrier's, and none
 *    names the balance.
 * 6. 200. On a failure the claim is given back (quo_webhook_release) and the answer is 500, so Quo sends it again.
 *
 * verify_jwt is off in config.toml: Quo signs its deliveries, it holds no Supabase session.
 */

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

/** An event this webhook can do nothing with, said as the reason Quo's delivery log shows. */
class Ignored extends Error {}

serve(async (req) => {
  if (req.method !== 'POST') return json(405, { ok: false, error: 'POST only' })
  const raw = await req.text()
  const check = await verifySignature(req.headers, raw, Deno.env.get('QUO_WEBHOOK_SECRET') ?? '')
  if (!check.ok) return answer({ kind: 'refused', why: check.why })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey) return answer({ kind: 'failed', why: 'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set' })
  const admin = createClient(supabaseUrl, serviceRoleKey)

  const claim = await admin.rpc('quo_webhook_claim', { p_id: check.webhookId })
  if (claim.error) return answer({ kind: 'failed', why: `quo_webhook_claim: ${claim.error.message}` })
  if (claim.data !== true) return answer({ kind: 'repeat', webhookId: check.webhookId })

  let body: unknown = null
  try {
    body = JSON.parse(raw)
  } catch {
    return answer({ kind: 'ignored', why: 'not JSON' })
  }
  const read = readQuoEvent(body)
  if (!read.ok) return answer({ kind: 'ignored', why: read.why })

  try {
    await handle(admin, read.reading)
    await admin.rpc('quo_webhook_ids_forget')
    return answer({ kind: 'handled', type: read.type, eventId: read.eventId })
  } catch (e) {
    if (e instanceof Ignored) return answer({ kind: 'ignored', why: e.message })
    const released = await admin.rpc('quo_webhook_release', { p_id: check.webhookId })
    if (released.error) console.error('[quo-webhook] the claim was not given back', released.error.message)
    return answer({ kind: 'failed', why: e instanceof Error ? e.message : String(e) })
  }
})

/** The answer for an ending, logged as `webhookAnswer` says. The claim is given back by the caller before a 500. */
function answer(outcome: WebhookOutcome): Response {
  const a = webhookAnswer(outcome)
  if (a.log) (a.status >= 500 ? console.error : console.log)(`[quo-webhook] ${a.log}`)
  return json(a.status, a.body)
}

// deno-lint-ignore no-explicit-any
async function handle(admin: any, reading: QuoReading): Promise<void> {
  const users = await loadSeats(admin)
  const company = quoCompany()
  const boxes = await loadBoxes(admin)
  // The box it came to: null when our number is not one Settings or the secret names.
  const to = boxOfInbound({ toNumberId: reading.ourNumberId }, boxes)
  const boxed: Boxed = { to, box: to ?? 'team', boxes, own: ownChannels(boxes, null), kit: await loadWalkKit(admin) }
  if (reading.kind === 'sent') {
    // A text of ours: one line a person it went to. One of our own numbers is a person only while the kit carries it.
    let placedAny = false
    let skipped = 0
    for (const number of reading.recipients) {
      if (numberPlan(number, boxed.own, boxed.kit) === 'skip') {
        skipped += 1
        continue
      }
      const placed = await placeNumber(admin, number, boxed.box)
      if (!placed) continue
      if (!onTheKit(placed, number, boxed)) {
        console.log(`[quo-webhook] our own number ${number} was placed on ${placed.contactId}, not the walk kit's contact: skipped`)
        skipped += 1
        continue
      }
      placedAny = true
      await planAndWrite(admin, reading, placed, { users, company, recipient: number }, sentKey(reading, number), boxed)
    }
    if (!placedAny) throw new Ignored(skipped > 0 && skipped === reading.recipients.length ? 'our own numbers' : 'none of its numbers is a phone number')
    if (reading.outcome === 'delivered') await notePauseRow(admin, { kind: 'go', at: reading.at })
    return
  }
  const placed = await placeEvent(admin, reading, boxed)
  await planAndWrite(admin, reading, placed, { users, company }, reading.quoId, boxed)
}

/** The box an event came to (`to`, null when not placed), the box its line takes, both boxes' numbers, and the walk kit. */
interface Boxed {
  to: Mailbox | null
  box: Mailbox
  boxes: BoxSettings
  /** Our own numbers, both boxes' (punch list #142). */
  own: OwnChannels
  /** The walk kit while one is set up, whose contact alone may carry one of our own numbers. */
  kit: WalkKit | null
}

/** Whether a placed number is where it may be: anywhere for a number that is not ours; the kit's contact for one of ours. */
function onTheKit(placed: Placed, number: string, boxed: Boxed): boolean {
  return !isOwnNumber(boxed.own, number) || placed.contactId === boxed.kit?.contactId
}

/**
 * Where an event lands: its number's contact. A call's later event that names no number finds it through the line its
 * call already wrote; with no line yet it fails, and Quo's retry comes after the call's own event.
 */
// deno-lint-ignore no-explicit-any
async function placeEvent(admin: any, reading: Exclude<QuoReading, { kind: 'sent' }>, boxed: Boxed): Promise<Placed> {
  const box = boxed.box
  if (reading.external) {
    // One of our own numbers writing in (a text from the bids number to the company number) is a person only while
    // the walk kit carries it (punch list #142); otherwise the event is Quo's mirror of our own send, and is ignored.
    if (numberPlan(reading.external, boxed.own, boxed.kit) === 'skip') throw new Ignored('our own number, the kit does not carry it')
    const placed = await placeNumber(admin, reading.external, box)
    if (placed && !onTheKit(placed, reading.external, boxed)) throw new Ignored(`our own number was placed on ${placed.contactId}, not the walk kit's contact`)
    if (placed) return placed
    if (reading.kind === 'text') throw new Ignored('the sender is not a phone number')
  }
  const { data: line, error } = await admin.from('messages').select('channel_id').eq('quo_id', reading.quoId).maybeSingle()
  if (error) throw new Error(`messages: ${error.message}`)
  const channelId = (line as { channel_id: string | null } | null)?.channel_id
  if (!channelId) throw new Error(`no number and no line yet for ${reading.quoId}`)
  const { data: channel, error: channelError } = await admin.from('contact_channels').select('value').eq('id', channelId).single()
  if (channelError) throw new Error(`contact_channels: ${channelError.message}`)
  const placed = await placeNumber(admin, (channel as { value: string }).value, box)
  if (!placed) throw new Error(`the line for ${reading.quoId} has no phone number`)
  return placed
}

/**
 * Plans one event for one number, writes its line on its box, then its STOP for that box, its team event and the app's
 * answer from that box's number, the answer last.
 */
async function planAndWrite(
  // deno-lint-ignore no-explicit-any
  admin: any,
  reading: QuoReading,
  placed: Placed,
  more: Pick<QuoPlanContext, 'users' | 'company'> & { recipient?: string },
  key: string,
  boxed: Boxed,
): Promise<void> {
  const ctx: Omit<QuoPlanContext, 'existing'> = {
    contactId: placed.contactId,
    contactWords: placed.words,
    channelId: placed.channelId,
    optedOut: placed.optedOut,
    defaultJobId: placed.star?.jobId ?? null,
    mailbox: boxed.box,
    ...more,
  }
  const { id: lineId, then: plan } = await writeLine<QuoPlan>(admin, key, placed.star, (prev) => {
    const p = planQuoEvent(reading, { ...ctx, existing: prev })
    return { line: p.line, then: p }
  })
  // A text's pictures and files: our copy now, since Quo's link to them does not last (Messages, cut 10).
  if (reading.kind === 'text' && lineId) await keepTextMedia(admin, lineId, reading.quoId, reading.media)
  // A completed call to or from them closes every open call to make (v2.5596, Follow up's We owe them), with its line.
  if (reading.kind === 'call' && reading.status === 'answered' && lineId) {
    const { error } = await admin.rpc('call_tasks_close_by_call', { p_contact: placed.contactId, p_message: lineId })
    if (error) console.error('[quo-webhook] call_tasks_close_by_call:', error.message)
  }

  // For the box it came to alone; both when our number is not placed, so a STOP is never missed.
  if (plan.optout) await writeStops(admin, placed.stops, plan.optout === 'out' ? 'stop' : 'start', boxed.to, reading.at)

  // The customer's say (v2.5597): EMAIL or TEXT alone sets how they hear from us.
  if (plan.prefers) {
    const { error } = await admin.from('contacts').update({ prefers: plan.prefers, prefers_how: 'reply', prefers_at: reading.at }).eq('id', placed.contactId)
    if (error) console.error('[quo-webhook] contacts.prefers:', error.message)
  }

  if (plan.event) {
    // Keyed beside its line, so Quo's retry never writes it twice.
    const { error } = await admin.from('messages').upsert(
      { contact_id: placed.contactId, channel: 'event', direction: 'team', who_text: 'The app', body: plan.event, quo_id: `${key}:event` },
      { onConflict: 'quo_id', ignoreDuplicates: true },
    )
    if (error) throw new Error(`messages: ${error.message}`)
  }

  if (plan.answer) {
    const sent = await sendText(
      admin,
      {
        purpose: plan.answer.purpose,
        contactId: placed.contactId,
        channelId: placed.channelId,
        to: placed.number,
        optedOut: placed.optedOut || plan.optout === 'out',
        body: plan.answer.body,
        lastOurTextAt: null,
        now: Date.now(),
        company: ctx.company,
        sender: null,
        jobId: placed.star?.jobId ?? null,
      },
      placed.star,
      sendBox(boxed.box, boxed.boxes),
      boxed.boxes,
    )
    // Quo turning the text away for no reason we read is worth Quo's retry: the line, the STOP and the event above
    // write the same again. A refusal of ours, texts not set up yet, or paused, or waiting on the carriers or the daily
    // cap, would only fail again.
    // A stop's confirmation is never asked for again: the STOP above is already mirrored, so Quo's retry would read the
    // number as stopped and plan no confirmation. It is logged instead.
    if (!sent.ok && sent.refused === 'quo' && plan.answer.purpose !== 'confirm') throw new Error(sent.words)
    if (!sent.ok) console.error(`[quo-webhook] the app's answer did not go: ${sent.words}`)
  }
}
