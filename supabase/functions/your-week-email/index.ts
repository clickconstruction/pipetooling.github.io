/**
 * your-week-email (v2.6607, punch list #255): the Monday email of Your week. On Monday at 6 AM Central the run reads
 * each person the office picked a signal for (`users.week_signal`, a real account with an address, not archived),
 * builds last week's card for them (`week_card_data`, the read `my_week()` makes, as the service role; `weekEmailFor`
 * from the copy of the kernels), and mails it to their own address. Nobody else, and nothing to a person with no card.
 *
 * Modes on the POST:
 * - the cron (no body, or `{}`): X-Cron-Secret. The cron fires at 11:00 and 12:00 UTC on Mondays and posts only while
 *   the switch `app_settings` `your_week_email_on_v1` reads 'true'; the function checks the switch again, runs only the
 *   tick that is 6 AM Central (`weeklySendTickNow`), and sends nothing twice on one day (`alreadySentToday`, from the
 *   last run it keeps in `your_week_email_last_run_v1`).
 * - `{ "dry": true }`: the cron secret, or a signed-in real account. Any hour, switch on or off. Answers the caller's
 *   own email for last week (`mine`) and, for a dev, the recipients; sends nothing and writes nothing.
 * - `{ "test": true }`: a signed-in real account. Sends the caller their own last week's card, `[TEST]` before the
 *   subject, logged as `your_week_email_test`; the switch is not read and no run is kept.
 *
 * Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY (the signed-in modes), RESEND_API_KEY,
 * CRON_SECRET, APP_ORIGIN (the card's link to the home). config.toml keeps verify_jwt = false: the cron sends no JWT.
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { REAL_ACCOUNT } from '../_shared/realAccount.ts'
import { sendEmailViaResend } from '../_shared/resendSendEmail.ts'
import { isArchivedCaller } from '../_shared/refuseArchivedCaller.ts'
import { YOUR_WEEK_EMAIL_LAST_RUN_KEY, YOUR_WEEK_EMAIL_ON_KEY, YOUR_WEEK_EMAIL_TYPE, weekEmailFor, weekEmailRecipients, type WeekEmail } from '../_shared/gcKernels/lib/techWeek/weekEmail.ts'
import { alreadySentToday, parseWeeklySendRun, weeklySendTickNow, weeklySheetIsOn, type WeeklySendRun } from '../_shared/gcKernels/lib/bridge/weeklySend.ts'
import { previousCompletePayWeek } from '../_shared/gcKernels/lib/payWeekAnchor.ts'
import { todayYmdInAppTz } from '../_shared/gcKernels/utils/dateUtils.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
}

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

// deno-lint-ignore no-explicit-any
type Admin = SupabaseClient<any>

type Caller = { id: string; email: string; role: string }

/** The signed-in caller on a real, unarchived account; null for anyone else. */
async function callerOf(req: Request, admin: Admin, supabaseUrl: string): Promise<Caller | null> {
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const auth = req.headers.get('Authorization')
  if (!anonKey || !auth) return null
  const client = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: auth } } })
  const { data: u } = await client.auth.getUser()
  if (!u?.user) return null
  if (await isArchivedCaller(admin, u.user.id)) return null
  const { data: who } = await admin.from('users').select('id, email, role, archived_at').match(REAL_ACCOUNT).eq('id', u.user.id).maybeSingle()
  if (!who || who.archived_at || !who.email) return null
  return { id: who.id, email: String(who.email), role: String(who.role ?? '') }
}

async function emailFor(admin: Admin, userId: string, week: { start: string; end: string }, url: string, now: Date): Promise<WeekEmail | null> {
  const { data, error } = await admin.rpc('week_card_data', { p_user_id: userId })
  if (error) throw new Error(`week_card_data: ${error.message}`)
  return weekEmailFor(data, week, url, now)
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return json({ ok: false, error: 'POST only' }, 405)
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceRoleKey) return json({ ok: false, error: 'Not set up' }, 503)
    const admin: Admin = createClient(supabaseUrl, serviceRoleKey, { db: { schema: 'public' } })

    const cronSecret = Deno.env.get('CRON_SECRET')
    const headerSecret = req.headers.get('X-Cron-Secret') ?? req.headers.get('x-cron-secret')
    const cronOk = Boolean(cronSecret) && headerSecret === cronSecret
    const body = (await req.json().catch(() => null)) as { dry?: unknown; test?: unknown } | null
    const dry = body?.dry === true
    const test = body?.test === true
    const caller = dry || test ? await callerOf(req, admin, supabaseUrl) : null
    if ((dry && !(cronOk || caller)) || (test && !caller) || (!dry && !test && !cronOk)) return json({ ok: false, error: 'Unauthorized' }, 401)

    const now = new Date()
    const today = todayYmdInAppTz(now)
    const week = previousCompletePayWeek(now)
    const origin = (Deno.env.get('APP_ORIGIN') ?? 'https://clicktooling.com').replace(/\/$/, '')
    const url = `${origin}/dashboard`

    if (test && caller) {
      const mine = await emailFor(admin, caller.id, week, url, now)
      if (!mine) return json({ ok: false, error: 'No card for you yet: the office has not picked your signal, or it has nothing to read.' }, 400)
      const resendApiKey = Deno.env.get('RESEND_API_KEY')
      if (!resendApiKey) return json({ ok: false, error: 'RESEND_API_KEY not configured' }, 500)
      const res = await sendEmailViaResend(caller.email, `[TEST] ${mine.subject}`, mine.text, mine.html, resendApiKey, { emailType: `${YOUR_WEEK_EMAIL_TYPE}_test` })
      if (!res.success) return json({ ok: false, error: res.error || 'Send failed' }, 502)
      return json({ ok: true, test: true, to: caller.email, subject: mine.subject })
    }

    const { data: settingRows, error: settingError } = await admin.from('app_settings').select('key, value_text').in('key', [YOUR_WEEK_EMAIL_ON_KEY, YOUR_WEEK_EMAIL_LAST_RUN_KEY])
    if (settingError) throw new Error(`app_settings: ${settingError.message}`)
    const setting = (key: string) => settingRows?.find((r: { key: string; value_text: string | null }) => r.key === key)?.value_text ?? null
    const on = weeklySheetIsOn(setting(YOUR_WEEK_EMAIL_ON_KEY))
    const lastRun = parseWeeklySendRun(setting(YOUR_WEEK_EMAIL_LAST_RUN_KEY))
    if (!dry) {
      if (!on) return json({ ok: true, ran: false, why: 'The Monday email is off.' })
      if (!weeklySendTickNow(now)) return json({ ok: true, ran: false, why: 'Not Monday 6 AM Central. The other tick runs.' })
      if (alreadySentToday(lastRun, today)) return json({ ok: true, ran: false, why: `The email went today already, to ${lastRun?.sent.length ?? 0}.` })
    }

    // Who hears it: everyone with a signal on a real, unarchived account with an address.
    const { data: userRows, error: usersError } = await admin.from('users').select('id, name, email, week_signal, archived_at, is_sample, is_digital_twin, is_walk_tester').not('week_signal', 'is', null)
    if (usersError) throw new Error(`users: ${usersError.message}`)
    const to = weekEmailRecipients(userRows ?? [])

    if (dry) {
      const mine = caller ? await emailFor(admin, caller.id, week, url, now) : null
      return json({ ok: true, dry: true, on, week, to: caller?.role === 'dev' || cronOk ? to.map((r) => ({ name: r.name, email: r.email })) : undefined, mine, lastRun })
    }

    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (!resendApiKey) return json({ ok: false, error: 'RESEND_API_KEY not configured' }, 500)
    const sent: string[] = []
    const failed: Array<{ to: string; error: string }> = []
    const skipped: string[] = []
    for (const r of to) {
      try {
        const mail = await emailFor(admin, r.id, week, url, now)
        if (!mail) {
          skipped.push(r.email)
          continue
        }
        const res = await sendEmailViaResend(r.email, mail.subject, mail.text, mail.html, resendApiKey, { emailType: YOUR_WEEK_EMAIL_TYPE })
        if (res.success) sent.push(r.email)
        else failed.push({ to: r.email, error: res.error || 'Send failed' })
      } catch (e) {
        failed.push({ to: r.email, error: e instanceof Error ? e.message : String(e) })
      }
    }
    const run: WeeklySendRun = { at: now.toISOString(), day: today, dry: false, sent, failed, gaps: skipped, subject: `Your week, ${week.start} to ${week.end}` }
    const { error: writeError } = await admin.from('app_settings').upsert({ key: YOUR_WEEK_EMAIL_LAST_RUN_KEY, value_text: JSON.stringify(run) }, { onConflict: 'key' })
    if (writeError) console.error(`[your-week-email] last run not kept: ${writeError.message}`)
    console.log(`[your-week-email] sent to ${sent.length}, failed ${failed.length}, no card ${skipped.length}`)
    return json({ ok: true, ran: true, sent, failed, skipped })
  } catch (e) {
    console.error('[your-week-email]', e)
    return json({ ok: false, error: e instanceof Error ? e.message : 'Unexpected error' }, 500)
  }
})
