import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  ESTIMATE_EXPERIENCE_APP_KEY_LIST,
  resolveEstimateCustomerExperience,
  serializableSnapshot,
} from '../_shared/estimateCustomerExperience.ts'
import {
  acceptHeaderBrandImageAlt,
  brandImageAbsoluteUrl,
  buildEstimateEmailHtml,
  parseAcceptHeaderBrandForEmail,
} from '../_shared/estimateEmailBrandImage.ts'

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
        'id, title, status, line_items_snapshot, terms_snapshot, total_cents, estimate_number, customer_experience_overrides, accept_header_brand',
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
    )
    const sentPayload = serializableSnapshot(resolved)

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

    const subject = resolved.emailSubject
    const body = resolved.emailBody
    const brand = parseAcceptHeaderBrandForEmail(
      (est as { accept_header_brand?: unknown }).accept_header_brand,
    )
    const htmlBody = buildEstimateEmailHtml(
      body,
      brand
        ? {
            imageUrl: brandImageAbsoluteUrl(origin, brand),
            imageAlt: acceptHeaderBrandImageAlt(brand),
          }
        : undefined,
    )

    const sent = await sendEmailViaResend(
      customer_email.trim(),
      subject,
      body,
      htmlBody,
      resendApiKey,
    )
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
