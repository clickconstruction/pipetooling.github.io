import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { logEmailSendBestEffort } from '../_shared/logEmailSend.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { EMAIL_FROM } from '../_shared/emailFrom.ts'

/**
 * Send a job-account setup email to supply house contacts (v2.1605 — the Job
 * Detail "Share with supply house" flow).
 *
 * Auth: user JWT verified in-handler (config.toml sets verify_jwt = false);
 * caller must be dev / master_technician / assistant / controller. The job
 * must be readable through the caller's RLS (blocks cross-tenant sends); the
 * recipient addresses are office-chosen supply house contacts.
 *
 * Sends via Resend from the EMAIL_FROM sender with the caller's email
 * as reply-to, then best-effort logs to email_send_log like every app send.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ALLOWED_ROLES = ['dev', 'master_technician', 'assistant', 'controller']
const MAX_HTML_CHARS = 100_000
const MAX_RECIPIENTS = 10

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  try {
    const authHeader = req.headers.get('Authorization')
    const token = authHeader?.replace(/^Bearer\s+/i, '') ?? ''
    if (!token) {
      return jsonResponse({ error: 'Unauthorized' }, 401)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnon = Deno.env.get('SUPABASE_ANON_KEY')!
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (!resendApiKey) {
      return jsonResponse({ error: 'RESEND_API_KEY not configured' }, 500)
    }

    const userClient = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader! } },
    })
    const { data: { user }, error: authError } = await userClient.auth.getUser(token)
    if (authError || !user) {
      return jsonResponse({ error: 'Unauthorized' }, 401)
    }

    const { data: me, error: meErr } = await userClient
      .from('users')
      .select('id, name, email, role')
      .eq('id', user.id)
      .single()
    if (meErr || !me || !ALLOWED_ROLES.includes(String(me.role))) {
      return jsonResponse({ error: 'Not allowed to share job accounts' }, 403)
    }

    const body = (await req.json()) as {
      job_id?: string
      to_emails?: unknown
      /** v2.1606: labeled recipients — audit-logged into supply_house_job_accounts. */
      recipients?: unknown
      subject?: string
      email_html?: string
      email_text?: string
    }

    const jobId = typeof body.job_id === 'string' && body.job_id.trim() ? body.job_id.trim() : null
    const subject = typeof body.subject === 'string' ? body.subject.trim() : ''
    const emailHtml = typeof body.email_html === 'string' ? body.email_html.trim() : ''
    const emailText = typeof body.email_text === 'string' ? body.email_text.trim() : ''
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    // Prefer labeled recipients (v2.1606); fall back to the v2.1605 to_emails shape.
    const labeled = Array.isArray(body.recipients)
      ? (body.recipients as Array<{ label?: unknown; email?: unknown }>)
          .map((r) => ({
            label: typeof r?.label === 'string' ? r.label.trim() : '',
            email: typeof r?.email === 'string' ? r.email.trim() : '',
          }))
          .filter((r) => emailRegex.test(r.email))
      : []
    const toEmails =
      labeled.length > 0
        ? labeled.map((r) => r.email)
        : Array.isArray(body.to_emails)
          ? body.to_emails.filter((e): e is string => typeof e === 'string' && emailRegex.test(e.trim())).map((e) => e.trim())
          : []

    if (!jobId) {
      return jsonResponse({ error: 'job_id required' }, 400)
    }
    if (toEmails.length === 0 || toEmails.length > MAX_RECIPIENTS) {
      return jsonResponse({ error: `to_emails must contain 1–${MAX_RECIPIENTS} valid addresses` }, 400)
    }
    if (!subject || !emailHtml || !emailText) {
      return jsonResponse({ error: 'subject, email_html and email_text required' }, 400)
    }
    if (emailHtml.length > MAX_HTML_CHARS) {
      return jsonResponse({ error: 'email_html too large' }, 400)
    }

    // The job must be readable via the caller's RLS — blocks cross-tenant sends.
    const { data: jobRow, error: jobErr } = await userClient
      .from('jobs_ledger')
      .select('id')
      .eq('id', jobId)
      .maybeSingle()
    if (jobErr || !jobRow) {
      return jsonResponse({ error: 'Job not found or access denied' }, 403)
    }

    const replyTo = typeof me.email === 'string' && me.email.includes('@') ? me.email : undefined
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: toEmails,
        subject,
        html: emailHtml,
        text: emailText,
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
    })
    if (!resendResponse.ok) {
      const errorData = await resendResponse.json().catch(() => ({} as { message?: string }))
      return jsonResponse({ error: errorData.message || `Resend ${resendResponse.status}` }, 502)
    }
    const sent = (await resendResponse.json().catch(() => ({}))) as { id?: string }

    await logEmailSendBestEffort({
      resendEmailId: sent.id ?? null,
      to: toEmails,
      from: EMAIL_FROM,
      subject,
    })

    // Share ledger (v2.1606): one row per recipient, service role (the table
    // has no client write policies). Failure must not report the send as
    // failed — the email is already gone.
    try {
      const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      const serviceClient = createClient(supabaseUrl, serviceKey)
      const rows = (labeled.length > 0 ? labeled : toEmails.map((email) => ({ label: '', email }))).map((r) => ({
        job_id: jobId,
        contact_label: r.label,
        contact_email: r.email,
        sent_by: me.id,
        sent_by_name: typeof me.name === 'string' ? me.name : '',
      }))
      await serviceClient.from('supply_house_job_accounts').insert(rows)
    } catch (auditErr) {
      console.error('supply_house_job_accounts audit insert failed', auditErr)
    }

    return jsonResponse({ success: true, resend_email_id: sent.id ?? null })
  } catch (e) {
    console.error('send-supply-house-job-account error', e)
    return jsonResponse({ error: 'Internal error' }, 500)
  }
})
