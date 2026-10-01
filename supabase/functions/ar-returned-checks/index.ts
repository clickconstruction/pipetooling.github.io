import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { loadOpenReturnCases, sendReturnCaseNotice } from '../_shared/arReturnCaseNotify.ts'
import { sendEmailViaResend } from '../_shared/resendSendEmail.ts'

/**
 * ar-returned-checks — the hourly sweep for checks that came back (v2.4320, punch
 * list #76 PR 2). pg_cron 'ar-returned-checks-hourly' (minute 17) calls it with
 * X-Cron-Secret.
 *
 * 1. `open_ar_rejected_check_cases()` — opens a case for a check Mercury could not
 *    take in when a payment recorded by hand matches it and it was not deposited
 *    again within 5 days; closes one once the check goes in again.
 * 2. Tells the office once about every open case it has not heard about — a bank
 *    return the Banking page's Sync stored (that path sends nothing itself), the
 *    rejected cases from step 1, anything the webhook's own notice missed.
 *
 * Body: `{}`; `{ "dry_run": true }` opens nothing and sends nothing, and logs the
 * subject each case would get. Auth: `X-Cron-Secret` (or `cron_secret` in the body) =
 * `CRON_SECRET`; gateway `verify_jwt = false`. Secrets: `SUPABASE_URL`,
 * `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `RESEND_API_KEY`, `VAPID_PUBLIC_KEY`,
 * `VAPID_PRIVATE_KEY`, `APP_ORIGIN` (optional).
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  let body: { cron_secret?: unknown; dry_run?: unknown } = {}
  try {
    body = (await req.json()) ?? {}
  } catch {
    body = {}
  }
  const expected = Deno.env.get('CRON_SECRET') ?? ''
  const given = req.headers.get('x-cron-secret') ?? (typeof body.cron_secret === 'string' ? body.cron_secret : '')
  if (!expected || given !== expected) return jsonResponse({ error: 'Unauthorized' }, 401)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceKey) return jsonResponse({ error: 'Server misconfigured' }, 500)
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
  const dryRun = body.dry_run === true
  const appOrigin = (Deno.env.get('APP_ORIGIN') ?? 'https://clicktooling.com').replace(/\/$/, '')
  const log = (event: Record<string, unknown>) => console.log(JSON.stringify(event))

  try {
    let swept: unknown = null
    if (!dryRun) {
      const { data, error } = await admin.rpc('open_ar_rejected_check_cases')
      if (error) throw error
      swept = data
    }
    const cases = await loadOpenReturnCases(admin)
    let told = 0
    let failed = 0
    for (const row of cases) {
      if (row.notified_at) continue
      try {
        const res = await sendReturnCaseNotice(admin, row, { appOrigin, sendEmail: sendEmailViaResend, dryRun, log })
        if (res.sent) told += 1
      } catch (e) {
        failed += 1
        console.error('ar-returned-checks notice', row.mercury_transaction_id, e instanceof Error ? e.message : String(e))
      }
    }
    const summary = { event: 'ar_returned_checks_run', dry_run: dryRun, swept, open_cases: cases.length, told, failed }
    log(summary)
    return jsonResponse({ ok: true, ...summary })
  } catch (e) {
    console.error('ar-returned-checks', e instanceof Error ? e.message : String(e))
    return jsonResponse({ error: e instanceof Error ? e.message : 'failed' }, 500)
  }
})
