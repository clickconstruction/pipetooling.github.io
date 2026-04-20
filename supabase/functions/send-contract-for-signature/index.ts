import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

async function sha256HexFromString(value: string): Promise<string> {
  const data = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function randomUrlToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function hasSigningContent(row: {
  signing_body_html?: string | null
  canonical_document_url?: string | null
  url?: string | null
}): boolean {
  if (row.signing_body_html?.trim()) return true
  if (row.canonical_document_url?.trim()) return true
  if (row.url?.trim()) return true
  return false
}

const MAX_EMAIL_SUBJECT_LEN = 200
const MAX_EMAIL_INTRO_LEN = 4000

function clampEmailSubject(raw: unknown): string {
  if (typeof raw !== 'string') return ''
  const t = raw.trim()
  return t.length > MAX_EMAIL_SUBJECT_LEN ? t.slice(0, MAX_EMAIL_SUBJECT_LEN) : t
}

function clampEmailIntro(raw: unknown): string {
  if (typeof raw !== 'string') return ''
  const t = raw.trim().replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
  return t.length > MAX_EMAIL_INTRO_LEN ? t.slice(0, MAX_EMAIL_INTRO_LEN) : t
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Split on blank lines into paragraphs; single newlines become `<br>`. */
function introPlainToHtmlBlocks(intro: string): string {
  const parts = intro.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
  if (parts.length === 0) return `<p>${escapeHtml(intro)}</p>`
  return parts
    .map((block) => {
      const withBr = escapeHtml(block).replace(/\n/g, '<br>')
      return `<p>${withBr}</p>`
    })
    .join('')
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function sendEmailViaResend(
  to: string,
  subject: string,
  textPlain: string,
  htmlBody: string,
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
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const token = authHeader.replace(/^Bearer\s+/i, '')
    if (!token) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnon = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    if (!serviceKey) {
      return new Response(JSON.stringify({ error: 'Server misconfigured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const userClient = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: authError } = await userClient.auth.getUser(token)
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = (await req.json()) as {
      person_contract_document_id?: string
      signer_email?: string
      public_origin?: string
      email_subject?: string
      email_intro_plain?: string
    }
    const { person_contract_document_id, signer_email, public_origin } = body
    if (!person_contract_document_id || !signer_email?.trim()) {
      return new Response(
        JSON.stringify({ error: 'person_contract_document_id and signer_email required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(signer_email.trim())) {
      return new Response(JSON.stringify({ error: 'Invalid email' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: row, error: selErr } = await userClient
      .from('person_contract_documents')
      .select('id, person_name, document_name, status, signing_body_html, canonical_document_url, url')
      .eq('id', person_contract_document_id)
      .single()

    if (selErr || !row) {
      return new Response(JSON.stringify({ error: 'Contract document not found or access denied' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const doc = row as {
      id: string
      person_name: string
      document_name: string
      status: string
      signing_body_html: string | null
      canonical_document_url: string | null
      url: string | null
    }

    if (doc.status === 'signed') {
      return new Response(JSON.stringify({ error: 'This document is already signed' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!hasSigningContent(doc)) {
      return new Response(
        JSON.stringify({
          error:
            'Add contract text, a canonical document URL, or a reference link before sending for signature.',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    if (doc.status !== 'unsent' && doc.status !== 'sent') {
      return new Response(JSON.stringify({ error: 'Invalid status for sending' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const origin =
      (typeof public_origin === 'string' && public_origin.startsWith('http') ? public_origin : null) ??
        Deno.env.get('ESTIMATE_PUBLIC_ORIGIN') ??
        'https://pipetooling.github.io'

    const rawToken = randomUrlToken()
    const tokenHash = await sha256HexFromString(rawToken)
    const expiresAt = new Date(Date.now() + 14 * 86400000).toISOString()
    const acceptUrl = `${origin.replace(/\/$/, '')}/contract/accept?t=${encodeURIComponent(rawToken)}`

    const admin = createClient(supabaseUrl, serviceKey)
    const { data: updatedRows, error: upErr } = await admin
      .from('person_contract_documents')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
        public_token_hash: tokenHash,
        public_token_expires_at: expiresAt,
      })
      .eq('id', doc.id)
      .in('status', ['unsent', 'sent'])
      .select('id')

    if (upErr || !updatedRows?.length) {
      console.error(upErr)
      return new Response(JSON.stringify({ error: 'Could not activate signing link' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const subjectTrimmed = clampEmailSubject(body.email_subject)
    const subject =
      subjectTrimmed || `Sign contract: ${doc.document_name} (${doc.person_name})`

    const defaultIntroPlain = 'Please review and sign your contract.'
    const introTrimmed = clampEmailIntro(body.email_intro_plain)
    const introPlain = introTrimmed || defaultIntroPlain

    const textPlain =
      `${introPlain}\n\n` +
      `Document: ${doc.document_name}\n` +
      `Open this link to sign:\n${acceptUrl}\n`
    const introHtml = introPlainToHtmlBlocks(introPlain)
    const htmlBody =
      `${introHtml}` +
      `<p><strong>${escapeHtml(doc.document_name)}</strong> — ${escapeHtml(doc.person_name)}</p>` +
      `<p><a href="${acceptUrl}">Open signing page</a></p>`

    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (!resendApiKey) {
      return new Response(
        JSON.stringify({
          ok: true,
          emailed: false,
          accept_url: acceptUrl,
          warning: 'RESEND_API_KEY not set; link not emailed',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const sent = await sendEmailViaResend(signer_email.trim(), subject, textPlain, htmlBody, resendApiKey)
    if (!sent.success) {
      return new Response(
        JSON.stringify({
          ok: true,
          emailed: false,
          accept_url: acceptUrl,
          email_error: sent.error,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    return new Response(
      JSON.stringify({ ok: true, emailed: true, accept_url: acceptUrl }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (e) {
    console.error(e)
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
