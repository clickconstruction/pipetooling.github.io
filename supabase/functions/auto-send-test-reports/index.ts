import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import * as pdfLib from 'https://esm.sh/pdf-lib@1.17.1'
import { EMAIL_FROM } from '../_shared/emailFrom.ts'
import { logEmailSendBestEffort } from '../_shared/logEmailSend.ts'
import {
  TEST_REPORT_AUTO_SEND_GRACE_MINUTES,
  buildTestReportBlocks,
  parseEmailList,
  parseTestReportSettings,
  testReportDataFromRowLike,
  testReportPdfFilename,
  testReportSendBlockers,
  testReportShortLabel,
  testReportTitle,
  type TestReportJobInfo,
} from '../_shared/testReport.ts'
import { buildTestReportEmail } from '../_shared/testReportEmail.ts'
import { renderTestReportPdfLib } from '../_shared/testReportPdfLib.ts'
import { TEST_REPORT_BUCKET, bytesToBase64, sendTestReportEmailViaResend, testReportActivityLine, testReportStoragePath } from '../_shared/testReportSend.ts'

/**
 * Dial B (v2.3316): every 10 minutes pg_cron calls this with X-Cron-Secret.
 * When Settings → Test reports says "Send PASS reports automatically", each
 * hydrostatic PASS draft older than the grace period whose job has a billed
 * Stripe invoice with a pay link AND a GC with an email on file is rendered
 * server-side (pdf-lib), filed, emailed to the GC (cc the standing copy),
 * stamped sent with no sender, and noted on the job as "Sent automatically".
 * Anything else — FAIL, pinpoint, gas, no bill, no GC email — stays a draft
 * on the Dashboard for a person. Ten per run; errors are logged, never fatal.
 */
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
}
const BATCH = 10
const SETTINGS_KEY = 'test_report_settings_v1'

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

type DraftRow = Record<string, unknown> & { id: string; job_id: string; pdf_version: number | null; status: string }
type JobRow = { id: string; hcp_number: string | null; job_name: string | null; job_address: string | null; customer_name: string | null; customer_email: string | null; customer_phone: string | null; gc_customer_id: string | null; master_user_id: string | null }

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  const cronSecret = Deno.env.get('CRON_SECRET')
  if (!cronSecret || req.headers.get('x-cron-secret') !== cronSecret) return jsonResponse({ error: 'Unauthorized' }, 401)
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const resendApiKey = Deno.env.get('RESEND_API_KEY')
  if (!resendApiKey) return jsonResponse({ error: 'RESEND_API_KEY not configured' }, 500)
  const admin = createClient(supabaseUrl, serviceKey)

  try {
    const { data: settingsRow } = await admin.from('app_settings').select('value_text').eq('key', SETTINGS_KEY).maybeSingle()
    let parsed: unknown = null
    try {
      parsed = settingsRow?.value_text ? JSON.parse(settingsRow.value_text as string) : null
    } catch {
      parsed = null
    }
    const settings = parseTestReportSettings(parsed)
    if (settings.autoSend !== 'pass') return jsonResponse({ ok: true, skipped: 'auto-send is off' })

    const cutoff = new Date(Date.now() - TEST_REPORT_AUTO_SEND_GRACE_MINUTES * 60_000).toISOString()
    const { data: draftsRaw, error: dErr } = await admin
      .from('job_test_reports')
      .select('*')
      .eq('status', 'draft')
      .eq('result', 'pass')
      .in('test_type', ['pre_test', 'post_test'])
      .not('system', 'is', null)
      .lt('created_at', cutoff)
      .order('created_at', { ascending: true })
      .limit(BATCH)
    if (dErr) return jsonResponse({ error: dErr.message }, 500)
    const drafts = (draftsRaw ?? []) as DraftRow[]

    const results: Array<{ report: string; outcome: string }> = []
    for (const draft of drafts) {
      try {
        const { data: jobRaw } = await admin
          .from('jobs_ledger')
          .select('id, hcp_number, job_name, job_address, customer_name, customer_email, customer_phone, gc_customer_id, master_user_id')
          .eq('id', draft.job_id)
          .maybeSingle()
        const job = jobRaw as JobRow | null
        if (!job) {
          results.push({ report: draft.id, outcome: 'job missing' })
          continue
        }
        if (!job.gc_customer_id) {
          results.push({ report: draft.id, outcome: 'no GC on the job' })
          continue
        }
        const { data: gcRaw } = await admin.from('customers').select('name, contact_info').eq('id', job.gc_customer_id).maybeSingle()
        const gc = gcRaw as { name: string | null; contact_info: unknown } | null
        const ci = gc?.contact_info && typeof gc.contact_info === 'object' ? (gc.contact_info as Record<string, unknown>) : {}
        const gcEmail = typeof ci.email === 'string' ? ci.email.trim().toLowerCase() : ''
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(gcEmail)) {
          results.push({ report: draft.id, outcome: 'GC has no email' })
          continue
        }
        const { data: invRaw } = await admin
          .from('jobs_ledger_invoices')
          .select('id, amount, hosted_invoice_url, billed_at, sequence_order')
          .eq('job_id', job.id)
          .eq('status', 'billed')
          .not('hosted_invoice_url', 'is', null)
          .order('billed_at', { ascending: false })
          .limit(1)
        const inv = ((invRaw ?? []) as Array<{ amount: number; hosted_invoice_url: string | null }>)[0]
        const payUrl = inv?.hosted_invoice_url?.trim() || ''
        if (!/^https:\/\//.test(payUrl)) {
          results.push({ report: draft.id, outcome: 'no Stripe bill' })
          continue
        }

        const data = testReportDataFromRowLike(draft)
        const jobInfo: TestReportJobInfo = {
          jobNumber: (job.hcp_number ?? '').trim() || null,
          jobName: (job.job_name ?? '').trim(),
          jobAddress: (job.job_address ?? '').trim(),
          customerName: (job.customer_name ?? '').trim(),
          customerEmail: (job.customer_email ?? '').trim() || null,
          customerPhone: (job.customer_phone ?? '').trim() || null,
          customerCompany: (gc?.name ?? '').trim() || null,
        }
        const blockers = testReportSendBlockers(data, { toEmail: gcEmail, hasPayLink: true })
        if (blockers.length) {
          results.push({ report: draft.id, outcome: `incomplete: ${blockers[0]}` })
          continue
        }

        const reportLabel = testReportShortLabel(data.testType, data.system)
        const title = testReportTitle(data.testType, data.system)
        const blocks = buildTestReportBlocks(data, jobInfo, settings)
        const bytes = await renderTestReportPdfLib(pdfLib as never, blocks, title)
        const version = (draft.pdf_version ?? 0) + 1
        const pdfPath = testReportStoragePath(job.id, draft.id, version)
        const { error: upErr } = await admin.storage.from(TEST_REPORT_BUCKET).upload(pdfPath, bytes, { contentType: 'application/pdf', upsert: false })
        if (upErr) {
          results.push({ report: draft.id, outcome: `upload failed: ${upErr.message}` })
          continue
        }

        const amountLabel = inv && Number.isFinite(Number(inv.amount)) ? `$${Number(inv.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : null
        const email = buildTestReportEmail({ reportLabel, address: jobInfo.jobAddress, payUrl, amountLabel, companyName: settings.companyName, officePhone: settings.officePhone, bodyTemplate: settings.emailBodyTemplate })
        const cc = parseEmailList(settings.emailCc).filter((e) => e !== gcEmail)
        const sent = await sendTestReportEmailViaResend({
          resendApiKey,
          from: EMAIL_FROM,
          to: [gcEmail],
          cc,
          subject: email.subject,
          text: email.text,
          html: email.html,
          pdfFilename: testReportPdfFilename(jobInfo, data).replace(/[^a-zA-Z0-9._-]/g, '_'),
          pdfBase64: bytesToBase64(bytes),
        })
        if (!sent.ok) {
          results.push({ report: draft.id, outcome: `resend failed: ${sent.error}` })
          continue
        }
        await logEmailSendBestEffort({ resendEmailId: sent.id, to: [gcEmail, ...cc], from: EMAIL_FROM, subject: email.subject, emailType: 'test_report' })

        const { error: stampErr } = await admin
          .from('job_test_reports')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            sent_to: [gcEmail],
            sent_cc: cc,
            sent_by: null,
            sent_pay_url: payUrl,
            pdf_path: pdfPath,
            pdf_version: version,
            certifier_name: settings.certifierName.trim() || null,
            certifier_license: settings.certifierLicense.trim() || null,
          })
          .eq('id', draft.id)
          .eq('status', 'draft')
        if (stampErr) console.error('auto-send stamp', draft.id, stampErr)

        if (job.master_user_id) {
          const body = testReportActivityLine({ reportLabel, version, to: [gcEmail], cc, recipientLabel: (gc?.name ?? '').trim() || null, withPayLink: true, automatic: true })
          const { error: noteErr } = await admin.from('jobs_ledger_thread_notes').insert({ job_id: job.id, author_user_id: job.master_user_id, body })
          if (noteErr) console.error('auto-send note', draft.id, noteErr)
        }
        results.push({ report: draft.id, outcome: `sent to ${gcEmail}` })
      } catch (e) {
        console.error('auto-send report', draft.id, e)
        results.push({ report: draft.id, outcome: `error: ${e instanceof Error ? e.message : String(e)}` })
      }
    }
    return jsonResponse({ ok: true, considered: drafts.length, results })
  } catch (e) {
    console.error('auto-send-test-reports', e)
    return jsonResponse({ error: 'Internal error' }, 500)
  }
})
