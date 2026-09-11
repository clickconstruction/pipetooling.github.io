import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { EMAIL_FROM } from '../_shared/emailFrom.ts'
import { logEmailSendBestEffort } from '../_shared/logEmailSend.ts'
import { TEST_REPORT_BUCKET, testReportActivityLine, testReportStoragePath } from '../_shared/testReportSend.ts'

/**
 * Send a test report to the GC (v2.3301): the PDF the browser rendered
 * arrives as base64; the function stores it (job-test-reports bucket,
 * versioned), emails it through Resend with the Stripe pay link in the body,
 * stamps the row sent (certifier snapshot, recipients, pay link, pdf path),
 * and posts the activity line on the job. Mirrors send-physical-invoice-email:
 * Bearer JWT + user-scoped client so RLS decides who may send; the service
 * role only touches storage.
 */
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const BUCKET = TEST_REPORT_BUCKET
const MAX_PDF_BASE64_CHARS = 6_000_000
const MAX_RECIPIENTS = 6
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

function cleanEmails(raw: unknown, max: number): string[] | null {
  if (!Array.isArray(raw)) return []
  const out: string[] = []
  for (const v of raw) {
    if (typeof v !== 'string') return null
    const e = v.trim().toLowerCase()
    if (!e) continue
    if (!EMAIL_RE.test(e)) return null
    if (!out.includes(e)) out.push(e)
  }
  return out.length > max ? null : out
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  try {
    const authHeader = req.headers.get('Authorization')
    const token = authHeader?.replace(/^Bearer\s+/i, '') ?? ''
    if (!authHeader || !token) return jsonResponse({ error: 'Unauthorized' }, 401)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnon = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (!resendApiKey) return jsonResponse({ error: 'RESEND_API_KEY not configured' }, 500)
    if (!serviceKey) return jsonResponse({ error: 'Service key not configured' }, 500)

    const userClient = createClient(supabaseUrl, supabaseAnon, { global: { headers: { Authorization: authHeader } } })
    const { data: { user }, error: authError } = await userClient.auth.getUser(token)
    if (authError || !user) return jsonResponse({ error: 'Unauthorized' }, 401)
    const admin = createClient(supabaseUrl, serviceKey)

    const body = (await req.json()) as {
      report_id?: string
      to?: unknown
      cc?: unknown
      subject?: string
      email_text?: string
      email_html?: string
      pdf_base64?: string
      pdf_filename?: string
      pay_url?: string | null
      certifier_name?: string | null
      certifier_license?: string | null
      report_label?: string
      recipient_label?: string | null
    }

    const reportId = typeof body.report_id === 'string' ? body.report_id.trim() : ''
    if (!reportId) return jsonResponse({ error: 'report_id required' }, 400)
    const to = cleanEmails(body.to, MAX_RECIPIENTS)
    const cc = cleanEmails(body.cc, MAX_RECIPIENTS)
    if (!to || to.length === 0) return jsonResponse({ error: 'At least one valid To address is required' }, 400)
    if (!cc) return jsonResponse({ error: 'Invalid cc address' }, 400)
    const ccOnly = cc.filter((e) => !to.includes(e))
    const subject = (body.subject ?? '').trim()
    const text = (body.email_text ?? '').trim()
    const html = (body.email_html ?? '').trim() || `<pre style="font:14px/1.5 sans-serif;white-space:pre-wrap">${text.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' })[c] ?? c)}</pre>`
    if (!subject || !text) return jsonResponse({ error: 'subject and email_text required' }, 400)
    const pdfBase64 = (body.pdf_base64 ?? '').trim()
    if (!pdfBase64 || pdfBase64.length > MAX_PDF_BASE64_CHARS) return jsonResponse({ error: 'Invalid or oversized PDF' }, 400)
    const pdfFilename = ((body.pdf_filename ?? '').trim() || 'test-report.pdf').replace(/[^a-zA-Z0-9._-]/g, '_')
    const payUrl = typeof body.pay_url === 'string' && /^https:\/\//.test(body.pay_url.trim()) ? body.pay_url.trim() : null

    // The row, through the caller's RLS — office roles on a job they can reach.
    const { data: row, error: rowErr } = await userClient
      .from('job_test_reports')
      .select('id, job_id, status, pdf_version, test_type, system')
      .eq('id', reportId)
      .maybeSingle()
    if (rowErr || !row) return jsonResponse({ error: 'Report not found or access denied' }, 404)
    const r = row as { id: string; job_id: string; status: string; pdf_version: number; test_type: string; system: string | null }

    // Store the exact bytes that go out, versioned so a re-send never overwrites what the GC has.
    const version = (r.pdf_version ?? 0) + 1
    const pdfPath = testReportStoragePath(r.job_id, r.id, version)
    const { error: upErr } = await admin.storage.from(BUCKET).upload(pdfPath, base64ToBytes(pdfBase64), { contentType: 'application/pdf', upsert: false })
    if (upErr) {
      console.error('test report upload', upErr)
      return jsonResponse({ error: `Could not store the PDF: ${upErr.message}` }, 500)
    }

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to,
        ...(ccOnly.length ? { cc: ccOnly } : {}),
        subject,
        html,
        text,
        attachments: [{ filename: pdfFilename, content: pdfBase64 }],
      }),
    })
    if (!resendResponse.ok) {
      const errorData = await resendResponse.json().catch(() => ({} as { message?: string }))
      // Leave the stored file (harmless) but do not stamp sent.
      return jsonResponse({ error: errorData.message || `Resend ${resendResponse.status}` }, 502)
    }
    const sent = (await resendResponse.json().catch(() => ({}))) as { id?: string }
    await logEmailSendBestEffort({ resendEmailId: sent.id ?? null, to: [...to, ...ccOnly], from: EMAIL_FROM, subject, emailType: 'test_report' })

    const nowIso = new Date().toISOString()
    const { error: stampErr } = await userClient
      .from('job_test_reports')
      .update({
        status: 'sent',
        sent_at: nowIso,
        sent_to: to,
        sent_cc: ccOnly,
        sent_by: user.id,
        sent_pay_url: payUrl,
        pdf_path: pdfPath,
        pdf_version: version,
        certifier_name: typeof body.certifier_name === 'string' ? body.certifier_name.trim() || null : null,
        certifier_license: typeof body.certifier_license === 'string' ? body.certifier_license.trim() || null : null,
      })
      .eq('id', r.id)
    if (stampErr) {
      console.error('test report stamp', stampErr)
      return jsonResponse({ error: 'The email went out but the report could not be marked sent — open it and check.', resend_email_id: sent.id ?? null }, 500)
    }

    // The job's activity line: who got what, with or without the pay link.
    const reportLabel = (body.report_label ?? '').trim() || 'test'
    const who = (body.recipient_label ?? '').trim()
    const noteBody = testReportActivityLine({ reportLabel, version, to, cc: ccOnly, recipientLabel: who || null, withPayLink: Boolean(payUrl), automatic: false })
    const { error: noteErr } = await userClient.from('jobs_ledger_thread_notes').insert({ job_id: r.job_id, author_user_id: user.id, body: noteBody })
    if (noteErr) console.error('test report activity note', noteErr)

    return jsonResponse({ ok: true, resend_email_id: sent.id ?? null, pdf_path: pdfPath, pdf_version: version })
  } catch (e) {
    console.error(e)
    return jsonResponse({ error: 'Internal error' }, 500)
  }
})
