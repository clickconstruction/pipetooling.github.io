/**
 * gmail-count: Quickfill's Email station (punch list #159, PR 2 of 5, v2.5820). The COUNTER beside the taker
 * (`gmail-sync`): for each box on `email_box_watch` that is on, and each label the row names, it reads Gmail as that
 * mailbox under the service account's domain-wide delegation with the metadata-only scope (`gmail.metadata`: labels,
 * counts, thread ids, dates and the headers From, Subject and Date; Google refuses a body, an attachment and a `q`
 * search under it) and keeps:
 *   - `email_box_threads`: one row per thread in the label (when it arrived, its last activity, who wrote first, the
 *     subject, first and last seen, gone when a sweep no longer finds it);
 *   - `email_box_days`: the day's row of the trend (how many sat, the oldest's age, what came, what cleared);
 *   - on the watch row: the sweep's health and `labels_state`, what it found per label (Gmail's exact total, how many
 *     the rows hold, whether the listing was cut short, whether the label is missing).
 * It writes nothing to Gmail: no label, no archive, no read mark.
 *
 * Two doors:
 *   - the cron, every 15 minutes with X-Cron-Secret (`20261024160000_email_box_count.sql`), while the switch
 *     `app_settings.email_count_on_v1` reads 'true': every box that is on, one after another, each its own try;
 *   - Read again from the station: a signed-in office member posts `{ watch_id }` with their JWT; the box is swept
 *     now when they may see it (`email_box_can_see`) and it was not swept in the last minute.
 *
 * One sweep of a label: `labels.list` finds the label (the Inbox by its system id, a named label exact then
 * case-blind; a missing one is written as such and the other labels still count); `labels.get` gives the exact
 * thread count; `threads.list` by label id lists up to SWEEP_PAGE_CAP pages of 100, newest first; a thread the rows
 * do not hold open is read with `threads.get` format=metadata (at most FETCH_CAP a sweep, the rest next time, under
 * Gmail's 6,000 units a minute per user); open rows the complete listing no longer returns are marked gone.
 * The pure part is `src/lib/emailIn/labelSweep.ts` and `countedBoxes.ts`, mirrored into `_shared/gcKernels`.
 *
 * Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY, CRON_SECRET, GOOGLE_SERVICE_ACCOUNT_JSON (the
 * reader's, now also granted gmail.metadata on the Workspace). config.toml keeps verify_jwt = false: the cron sends no
 * JWT, and the press is checked in the body.
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { GMAIL_METADATA_SCOPES, GmailError, gmailLabelCounts, gmailLabels, gmailThread, gmailThreadsByLabel } from '../_shared/gmail.ts'
import { googleServiceToken } from '../_shared/googleToken.ts'
import { countedBoxes, findLabel, type CountedBox, type GmailLabel, type WatchRow } from '../_shared/gcKernels/lib/emailIn/countedBoxes.ts'
import { dayRow, planSweep, SWEEP_PAGE_CAP, threadSeen, type TrendThread } from '../_shared/gcKernels/lib/emailIn/labelSweep.ts'
import { calendarYmdInAppTzFromIso } from '../_shared/gcKernels/utils/dateUtils.ts'

const SWITCH_KEY = 'email_count_on_v1'
/** The most threads one sweep reads whole per label: 40 units each under Gmail's 6,000 a minute per user. */
const FETCH_CAP = 100
/** A press within this of the last sweep answers with what the last sweep found. */
const PRESS_FLOOR_MS = 60_000
const CHUNK = 100

// deno-lint-ignore no-explicit-any
type Admin = any

/** What the last sweep found for one label, as `labels_state` keeps it. */
interface LabelState {
  at: string
  total?: number | null
  listed?: number
  cut?: boolean
  missing?: boolean
  error?: string
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

const nowIso = () => new Date().toISOString()

async function rows<T>(query: Promise<{ data: T[] | null; error: { message: string } | null }>, what: string): Promise<T[]> {
  const { data, error } = await query
  if (error) throw new Error(`Reading ${what} failed: ${error.message}`)
  return data ?? []
}

async function must(query: Promise<{ error: { message: string } | null }>, what: string): Promise<void> {
  const { error } = await query
  if (error) throw new Error(`${what} failed: ${error.message}`)
}

const chunks = <T>(list: readonly T[], size: number): T[][] => {
  const out: T[][] = []
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size))
  return out
}

interface KnownRow {
  gmail_thread_id: string
  gone_at: string | null
}

/** One label of one box: list, fetch the new, keep the still, mark the gone, write the day's row. */
async function sweepLabel(admin: Admin, token: string, box: CountedBox, name: string, labels: readonly GmailLabel[], at: string): Promise<LabelState> {
  const label = findLabel(name, labels)
  if (!label) return { at, missing: true }

  const counts = await gmailLabelCounts(token, label.id)
  const total = typeof counts.threadsTotal === 'number' ? counts.threadsTotal : null

  const listed: string[] = []
  let pageToken: string | undefined
  let pages = 0
  let cut = false
  do {
    const page = await gmailThreadsByLabel(token, label.id, pageToken)
    for (const t of page.threads ?? []) listed.push(t.id)
    pageToken = page.nextPageToken
    pages++
    if (pageToken && pages >= SWEEP_PAGE_CAP) {
      cut = true
      break
    }
  } while (pageToken)

  const known = await rows<KnownRow>(admin.from('email_box_threads').select('gmail_thread_id, gone_at').eq('watch_id', box.watchId).eq('label_name', name), `${box.words} ${name}'s rows`)
  const plan = planSweep(listed, known.map((k) => ({ gmailThreadId: k.gmail_thread_id, gone: !!k.gone_at })), !cut)

  // The new and the returned, read whole: at most FETCH_CAP a sweep; the next sweep takes the rest.
  const fresh: Record<string, unknown>[] = []
  for (const id of plan.fetch.slice(0, FETCH_CAP)) {
    let meta
    try {
      meta = await gmailThread(token, id)
    } catch (e) {
      if (e instanceof GmailError && e.status === 404) continue
      throw e
    }
    const seen = threadSeen(meta)
    fresh.push({
      watch_id: box.watchId,
      label_name: name,
      gmail_thread_id: seen.gmailThreadId,
      arrived_at: seen.arrivedAt,
      last_at: seen.lastAt,
      from_name: seen.fromName,
      from_address: seen.fromAddress,
      subject: seen.subject,
      first_seen_at: at,
      last_seen_at: at,
      gone_at: null,
    })
  }
  for (const part of chunks(fresh, CHUNK)) await must(admin.from('email_box_threads').upsert(part, { onConflict: 'watch_id,label_name,gmail_thread_id' }), `Writing ${box.words} ${name}'s threads`)
  for (const part of chunks(plan.still, CHUNK)) await must(admin.from('email_box_threads').update({ last_seen_at: at }).eq('watch_id', box.watchId).eq('label_name', name).in('gmail_thread_id', part), `Keeping ${box.words} ${name}'s threads`)
  for (const part of chunks(plan.gone, CHUNK)) await must(admin.from('email_box_threads').update({ gone_at: at }).eq('watch_id', box.watchId).eq('label_name', name).is('gone_at', null).in('gmail_thread_id', part), `Clearing ${box.words} ${name}'s threads`)

  // The day's row of the trend: the open rows and the ones gone in the last two days are enough to count the day.
  const twoDaysAgo = new Date(new Date(at).getTime() - 2 * 86_400_000).toISOString()
  const trend = await rows<{ arrived_at: string | null; first_seen_at: string; gone_at: string | null }>(
    admin.from('email_box_threads').select('arrived_at, first_seen_at, gone_at').eq('watch_id', box.watchId).eq('label_name', name).or(`gone_at.is.null,gone_at.gte.${twoDaysAgo}`),
    `${box.words} ${name}'s trend`,
  )
  const threads: TrendThread[] = trend.map((r) => ({ arrivedAt: r.arrived_at, firstSeenAt: r.first_seen_at, goneAt: r.gone_at }))
  const day = dayRow(threads, at)
  const open = threads.filter((t) => !t.goneAt).length
  await must(
    admin.from('email_box_days').upsert(
      { watch_id: box.watchId, label_name: name, day: calendarYmdInAppTzFromIso(at), count: total ?? day.count, oldest_days: day.oldestDays, new_count: day.newCount, cleared_count: day.clearedCount, updated_at: at },
      { onConflict: 'watch_id,label_name,day' },
    ),
    `Writing ${box.words} ${name}'s day`,
  )
  return { at, total, listed: open, cut }
}

/** One box's sweep: its token, its labels, each label its own try, its health written. */
async function runBox(admin: Admin, saJson: string, box: CountedBox): Promise<Record<string, unknown>> {
  const at = nowIso()
  await must(admin.from('email_box_watch').update({ last_run_at: at }).eq('id', box.watchId), `Starting ${box.words}`)
  const state: Record<string, LabelState> = {}
  let firstError: string | null = null
  try {
    const token = await googleServiceToken(saJson, GMAIL_METADATA_SCOPES, box.address)
    const labels = (await gmailLabels(token)).labels ?? []
    for (const name of box.labels) {
      try {
        state[name] = await sweepLabel(admin, token, box, name, labels, at)
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e)
        state[name] = { at, error: message.slice(0, 500) }
        firstError = firstError ?? `${name}: ${message}`
        // Gmail's rate limit: the rest of this box waits for the next sweep.
        if (e instanceof GmailError && e.status === 429) break
      }
    }
  } catch (e) {
    firstError = e instanceof Error ? e.message : String(e)
  }
  await must(
    admin.from('email_box_watch').update({ labels_state: state, last_error: firstError ? firstError.slice(0, 1000) : null, ...(firstError ? {} : { last_ok_at: nowIso() }) }).eq('id', box.watchId),
    `Finishing ${box.words}`,
  )
  if (firstError) throw new Error(firstError)
  return { ok: true, labels: state }
}

/** Every box that is on (or the one asked for), each on its own: one that fails leaves the others counted. */
async function run(admin: Admin, only?: string): Promise<{ ok: boolean; boxes: Record<string, unknown> }> {
  const saJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON')
  if (!saJson) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON must be set.')
  let query = admin.from('email_box_watch').select('id, user_id, address, labels, is_on').eq('is_on', true).order('created_at', { ascending: true })
  if (only) query = query.eq('id', only)
  const watch = await rows<WatchRow>(query, 'the counted boxes')
  const out: Record<string, unknown> = {}
  let ok = true
  for (const box of countedBoxes(watch)) {
    try {
      out[box.words] = await runBox(admin, saJson, box)
    } catch (e) {
      ok = false
      console.error(`gmail-count ${box.words}`, e)
      out[box.words] = { ok: false, error: e instanceof Error ? e.message : String(e) }
    }
  }
  return { ok, boxes: out }
}

serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: setting } = await admin.from('app_settings').select('value_text').eq('key', SWITCH_KEY).maybeSingle()
    const on = setting?.value_text === 'true'

    const cronSecret = Deno.env.get('CRON_SECRET')
    const headerSecret = req.headers.get('X-Cron-Secret') ?? req.headers.get('x-cron-secret')
    if (cronSecret && headerSecret === cronSecret) {
      if (!on) return jsonResponse({ ok: true, off: true })
      const result = await run(admin)
      return jsonResponse(result, result.ok ? 200 : 500)
    }

    // Read again, from the station: a signed-in office member, for one box they may see, at most once a minute.
    const authorization = req.headers.get('Authorization') ?? ''
    if (!authorization.toLowerCase().startsWith('bearer ')) return jsonResponse({ error: 'Unauthorized' }, 401)
    const caller = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authorization } } })
    const { data: u } = await caller.auth.getUser()
    if (!u?.user) return jsonResponse({ error: 'Sign in to read a box again.' }, 401)
    const body = await req.json().catch(() => null)
    const watchId = typeof body?.watch_id === 'string' ? body.watch_id : ''
    if (!watchId) return jsonResponse({ error: 'Say which box: { watch_id }.' }, 400)
    if (!on) return jsonResponse({ ok: false, off: true, error: 'Counting mail is switched off in Settings.' }, 409)
    const { data: may, error: mayErr } = await caller.rpc('email_box_can_see', { p_watch: watchId })
    if (mayErr || may !== true) return jsonResponse({ error: 'That box is not yours to read.' }, 403)
    const { data: w } = await admin.from('email_box_watch').select('id, last_run_at, is_on').eq('id', watchId).maybeSingle()
    if (!w?.is_on) return jsonResponse({ ok: false, error: 'That box is switched off.' }, 409)
    if (w.last_run_at && Date.now() - new Date(w.last_run_at).getTime() < PRESS_FLOOR_MS) return jsonResponse({ ok: true, recent: true, last_run_at: w.last_run_at })
    const result = await run(admin, watchId)
    return jsonResponse(result, result.ok ? 200 : 500)
  } catch (e) {
    console.error('gmail-count', e)
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
