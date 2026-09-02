import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { logEmailSendBestEffort } from '../_shared/logEmailSend.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { EMAIL_FROM } from '../_shared/emailFrom.ts'

// Email a SIGNED lien release to the job's customer, PDF attached (v2.2621 —
// the signing loop's "ready to send" lane). Mirrors send-physical-invoice-email:
// Bearer JWT + user-scoped client (RLS applies), recipient must match the job's
// customer email, Resend sends, then the release row is stamped sent. The PDF
// arrives from the client (stored signed.pdf bytes, else a regeneration).

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
      release_id?: string
      job_id?: string
      customer_email?: string
      subject?: string
      email_text?: string
      email_html?: string
      pdf_base64?: string
      pdf_filename?: string
    }

    const releaseId = typeof body.release_id === 'string' ? body.release_id.trim() : ''
    const jobId = typeof body.job_id === 'string' ? body.job_id.trim() : ''
    const customerEmailIn = typeof body.customer_email === 'string' ? body.customer_email.trim() : ''
    const pdfBase64 = typeof body.pdf_base64 === 'string' ? body.pdf_base64.trim() : ''
    const pdfFilename = (typeof body.pdf_filename === 'string' ? body.pdf_filename.trim() : '') || 'lien-release.pdf'

    if (!releaseId || !jobId) return jsonResponse({ error: 'release_id and job_id required' }, 400)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(customerEmailIn)) return jsonResponse({ error: 'Valid customer_email required' }, 400)
    if (!pdfBase64 || pdfBase64.length > MAX_PDF_BASE64_CHARS) {
      return jsonResponse({ error: 'Invalid or oversized PDF attachment' }, 400)
    }

    const { data: rel, error: relErr } = await userClient
      .from('job_lien_releases')
      .select('id, job_id, status, voided_at')
      .eq('id', releaseId)
      .single()
    if (relErr || !rel) return jsonResponse({ error: 'Release not found or access denied' }, 403)
    if (rel.job_id !== jobId) return jsonResponse({ error: 'Release does not belong to this job' }, 400)
    if (rel.voided_at) return jsonResponse({ error: 'This release was voided' }, 400)
    if (rel.status !== 'signed') return jsonResponse({ error: 'Only a signed release can be emailed' }, 400)

    const { data: jl, error: jlErr } = await userClient
      .from('jobs_ledger')
      .select('id, customer_email')
      .eq('id', jobId)
      .single()
    if (jlErr || !jl) return jsonResponse({ error: 'Job not found' }, 403)
    const jobEmail = typeof jl.customer_email === 'string' ? jl.customer_email.trim() : ''
    if (!jobEmail) return jsonResponse({ error: 'Job has no customer email; add it on Edit Job' }, 400)
    if (customerEmailIn.toLowerCase() !== jobEmail.toLowerCase()) {
      return jsonResponse({ error: 'customer_email must match the job customer email' }, 400)
    }

    const subject =
      typeof body.subject === 'string' && body.subject.trim().length > 0 ? body.subject.trim() : 'Release of lien'
    const textPlain =
      typeof body.email_text === 'string' && body.email_text.trim().length > 0
        ? body.email_text.trim()
        : 'Please find the signed release of lien attached as a PDF.'
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
        attachments: [{ filename: pdfFilename.replace(/[^a-zA-Z0-9._-]/g, '_'), content: pdfBase64 }],
      }),
    })
    if (!resendResponse.ok) {
      const errorData = await resendResponse.json().catch(() => ({} as { message?: string }))
      return jsonResponse({ error: errorData.message || `Resend ${resendResponse.status}` }, 502)
    }
    const sent = (await resendResponse.json().catch(() => ({}))) as { id?: string }
    await logEmailSendBestEffort({ resendEmailId: sent.id ?? null, to: [customerEmailIn], from: EMAIL_FROM, subject })

    const { error: upErr } = await userClient
      .from('job_lien_releases')
      .update({ sent_to_customer_at: new Date().toISOString(), sent_channel: 'email', sent_by: user.id })
      .eq('id', releaseId)
      .eq('status', 'signed')
    if (upErr) {
      console.error('send-lien-release-email: sent stamp after send', upErr)
      return jsonResponse(
        { error: 'Email was sent but the release could not be marked sent — mark it sent manually.' },
        500,
      )
    }

    return jsonResponse({ success: true })
  } catch (e) {
    console.error(e)
    return jsonResponse({ error: e instanceof Error ? e.message : 'Unexpected error' }, 500)
  }
})
