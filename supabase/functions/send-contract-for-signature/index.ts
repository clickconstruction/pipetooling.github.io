import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { logEmailSendBestEffort } from '../_shared/logEmailSend.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { EMAIL_FROM } from '../_shared/emailFrom.ts'
import { todayYmdInAppTz } from '../_shared/appTimeZone.ts'
import { PORTAL_COMPANY } from '../_shared/portalCompany.ts'
import { buildContractSigningEmail, clampContractEmailIntro, clampContractEmailSubject } from '../_shared/contractSigningEmail.ts'

/** Short portal address root — mirrors `PORTAL_SHORT_ORIGIN` in src/lib/portal/portalShortOrigin.ts. */
const PORTAL_SHORT_ORIGIN = 'https://my.clickplumbing.com/'

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
  fromMailbox: string,
  replyTo: string | null,
): Promise<{ success: boolean; error?: string }> {
  const resendResponse = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromMailbox,
      to: [to],
      subject,
      html: htmlBody,
      text: textPlain,
      ...(replyTo ? { reply_to: replyTo } : {}),
    }),
  })
  if (!resendResponse.ok) {
    const errorData = await resendResponse.json().catch(() => ({} as { message?: string }))
    return { success: false, error: errorData.message || `Resend ${resendResponse.status}` }
  }
  const sent = (await resendResponse.json().catch(() => ({}))) as { id?: string }
  await logEmailSendBestEffort({ resendEmailId: sent.id ?? null, to: [to], from: fromMailbox, subject, emailType: 'contract_for_signature' })
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

    // The staff member pressing send: Reply-To and the "reach" line. Best effort — a missing
    // users row (service accounts) just drops the sender from the email.
    const { data: senderRow } = await admin.from('users').select('name, email').eq('id', user.id).maybeSingle()
    const senderName = ((senderRow as { name?: string | null } | null)?.name ?? '').trim()
    const senderEmail = ((senderRow as { email?: string | null } | null)?.email ?? user.email ?? '').trim()
    const sender = senderEmail ? { name: senderName, email: senderEmail } : null

    // The person's live portal address, if they have one: a saved slug AND an unrevoked link.
    // Read-only — nothing is minted to send an email (the portal's no-mint-on-demand rule).
    let portalUrl: string | null = null
    try {
      const { data: personRows } = await admin
        .from('people')
        .select('id')
        .eq('name', doc.person_name.trim())
        .is('archived_at', null)
        .limit(2)
      const personIds = ((personRows ?? []) as Array<{ id: string }>).map((r) => r.id)
      if (personIds.length === 1) {
        const personId = personIds[0]!
        const [{ data: slugRow }, { data: linkRows }] = await Promise.all([
          admin.from('sub_portal_slugs').select('slug').eq('person_id', personId).maybeSingle(),
          admin.from('sub_portal_links').select('id').eq('person_id', personId).is('revoked_at', null).limit(1),
        ])
        const slug = ((slugRow as { slug?: string | null } | null)?.slug ?? '').trim()
        if (slug && (linkRows ?? []).length > 0) portalUrl = `${PORTAL_SHORT_ORIGIN}${slug}`
      }
    } catch (e) {
      console.warn('portal lookup skipped', e)
    }

    const mail = buildContractSigningEmail({
      documentName: doc.document_name,
      personName: doc.person_name,
      acceptUrl,
      expiresYmd: todayYmdInAppTz(new Date(expiresAt)),
      sentYmd: todayYmdInAppTz(),
      subjectOverride: clampContractEmailSubject(body.email_subject),
      introPlain: clampContractEmailIntro(body.email_intro_plain),
      sender,
      portalUrl,
      officePhone: PORTAL_COMPANY.phone || null,
    })
    const subject = mail.subject
    const textPlain = mail.text
    const htmlBody = mail.html
    // From keeps EMAIL_FROM's verified address; only the display name becomes the company the
    // sub knows (they never met "ClickTooling").
    const fromAddress = /<([^>]+)>/.exec(EMAIL_FROM)?.[1]?.trim() ?? EMAIL_FROM
    const fromMailbox = `${mail.fromName} <${fromAddress}>`

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

    const sent = await sendEmailViaResend(signer_email.trim(), subject, textPlain, htmlBody, resendApiKey, fromMailbox, mail.replyTo)
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
