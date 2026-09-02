import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { logEmailSendBestEffort } from '../_shared/logEmailSend.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { EMAIL_FROM } from '../_shared/emailFrom.ts'

// Email a lien-instrument PDF (v2.2645 — the § 53.056 notice today; the shape
// is instrument-agnostic) to a named recipient about a job the caller can
// access. Mirrors send-lien-release-email: Bearer JWT + user-scoped client so
// RLS proves office/master access to the job; the PDF arrives from the client;
// Resend sends; the caller records the send on its filing row afterward.
// Email is a COURTESY copy — the statutory path stays certified mail /
// traceable delivery, recorded with its tracking number.

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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return jsonResponse({ error: 'Unauthorized' }, 401)
    const token = authHeader.replace(/^Bearer\s+/i, '')
    if (!token) return jsonResponse({ error: 'Unauthorized' }, 401)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnon = Deno.env.get('SUPABASE_ANON_KEY')!
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (!resendApiKey) return jsonResponse({ error: 'RESEND_API_KEY not configured' }, 500)

    const userClient = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: authError } = await userClient.auth.getUser(token)
    if (authError || !user) return jsonResponse({ error: 'Unauthorized' }, 401)

    const body = (await req.json()) as {
      job_id?: string
      to_email?: string
      recipient_label?: string
      subject?: string
      email_text?: string
      pdf_base64?: string
      pdf_filename?: string
    }

    const jobId = typeof body.job_id === 'string' ? body.job_id.trim() : ''
    const toEmail = typeof body.to_email === 'string' ? body.to_email.trim() : ''
    const pdfBase64 = typeof body.pdf_base64 === 'string' ? body.pdf_base64.trim() : ''
    const pdfFilename = (typeof body.pdf_filename === 'string' ? body.pdf_filename.trim() : '') || 'lien-notice.pdf'

    if (!jobId) return jsonResponse({ error: 'job_id required' }, 400)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(toEmail)) return jsonResponse({ error: 'Valid to_email required' }, 400)
    if (!pdfBase64 || pdfBase64.length > MAX_PDF_BASE64_CHARS) {
      return jsonResponse({ error: 'Invalid or oversized PDF attachment' }, 400)
    }

    // RLS is the access check: only office/master roles can read the job row.
    const { data: jl, error: jlErr } = await userClient
      .from('jobs_ledger')
      .select('id, job_name, hcp_number')
      .eq('id', jobId)
      .single()
    if (jlErr || !jl) return jsonResponse({ error: 'Job not found or access denied' }, 403)

    const subject =
      typeof body.subject === 'string' && body.subject.trim().length > 0
        ? body.subject.trim()
        : `Notice of claim for unpaid labor or materials — ${jl.job_name ?? 'job'}`
    const textPlain =
      typeof body.email_text === 'string' && body.email_text.trim().length > 0
        ? body.email_text.trim()
        : 'Please find the attached notice of claim for unpaid labor or materials (Tex. Prop. Code § 53.056). A copy is also being delivered by certified mail.'
    const htmlBody = `<p>${textPlain.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br/>')}</p>`

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: [toEmail],
        subject,
        html: htmlBody,
        text: textPlain,
        attachments: [{ filename: pdfFilename.replace(/[^a-zA-Z0-9._-]/g, '_'), content: pdfBase64 }],
      }),
    })
    if (!resendResponse.ok) {
      const errorData = await resendResponse.json().catch(() => ({} as { message?: string }))
      return jsonResponse({ error: errorData.message || `Resend ${resendResponse.status}` }, 502)
    }
    const sent = (await resendResponse.json().catch(() => ({}))) as { id?: string }
    await logEmailSendBestEffort({ resendEmailId: sent.id ?? null, to: [toEmail], from: EMAIL_FROM, subject, emailType: 'lien_filing_notice' })

    return jsonResponse({ success: true, resend_email_id: sent.id ?? null })
  } catch (e) {
    console.error(e)
    return jsonResponse({ error: e instanceof Error ? e.message : 'Unexpected error' }, 500)
  }
})
