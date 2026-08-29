import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { logEmailSendBestEffort } from '../_shared/logEmailSend.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { EMAIL_FROM } from '../_shared/emailFrom.ts'

/**
 * Send a GC statement email (v2.1416, phase 2 of GC statements).
 *
 * Auth: user JWT verified in-handler (config.toml sets verify_jwt = false);
 * caller must be dev / master_technician / assistant / controller / primary —
 * the same cohort that can open GC Review. The GC customer must be readable
 * through the caller's RLS (blocks cross-tenant sends); the recipient address
 * itself is office-chosen (statements often go to an AP inbox not on file).
 *
 * Sends via Resend from the EMAIL_FROM sender with the caller's email
 * as reply-to, then audits into public.gc_statement_emails with the service
 * role (the table has no client write policies) and best-effort logs to
 * email_send_log like every other app send.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ALLOWED_ROLES = ['dev', 'master_technician', 'assistant', 'controller', 'primary']
const MAX_HTML_CHARS = 300_000

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
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
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
      return jsonResponse({ error: 'Not allowed to send GC statements' }, 403)
    }

    const body = (await req.json()) as {
      gc_customer_id?: string | null
      gc_name?: string
      group_by?: string
      to_email?: string
      /** CC recipients (v2.2160) — validated/capped here too; never the To address. */
      cc_emails?: unknown
      subject?: string
      email_html?: string
      email_text?: string
      total?: number
      job_count?: number
    }

    const gcCustomerId = typeof body.gc_customer_id === 'string' && body.gc_customer_id.trim() ? body.gc_customer_id.trim() : null
    const gcName = typeof body.gc_name === 'string' ? body.gc_name.trim() : ''
    // 'all' = the full GC Review report in one email ("Share all", v2.1420) —
    // like development statements it carries no customer id.
    const groupBy = body.group_by === 'development' ? 'development' : body.group_by === 'all' ? 'all' : 'gc'
    const toEmail = typeof body.to_email === 'string' ? body.to_email.trim() : ''
    const subject = typeof body.subject === 'string' ? body.subject.trim() : ''
    const emailHtml = typeof body.email_html === 'string' ? body.email_html.trim() : ''
    const emailText = typeof body.email_text === 'string' ? body.email_text.trim() : ''
    const total = typeof body.total === 'number' && Number.isFinite(body.total) ? body.total : NaN
    const jobCount = typeof body.job_count === 'number' && Number.isInteger(body.job_count) ? body.job_count : 0

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(toEmail)) {
      return jsonResponse({ error: 'Valid to_email required' }, 400)
    }
    // CC (v2.2160): mirror of src/lib/gcStatementCc.ts parseCcEmails — lower-case, valid, unique, not the To, ≤ 10.
    const ccEmails: string[] = []
    if (Array.isArray(body.cc_emails)) {
      for (const raw of body.cc_emails) {
        if (typeof raw !== 'string') continue
        const e = raw.trim().toLowerCase()
        if (!e || !emailRegex.test(e) || e === toEmail.toLowerCase() || ccEmails.includes(e)) continue
        ccEmails.push(e)
        if (ccEmails.length >= 10) break
      }
    }
    if (!gcName || !subject || !emailHtml || !emailText) {
      return jsonResponse({ error: 'gc_name, subject, email_html and email_text required' }, 400)
    }
    if (emailHtml.length > MAX_HTML_CHARS) {
      return jsonResponse({ error: 'email_html too large' }, 400)
    }
    if (!Number.isFinite(total) || total < 0 || jobCount < 0) {
      return jsonResponse({ error: 'total and job_count must be non-negative numbers' }, 400)
    }

    // GC statements are keyed to a customer row; development statements have
    // no customer id. When an id is given it must be readable via the
    // caller's RLS — blocks cross-tenant sends.
    if (groupBy === 'gc') {
      if (!gcCustomerId) {
        return jsonResponse({ error: 'gc_customer_id required for GC statements' }, 400)
      }
      const { data: gcRow, error: gcErr } = await userClient
        .from('customers')
        .select('id')
        .eq('id', gcCustomerId)
        .maybeSingle()
      if (gcErr || !gcRow) {
        return jsonResponse({ error: 'GC customer not found or access denied' }, 403)
      }
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
        to: [toEmail],
        ...(ccEmails.length ? { cc: ccEmails } : {}),
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
      to: [toEmail, ...ccEmails],
      from: EMAIL_FROM,
      subject,
    })

    // Audit row (service role — table has no client write policies). Failure
    // here must not report the send as failed: the email is already gone.
    try {
      const serviceClient = createClient(supabaseUrl, serviceKey)
      await serviceClient.from('gc_statement_emails').insert({
        gc_customer_id: gcCustomerId,
        gc_name: gcName,
        group_by: groupBy,
        sent_to: toEmail,
        subject,
        total,
        job_count: jobCount,
        sent_by: me.id,
        sent_by_name: typeof me.name === 'string' ? me.name : '',
        resend_email_id: sent.id ?? null,
        cc_emails: ccEmails.length ? ccEmails : null,
      })
    } catch (auditErr) {
      console.error('gc_statement_emails audit insert failed', auditErr)
    }

    return jsonResponse({ success: true, resend_email_id: sent.id ?? null })
  } catch (e) {
    console.error('send-gc-statement-email error', e)
    return jsonResponse({ error: 'Internal error' }, 500)
  }
})
