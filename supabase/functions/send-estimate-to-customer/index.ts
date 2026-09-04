import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { logEmailSendBestEffort } from '../_shared/logEmailSend.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  ESTIMATE_EXPERIENCE_APP_KEY_LIST,
  resolveEstimateCustomerExperience,
  serializableSnapshot,
} from '../_shared/estimateCustomerExperience.ts'
import { brandImageAbsoluteUrl, parseAcceptHeaderBrandForEmail } from '../_shared/estimateEmailBrandImage.ts'
import { buildEstimateLetterheadEmail, estimateEmailCompanyName } from '../_shared/estimateEmailLetterhead.ts'
import { APP_CALENDAR_TZ } from '../_shared/appTimeZone.ts'
import { buildCustomerAttachmentSentPayload } from '../_shared/estimateCustomerAttachment.ts'
import { EMAIL_FROM } from '../_shared/emailFrom.ts'
import { normalizeSharedEstimateOptions, sharedEstimateOptionTotalCents } from '../_shared/estimateOptions.ts'

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
  from: string,
  replyTo: string | null,
): Promise<{ success: boolean; error?: string }> {
  const resendResponse = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
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
  await logEmailSendBestEffort({ resendEmailId: sent.id ?? null, to: [to], from, subject })
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

    const { estimate_id, customer_email, public_origin } = (await req.json()) as {
      estimate_id?: string
      customer_email?: string
      public_origin?: string
    }
    if (!estimate_id || !customer_email?.trim()) {
      return new Response(JSON.stringify({ error: 'estimate_id and customer_email required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(customer_email.trim())) {
      return new Response(JSON.stringify({ error: 'Invalid email' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: est, error: selErr } = await userClient
      .from('estimates')
      .select(
        'id, title, status, line_items_snapshot, terms_snapshot, total_cents, estimate_number, customer_experience_overrides, accept_header_brand, customer_attachment_url, customer_attachment_label, doc_kind, options_snapshot, valid_until, for_address',
      )
      .eq('id', estimate_id)
      .single()

    if (selErr || !est) {
      return new Response(JSON.stringify({ error: 'Estimate not found or access denied' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (est.status !== 'draft') {
      return new Response(JSON.stringify({ error: 'Only draft estimates can be sent' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const origin =
      (typeof public_origin === 'string' && public_origin.startsWith('http') ? public_origin : null)
        ?? Deno.env.get('ESTIMATE_PUBLIC_ORIGIN')
        ?? 'https://pipetooling.github.io'

    const rawToken = randomUrlToken()
    const tokenHash = await sha256HexFromString(rawToken)
    const expiresAt = new Date(Date.now() + 14 * 86400000).toISOString()
    const acceptUrl = `${origin.replace(/\/$/, '')}/estimate/accept?t=${encodeURIComponent(rawToken)}`

    const admin = createClient(supabaseUrl, serviceKey)
    const { data: appRows } = await admin
      .from('app_settings')
      .select('key, value_text')
      .in('key', ESTIMATE_EXPERIENCE_APP_KEY_LIST)

    const resolved = resolveEstimateCustomerExperience(
      appRows ?? [],
      est.customer_experience_overrides,
      {
        acceptUrl,
        title: String(est.title ?? ''),
        estimateNumber: Number(est.estimate_number ?? 0),
      },
      { docKind: (est as { doc_kind?: string | null }).doc_kind ?? null },
    )

    // The Letterhead email (v2.2747): built once here, previewed by the same builder in the app.
    const { data: me } = await admin.from('users').select('name, email').eq('id', user.id).maybeSingle()
    const sender = me
      ? {
          name: String((me as { name?: string | null }).name ?? '').trim(),
          email: String((me as { email?: string | null }).email ?? '').trim(),
        }
      : null
    const brand = parseAcceptHeaderBrandForEmail((est as { accept_header_brand?: unknown }).accept_header_brand)
    // Estimate Options (v2.2460, owner decision 5): the email shows every option's price —
    // the ladder itself is persuasive; the page still does the choosing.
    const emailOptions = normalizeSharedEstimateOptions((est as { options_snapshot?: unknown }).options_snapshot)
    const dateLabel = new Intl.DateTimeFormat('en-US', { timeZone: APP_CALENDAR_TZ, month: 'short', day: 'numeric', year: 'numeric' }).format(new Date())
    const mail = buildEstimateLetterheadEmail({
      docKind: (est as { doc_kind?: string | null }).doc_kind === 'change_order' ? 'change_order' : 'estimate',
      estimateNumber: Number(est.estimate_number ?? 0),
      title: String(est.title ?? ''),
      totalCents: Number(est.total_cents ?? 0),
      validUntilYmd: (est as { valid_until?: string | null }).valid_until ?? null,
      forAddress: (est as { for_address?: string | null }).for_address ?? null,
      acceptUrl,
      brand,
      brandImageUrl: brand ? brandImageAbsoluteUrl(origin, brand) : null,
      bodyText: resolved.emailBody,
      options: emailOptions.map((o) => ({ name: o.name, recommended: o.recommended, totalCents: sharedEstimateOptionTotalCents(o) })),
      footerLines: resolved.acceptPageFooter.split('\n'),
      sender,
      dateLabel,
    })
    // From keeps EMAIL_FROM's verified address; only the display name becomes the company the
    // customer knows (they never met "ClickTooling").
    const fromAddress = /<([^>]+)>/.exec(EMAIL_FROM)?.[1]?.trim() ?? EMAIL_FROM
    const fromMailbox = `${estimateEmailCompanyName(brand)} <${fromAddress}>`
    const sentPayload = serializableSnapshot({ ...resolved, emailSubject: mail.subject })
    const estRow = est as {
      customer_attachment_url?: string | null
      customer_attachment_label?: string | null
    }
    const customer_attachment_sent = buildCustomerAttachmentSentPayload(
      estRow.customer_attachment_url,
      estRow.customer_attachment_label,
    )

    const { error: upErr } = await admin
      .from('estimates')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
        customer_email: customer_email.trim(),
        public_token_hash: tokenHash,
        public_token_expires_at: expiresAt,
        line_items_snapshot: est.line_items_snapshot,
        terms_snapshot: est.terms_snapshot,
        total_cents: est.total_cents,
        customer_experience_sent: sentPayload,
        customer_attachment_sent,
      })
      .eq('id', estimate_id)
      .eq('status', 'draft')

    if (upErr) {
      console.error(upErr)
      return new Response(JSON.stringify({ error: 'Could not activate send link' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

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

    const sent = await sendEmailViaResend(customer_email.trim(), mail.subject, mail.text, mail.html, resendApiKey, fromMailbox, mail.replyTo)
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
