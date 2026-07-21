import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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
      .select('id, job_id')
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
    const jobEmail = typeof jl.customer_email === 'string' ? jl.customer_email.trim() : ''
    if (!jobEmail) {
      return jsonResponse({ error: 'Job has no customer email; add it on Edit Job' }, 400)
    }
    if (normalizeEmail(customerEmailIn) !== normalizeEmail(jobEmail)) {
      return jsonResponse({ error: 'customer_email must match the job customer email' }, 400)
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
        from: 'PipeTooling <team@noreply.pipetooling.com>',
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

    return jsonResponse({ success: true })
  } catch (e) {
    console.error(e)
    return jsonResponse({ error: e instanceof Error ? e.message : 'Unexpected error' }, 500)
  }
})
