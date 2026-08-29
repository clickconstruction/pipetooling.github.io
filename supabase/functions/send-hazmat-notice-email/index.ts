import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { logEmailSendBestEffort } from '../_shared/logEmailSend.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { EMAIL_FROM } from '../_shared/emailFrom.ts'

// Companion email for the Biohazard Remediation Fee Notice: Stripe invoices
// cannot carry attachments, so the notice PDF (built client-side, same as the
// physical-invoice flow) is emailed to the customer as its own message.
// No DB writes — re-sendable any time from Edit Job's Riders strip.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MAX_PDF_BASE64_CHARS = 6_000_000

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function normalizeEmail(s: string): string {
  return s.trim().toLowerCase()
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
    if (!authHeader) {
      return jsonResponse({ error: 'Unauthorized' }, 401)
    }
    const token = authHeader.replace(/^Bearer\s+/i, '')
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
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: authError } = await userClient.auth.getUser(token)
    if (authError || !user) {
      return jsonResponse({ error: 'Unauthorized' }, 401)
    }

    const body = (await req.json()) as {
      job_id?: string
      incident_id?: string
      customer_email?: string
      subject?: string
      pdf_base64?: string
      pdf_filename?: string
      email_text?: string
      email_html?: string
    }

    const jobId = typeof body.job_id === 'string' ? body.job_id.trim() : ''
    const incidentId = typeof body.incident_id === 'string' ? body.incident_id.trim() : ''
    const customerEmailIn = typeof body.customer_email === 'string' ? body.customer_email.trim() : ''
    const pdfBase64 = typeof body.pdf_base64 === 'string' ? body.pdf_base64.trim() : ''
    const pdfFilenameRaw = typeof body.pdf_filename === 'string' ? body.pdf_filename.trim() : ''
    const pdfFilename = (pdfFilenameRaw || 'biohazard-remediation-fee-notice.pdf').replace(/[^a-zA-Z0-9._-]/g, '_')

    if (!jobId || !incidentId) {
      return jsonResponse({ error: 'job_id and incident_id required' }, 400)
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(customerEmailIn)) {
      return jsonResponse({ error: 'Valid customer_email required' }, 400)
    }
    if (!pdfBase64 || pdfBase64.length > MAX_PDF_BASE64_CHARS) {
      return jsonResponse({ error: 'Invalid or oversized PDF attachment' }, 400)
    }

    // RLS-gated read: only office/billing roles can see incidents at all.
    const { data: incident, error: incErr } = await userClient
      .from('job_hazmat_incidents')
      .select('id, job_id, invoice_id')
      .eq('id', incidentId)
      .single()
    if (incErr || !incident) {
      return jsonResponse({ error: 'Incident not found or access denied' }, 403)
    }
    if (incident.job_id !== jobId) {
      return jsonResponse({ error: 'Incident does not belong to this job' }, 400)
    }

    const { data: jl, error: jlErr } = await userClient
      .from('jobs_ledger')
      .select('id, customer_id, customer_email')
      .eq('id', jobId)
      .single()
    if (jlErr || !jl?.customer_id) {
      return jsonResponse({ error: 'Job not found or not linked to a customer' }, 403)
    }
    // Bill-to override (v2.1085): when the incident's fee invoice bills an
    // alternate recipient (bill_to_email), the notice may go to that address
    // too — the payer of the fee should receive the notice.
    let billToEmail = ''
    const linkedInvoiceId =
      typeof (incident as { invoice_id?: string | null }).invoice_id === 'string'
        ? ((incident as { invoice_id?: string | null }).invoice_id ?? '').trim()
        : ''
    if (linkedInvoiceId) {
      const { data: linkedInv } = await userClient
        .from('jobs_ledger_invoices')
        .select('bill_to_email')
        .eq('id', linkedInvoiceId)
        .maybeSingle()
      billToEmail =
        typeof (linkedInv as { bill_to_email?: string | null } | null)?.bill_to_email === 'string'
          ? ((linkedInv as { bill_to_email?: string | null }).bill_to_email ?? '').trim()
          : ''
    }
    const jobEmail = typeof jl.customer_email === 'string' ? jl.customer_email.trim() : ''
    if (!jobEmail && !billToEmail) {
      return jsonResponse({ error: 'Job has no customer email; add it on Edit Job' }, 400)
    }
    const matchesJobEmail = jobEmail && normalizeEmail(customerEmailIn) === normalizeEmail(jobEmail)
    const matchesBillTo = billToEmail && normalizeEmail(customerEmailIn) === normalizeEmail(billToEmail)
    if (!matchesJobEmail && !matchesBillTo) {
      return jsonResponse(
        { error: billToEmail ? 'customer_email must match the fee invoice bill-to email or the job customer email' : 'customer_email must match the job customer email' },
        400,
      )
    }

    const subject =
      typeof body.subject === 'string' && body.subject.trim().length > 0
        ? body.subject.trim()
        : 'Biohazard Remediation Fee Notice'
    const textPlain =
      typeof body.email_text === 'string' && body.email_text.trim().length > 0
        ? body.email_text.trim()
        : 'Please find the Biohazard Remediation Fee Notice attached as a PDF.'
    const htmlBody =
      typeof body.email_html === 'string' && body.email_html.trim().length > 0
        ? body.email_html.trim()
        : `<p>${textPlain.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: [customerEmailIn],
        subject,
        html: htmlBody,
        text: textPlain,
        attachments: [{ filename: pdfFilename, content: pdfBase64 }],
      }),
    })
    if (!resendResponse.ok) {
      const errorData = await resendResponse.json().catch(() => ({} as { message?: string }))
      return jsonResponse({ error: errorData.message || `Resend ${resendResponse.status}` }, 502)
    }
    const resendSent = (await resendResponse.json().catch(() => ({}))) as { id?: string }
    await logEmailSendBestEffort({
      resendEmailId: resendSent.id ?? null,
      to: [customerEmailIn],
      from: EMAIL_FROM,
      subject,
    })

    // Stamp the send on the incident + audit trail (v2.1039). Service role:
    // job_hazmat_incidents and job_activity_events have no client write
    // policies by design — this function is the single funnel every notice
    // email goes through, so the stamp can't be skipped or forged. A stamp
    // failure never fails the request: the email is already out the door.
    try {
      const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
      if (serviceKey) {
        const admin = createClient(supabaseUrl, serviceKey)
        const sentAt = new Date().toISOString()
        await admin
          .from('job_hazmat_incidents')
          .update({ notice_emailed_at: sentAt, notice_emailed_to: customerEmailIn })
          .eq('id', incidentId)
        await admin.from('job_activity_events').insert({
          job_id: jobId,
          event_type: 'hazmat_notice_emailed',
          occurred_at: sentAt,
          actor_user_id: user.id,
          summary: `Biohazard fee notice emailed to ${customerEmailIn}`,
          detail: { source_id: `${incidentId}:${sentAt}`, incident_id: incidentId, to: customerEmailIn },
          financial: false,
        })
      }
    } catch (stampErr) {
      console.error('notice email sent but stamping failed', stampErr)
    }

    return jsonResponse({ success: true })
  } catch (e) {
    console.error(e)
    return jsonResponse({ error: e instanceof Error ? e.message : 'Unexpected error' }, 500)
  }
})
