/**
 * gc-office-notices — GC mode's office notices (Owner Billing's O10b; the plan is
 * to-dos/gc-mode/mockups/owner-billing-o10.md on spike/gc-mode). Three emails nobody presses: bill day in two days to
 * the project manager, a pay application still with the architect after 3 days (to the architect) and after 5 (to the
 * project manager). `get_gc_office_notices_due()` (O10a, migration 20261010060000) says what is due; this sends each
 * once, writing its `gc_office_notices` row first, and only while the switch (`gc_office_notices_on_v1`, the day it
 * went on) is on. Words and frames: `_shared/gcOfficeNotices.ts`.
 *
 * Modes on the POST JSON body:
 * - cron (no mode)        — X-Cron-Secret. Before 8 AM Central, or with the switch off, nothing. Else each notice due:
 *                           its address (the architect's billing email, else contact; ours a real account), its row
 *                           (a unique index makes a second tick's insert fail: skipped), the send, the row's
 *                           email_send_log_id, and the architect's sent copy on the billing job.
 * - { mode: 'preview', since? }   — the caller's JWT on the money team, never a training account or a twin: the
 *                           notices as they would go today, as if on since the switch's day (else today, else
 *                           `since`). Writes nothing.
 * - { mode: 'test_send', since? } — the same gate and list; each one to the caller alone, "[TEST] " before its
 *                           subject. Nothing filed, no row written, the switch not read.
 *
 * Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY, RESEND_API_KEY, CRON_SECRET, EMAIL_FROM,
 * APP_ORIGIN (Bill the customer's link). config.toml keeps verify_jwt = false: the cron sends no JWT.
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sendEmailViaResend } from '../_shared/resendSendEmail.ts'
import { fileSentEmailBestEffort } from '../_shared/fileSentCopy.ts'
import { EMAIL_FROM } from '../_shared/emailFrom.ts'
import { mailboxWithName } from '../_shared/mailboxWithName.ts'
import { customerBillingEmail } from '../_shared/billToParty.ts'
import { REAL_ACCOUNT } from '../_shared/realAccount.ts'
import { officeHour, officeYmd } from '../_shared/bidFollowupReminder.ts'
import { GC_CUSTOMER_EMAIL_FROM_NAME, GC_CUSTOMER_EMAIL_ROLES } from '../_shared/gcCustomerEmails.ts'
import {
  billTheCustomerUrl,
  buildOfficeNoticeEmail,
  GC_CERTIFY_REMINDER_FILED_AS,
  GC_OFFICE_NOTICE_EMAIL_TYPE,
  GC_OFFICE_NOTICES_HOUR,
  GC_OFFICE_NOTICES_SETTING_KEY,
  gcOfficeNoticesSince,
  testSubject,
  type GcOfficeNotice,
  type GcOfficeNoticesPayload,
} from '../_shared/gcOfficeNotices.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
}

const APP_ORIGIN = (Deno.env.get('APP_ORIGIN')?.trim() || 'https://clicktooling.com').replace(/\/+$/, '')
const TEST_EMAIL_TYPE = 'gc_office_notice_test'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

// deno-lint-ignore no-explicit-any
type Admin = any
type Caller = { id: string; email: string | null; name: string | null }

/** The caller's JWT → an active money-team user, not in training mode; a Response means the gate failed. */
async function requireMoneyTeam(req: Request, admin: Admin): Promise<Caller | Response> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return jsonResponse({ error: 'Unauthorized' }, 401)
  const jwtClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } })
  const {
    data: { user },
    error,
  } = await jwtClient.auth.getUser(authHeader.replace(/^Bearer\s+/i, ''))
  if (error || !user) return jsonResponse({ error: 'Unauthorized' }, 401)
  const { data: me } = await admin.from('users').select('id, email, name, role, archived_at, read_only').match(REAL_ACCOUNT).eq('id', user.id).maybeSingle()
  if (!me || me.archived_at || !GC_CUSTOMER_EMAIL_ROLES.includes(String(me.role))) return jsonResponse({ error: 'Forbidden' }, 403)
  if (me.read_only) return jsonResponse({ error: 'A training account cannot send the office’s notices.' }, 403)
  return { id: me.id, email: me.email ?? null, name: me.name ?? null }
}

async function loadPayload(admin: Admin, since: string | null): Promise<GcOfficeNoticesPayload> {
  const { data, error } = await admin.rpc('get_gc_office_notices_due', since ? { p_since: since } : {})
  if (error) throw new Error(`payload rpc: ${error.message}`)
  const payload = data as GcOfficeNoticesPayload | null
  if (!payload || !Array.isArray(payload.notices)) throw new Error('empty payload')
  return payload
}

/** Where a notice goes: the architect's billing email, else its contact email; ours as the payload read it. */
async function addressOf(admin: Admin, n: GcOfficeNotice): Promise<string> {
  if (n.to.customerId) {
    const { data } = await admin.from('customers').select('id, name, billing_email, contact_info').eq('id', n.to.customerId).maybeSingle()
    return customerBillingEmail(data ?? null).trim()
  }
  return (n.to.email ?? '').trim()
}

function emailOf(n: GcOfficeNotice) {
  return buildOfficeNoticeEmail(n, billTheCustomerUrl(APP_ORIGIN, n.projectId), n.replyTo?.name ?? null)
}

/** The architect's reminder: from Click Construction, replies to the project manager. Ours: from the app. */
function sendOptions(n: GcOfficeNotice): { from?: string; replyTo?: string } {
  if (n.kind !== 'certify_reminder') return {}
  const replyTo = (n.replyTo?.email ?? '').trim()
  return { from: mailboxWithName(GC_CUSTOMER_EMAIL_FROM_NAME, EMAIL_FROM), ...(replyTo ? { replyTo } : {}) }
}

/** The cron's run: every notice due, each once. */
async function runDispatch(admin: Admin, resendApiKey: string): Promise<Response> {
  if (officeHour(new Date()) < GC_OFFICE_NOTICES_HOUR) return jsonResponse({ ok: true, skipped: 'before the morning', sent: 0 })
  const { data: setting } = await admin.from('app_settings').select('value_text').eq('key', GC_OFFICE_NOTICES_SETTING_KEY).maybeSingle()
  if (!gcOfficeNoticesSince(setting?.value_text)) return jsonResponse({ ok: true, skipped: 'off', sent: 0 })

  const payload = await loadPayload(admin, null)
  let sent = 0
  const skipped: string[] = []
  const errors: string[] = []
  for (const n of payload.notices) {
    const what = `${n.kind} ${n.project} ${n.number}`
    try {
      const address = await addressOf(admin, n)
      if (!address) {
        skipped.push(`${what}: no email on file`)
        continue
      }
      // The row first: a second tick's insert hits the unique index and skips, so the notice goes at most once.
      const { data: row, error: insErr } = await admin
        .from('gc_office_notices')
        .insert({
          project_id: n.projectId,
          kind: n.kind,
          bill_day: n.kind === 'bill_day' ? n.billDay : null,
          pay_app_id: n.kind === 'bill_day' ? null : n.payAppId,
          recipient_user_id: n.to.userId ?? null,
          recipient_customer_id: n.to.customerId ?? null,
          recipient_email: address,
        })
        .select('id')
        .single()
      if (insErr) {
        if (insErr.code === '23505') skipped.push(`${what}: sent already`)
        else errors.push(`${what}: ${insErr.message}`)
        continue
      }
      const mail = emailOf(n)
      const options = sendOptions(n)
      const res = await sendEmailViaResend(address, mail.subject, mail.text, mail.html, resendApiKey, { ...options, emailType: GC_OFFICE_NOTICE_EMAIL_TYPE[n.kind] })
      if (!res.success) {
        // The row stays: this notice is not tried again, and the next one on the pay application still goes.
        errors.push(`${what}: ${res.error ?? 'Resend said no'}`)
        continue
      }
      if (res.resendEmailId) {
        const { data: log } = await admin.from('email_send_log').select('id').eq('resend_email_id', res.resendEmailId).maybeSingle()
        if (log?.id) await admin.from('gc_office_notices').update({ email_send_log_id: log.id }).eq('id', row.id)
      }
      // Sent copies (docs/SENT_COPIES.md): the architect's reminder as it went, on the billing job's Documents tab.
      // Ours are mail to our own staff, deliberately not filed.
      if (n.kind === 'certify_reminder') {
        await fileSentEmailBestEffort(
          {
            kind: GC_CERTIFY_REMINDER_FILED_AS,
            title: mail.subject,
            recipientName: n.to.name ?? null,
            customerId: n.to.customerId ?? null,
            jobIds: n.billingJobId ? [n.billingJobId] : [],
            source: { table: 'gc_office_notices', id: row.id },
          },
          { to: [address], from: options.from ?? EMAIL_FROM, subject: mail.subject, html: mail.html, resendEmailId: res.resendEmailId ?? null },
        )
      }
      sent += 1
    } catch (e) {
      errors.push(`${what}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  return jsonResponse({ ok: true, today: payload.today, sent, skipped, errors })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (!supabaseUrl || !serviceRole) return jsonResponse({ error: 'Supabase service env not configured' }, 500)
    if (!resendApiKey) return jsonResponse({ error: 'RESEND_API_KEY not configured' }, 500)
    const admin = createClient(supabaseUrl, serviceRole)

    let body: Record<string, unknown> = {}
    try {
      body = (await req.json()) as Record<string, unknown>
    } catch {
      body = {}
    }
    const mode = typeof body.mode === 'string' ? body.mode : ''

    if (mode === 'preview' || mode === 'test_send') {
      const me = await requireMoneyTeam(req, admin)
      if (me instanceof Response) return me
      const asked = typeof body.since === 'string' ? gcOfficeNoticesSince(body.since) : null
      const { data: setting } = await admin.from('app_settings').select('value_text').eq('key', GC_OFFICE_NOTICES_SETTING_KEY).maybeSingle()
      const since = asked ?? gcOfficeNoticesSince(setting?.value_text) ?? officeYmd(new Date().toISOString())
      const payload = await loadPayload(admin, since)
      if (mode === 'preview') {
        const notices = []
        for (const n of payload.notices) {
          const mail = emailOf(n)
          notices.push({ kind: n.kind, project: n.project, number: n.number, to: n.to.name ?? null, email: await addressOf(admin, n), subject: mail.subject, text: mail.text })
        }
        return jsonResponse({ today: payload.today, billDay: payload.billDay, since, notices })
      }
      const email = (me.email ?? '').trim()
      if (!email) return jsonResponse({ error: 'Your account has no email address' }, 400)
      let sent = 0
      for (const n of payload.notices) {
        const mail = emailOf(n)
        const res = await sendEmailViaResend(email, testSubject(mail.subject), mail.text, mail.html, resendApiKey, { ...sendOptions(n), emailType: TEST_EMAIL_TYPE })
        if (!res.success) return jsonResponse({ error: res.error || 'Send failed', sent }, 500)
        sent += 1
      }
      return jsonResponse({ ok: true, since, sent })
    }

    // The cron.
    const cronSecret = Deno.env.get('CRON_SECRET')
    const headerSecret = req.headers.get('X-Cron-Secret') ?? req.headers.get('x-cron-secret')
    if (!cronSecret || headerSecret !== cronSecret) return jsonResponse({ error: 'Unauthorized' }, 401)
    return await runDispatch(admin, resendApiKey)
  } catch (e) {
    console.error('gc-office-notices', e)
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
