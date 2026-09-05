import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { logEmailSendBestEffort } from '../_shared/logEmailSend.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  ESTIMATE_EXPERIENCE_APP_KEY_LIST,
  parseEstimateCustomerExperienceSnapshot,
  resolveEstimateCustomerExperience,
  serializableSnapshot,
} from '../_shared/estimateCustomerExperience.ts'
import { brandImageAbsoluteUrl, parseAcceptHeaderBrandForEmail } from '../_shared/estimateEmailBrandImage.ts'
import { buildEstimateLetterheadEmail, estimateEmailCompanyName } from '../_shared/estimateEmailLetterhead.ts'
import { APP_CALENDAR_TZ } from '../_shared/appTimeZone.ts'
import { buildCustomerAttachmentSentPayload } from '../_shared/estimateCustomerAttachment.ts'
import { EMAIL_FROM } from '../_shared/emailFrom.ts'
import { normalizeSharedEstimateOptions, sharedEstimateOptionTotalCents } from '../_shared/estimateOptions.ts'
import {
  canResendEstimateLink,
  estimateLinkResendBlockMessage,
  rewriteEstimateAcceptUrl,
} from '../_shared/estimateLinkResend.ts'

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

    // mode 'resend' (J17-F2/N3): re-mint the token on an already-sent estimate and mail the
    // stored email again. `customer_email` is optional there — the row's address is the default.
    const body = (await req.json()) as {
      estimate_id?: string
      customer_email?: string
      public_origin?: string
      mode?: 'send' | 'resend'
    }
    const { estimate_id, public_origin } = body
    const isResend = body.mode === 'resend'
    const requestedEmail = body.customer_email?.trim() ?? ''
    if (!estimate_id || (!isResend && !requestedEmail)) {
      return new Response(JSON.stringify({ error: 'estimate_id and customer_email required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (requestedEmail && !emailRegex.test(requestedEmail)) {
      return new Response(JSON.stringify({ error: 'Invalid email' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: est, error: selErr } = await userClient
      .from('estimates')
      .select(
        'id, title, status, sent_at, customer_email, bid_room_id, customer_experience_sent, line_items_snapshot, terms_snapshot, total_cents, estimate_number, customer_experience_overrides, accept_header_brand, customer_attachment_url, customer_attachment_label, doc_kind, options_snapshot, valid_until, for_address',
      )
      .eq('id', estimate_id)
      .single()

    if (selErr || !est) {
      return new Response(JSON.stringify({ error: 'Estimate not found or access denied' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (isResend) {
      const verdict = canResendEstimateLink(est.status, (est as { sent_at?: string | null }).sent_at, new Date(), {
        validUntil: (est as { valid_until?: string | null }).valid_until ?? null,
        inBidRoom: Boolean((est as { bid_room_id?: string | null }).bid_room_id),
      })
      if (!verdict.ok) {
        return new Response(JSON.stringify({ error: estimateLinkResendBlockMessage(verdict.reason), code: verdict.reason }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    } else if (est.status !== 'draft') {
      return new Response(JSON.stringify({ error: 'Only draft estimates can be sent' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const customer_email = requestedEmail || String((est as { customer_email?: string | null }).customer_email ?? '').trim()
    if (!customer_email || !emailRegex.test(customer_email)) {
      return new Response(JSON.stringify({ error: 'This estimate has no customer email on record to resend to' }), {
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

    // A resend mails the copy the customer already saw (the stored snapshot) with only the accept
    // URL swapped — never a rebuild from today's templates. Rows without a parseable snapshot
    // (pre-snapshot sends) fall back to resolving from current settings, same as a first send.
    const storedSnapshot = isResend
      ? parseEstimateCustomerExperienceSnapshot((est as { customer_experience_sent?: unknown }).customer_experience_sent)
      : null
    const resolved = storedSnapshot
      ? { ...storedSnapshot, emailBody: rewriteEstimateAcceptUrl(storedSnapshot.emailBody, acceptUrl) }
      : resolveEstimateCustomerExperience(
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

    // Resend: only the token (and the snapshot's URL) move. `sent_at`, the frozen line items,
    // terms, total and attachment stay as the first send left them — the customer has been
    // waiting since then, and the Sent chip's age keeps telling the truth. Overwriting
    // `public_token_hash` is what retires the old link (lookup is by hash → 404).
    const { error: upErr } = isResend
      ? await admin
          .from('estimates')
          .update({
            customer_email,
            public_token_hash: tokenHash,
            public_token_expires_at: expiresAt,
            customer_experience_sent: sentPayload,
          })
          .eq('id', estimate_id)
          .eq('status', 'sent')
      : await admin
          .from('estimates')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            customer_email,
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
      return new Response(JSON.stringify({ error: isResend ? 'Could not refresh the customer link' : 'Could not activate send link' }), {
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
          resent: isResend,
          sent_to: customer_email,
          accept_url: acceptUrl,
          warning: 'RESEND_API_KEY not set; link not emailed',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const sent = await sendEmailViaResend(customer_email, mail.subject, mail.text, mail.html, resendApiKey, fromMailbox, mail.replyTo)
    if (!sent.success) {
      return new Response(
        JSON.stringify({
          ok: true,
          emailed: false,
          resent: isResend,
          sent_to: customer_email,
          accept_url: acceptUrl,
          email_error: sent.error,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    return new Response(
      JSON.stringify({ ok: true, emailed: true, resent: isResend, sent_to: customer_email, accept_url: acceptUrl }),
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
