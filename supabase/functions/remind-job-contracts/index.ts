/**
 * remind-job-contracts (Contract Desk PR 5): the reminder lane. pg_cron calls
 * this hourly with X-Cron-Secret; it drains job_contracts that are out for
 * signature with reminders on and next_reminder_at due, emails the customer
 * the same durable link, bumps reminder_count / next_reminder_at (3 days,
 * up to 3 reminders), and logs a `reminded` event. Kill switch: app_settings
 * key `job_contract_reminders_disabled_v1` = '1'.
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sendEmailViaResend } from '../_shared/resendSendEmail.ts'
import {
  amountCentsFromFields,
  appOrigin,
  contractHeading,
  escapeHtml,
  formatMoney,
  isValidEmail,
  JOB_CONTRACT_REMINDER_DAYS,
  jobNumberLabel,
  signingUrl,
} from '../_shared/jobContract.ts'

const MAX_REMINDERS = 3
const KILL_SWITCH_KEY = 'job_contract_reminders_disabled_v1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

type DueRow = {
  id: string
  job_id: string
  revision: number
  public_token: string | null
  public_token_expires_at: string | null
  recipient_name: string | null
  recipient_email: string | null
  cc_emails: string[] | null
  fields: unknown
  reminder_count: number
  created_by: string | null
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  try {
    const cronSecret = Deno.env.get('CRON_SECRET')
    if (!cronSecret) return json({ error: 'CRON_SECRET not configured' }, 500)
    const body = (await req.json().catch(() => ({}))) as { cron_secret?: string; dry_run?: boolean }
    if (req.headers.get('X-Cron-Secret') !== cronSecret && body.cron_secret !== cronSecret) {
      return json({ error: 'Unauthorized - Invalid or missing cron secret' }, 401)
    }

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: kill } = await admin.from('app_settings').select('value_text').eq('key', KILL_SWITCH_KEY).maybeSingle()
    if (((kill as { value_text?: string | null } | null)?.value_text ?? '').trim() === '1') {
      return json({ ok: true, skipped: 'disabled', sent: 0 })
    }

    const nowIso = new Date().toISOString()
    const { data: dueRaw, error: dueErr } = await admin
      .from('job_contracts')
      .select('id, job_id, revision, public_token, public_token_expires_at, recipient_name, recipient_email, cc_emails, fields, reminder_count, created_by')
      .eq('status', 'sent')
      .eq('reminders_enabled', true)
      .is('voided_at', null)
      .lte('next_reminder_at', nowIso)
      .lt('reminder_count', MAX_REMINDERS)
      .order('next_reminder_at', { ascending: true })
      .limit(50)
    if (dueErr) return json({ error: dueErr.message }, 500)
    const due = (dueRaw ?? []) as DueRow[]
    if (due.length === 0) return json({ ok: true, sent: 0 })

    const resendKey = Deno.env.get('RESEND_API_KEY')
    const origin = appOrigin()
    let sent = 0
    let skipped = 0
    for (const c of due) {
      const email = (c.recipient_email ?? '').trim()
      const expired = c.public_token_expires_at ? new Date(c.public_token_expires_at).getTime() < Date.now() : false
      if (!c.public_token || !isValidEmail(email) || expired) {
        // Nothing to remind with — stop the lane for this row so it never re-queues.
        await admin.from('job_contracts').update({ next_reminder_at: null }).eq('id', c.id)
        skipped++
        continue
      }
      const { data: job } = await admin
        .from('jobs_ledger')
        .select('hcp_number, click_number, job_name, job_address')
        .eq('id', c.job_id)
        .maybeSingle()
      const j = (job ?? {}) as { hcp_number?: string | null; click_number?: string | null; job_name?: string | null; job_address?: string | null }
      const heading = contractHeading({ job_address: j.job_address ?? null, job_name: j.job_name ?? null })
      const jobNo = jobNumberLabel({ hcp_number: j.hcp_number ?? null, click_number: j.click_number ?? null })
      const amount = amountCentsFromFields(c.fields)
      const url = signingUrl(origin, c.public_token)
      const nth = c.reminder_count + 1
      const last = nth >= MAX_REMINDERS

      let replyTo: string | undefined
      if (c.created_by) {
        const { data: sender } = await admin.from('users').select('email').eq('id', c.created_by).maybeSingle()
        const e = (sender as { email?: string | null } | null)?.email ?? ''
        if (isValidEmail(e)) replyTo = e
      }

      const greeting = c.recipient_name ? `Hi ${c.recipient_name.split(' ')[0]},` : 'Hello,'
      const subject = `Reminder: please sign — ${heading} (Job #${jobNo})`
      const amountLine = amount != null ? `Contract amount: ${formatMoney(amount)}\n` : ''
      const text =
        `${greeting}\n\nA quick reminder that your service agreement is waiting for your signature. It takes about a minute on your phone.\n\n` +
        `${heading}\nJob #${jobNo}\n${amountLine}\nReview and sign here:\n${url}\n\n` +
        `${last ? 'This is our last automatic reminder — reply to this email or call us if anything needs changing.' : 'Questions? Just reply to this email.'}\n`
      const html =
        `<p>${escapeHtml(greeting)}</p>` +
        `<p>A quick reminder that your service agreement is waiting for your signature. It takes about a minute on your phone.</p>` +
        `<p><strong>${escapeHtml(heading)}</strong><br>Job #${escapeHtml(jobNo)}${amount != null ? `<br>Contract amount: ${escapeHtml(formatMoney(amount))}` : ''}</p>` +
        `<p><a href="${escapeHtml(url)}" style="display:inline-block;background:#c2410c;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600">Review &amp; sign</a></p>` +
        `<p style="color:#6b7280;font-size:13px">${last ? 'This is our last automatic reminder — reply to this email or call us if anything needs changing.' : 'Questions? Just reply to this email.'}</p>`

      let emailed = false
      if (resendKey && !body.dry_run) {
        const cc = (c.cc_emails ?? []).filter(isValidEmail).slice(0, 10)
        const r = await sendEmailViaResend(email, subject, text, html, resendKey, { ...(replyTo ? { replyTo } : {}), ...(cc.length ? { cc } : {}) })
        emailed = r.success
      }
      if (!emailed && !body.dry_run) {
        // Email failed — try again next hour rather than burning a reminder slot.
        continue
      }
      const next = last ? null : new Date(Date.now() + JOB_CONTRACT_REMINDER_DAYS * 86_400_000).toISOString()
      await admin.from('job_contracts').update({ reminder_count: nth, next_reminder_at: next }).eq('id', c.id).eq('status', 'sent')
      await admin.from('job_contract_events').insert({
        contract_id: c.id,
        event_type: 'reminded',
        metadata: { n: nth, to: email, revision: c.revision, dry_run: body.dry_run === true },
      })
      sent++
    }
    return json({ ok: true, sent, skipped, due: due.length })
  } catch (e) {
    console.error(e)
    return json({ error: 'Internal error' }, 500)
  }
})
