/**
 * messages-nudge-dispatch — Messages, cut 5: the morning run of the reminders the app sends itself
 * (to-dos/gc-mode/messages/BUILD_PLAN.md → Cut 5 and section 6; section 7's decision 3: per step, off until the owner
 * turns it on). Every decision is a kernel's, from the copy (`_shared/gcKernels`): `nudgeRunReads` puts everyone's flow
 * together the way each person's panel does, `planNudgeRun` picks the morning's texts, and `runSummary` words the
 * morning. Each text goes through `sendText` (`_shared/quoLines.ts`), the path quo-send and the webhook's HELP answer
 * take, with the purpose `nudge`: it adds the opt-out line when a rule says, and sends from its box's number. The box
 * is picked as quo-send picks it (R6): the one they last texted on this number, else their kind's, else the company
 * number's (`boxForReply`, `sendBox`). A number that sent STOP to that box is kept back as opted out (`stoppedOn`).
 *
 * Modes on the POST:
 * - the cron (no body): X-Cron-Secret. The cron fires at 14:00 and 15:00 UTC, and only the tick that is 9 AM Central
 *   runs (`runHourNow`). For each text: the send, then its `nudge_sent` row (sent_by 'app') and the thread's event
 *   line, keyed so a retry writes nothing twice. The morning's summary goes in `app_settings`
 *   `messages_nudge_last_run_v1`.
 * - `{ "dry": true }`: the cron secret, or a signed-in dev (a real account). Any hour. The texts as they would go and
 *   the summary. Sends nothing and writes nothing.
 *
 * Offers (v2.5595, punch list #115): a step the owner set to *offers* in Settings → Flows ('offer' in the switch) is
 * planned the same way, but its text is written to `nudge_offers` for the office to press on the Dashboard's Today's
 * sends, never sent; a number that is missing or sent STOP holds the row with why. A text the office prepared itself for
 * a morning (Send in the morning on the Tell the customer sheet; `prepared_by` office with a `send_on`) is sent by the
 * run on that day as the office's own, stamped on the row, with its `nudge_sent` record and the thread's event line.
 *
 * The walk kit (punch list #142 PR 6): `walk_kit_v1` is read once per run, and the kit's contact is left out of the
 * morning entirely (`nudgeRunReads`' `walkKitContactId`, and the office's morning texts), so a walk never texts or
 * offers a reminder to the company's own number.
 *
 * Customers wait until the run can read their page: `customer_portal_views` and `customer_portal_papers` are the
 * office's alone, so the service role cannot read them, and the run never texts a customer off a partial read.
 * The switch (`messages_nudge_app_sends_v1`) is `{}` as it ships, so every step is off and every run sends nothing. A
 * step turned on still waits on Settings → Phone and texts → Send texts (`messages_texts_on_v1`, checked in sendText):
 * while it is off, sendText answers `textsOff`, and the run counts that text and the rest as kept back, never failed.
 *
 * Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY (a dev's dry run), CRON_SECRET, APP_ORIGIN (a
 * trade partner's page link), and sendText's QUO_API_KEY, QUO_PHONE_NUMBER_ID and QUO_COMPANY_*. config.toml keeps
 * verify_jwt = false: the cron sends no JWT.
 */
// deno-lint-ignore-file no-explicit-any
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { REAL_ACCOUNT } from '../_shared/realAccount.ts'
import { lastOurTextAt, loadBoxes, quoCompany, sendText } from '../_shared/quoLines.ts'
import { loadWalkKit } from '../_shared/walkKit.ts'
import { mintRatingLink, needsRatingLink, ratingAnswered } from '../_shared/ratingMint.ts'
// The kernels straight from the copy, not its index, as quoLines.ts reads them.
import { APP_SETTINGS_KEY_MESSAGES_NUDGE_LAST_RUN_V1 } from '../_shared/gcKernels/lib/appSettingsKeys.ts'
import { FLOW_KINDS } from '../_shared/gcKernels/lib/flows/facts.ts'
import { notSentWords, planNudgeRun, type NudgeKept, type NudgeOffer } from '../_shared/gcKernels/lib/flows/nudgeDispatch.ts'
import { APP_SENDS_SETTING_KEY, nudgeRunReads, type NudgeRunRows, type RunOfferRow } from '../_shared/gcKernels/lib/flows/nudgeRunInputs.ts'
import { runHourNow, runSummary, type RunRefused } from '../_shared/gcKernels/lib/flows/nudgeRunLog.ts'
import { boxForReply, sendBox, stoppedOn, type Mailbox } from '../_shared/gcKernels/lib/messages/boxes.ts'
import type { JobAt } from '../_shared/gcKernels/lib/quo/rows.ts'
import { todayYmdInAppTz } from '../_shared/gcKernels/utils/dateUtils.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
}

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

/** PostgREST's page, and how many contacts one read takes. */
const PAGE = 1000
const CHUNK = 100

/** The kinds the run reads: every flow's kind but the customer's, whose page it cannot read yet. */
const RUN_KINDS = FLOW_KINDS.filter((k) => k !== 'customer')

type Answer<T> = { data: T[] | null; error: { message: string } | null }

/** Every row of a read, page by page; the read orders itself so the pages do not overlap. */
async function all<T>(read: (from: number, to: number) => PromiseLike<Answer<T>>, what: string): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await read(from, from + PAGE - 1)
    if (error) throw new Error(`${what}: ${error.message}`)
    out.push(...(data ?? []))
    if (!data || data.length < PAGE) return out
  }
}

const chunks = <T>(xs: readonly T[], n: number): T[][] => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n))

/** An open `nudge_offers` row: a text waiting on Today's sends, or one the office handed to a morning. */
type OfferRow = RunOfferRow & { id: string; body: string; channel_id: string | null; prepared_by: string; send_on: string | null; by_user_id: string | null }

/** The job an offer sits on, in the column `nudge_sent` and the thread keep it. */
const jobAtOf = (o: OfferRow): JobAt | null =>
  o.bid_id ? { jobId: o.bid_id, column: 'bid_id' } : o.project_id ? { jobId: o.project_id, column: 'project_id' } : o.jobs_ledger_id ? { jobId: o.jobs_ledger_id, column: 'jobs_ledger_id' } : null

/** The morning's rows, read as the service role. */
async function readRows(admin: any): Promise<{ rows: NudgeRunRows; customersHeld: number; offers: OfferRow[] }> {
  const contacts = await all<NudgeRunRows['contacts'][number]>(
    (a, b) => admin.from('contacts').select('id, kind, name, goes_by, snoozed_until, prefers').in('kind', RUN_KINDS).order('id').range(a, b),
    'contacts',
  )
  const { count: customersHeld, error: heldError } = await admin.from('contacts').select('id', { count: 'exact', head: true }).eq('kind', 'customer')
  if (heldError) throw new Error(`contacts: ${heldError.message}`)

  const flowRows: Record<string, unknown> = {}
  const got = { holds: [] as any[], sent: [] as any[], notes: [] as any[], lines: [] as any[], owed: [] as any[], channels: [] as any[] }
  for (const ids of chunks(contacts.map((c) => c.id), CHUNK)) {
    const { data, error } = await admin.rpc('flow_rows_for', { p_ids: ids })
    if (error) throw new Error(`flow_rows_for: ${error.message}`)
    Object.assign(flowRows, data ?? {})
    const [holds, sent, notes, lines, owed, channels] = await Promise.all([
      all<any>((a, b) => admin.from('nudge_holds').select('id, contact_id, step_key, project_id, jobs_ledger_id, until_on, released_at').in('contact_id', ids).is('released_at', null).order('id').range(a, b), 'nudge_holds'),
      all<any>((a, b) => admin.from('nudge_sent').select('contact_id, step_key, project_id, jobs_ledger_id, sent_at, sent_by, how, by_user_id').in('contact_id', ids).order('id').range(a, b), 'nudge_sent'),
      all<any>((a, b) => admin.from('messages').select('contact_id, step_key, project_id, jobs_ledger_id, who_user_id, body, at').in('contact_id', ids).not('step_key', 'is', null).order('id').range(a, b), 'step notes'),
      all<any>((a, b) => admin.from('messages').select('contact_id, direction, at, channel_id').in('contact_id', ids).order('at', { ascending: false }).order('id').range(a, b), 'messages'),
      all<any>((a, b) => admin.from('contact_owed').select('contact_id, done_at').in('contact_id', ids).is('done_at', null).order('id').range(a, b), 'contact_owed'),
      all<any>((a, b) => admin.from('contact_channels').select('id, contact_id, kind, value, opted_out_at, opted_out_by_box, created_at').in('contact_id', ids).eq('kind', 'phone').order('id').range(a, b), 'contact_channels'),
    ])
    got.holds.push(...holds)
    got.sent.push(...sent)
    got.notes.push(...notes)
    got.lines.push(...lines)
    got.owed.push(...owed)
    got.channels.push(...channels)
  }

  const [steps, quickReplies, uses, switchRow, offers] = await Promise.all([
    all<any>((a, b) => admin.from('flow_steps').select('*, flows!inner(kind)').order('id').range(a, b), 'flow_steps'),
    all<any>((a, b) => admin.from('quick_replies').select('id, text, for_kind, step_key, scope, added_by, added_at, removed_at').eq('scope', 'team').order('id').range(a, b), 'quick_replies'),
    all<any>((a, b) => admin.from('quick_reply_uses').select('quick_reply_id, user_id').order('id').range(a, b), 'quick_reply_uses'),
    admin.from('app_settings').select('value_text').eq('key', APP_SENDS_SETTING_KEY).maybeSingle(),
    // Every open offer, every kind: the planner keeps a step offered already, and the office's morning texts go today.
    all<OfferRow>(
      (a, b) =>
        admin
          .from('nudge_offers')
          .select('id, contact_id, step_key, bid_id, project_id, jobs_ledger_id, body, channel_id, prepared_by, send_on, by_user_id')
          .is('sent_at', null)
          .is('dismissed_at', null)
          .order('id')
          .range(a, b),
      'nudge_offers',
    ),
  ])
  if (switchRow.error) throw new Error(`app_settings: ${switchRow.error.message}`)
  const rows: NudgeRunRows = {
    contacts,
    flowRows: flowRows as NudgeRunRows['flowRows'],
    steps,
    ...got,
    quickReplies,
    uses,
    appSends: switchRow.data?.value_text ?? null,
    offers,
  }
  return { rows, customersHeld: customersHeld ?? 0, offers }
}

/** Who may ask for a dry run: the cron, or a signed-in dev on a real account. */
async function mayDryRun(req: Request, admin: any, supabaseUrl: string, cronOk: boolean): Promise<boolean> {
  if (cronOk) return true
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const auth = req.headers.get('Authorization')
  if (!anonKey || !auth) return false
  const caller = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: auth } } })
  const { data: u } = await caller.auth.getUser()
  if (!u?.user) return false
  const { data: who } = await admin.from('users').select('role, archived_at').match(REAL_ACCOUNT).eq('id', u.user.id).maybeSingle()
  return who?.role === 'dev' && !who.archived_at
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return json({ ok: false, error: 'POST only' }, 405)
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceRoleKey) return json({ ok: false, error: 'Not set up' }, 503)
    const admin = createClient(supabaseUrl, serviceRoleKey)

    const cronSecret = Deno.env.get('CRON_SECRET')
    const headerSecret = req.headers.get('X-Cron-Secret') ?? req.headers.get('x-cron-secret')
    const cronOk = Boolean(cronSecret) && headerSecret === cronSecret
    const body = (await req.json().catch(() => null)) as { dry?: unknown } | null
    const dry = body?.dry === true
    if (dry ? !(await mayDryRun(req, admin, supabaseUrl, cronOk)) : !cronOk) return json({ ok: false, error: 'Unauthorized' }, 401)

    const now = new Date()
    if (!dry && !runHourNow(now)) return json({ ok: true, ran: false, why: 'Not 9 AM Central. The other tick runs.' })

    const origin = (Deno.env.get('APP_ORIGIN') ?? 'https://clicktooling.com').replace(/\/$/, '')
    const [{ rows, customersHeld, offers }, kit] = await Promise.all([readRows(admin), loadWalkKit(admin)])
    const walkKitContactId = kit?.contactId ?? null
    const reads = nudgeRunReads(rows, now, { origin, walkKitContactId })
    const run = planNudgeRun(reads.input)
    const today = todayYmdInAppTz(now)
    /**
     * The column a person's job sits in (v2.6007): a residential customer's job is a Pipeline job (`jobs_ledger`), anyone
     * else's a GC project. The text's tie, its `nudge_sent` record, the thread's event line and an offer all file on it,
     * so the flow reads the text back on the job (`review_asked`) and the run never doubles the reminder.
     */
    const jobAtFor = (contactId: string, jobId: string | null): JobAt | null =>
      jobId ? { jobId, column: reads.input.people.find((p) => p.id === contactId)?.reading.kind === 'residential' ? 'jobs_ledger_id' : 'project_id' } : null
    const jobColumnsOf = (at: JobAt | null) => ({ project_id: at?.column === 'project_id' ? at.jobId : null, jobs_ledger_id: at?.column === 'jobs_ledger_id' ? at.jobId : null })
    // Customer reviews (v2.5943, punch list #185): a review text the app sends itself carries {rate} until its link is
    // minted here (`_shared/ratingMint.ts`, by `ratings/ratingAsk.ts`'s rule: a fresh unanswered ask to the same person
    // about the same job is reused); a job whose rating was answered already is kept back with why, its offer too since
    // v2.6007. An offer keeps the blank: Today's sends mints at the press (`offersIo.ts`'s `withRatingLink`, which keeps
    // an answered job back the same way), so an offer put away never counts as asked. A dry run mints nothing and shows
    // the blank.
    if (!dry) {
      const keptMint: NudgeKept[] = []
      const keepAnswered = async (list: NudgeOffer[]): Promise<NudgeOffer[]> => {
        const out: NudgeOffer[] = []
        for (const o of list) {
          if (needsRatingLink(o.body) && o.jobId && (await ratingAnswered(admin, o.jobId))) keptMint.push({ contactId: o.contactId, stepId: o.stepId, jobId: o.jobId, why: 'answered', words: notSentWords('answered') })
          else out.push(o)
        }
        return out
      }
      const withRatingLinks = async <T extends { contactId: string; stepId: string; jobId: string | null; body: string }>(list: T[]): Promise<T[]> => {
        const out: T[] = []
        for (const t of list) {
          if (!needsRatingLink(t.body)) {
            out.push(t)
            continue
          }
          const c = rows.contacts.find((x) => x.id === t.contactId)
          const mint = await mintRatingLink(admin, { contactId: t.contactId, jobId: t.jobId, name: (c?.goes_by ?? c?.name ?? '').trim(), origin })
          if ('url' in mint) out.push({ ...t, body: t.body.replace('{rate}', mint.url) })
          else keptMint.push({ contactId: t.contactId, stepId: t.stepId, jobId: t.jobId, why: 'answered', words: mint.refused === 'answered' ? notSentWords('answered') : `the rating link was not made (${mint.refused}${mint.detail ? `: ${mint.detail}` : ''})` })
        }
        return out
      }
      run.texts = await withRatingLinks(run.texts)
      run.offers = await keepAnswered(run.offers)
      run.notSent.push(...keptMint)
    }
    /** The texts the office prepared for this morning, or an earlier one that was missed, with a number to go to. Never the kit's. */
    const due = offers.filter((o) => o.prepared_by === 'office' && o.send_on !== null && o.send_on <= today && o.channel_id && o.contact_id !== walkKitContactId)

    if (dry) {
      const summary = runSummary({ run, sent: run.texts.length + due.length, refused: [], unread: reads.unread.length, customersHeld, prepared: run.offers.length, morningSent: due.length, now, dry: true })
      console.log(`[messages-nudge-dispatch] dry run: ${summary.words.join(' ')}`)
      return json({
        ok: true,
        dry: true,
        summary,
        texts: run.texts.map((t) => ({ contactId: t.contactId, stepId: t.stepId, jobId: t.jobId, body: t.body })),
        offers: run.offers.map((o) => ({ contactId: o.contactId, stepId: o.stepId, jobId: o.jobId, body: o.body, held: o.held })),
        morning: due.map((o) => ({ id: o.id, contactId: o.contact_id, stepId: o.step_key, body: o.body })),
        kept: run.notSent,
        unread: reads.unread,
      })
    }

    const company = quoCompany()
    const boxes = await loadBoxes(admin)
    const refused: RunRefused[] = []
    const problems: string[] = []
    /** Reminders kept back once their box is known: a STOP to that box (R6 keeps a STOP per box). */
    const keptAtSend: NudgeKept[] = []
    let sent = 0
    let textsOff = 0
    for (const [i, t] of run.texts.entries()) {
      const channelId = reads.channelIds[t.contactId] ?? null
      const channel = channelId ? rows.channels.find((c) => c.id === channelId) : null
      const tie = jobAtFor(t.contactId, t.jobId)
      // The box it goes from, as quo-send picks it: the one they last texted on this number, else their kind's, else
      // the company number's.
      let wroteTo: Mailbox | null = null
      if (channelId) {
        const { data: lastIn, error: lastInError } = await admin
          .from('messages')
          .select('mailbox')
          .eq('channel_id', channelId)
          .eq('direction', 'in')
          .not('mailbox', 'is', null)
          .order('at', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (lastInError) throw new Error(`messages: ${lastInError.message}`)
        wroteTo = ((lastIn as { mailbox: Mailbox } | null)?.mailbox ?? null) as Mailbox | null
      }
      const kind = rows.contacts.find((c) => c.id === t.contactId)?.kind ?? 'unknown'
      const box = sendBox(boxForReply(wroteTo, { kind }), boxes)
      const stops = { channelId: channelId ?? '', optedOutAt: channel?.opted_out_at ?? null, optedOutByBox: (channel as { opted_out_by_box?: Record<string, string | null> } | null)?.opted_out_by_box ?? {} }
      if (channelId && stoppedOn(stops, box)) {
        keptAtSend.push({ contactId: t.contactId, stepId: t.stepId, jobId: t.jobId, why: 'opted out', words: notSentWords('opted out') })
        continue
      }
      const out = await sendText(
        admin,
        {
          purpose: 'nudge',
          contactId: t.contactId,
          channelId,
          to: reads.input.numbers[t.contactId]?.number ?? null,
          optedOut: false,
          body: t.body,
          lastOurTextAt: channelId ? await lastOurTextAt(admin, channelId, box) : null,
          now: Date.now(),
          company,
          sender: null,
          jobId: t.jobId,
        },
        tie,
        box,
        boxes,
      )
      // Send texts off company-wide keeps every text back, not failed: this one and the rest are counted, not tried.
      if (!out.ok && out.refused === 'textsOff') {
        textsOff = run.texts.length - i
        break
      }
      if (!out.ok) {
        refused.push({ contactId: t.contactId, stepId: t.stepId, words: out.words })
        // Texts not set up refuses every one the same way: the rest are said once, not tried.
        if (out.refused === 'not-set-up') {
          for (const rest of run.texts.slice(i + 1)) refused.push({ contactId: rest.contactId, stepId: rest.stepId, words: out.words })
          break
        }
        continue
      }
      sent += 1
      const { error: sentError } = await admin.from('nudge_sent').insert({
        contact_id: t.contactId,
        step_key: t.stepId,
        ...jobColumnsOf(tie),
        how: t.record.how,
        sent_by: 'app',
        by_user_id: null,
        message_id: out.messageId,
        sent_at: t.record.at,
      })
      if (sentError) problems.push(`nudge_sent for ${t.contactId} ${t.stepId}: ${sentError.message}`)
      const { error: eventError } = await admin.from('messages').upsert(
        {
          contact_id: t.contactId,
          channel: 'event',
          direction: 'team',
          who_text: 'The app',
          body: t.event,
          ...jobColumnsOf(tie),
          quo_id: `nudge:${t.contactId}:${t.stepId}:${t.jobId ?? '-'}:${today}`,
        },
        { onConflict: 'quo_id', ignoreDuplicates: true },
      )
      if (eventError) problems.push(`event line for ${t.contactId} ${t.stepId}: ${eventError.message}`)
    }

    // The texts prepared for the office to press (v2.5595): one nudge_offers row each, for Today's sends on the Dashboard.
    // A retry the same morning writes nothing twice: the planner kept a step offered already from the open rows.
    let prepared = 0
    for (const o of run.offers) {
      const { error } = await admin.from('nudge_offers').insert({
        contact_id: o.contactId,
        step_key: o.stepId,
        ...jobColumnsOf(jobAtFor(o.contactId, o.jobId)),
        body: o.body,
        channel_id: o.held ? null : (reads.channelIds[o.contactId] ?? null),
        prepared_by: 'app',
        held_why: o.held,
      })
      if (error) problems.push(`nudge_offers for ${o.contactId} ${o.stepId}: ${error.message}`)
      else prepared += 1
    }

    // The texts the office prepared for this morning (Send in the morning): sent as the office's own, through the same
    // path, from the box quo-send would pick; stamped on the row, recorded in nudge_sent and said in the thread. One Quo
    // turned away is held on Today's sends with Quo's words, so the office sees it instead of the run retrying each morning.
    let morningSent = 0
    if (textsOff) textsOff += due.length
    else {
      const dueKinds = new Map<string, string>()
      if (due.length) {
        const { data: kindRows, error: kindError } = await admin.from('contacts').select('id, kind').in('id', [...new Set(due.map((o) => o.contact_id))])
        if (kindError) throw new Error(`contacts: ${kindError.message}`)
        for (const c of (kindRows ?? []) as Array<{ id: string; kind: string }>) dueKinds.set(c.id, c.kind)
      }
      for (const [k, o] of due.entries()) {
        const { data: channel, error: channelError } = await admin.from('contact_channels').select('id, value, opted_out_at, opted_out_by_box').eq('id', o.channel_id).maybeSingle()
        if (channelError) throw new Error(`contact_channels: ${channelError.message}`)
        const hold = async (why: string) => {
          const { error } = await admin.from('nudge_offers').update({ held_why: why, send_on: null }).eq('id', o.id)
          if (error) problems.push(`nudge_offers ${o.id}: ${error.message}`)
        }
        if (!channel) {
          await hold('The number it was going to is gone. Pick another, or call instead.')
          continue
        }
        const { data: lastIn, error: lastInError } = await admin
          .from('messages')
          .select('mailbox')
          .eq('channel_id', o.channel_id)
          .eq('direction', 'in')
          .not('mailbox', 'is', null)
          .order('at', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (lastInError) throw new Error(`messages: ${lastInError.message}`)
        const box = sendBox(boxForReply(((lastIn as { mailbox: Mailbox } | null)?.mailbox ?? null) as Mailbox | null, { kind: dueKinds.get(o.contact_id) ?? 'unknown' }), boxes)
        const stops = { channelId: o.channel_id!, optedOutAt: channel.opted_out_at ?? null, optedOutByBox: (channel as { opted_out_by_box?: Record<string, string | null> }).opted_out_by_box ?? {} }
        if (stoppedOn(stops, box)) {
          await hold('The number sent STOP. Call instead.')
          continue
        }
        const at = jobAtOf(o)
        const out = await sendText(
          admin,
          {
            purpose: 'nudge',
            contactId: o.contact_id,
            channelId: o.channel_id,
            to: channel.value,
            optedOut: false,
            body: o.body,
            lastOurTextAt: await lastOurTextAt(admin, o.channel_id!, box),
            now: Date.now(),
            company,
            sender: null,
            jobId: at?.jobId ?? null,
          },
          at,
          box,
          boxes,
        )
        if (!out.ok && out.refused === 'textsOff') {
          textsOff += due.length - k
          break
        }
        if (!out.ok) {
          refused.push({ contactId: o.contact_id, stepId: o.step_key, words: out.words })
          await hold(out.words)
          if (out.refused === 'not-set-up') {
            for (const rest of due.slice(k + 1)) refused.push({ contactId: rest.contact_id, stepId: rest.step_key, words: out.words })
            break
          }
          continue
        }
        morningSent += 1
        sent += 1
        const { error: offerError } = await admin.from('nudge_offers').update({ sent_at: now.toISOString(), message_id: out.messageId }).eq('id', o.id)
        if (offerError) problems.push(`nudge_offers ${o.id}: ${offerError.message}`)
        const { error: sentError } = await admin.from('nudge_sent').insert({
          contact_id: o.contact_id,
          step_key: o.step_key,
          bid_id: o.bid_id,
          project_id: o.project_id,
          jobs_ledger_id: o.jobs_ledger_id,
          how: 'text',
          sent_by: 'person',
          by_user_id: o.by_user_id,
          message_id: out.messageId,
          sent_at: now.toISOString(),
        })
        if (sentError) problems.push(`nudge_sent for offer ${o.id}: ${sentError.message}`)
        const { error: eventError } = await admin.from('messages').upsert(
          {
            contact_id: o.contact_id,
            channel: 'event',
            direction: 'team',
            who_text: 'The app',
            body: 'The app sent the text the office prepared for this morning.',
            bid_id: o.bid_id,
            project_id: o.project_id,
            jobs_ledger_id: o.jobs_ledger_id,
            quo_id: `nudge:offer:${o.id}`,
          },
          { onConflict: 'quo_id', ignoreDuplicates: true },
        )
        if (eventError) problems.push(`event line for offer ${o.id}: ${eventError.message}`)
      }
    }

    const summary = runSummary({ run: { ...run, notSent: [...run.notSent, ...keptAtSend] }, sent, refused, textsOff, unread: reads.unread.length, customersHeld, prepared, morningSent, now, dry: false })
    const { error: lastError } = await admin
      .from('app_settings')
      .upsert({ key: APP_SETTINGS_KEY_MESSAGES_NUDGE_LAST_RUN_V1, value_text: JSON.stringify(summary) }, { onConflict: 'key' })
    if (lastError) problems.push(`app_settings: ${lastError.message}`)
    for (const p of problems) console.error(`[messages-nudge-dispatch] ${p}`)
    console.log(`[messages-nudge-dispatch] ${summary.words.join(' ')}`)
    return json({ ok: problems.length === 0, ran: true, summary, problems })
  } catch (e) {
    console.error('[messages-nudge-dispatch]', e)
    return json({ ok: false, error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
