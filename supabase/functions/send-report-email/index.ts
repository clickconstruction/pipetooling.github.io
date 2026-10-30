import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sendEmailViaResend } from '../_shared/resendSendEmail.ts'
// The email itself is `_shared/fieldReportEmail.ts` (v2.4180) — What the team sees renders it on sample data.
import { buildReportEmail, type ReportContent } from '../_shared/fieldReportEmail.ts'
import { REAL_ACCOUNT } from '../_shared/realAccount.ts'
import { readReportSubject, reportSendSkip, type ReportSubject } from '../_shared/reportSubject.ts'

/**
 * Emails reports to configured recipients (report_email_subscriptions).
 *
 * Modes:
 *  - auto   { report_id }                         — fired fire-and-forget right
 *                                                    after a report is created;
 *                                                    emails every enabled + auto_send
 *                                                    subscription whose scope matches
 *                                                    (all authors · the author is named;
 *                                                    the v2.3480 team-lead scope went
 *                                                    with the list in v2.5088), skipping
 *                                                    any already in the dispatch log.
 *  - manual { mode:'manual', subscription_id,      — "Send now" from the dashboard;
 *             since_days? }                          emails recent in-scope reports not
 *                                                    yet dispatched to that subscription.
 *
 * A report on a ZZ test record — its job's or its customer's name, a project's or a bid's, starts with ZZ
 * (`_shared/reportSubject.ts`, v2.6127) — is emailed to no one in either mode: auto answers with the reason,
 * manual leaves it out and counts it. A session's walk on a ZZ job stays in the building.
 *
 * Idempotency: report_email_dispatch_log UNIQUE(subscription_id, report_id).
 * Auth: requires a logged-in user (JWT). Manual mode additionally requires the
 * caller to be a report-email manager. All privileged work uses the service role.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MANUAL_DEFAULT_SINCE_DAYS = 14
const MANUAL_MAX_REPORTS = 50
const MANAGER_ROLES = ['dev', 'master_technician', 'assistant', 'controller']
const LEGACY_SUPERINTENDENT_REPORT_TEMPLATE_NAME = 'Superintendent Report'
const STATUS_REPORT_LABEL = 'Status Report'

interface ReportRow {
  id: string
  template_id: string
  created_by_user_id: string
  job_ledger_id: string | null
  project_id: string | null
  bid_id: string | null
  field_values: Record<string, unknown> | null
  created_at: string
}

interface SubscriptionRow {
  id: string
  recipient_user_id: string | null
  recipient_email: string | null
  label: string | null
  all_authors: boolean
  auto_send: boolean
  enabled: boolean
}

type AdminClient = SupabaseClient

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function resolveReportContent(admin: AdminClient, report: ReportRow, subject: ReportSubject): Promise<ReportContent> {
  const { data: templateRow } = await admin
    .from('report_templates')
    .select('name')
    .eq('id', report.template_id)
    .single()
  let templateName = (templateRow as { name: string } | null)?.name ?? 'Report'
  if (templateName === LEGACY_SUPERINTENDENT_REPORT_TEMPLATE_NAME) templateName = STATUS_REPORT_LABEL

  const { data: authorRow } = await admin
    .from('users')
    .select('name')
    .eq('id', report.created_by_user_id)
    .single()
  const authorName = (authorRow as { name: string | null } | null)?.name ?? 'Someone'

  // The job, project or bid was read once already, for the test-job rule (`readReportSubject`); its words as before.
  let jobDisplay = 'Unknown job'
  if (subject.kind === 'job') {
    const name = subject.jobName?.trim() || 'Job'
    jobDisplay = subject.hcpNumber?.trim() ? `${subject.hcpNumber.trim()} · ${name}` : name
  } else if (subject.kind === 'project') {
    jobDisplay = subject.name?.trim() || 'Project'
  } else if (subject.kind === 'bid') {
    jobDisplay = subject.projectName?.trim() || subject.gcContactName?.trim() || 'Bid'
  }

  return {
    templateName,
    authorName,
    jobDisplay,
    createdAt: report.created_at,
    fieldValues: report.field_values ?? {},
  }
}

/** Resolve a subscription's destination address; null when unsendable (archived/empty). */
async function resolveRecipientEmail(
  admin: AdminClient,
  sub: SubscriptionRow,
): Promise<string | null> {
  if (sub.recipient_email) return sub.recipient_email.trim() || null
  if (!sub.recipient_user_id) return null
  const { data } = await admin
    .from('users')
    .select('email, archived_at').match(REAL_ACCOUNT)
    .eq('id', sub.recipient_user_id)
    .single()
  const u = data as { email: string | null; archived_at: string | null } | null
  if (!u || u.archived_at || !u.email?.trim()) return null
  return u.email.trim()
}

async function sendReportToSubscription(
  admin: AdminClient,
  sub: SubscriptionRow,
  report: ReportRow,
  content: ReportContent,
  resendApiKey: string,
  trigger: 'auto' | 'manual',
): Promise<'sent' | 'skipped' | 'failed'> {
  const to = await resolveRecipientEmail(admin, sub)
  if (!to) return 'skipped'
  const { subject, html, text } = buildReportEmail(content)
  // Sent copies (docs/SENT_COPIES.md): a report that goes to an address outside the company is
  // kept on its job. A subscription that names one of our own users is our own mail.
  const outside = Boolean((sub.recipient_email ?? '').trim())
  const result = await sendEmailViaResend(to, subject, text, html, resendApiKey, outside ? { file: { kind: 'field_report', jobIds: [report.job_ledger_id], bidId: report.bid_id, source: { table: 'reports', id: report.id } } } : undefined)
  if (!result.success) {
    console.error('send-report-email Resend error:', result.error)
    return 'failed'
  }
  // Ledger write is what makes delivery at-most-once. A duplicate (23505) means a
  // concurrent send already logged it — treat as success, do not double-count.
  const { error: logErr } = await admin.from('report_email_dispatch_log').insert({
    subscription_id: sub.id,
    report_id: report.id,
    recipient_user_id: sub.recipient_user_id,
    recipient_email: sub.recipient_email,
    trigger,
  })
  if (logErr && !String(logErr.code).includes('23505')) {
    console.error('send-report-email dispatch log error:', logErr.message)
  }
  return 'sent'
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Unauthorized' }, 401)
    const token = authHeader.replace(/^Bearer\s+/i, '')
    if (!token) return json({ error: 'Unauthorized' }, 401)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser(token)
    if (authError || !user) return json({ error: 'Unauthorized' }, 401)

    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (!serviceRoleKey) return json({ error: 'SUPABASE_SERVICE_ROLE_KEY not configured' }, 500)
    if (!resendApiKey) return json({ error: 'RESEND_API_KEY not configured' }, 500)
    const admin = createClient(supabaseUrl, serviceRoleKey)

    const body = (await req.json().catch(() => ({}))) as {
      mode?: string
      report_id?: string
      subscription_id?: string
      since_days?: number
    }
    const mode = body.mode === 'manual' ? 'manual' : 'auto'

    if (mode === 'auto') {
      const reportId = body.report_id
      if (!reportId) return json({ error: 'Missing report_id' }, 400)

      const { data: reportData, error: reportErr } = await admin
        .from('reports')
        .select('id, template_id, created_by_user_id, job_ledger_id, project_id, bid_id, field_values, created_at')
        .eq('id', reportId)
        .single()
      if (reportErr || !reportData) return json({ error: 'Report not found' }, 404)
      const report = reportData as unknown as ReportRow

      // A report on a ZZ test record reaches no inbox (v2.6127): a session's walk stays in the building.
      const subject = await readReportSubject(admin, report)
      const skip = reportSendSkip(subject)
      if (skip) return json({ ok: true, sent: 0, skipped: skip.reason, message: skip.message })

      const { data: subsData } = await admin
        .from('report_email_subscriptions')
        .select('id, recipient_user_id, recipient_email, label, all_authors, auto_send, enabled')
        .eq('enabled', true)
        .eq('auto_send', true)
      const subs = (subsData ?? []) as unknown as SubscriptionRow[]
      if (subs.length === 0) return json({ ok: true, sent: 0, message: 'No auto subscriptions' })

      // Subscriptions scoped to this report's author.
      const { data: scopedData } = await admin
        .from('report_email_subscription_authors')
        .select('subscription_id')
        .eq('author_user_id', report.created_by_user_id)
      const authorScoped = new Set(
        ((scopedData ?? []) as Array<{ subscription_id: string }>).map((r) => r.subscription_id),
      )

      // Already-dispatched for this report.
      const { data: dispatchedData } = await admin
        .from('report_email_dispatch_log')
        .select('subscription_id')
        .eq('report_id', report.id)
      const dispatched = new Set(
        ((dispatchedData ?? []) as Array<{ subscription_id: string }>).map((r) => r.subscription_id),
      )

      const matched = subs.filter(
        // Mirrors subscriptionMatchesReport in src/lib/reportEmailSubscriptions.ts.
        (s) => (s.all_authors || authorScoped.has(s.id)) && !dispatched.has(s.id),
      )
      if (matched.length === 0) return json({ ok: true, sent: 0, message: 'No matching subscriptions' })

      const content = await resolveReportContent(admin, report, subject)
      let sent = 0
      for (const sub of matched) {
        const outcome = await sendReportToSubscription(admin, sub, report, content, resendApiKey, 'auto')
        if (outcome === 'sent') sent++
      }
      return json({ ok: true, sent, matched: matched.length })
    }

    // ---- manual ----
    const { data: meRow } = await admin.from('users').select('role').eq('id', user.id).single()
    const myRole = (meRow as { role: string } | null)?.role ?? ''
    if (!MANAGER_ROLES.includes(myRole)) return json({ error: 'Forbidden' }, 403)

    const subscriptionId = body.subscription_id
    if (!subscriptionId) return json({ error: 'Missing subscription_id' }, 400)

    const { data: subData, error: subErr } = await admin
      .from('report_email_subscriptions')
      .select('id, recipient_user_id, recipient_email, label, all_authors, auto_send, enabled')
      .eq('id', subscriptionId)
      .single()
    if (subErr || !subData) return json({ error: 'Subscription not found' }, 404)
    const sub = subData as unknown as SubscriptionRow
    if (!sub.enabled) return json({ error: 'Subscription is disabled' }, 400)

    const sinceDays =
      typeof body.since_days === 'number' && body.since_days > 0 ? body.since_days : MANUAL_DEFAULT_SINCE_DAYS
    const sinceIso = new Date(Date.now() - sinceDays * 86400000).toISOString()

    let authorIds: string[] = []
    if (!sub.all_authors) {
      const { data: authorData } = await admin
        .from('report_email_subscription_authors')
        .select('author_user_id')
        .eq('subscription_id', sub.id)
      authorIds = ((authorData ?? []) as Array<{ author_user_id: string }>).map((r) => r.author_user_id)
      if (authorIds.length === 0) return json({ ok: true, sent: 0, message: 'No authors in scope' })
    }

    let reportsQuery = admin
      .from('reports')
      .select('id, template_id, created_by_user_id, job_ledger_id, project_id, bid_id, field_values, created_at')
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: false })
      .limit(MANUAL_MAX_REPORTS)
    if (!sub.all_authors) reportsQuery = reportsQuery.in('created_by_user_id', authorIds)
    const { data: reportsData } = await reportsQuery
    const reports = (reportsData ?? []) as unknown as ReportRow[]
    if (reports.length === 0) return json({ ok: true, sent: 0, message: 'No reports in window' })

    const { data: dispatchedData } = await admin
      .from('report_email_dispatch_log')
      .select('report_id')
      .eq('subscription_id', sub.id)
      .in('report_id', reports.map((r) => r.id))
    const dispatched = new Set(
      ((dispatchedData ?? []) as Array<{ report_id: string }>).map((r) => r.report_id),
    )
    const toSend = reports.filter((r) => !dispatched.has(r.id))

    let sent = 0
    let skippedTestJobs = 0
    for (const report of toSend) {
      // A report on a ZZ test record is left out and counted (v2.6127); the editor says so.
      const subject = await readReportSubject(admin, report)
      if (reportSendSkip(subject)) {
        skippedTestJobs++
        continue
      }
      const content = await resolveReportContent(admin, report, subject)
      const outcome = await sendReportToSubscription(admin, sub, report, content, resendApiKey, 'manual')
      if (outcome === 'sent') sent++
    }
    return json({ ok: true, sent, candidates: reports.length, alreadySent: dispatched.size, skippedTestJobs })
  } catch (error) {
    console.error('send-report-email error:', error)
    return json({ error: error instanceof Error ? error.message : 'Internal server error' }, 500)
  }
})
