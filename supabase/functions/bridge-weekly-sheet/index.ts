/**
 * bridge-weekly-sheet (v2.5883): the weekly send of the Bridge's Monday sheet. On Monday at 6 AM Central the run
 * builds the sheet the page shows (`buildSheetFromReads` over `loadMondaySheetReads`, the copy of the kernels, the
 * same reads the page makes, as the service role) and mails it to every dev with a real account, each to their own
 * address, and never to anyone else (`weeklySendRecipients`). The bank is read from Mercury with the API key
 * (`_shared/mercuryAccounts.ts`), as `get-mercury-account-balances` reads it; ZZ test jobs stay out, as they do for
 * a dev who has not chosen to show them.
 *
 * Modes on the POST:
 * - the cron (no body, or `{}`): X-Cron-Secret. The cron fires at 11:00 and 12:00 UTC on Mondays and posts only while
 *   the switch `app_settings` `bridge_weekly_sheet_on_v1` reads 'true'; the function checks the switch again, runs only
 *   the tick that is 6 AM Central (`weeklySendTickNow`), and sends nothing twice on one day (`alreadySentToday`, from
 *   the last run it keeps in `bridge_weekly_sheet_last_run_v1`).
 * - `{ "dry": true }`: the cron secret, or a signed-in dev on a real account. Any hour, switch on or off. Builds the
 *   sheet and answers the recipients, the subject, the text and the html, what could not be read, and each read's
 *   error; sends nothing and writes nothing.
 *
 * Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY (a dev's dry run), RESEND_API_KEY, CRON_SECRET,
 * MERCURY_API_KEY (the bank; without it the typed figure stands in and the sheet says the bank was not read),
 * APP_ORIGIN (the sheet's link to the full Bridge). config.toml keeps verify_jwt = false: the cron sends no JWT.
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { REAL_ACCOUNT } from '../_shared/realAccount.ts'
import { fetchMercuryAccounts } from '../_shared/mercuryAccounts.ts'
import { sendEmailViaResend } from '../_shared/resendSendEmail.ts'
import type { Database } from '../../../src/types/database.ts'
// The kernels straight from the copy, not its index, as quoLines.ts reads them.
import { loadMondaySheetReads } from '../_shared/gcKernels/lib/bridge/sheetReads.ts'
import { buildSheetFromReads } from '../_shared/gcKernels/lib/bridge/sheetBuild.ts'
import { mondaySheetHtml, mondaySheetSubject, mondaySheetText } from '../_shared/gcKernels/lib/bridge/mondaySheet.ts'
import { parseMercuryCash, type MercuryCash } from '../_shared/gcKernels/lib/bridge/mercuryCash.ts'
import { readZzTestJobRows } from '../_shared/gcKernels/lib/jobs/zzTestJobReads.ts'
import { WEEKLY_SHEET_LAST_RUN_KEY, WEEKLY_SHEET_ON_KEY, alreadySentToday, parseWeeklySendRun, weeklySendRecipients, weeklySendTickNow, weeklySheetIsOn, type WeeklySendRun } from '../_shared/gcKernels/lib/bridge/weeklySend.ts'
import { todayYmdInAppTz } from '../_shared/gcKernels/utils/dateUtils.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
}
const EMAIL_TYPE = 'bridge_weekly_sheet'

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

type Admin = SupabaseClient<Database>

/** Who may ask for a dry run: the cron, or a signed-in dev on a real account. */
async function mayDryRun(req: Request, admin: Admin, supabaseUrl: string, cronOk: boolean): Promise<boolean> {
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

/** The bank through Mercury's API, or null with the reason when it cannot be read. */
async function readBank(now: Date): Promise<{ bank: MercuryCash | null; problem: string | null }> {
  const key = Deno.env.get('MERCURY_API_KEY')?.trim()
  if (!key) return { bank: null, problem: 'MERCURY_API_KEY not configured' }
  try {
    const r = await fetchMercuryAccounts(key)
    if (!r.ok) return { bank: null, problem: `${r.error}: ${r.detail}` }
    return { bank: parseMercuryCash({ ok: true, accounts: r.accounts, totalCurrentBalance: r.totalCurrentBalance }, now.toISOString()), problem: null }
  } catch (e) {
    return { bank: null, problem: e instanceof Error ? e.message : String(e) }
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return json({ ok: false, error: 'POST only' }, 405)
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceRoleKey) return json({ ok: false, error: 'Not set up' }, 503)
    const admin: Admin = createClient<Database>(supabaseUrl, serviceRoleKey, { db: { schema: 'public' } })

    const cronSecret = Deno.env.get('CRON_SECRET')
    const headerSecret = req.headers.get('X-Cron-Secret') ?? req.headers.get('x-cron-secret')
    const cronOk = Boolean(cronSecret) && headerSecret === cronSecret
    const body = (await req.json().catch(() => null)) as { dry?: unknown } | null
    const dry = body?.dry === true
    if (dry ? !(await mayDryRun(req, admin, supabaseUrl, cronOk)) : !cronOk) return json({ ok: false, error: 'Unauthorized' }, 401)

    const now = new Date()
    const today = todayYmdInAppTz(now)
    const { data: settingRows, error: settingError } = await admin.from('app_settings').select('key, value_text').in('key', [WEEKLY_SHEET_ON_KEY, WEEKLY_SHEET_LAST_RUN_KEY])
    if (settingError) throw new Error(`app_settings: ${settingError.message}`)
    const setting = (key: string) => settingRows?.find((r) => r.key === key)?.value_text ?? null
    const on = weeklySheetIsOn(setting(WEEKLY_SHEET_ON_KEY))
    const lastRun = parseWeeklySendRun(setting(WEEKLY_SHEET_LAST_RUN_KEY))
    if (!dry) {
      if (!on) return json({ ok: true, ran: false, why: 'The weekly email is off.' })
      if (!weeklySendTickNow(now)) return json({ ok: true, ran: false, why: 'Not Monday 6 AM Central. The other tick runs.' })
      if (alreadySentToday(lastRun, today)) return json({ ok: true, ran: false, why: `The sheet went today already, to ${lastRun?.sent.length ?? 0}.` })
    }

    // Who hears it: every dev with a real account and an address, nobody else.
    const { data: userRows, error: usersError } = await admin.from('users').select('role, email, archived_at, is_sample, is_digital_twin, is_walk_tester').eq('role', 'dev')
    if (usersError) throw new Error(`users: ${usersError.message}`)
    const to = weeklySendRecipients(userRows ?? [])

    // The sheet, from the page's reads as the service role.
    const problems: Array<{ what: string; error: string }> = []
    const { bank, problem: bankProblem } = await readBank(now)
    if (bankProblem) problems.push({ what: 'the bank', error: bankProblem })
    const zzTestJobIds = new Set((await readZzTestJobRows(admin)).map((r) => r.id))
    const reads = await loadMondaySheetReads(admin, {
      bank,
      zzTestJobIds,
      canReadTouches: true,
      onProblem: (what, error) => problems.push({ what, error: error instanceof Error ? error.message : String(error) }),
    })
    if (bankProblem) reads.gaps.unshift('the bank')
    const sheet = buildSheetFromReads(reads)
    const origin = (Deno.env.get('APP_ORIGIN') ?? 'https://clicktooling.com').replace(/\/$/, '')
    const url = `${origin}/bridge`
    const subject = mondaySheetSubject(sheet)
    const html = mondaySheetHtml(sheet, url)
    const text = mondaySheetText(sheet, url)
    for (const p of problems) console.warn(`[bridge-weekly-sheet] not read: ${p.what}: ${p.error}`)

    if (dry) return json({ ok: true, dry: true, on, to, subject, text, html, gaps: reads.gaps, problems, lastRun })

    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (!resendApiKey) return json({ ok: false, error: 'RESEND_API_KEY not configured' }, 500)
    const sent: string[] = []
    const failed: Array<{ to: string; error: string }> = []
    for (const email of to) {
      try {
        const res = await sendEmailViaResend(email, subject, text, html, resendApiKey, { emailType: EMAIL_TYPE })
        if (res.success) sent.push(email)
        else failed.push({ to: email, error: res.error || 'Send failed' })
      } catch (e) {
        failed.push({ to: email, error: e instanceof Error ? e.message : String(e) })
      }
    }
    const run: WeeklySendRun = { at: now.toISOString(), day: today, dry: false, sent, failed, gaps: reads.gaps, subject }
    const { error: writeError } = await admin.from('app_settings').upsert({ key: WEEKLY_SHEET_LAST_RUN_KEY, value_text: JSON.stringify(run) }, { onConflict: 'key' })
    if (writeError) console.error(`[bridge-weekly-sheet] last run not kept: ${writeError.message}`)
    console.log(`[bridge-weekly-sheet] sent to ${sent.length}, failed ${failed.length}, gaps ${reads.gaps.length}`)
    return json({ ok: true, ran: true, sent, failed, gaps: reads.gaps, problems })
  } catch (e) {
    console.error('[bridge-weekly-sheet]', e)
    return json({ ok: false, error: e instanceof Error ? e.message : 'Unexpected error' }, 500)
  }
})
