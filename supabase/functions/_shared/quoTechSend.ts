/**
 * quo-send's tech path (Messages, residential R5; `to-dos/gc-mode/messages/RESIDENTIAL_BUILD_PLAN.md` → R5 on branch
 * spike/gc-mode): Job Mode's **Message the customer**. A tech on the job presses one of the phone's lines and types only
 * the blanks the app cannot fill. The text is made here from the line and the record with the sheet's own kernel
 * (`jobModeText.ts`), so no free text goes out, and any body the client sends is never read.
 *
 * Who may: a tech dispatched to or clocked on the job this week or last (`messages_tech_on_job`, asked as them), or
 * the office team, so the owner working a job is not turned away. The contact: the sheet's when it is the job's
 * customer's, else the door's (`contact_for_job` for a tech, `contact_for_customer` for the office), found or made as
 * the caller, so a training account and a digital twin are refused in words. A sheet's contact that is not the
 * customer's is logged, so a stale sheet shows. The number: the one they last texted from, else their first phone. The
 * line is tied to the job, keeps the phone line it came from (`messages.quick_reply_id`), and for a tech, the customer's
 * answer is held for them until their hour (`techHoldUntil`, `contacts.has_*`). The send itself is the reply box's
 * (`sendText`), so the box, the STOP, the opt-out line, the pause and Settings' Send texts switch all hold.
 */
// deno-lint-ignore-file no-explicit-any
import { seatOf } from './gcKernels/lib/quo/rows.ts'
import { boxForReply, sendBox, stoppedOn, type Mailbox, type OptedOutByBox } from './gcKernels/lib/messages/boxes.ts'
import { TECH_SEND_WORDS, composeTechText, parseTechSendBody, pickPhone } from './gcKernels/lib/quo/techSend.ts'
import { jobModeFills } from './gcKernels/lib/jobModeText.ts'
import { customerLang } from './gcKernels/lib/messages/customerLang.ts'
import { OFFICE_HOURS_KEY, parseOfficeHours, techHoldUntil } from './gcKernels/lib/messages/hasRule.ts'
import { scheduleTodayDateKey } from './gcKernels/lib/jobScheduleChicago.ts'
import { lastOurTextAt, loadBoxes, loadSeats, quoCompany, sendText } from './quoLines.ts'

/** What the tech path answers: the status and the JSON body quo-send returns. */
export interface TechSendAnswer {
  status: number
  body: Record<string, unknown>
}

const refused = (error: string, words: string, status: number): TechSendAnswer => ({ status, body: { ok: false, error, words } })

/** The caller as quo-send read them: a real account that is not read only. */
export interface TechSendCaller {
  id: string
  name: string | null
}

/**
 * Job Mode's send. `admin` is the service role; `caller` is the caller's own client, so the doors ask `auth.uid()` as
 * them. Throws only on a table it cannot read; quo-send answers that as a text that did not go.
 */
export async function jobModeSend(admin: any, caller: any, who: TechSendCaller, raw: unknown): Promise<TechSendAnswer> {
  const parsed = parseTechSendBody(raw)
  if (!parsed.ok) return refused('badRequest', parsed.words, 400)
  const ask = parsed.body

  // Who may: the office team, else a tech on this job.
  const { data: office, error: officeError } = await caller.rpc('gc_office_team')
  if (officeError) throw new Error(`gc_office_team: ${officeError.message}`)
  const isOffice = office === true
  if (!isOffice) {
    const { data: onJob, error } = await caller.rpc('messages_tech_on_job', { p_job_id: ask.jobId })
    if (error) throw new Error(`messages_tech_on_job: ${error.message}`)
    if (onJob !== true) return refused('notTech', TECH_SEND_WORDS.notTech, 403)
  }

  // The job and its customer.
  const { data: job, error: jobError } = await admin.from('jobs_ledger').select('id, customer_id, job_name, job_address').eq('id', ask.jobId).maybeSingle()
  if (jobError) throw new Error(`jobs_ledger: ${jobError.message}`)
  if (!job?.customer_id) return refused('noCustomer', TECH_SEND_WORDS.noCustomer, 422)
  if (job.customer_id !== ask.customerId) return refused('wrongCustomer', TECH_SEND_WORDS.wrongCustomer, 422)

  // The contact: the sheet's when it is this customer's, else the door's, as the caller.
  let contactId: string | null = null
  if (ask.contactId) {
    const { data: given, error } = await admin.from('contacts').select('id, kind, customer_id').eq('id', ask.contactId).maybeSingle()
    if (error) throw new Error(`contacts: ${error.message}`)
    if (given && given.kind === 'customer' && given.customer_id === job.customer_id) contactId = given.id
    else console.warn(`[quo-send] job_mode: the sheet's contact ${ask.contactId} is not job ${ask.jobId}'s customer's; the job's customer's is used`)
  }
  if (!contactId) {
    const door = isOffice ? caller.rpc('contact_for_customer', { p_customer_id: job.customer_id }) : caller.rpc('contact_for_job', { p_job_id: ask.jobId })
    const { data, error } = await door
    if (error || typeof data !== 'string') return refused('noContact', error?.message ?? TECH_SEND_WORDS.notTech, 403)
    contactId = data
  }

  // The line, made from the phone's line and the record.
  const today = scheduleTodayDateKey(new Date())
  const [lineRead, customerRead, blocksRead] = await Promise.all([
    admin.from('quick_replies').select('id, text, text_es, for_kind, scope, phone_order, removed_at').eq('id', ask.quickReplyId).maybeSingle(),
    admin.from('customers').select('name, language').eq('id', job.customer_id).maybeSingle(),
    admin
      .from('job_schedule_blocks')
      .select('work_date, time_start, time_end')
      .eq('job_id', ask.jobId)
      .eq('assignee_user_id', who.id)
      .gte('work_date', today)
      .order('work_date')
      .order('time_start')
      .limit(20),
  ])
  for (const [name, read] of [['quick_replies', lineRead], ['customers', customerRead], ['job_schedule_blocks', blocksRead]] as const) {
    if (read.error) throw new Error(`${name}: ${read.error.message}`)
  }
  const line = lineRead.data
  if (!line) return refused('notOnPhone', TECH_SEND_WORDS.notOnPhone, 404)
  const customer = customerRead.data as { name: string | null; language: string | null } | null
  const app = jobModeFills({
    customerName: customer?.name ?? null,
    me: who.name,
    jobName: job.job_name ?? null,
    jobAddress: job.job_address ?? null,
    blocks: ((blocksRead.data ?? []) as Array<{ work_date: string; time_start: string; time_end: string }>).map((b) => ({
      workDate: b.work_date,
      timeStart: b.time_start,
      timeEnd: b.time_end,
    })),
    today,
  })
  const language = customer?.language === 'es' || customer?.language === 'en' ? customer.language : undefined
  const made = composeTechText(
    { text: line.text, textEs: line.text_es ?? null, forKind: line.for_kind, scope: line.scope, phoneOrder: line.phone_order ?? null, removed: line.removed_at !== null },
    app,
    ask.fills,
    customerLang({ lang: language }),
  )
  if (!made.ok) return refused(made.refused, made.words, 422)

  // The number: the one they last texted from, else their first phone.
  const [channelsRead, lastInRead] = await Promise.all([
    admin.from('contact_channels').select('id, kind, value, created_at, opted_out_at, opted_out_by_box').eq('contact_id', contactId),
    admin
      .from('messages')
      .select('channel_id, mailbox')
      .eq('contact_id', contactId)
      .eq('channel', 'text')
      .eq('direction', 'in')
      .order('at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])
  if (channelsRead.error) throw new Error(`contact_channels: ${channelsRead.error.message}`)
  if (lastInRead.error) throw new Error(`messages: ${lastInRead.error.message}`)
  const channels = (channelsRead.data ?? []) as Array<{ id: string; kind: string; value: string; created_at: string; opted_out_at: string | null; opted_out_by_box: OptedOutByBox | null }>
  const lastIn = lastInRead.data as { channel_id: string | null; mailbox: Mailbox | null } | null
  const phone = pickPhone(
    channels.map((c) => ({ id: c.id, kind: c.kind, value: c.value, createdAt: c.created_at })),
    lastIn?.channel_id ?? null,
  )
  const channel = phone ? channels.find((c) => c.id === phone.id) : undefined
  if (!channel) return refused('noPhone', TECH_SEND_WORDS.noPhone, 422)

  // The box: the one they last texted on this number, else a customer's, as the reply box's path picks it.
  const boxes = await loadBoxes(admin)
  const wroteTo = lastIn?.channel_id === channel.id ? (lastIn?.mailbox ?? null) : null
  const box = sendBox(boxForReply(wroteTo, { kind: 'customer' }), boxes)
  const stops = { channelId: channel.id, optedOutAt: channel.opted_out_at, optedOutByBox: channel.opted_out_by_box ?? {} }
  const seats = await loadSeats(admin)
  const outcome = await sendText(
    admin,
    {
      purpose: 'reply',
      contactId,
      channelId: channel.id,
      to: channel.value,
      optedOut: stoppedOn(stops, box),
      body: made.text,
      links: [],
      lastOurTextAt: await lastOurTextAt(admin, channel.id, box),
      held: false,
      now: Date.now(),
      company: quoCompany(),
      sender: { userId: who.id, quoUserId: seatOf(who.id, seats), name: (who.name ?? '').trim() || 'Someone' },
      jobId: ask.jobId,
    },
    { jobId: ask.jobId, column: 'jobs_ledger_id' },
    box,
    boxes,
  )
  if (!outcome.ok) return refused(outcome.refused, outcome.words, outcome.status)

  // The text went: its line keeps the phone line it came from, and a tech holds the answer until their hour. Neither
  // write undoes the text, so a failure is logged and the answer stands.
  if (outcome.messageId) {
    const { error } = await admin.from('messages').update({ quick_reply_id: line.id }).eq('id', outcome.messageId)
    if (error) console.error('[quo-send] job_mode: the line kept no quick reply:', error.message)
  }
  if (!isOffice) {
    const { data: hoursRow, error: hoursError } = await admin.from('app_settings').select('value_text').eq('key', OFFICE_HOURS_KEY).maybeSingle()
    if (hoursError) console.error('[quo-send] job_mode: the office hours were not read:', hoursError.message)
    const at = new Date().toISOString()
    const until = techHoldUntil(at, parseOfficeHours((hoursRow as { value_text: string | null } | null)?.value_text))
    const { error } = await admin.from('contacts').update({ has_user_id: who.id, has_since: at, has_how: 'rule', has_until: until }).eq('id', contactId)
    if (error) console.error('[quo-send] job_mode: the answer was not held for the tech:', error.message)
  }
  return {
    status: 200,
    body: { ok: true, messageId: outcome.messageId, quoId: outcome.quoId, segments: outcome.segments, mailbox: box, contactId },
  }
}
