// watch-notify-dispatch: tells the people on a watch's list what the watched person did with the
// material on site. Cron only (X-Cron-Secret), every five minutes; no signed-in caller reaches it.
//
// For each live watch with someone on its list (person_watches.tell_user_ids) it reads, with the
// service role, what the watched person did since the watch began (three days back at most): their
// ledger rows, the boxes they moved, retired, brought back, edited or renamed, and the part ties and
// site prices they took off. The words and the choice of what to send are _shared/watchNotice.ts:
// the first act of the day, acts outside the process (several in one push), and the day's count
// after the evening hour. A notice's key is written to person_watch_notices BEFORE its push goes, and
// a key already there is skipped, so two runs never send one notice twice. A push that then fails is
// logged and is not sent again: a missed alert is cheaper than a phone that buzzes every five minutes.
//
// The push goes through a person's Push me hours (_shared/pushHoursSend.ts), like every other push.
// Nothing here reaches the watched person, and nothing here writes to the ledger.
//
// Secrets used: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CRON_SECRET, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { APP_CALENDAR_TZ, calendarYmdInAppTzFromIso, todayYmdInAppTz } from '../_shared/appTimeZone.ts'
import { sendPushHonouringHours } from '../_shared/pushHoursSend.ts'
import { webPushSender } from '../_shared/webPushSend.ts'
import { watchNoticeKeys, watchNotices, type WatchAct, type WatchActKind } from '../_shared/watchNotice.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

/** How far back a run reads, whatever the watch's age: a watch set long ago does not read its whole past every five minutes. */
const READ_BACK_DAYS = 3

type Watch = { id: string; user_id: string; tell_user_ids: string[] | null; set_at: string }
type Row = Record<string, unknown>

const text = (v: unknown): string => (typeof v === 'string' ? v : '')

/** The hour of the company's day now, 0 to 23. */
function hourInAppTz(now: Date): number {
  const h = new Intl.DateTimeFormat('en-US', { timeZone: APP_CALENDAR_TZ, hour: 'numeric', hourCycle: 'h23' }).format(now)
  const n = Number(h)
  return Number.isFinite(n) ? n % 24 : 0
}

// deno-lint-ignore no-explicit-any
async function rowsOf(admin: any, table: string, cols: string, userId: string, since: string, timeCol = 'at'): Promise<Row[]> {
  const { data, error } = await admin.from(table).select(cols).eq('by_user_id', userId).gte(timeCol, since).order(timeCol, { ascending: true }).limit(1000)
  if (error) {
    console.error(`watch-notify-dispatch: ${table} read failed: ${error.message}`)
    return []
  }
  return (data ?? []) as Row[]
}

// deno-lint-ignore no-explicit-any
async function actsOf(admin: any, userId: string, since: string): Promise<{ acts: WatchAct[]; jobId: string | null }> {
  const [moves, boxMoves, changes, names, removed] = await Promise.all([
    rowsOf(admin, 'job_material_movements', 'id, job_id, part_name, quantity, reason, from_container_id, to_container_id, note, at', userId, since),
    rowsOf(admin, 'job_container_moves', 'id, container_id, at', userId, since),
    rowsOf(admin, 'job_container_changes', 'id, container_id, what, at', userId, since),
    rowsOf(admin, 'job_container_names', 'id, container_id, at', userId, since),
    rowsOf(admin, 'on_site_removed_answers', 'id, answer, job_id, was, at', userId, since),
  ])

  const boxIds = new Set<string>()
  for (const m of moves) for (const id of [text(m.from_container_id), text(m.to_container_id)]) if (id) boxIds.add(id)
  for (const r of [...boxMoves, ...changes, ...names]) if (text(r.container_id)) boxIds.add(text(r.container_id))
  const label = new Map<string, string>()
  if (boxIds.size > 0) {
    const { data, error } = await admin.from('job_containers').select('id, label').in('id', [...boxIds].slice(0, 500))
    if (error) console.error(`watch-notify-dispatch: job_containers read failed: ${error.message}`)
    for (const c of (data ?? []) as Row[]) label.set(text(c.id), text(c.label))
  }
  const box = (id: unknown): string => label.get(text(id)) ?? ''
  const day = (at: string): string => calendarYmdInAppTzFromIso(at)

  const acts: WatchAct[] = []
  for (const m of moves) {
    const at = text(m.at)
    acts.push({ id: text(m.id), kind: text(m.reason) as WatchActKind, at, day: day(at), part: text(m.part_name), quantity: Number(m.quantity) || 0, box: box(m.from_container_id ?? m.to_container_id), note: text(m.note) })
  }
  const boxAct = (r: Row, kind: WatchActKind): WatchAct => ({ id: text(r.id), kind, at: text(r.at), day: day(text(r.at)), part: '', quantity: 0, box: box(r.container_id), note: '' })
  for (const r of boxMoves) acts.push(boxAct(r, 'box_moved'))
  for (const r of names) acts.push(boxAct(r, 'box_renamed'))
  for (const r of changes) acts.push(boxAct(r, text(r.what) === 'retired' ? 'box_retired' : text(r.what) === 'brought_back' ? 'box_brought_back' : 'box_changed'))
  for (const r of removed) {
    const was = (r.was ?? {}) as Row
    const at = text(r.at)
    acts.push({ id: text(r.id), kind: 'answer_removed', at, day: day(at), part: text(was.row_name) || [text(was.a_name), text(was.b_name)].filter(Boolean).join(' and '), quantity: 0, box: '', note: '' })
  }
  const firstJob = moves.length > 0 ? text(moves[moves.length - 1]?.job_id) : ''
  return { acts, jobId: firstJob || null }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const cronSecret = Deno.env.get('CRON_SECRET')
    const headerSecret = req.headers.get('X-Cron-Secret') ?? req.headers.get('x-cron-secret')
    if (!cronSecret || headerSecret !== cronSecret) return jsonResponse({ error: 'Unauthorized' }, 401)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceRole) return jsonResponse({ error: 'Server not configured' }, 500)
    const admin = createClient(supabaseUrl, serviceRole)

    const { data: watchRows, error: watchError } = await admin.from('person_watches').select('id, user_id, tell_user_ids, set_at').is('lifted_at', null).limit(200)
    if (watchError) return jsonResponse({ error: watchError.message }, 500)
    const watches = ((watchRows ?? []) as Watch[]).filter((w) => (w.tell_user_ids ?? []).length > 0)
    if (watches.length === 0) return jsonResponse({ watches: 0, sent: 0 })

    const now = new Date()
    const today = todayYmdInAppTz(now)
    const hour = hourInAppTz(now)
    const floor = new Date(now.getTime() - READ_BACK_DAYS * 86_400_000).toISOString()
    const sender = webPushSender(admin, 'watch-notify-dispatch')
    let sent = 0
    let skipped = 0

    for (const w of watches) {
      const since = w.set_at > floor ? w.set_at : floor
      const [{ acts, jobId }, person, sentRows] = await Promise.all([
        actsOf(admin, w.user_id, since),
        admin.from('users').select('name').eq('id', w.user_id).maybeSingle(),
        admin.from('person_watch_notices').select('key').eq('watch_id', w.id).limit(5000),
      ])
      if (acts.length === 0) continue
      const name = text((person.data as Row | null)?.name).trim().split(/\s+/)[0] || 'A watched person'

      let site = ''
      let url = '/materials?tab=on-site'
      if (jobId) {
        const { data: job } = await admin.from('jobs_ledger').select('development_id').eq('id', jobId).maybeSingle()
        const developmentId = text((job as Row | null)?.development_id)
        if (developmentId) {
          const { data: dev } = await admin.from('developments').select('name').eq('id', developmentId).maybeSingle()
          site = text((dev as Row | null)?.name)
          url = `/materials?tab=on-site&site=${developmentId}`
        }
      }

      const already = new Set(((sentRows.data ?? []) as Row[]).map((r) => text(r.key)))
      const notices = watchNotices({ watchId: w.id, name, site, acts, sent: already, today, hour })
      for (const n of notices) {
        // The keys go in first: a key that is already there means another run has this notice.
        const keys = watchNoticeKeys(n)
        const { error: keyError } = await admin.from('person_watch_notices').insert(keys.map((key) => ({ watch_id: w.id, key, kind: n.kind, day: n.day, title: n.title, body: n.body, told: w.tell_user_ids ?? [] })))
        if (keyError) {
          skipped += 1
          continue
        }
        try {
          await sendPushHonouringHours(admin, { userIds: w.tell_user_ids ?? [], title: n.title, body: n.body, url, tag: n.tag, templateType: 'watch_notice' }, sender)
          sent += 1
        } catch (e) {
          console.error(`watch-notify-dispatch: push failed for ${n.key}: ${e instanceof Error ? e.message : String(e)}`)
        }
      }
    }
    return jsonResponse({ watches: watches.length, sent, skipped })
  } catch (e) {
    console.error('watch-notify-dispatch error', e)
    return jsonResponse({ error: e instanceof Error ? e.message : 'Internal error' }, 500)
  }
})
