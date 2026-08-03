import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Resend signs webhooks with Svix headers: svix-id, svix-timestamp, svix-signature.
// The secret from the Resend dashboard looks like "whsec_<base64>"; the signed
// content is `${svixId}.${svixTimestamp}.${body}` and signatures are base64,
// space-separated as "v1,<sig> v1,<sig2> ...".

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type, svix-id, svix-timestamp, svix-signature',
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin)
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

async function verifySvixSignature(
  body: string,
  svixId: string | null,
  svixTimestamp: string | null,
  svixSignature: string | null,
  secret: string,
): Promise<boolean> {
  if (!svixId || !svixTimestamp || !svixSignature) return false
  const tsNum = parseInt(svixTimestamp, 10)
  if (Number.isNaN(tsNum)) return false
  const now = Math.floor(Date.now() / 1000)
  if (Math.abs(now - tsNum) > 300) return false

  const secretB64 = secret.startsWith('whsec_') ? secret.slice('whsec_'.length) : secret
  const key = await crypto.subtle.importKey(
    'raw',
    base64ToBytes(secretB64),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signedContent = `${svixId}.${svixTimestamp}.${body}`
  const sigBuf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signedContent))
  const expected = bytesToBase64(new Uint8Array(sigBuf))

  // Header may contain several space-separated "v1,<base64>" candidates (key rotation).
  for (const part of svixSignature.split(' ')) {
    const commaIdx = part.indexOf(',')
    if (commaIdx < 0) continue
    if (part.slice(0, commaIdx) !== 'v1') continue
    if (timingSafeEqual(part.slice(commaIdx + 1), expected)) return true
  }
  return false
}

type ResendWebhookEvent = {
  type?: string
  created_at?: string
  data?: {
    email_id?: string
    id?: string
    from?: string
    to?: string[] | string
    subject?: string
    created_at?: string
  }
}

function toEmailArray(to: string[] | string | undefined): string[] {
  if (Array.isArray(to)) return to.filter((t): t is string => typeof t === 'string')
  if (typeof to === 'string' && to.trim()) return [to]
  return []
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  try {
    const secret = Deno.env.get('RESEND_WEBHOOK_SECRET')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    if (!secret?.trim() || !serviceKey) {
      console.error('resend-webhook: missing RESEND_WEBHOOK_SECRET or service role')
      return jsonResponse({ error: 'Server misconfigured' }, 500)
    }

    const body = await req.text()
    const ok = await verifySvixSignature(
      body,
      req.headers.get('svix-id'),
      req.headers.get('svix-timestamp'),
      req.headers.get('svix-signature'),
      secret,
    )
    if (!ok) return jsonResponse({ error: 'Invalid signature' }, 400)

    let event: ResendWebhookEvent
    try {
      event = JSON.parse(body) as ResendWebhookEvent
    } catch {
      return jsonResponse({ error: 'Invalid JSON' }, 400)
    }

    const type = event.type ?? ''
    if (!type.startsWith('email.')) return jsonResponse({ ok: true, ignored: type })
    const emailId = event.data?.email_id ?? event.data?.id
    if (!emailId) return jsonResponse({ ok: true, ignored: 'no email id' })

    const lastEvent = type.slice('email.'.length) // sent, delivered, bounced, opened, …
    const eventAt = event.created_at ?? new Date().toISOString()
    const admin = createClient(supabaseUrl, serviceKey)

    const { data: existing } = await admin
      .from('email_send_log')
      .select('id')
      .eq('resend_email_id', emailId)
      .maybeSingle()

    if (existing) {
      const { error } = await admin
        .from('email_send_log')
        .update({
          last_event: lastEvent,
          last_event_at: eventAt,
          // Fill identity fields if a later event carries them (sent usually does).
          ...(event.data?.from ? { from_email: event.data.from } : {}),
          ...(event.data?.subject ? { subject: event.data.subject } : {}),
          ...(toEmailArray(event.data?.to).length > 0 ? { to_emails: toEmailArray(event.data?.to) } : {}),
        })
        .eq('id', (existing as { id: string }).id)
      if (error) return jsonResponse({ error: error.message }, 500)
    } else {
      const { error } = await admin.from('email_send_log').insert({
        resend_email_id: emailId,
        sent_at: event.data?.created_at ?? eventAt,
        from_email: event.data?.from ?? null,
        to_emails: toEmailArray(event.data?.to),
        subject: event.data?.subject ?? null,
        last_event: lastEvent,
        last_event_at: eventAt,
        source: 'webhook',
      })
      if (error && (error as { code?: string }).code !== '23505') {
        return jsonResponse({ error: error.message }, 500)
      }
    }

    return jsonResponse({ ok: true })
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : 'Unexpected error' }, 500)
  }
})
