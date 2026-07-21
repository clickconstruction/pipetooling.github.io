import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MAX_PDF_BASE64_CHARS = 6_000_000
/** Optional companion documents (e.g. the Biohazard Remediation Fee Notice) sent as separate files. */
const MAX_EXTRA_ATTACHMENTS = 2
const MAX_TOTAL_BASE64_CHARS = 9_000_000

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function normalizeEmail(s: string): string {
  return s.trim().toLowerCase()
}

async function sendEmailWithAttachmentsViaResend(
  to: string,
  subject: string,
  textPlain: string,
  htmlBody: string,
  attachments: Array<{ filename: string; content: string }>,
  resendApiKey: string,
): Promise<{ success: boolean; error?: string }> {
  const resendResponse = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'PipeTooling <team@noreply.pipetooling.com>',
      to: [to],
      subject,
      html: htmlBody,
      text: textPlain,
      attachments,
    }),
  })
  if (!resendResponse.ok) {
    const errorData = await resendResponse.json().catch(() => ({} as { message?: string }))
    return { success: false, error: errorData.message || `Resend ${resendResponse.status}` }
  }
  return { success: true }
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
      jobs_ledger_invoice_id?: string
      job_id?: string
      amount_dollars?: number
      sent_to_customer_at?: string
      external_send_note?: string | null
      customer_email?: string
      subject?: string
      pdf_base64?: string
      pdf_filename?: string
      email_html?: string
      email_text?: string
      extra_attachments?: Array<{ filename?: string; content_base64?: string }>
    }

    const invoiceId = typeof body.jobs_ledger_invoice_id === 'string' ? body.jobs_ledger_invoice_id.trim() : ''
    const jobId = typeof body.job_id === 'string' ? body.job_id.trim() : ''
    const amountRaw = body.amount_dollars
    const amount =
      typeof amountRaw === 'number' && Number.isFinite(amountRaw)
        ? amountRaw
        : typeof amountRaw === 'string'
          ? Number(amountRaw)
          : NaN
    const sentAt =
      typeof body.sent_to_customer_at === 'string' && body.sent_to_customer_at.trim().length > 0
        ? body.sent_to_customer_at.trim()
        : new Date().toISOString()
    const externalNote =
      typeof body.external_send_note === 'string' ? body.external_send_note.trim() || null : null
    const customerEmailIn = typeof body.customer_email === 'string' ? body.customer_email.trim() : ''
    const pdfBase64 = typeof body.pdf_base64 === 'string' ? body.pdf_base64.trim() : ''
    const pdfFilenameRaw = typeof body.pdf_filename === 'string' ? body.pdf_filename.trim() : ''
    const pdfFilename = pdfFilenameRaw || 'invoice.pdf'

    if (!invoiceId || !jobId) {
      return jsonResponse({ error: 'jobs_ledger_invoice_id and job_id required' }, 400)
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return jsonResponse({ error: 'amount_dollars must be a positive number' }, 400)
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(customerEmailIn)) {
      return jsonResponse({ error: 'Valid customer_email required' }, 400)
    }
    if (!pdfBase64 || pdfBase64.length > MAX_PDF_BASE64_CHARS) {
      return jsonResponse({ error: 'Invalid or oversized PDF attachment' }, 400)
    }

    const extraIn = Array.isArray(body.extra_attachments) ? body.extra_attachments : []
    if (extraIn.length > MAX_EXTRA_ATTACHMENTS) {
      return jsonResponse({ error: `At most ${MAX_EXTRA_ATTACHMENTS} extra attachments allowed` }, 400)
    }
    const extraAttachments: Array<{ filename: string; content: string }> = []
    let totalBase64 = pdfBase64.length
    for (const a of extraIn) {
      const content = typeof a?.content_base64 === 'string' ? a.content_base64.trim() : ''
      const filenameRaw = typeof a?.filename === 'string' ? a.filename.trim() : ''
      if (!content || content.length > MAX_PDF_BASE64_CHARS) {
        return jsonResponse({ error: 'Invalid or oversized extra attachment' }, 400)
      }
      totalBase64 += content.length
      if (totalBase64 > MAX_TOTAL_BASE64_CHARS) {
        return jsonResponse({ error: 'Combined attachments too large' }, 400)
      }
      extraAttachments.push({
        filename: (filenameRaw || 'attachment.pdf').replace(/[^a-zA-Z0-9._-]/g, '_'),
        content,
      })
    }

    const { data: inv, error: invErr } = await userClient
      .from('jobs_ledger_invoices')
      .select('id, job_id, status, amount')
      .eq('id', invoiceId)
      .single()

    if (invErr || !inv) {
      return jsonResponse({ error: 'Invoice not found or access denied' }, 403)
    }
    if (inv.job_id !== jobId) {
      return jsonResponse({ error: 'Invoice does not belong to this job' }, 400)
    }
    if (inv.status !== 'ready_to_bill') {
      return jsonResponse({ error: 'Invoice must be Ready to Bill to send a physical invoice email' }, 400)
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
        : 'Invoice from PipeTooling'

    const textPlain =
      typeof body.email_text === 'string' && body.email_text.trim().length > 0
        ? body.email_text.trim()
        : 'Please find your invoice attached as a PDF. Thank you for your business.'
    const htmlBody =
      typeof body.email_html === 'string' && body.email_html.trim().length > 0
        ? body.email_html.trim()
        : `<p>${textPlain.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`

    const sendResult = await sendEmailWithAttachmentsViaResend(
      customerEmailIn,
      subject,
      textPlain,
      htmlBody,
      [{ filename: pdfFilename.replace(/[^a-zA-Z0-9._-]/g, '_'), content: pdfBase64 }, ...extraAttachments],
      resendApiKey,
    )
    if (!sendResult.success) {
      return jsonResponse({ error: sendResult.error ?? 'Failed to send email' }, 502)
    }

    const { error: upErr } = await userClient
      .from('jobs_ledger_invoices')
      .update({
        status: 'billed',
        amount,
        external_send_channel: 'physical',
        external_send_note: externalNote,
        sent_to_customer_at: sentAt,
      })
      .eq('id', invoiceId)
      .eq('status', 'ready_to_bill')

    if (upErr) {
      console.error('send-physical-invoice-email: invoice update after send', upErr)
      return jsonResponse(
        {
          error:
            'Email was sent but billing could not be recorded. Contact support if the job does not show as billed.',
        },
        500,
      )
    }

    return jsonResponse({ success: true })
  } catch (e) {
    console.error(e)
    return jsonResponse({ error: e instanceof Error ? e.message : 'Unexpected error' }, 500)
  }
})
