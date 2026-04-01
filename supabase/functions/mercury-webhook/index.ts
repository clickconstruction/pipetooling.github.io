import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type, mercury-signature',
}

const MERCURY_BASE = 'https://api.mercury.com/api/v1'

function mapMercuryTransactionToRow(t: Record<string, unknown>, syncedAt: string) {
  return {
    mercury_id: t.id as string,
    mercury_account_id: t.accountId as string,
    amount: t.amount as number,
    currency: 'USD',
    created_at: t.createdAt as string,
    posted_at: (t.postedAt as string | null | undefined) ?? null,
    status: t.status as string,
    kind: t.kind as string,
    counterparty_id: (t.counterpartyId as string | null | undefined) ?? null,
    counterparty_name: t.counterpartyName as string,
    note: (t.note as string | null | undefined) ?? null,
    external_memo: (t.externalMemo as string | null | undefined) ?? null,
    dashboard_link: (t.dashboardLink as string | null | undefined) ?? null,
    mercury_category: t.mercuryCategory ?? null,
    raw: t,
    synced_at: syncedAt,
  }
}

async function verifyMercurySignature(
  payload: string,
  signatureHeader: string | null,
  secretKey: string,
): Promise<boolean> {
  if (!signatureHeader) return false
  let timestamp = ''
  let signature = ''
  for (const part of signatureHeader.split(',')) {
    const eq = part.indexOf('=')
    if (eq < 0) continue
    const k = part.slice(0, eq).trim()
    const v = part.slice(eq + 1)
    if (k === 't') timestamp = v
    if (k === 'v1') signature = v
  }
  if (!timestamp || !signature) return false
  const tsNum = parseInt(timestamp, 10)
  if (Number.isNaN(tsNum)) return false
  const now = Math.floor(Date.now() / 1000)
  if (Math.abs(now - tsNum) > 300) return false

  const signedPayload = `${timestamp}.${payload}`
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secretKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sigBuf = await crypto.subtle.sign('HMAC', key, enc.encode(signedPayload))
  const expected = [...new Uint8Array(sigBuf)].map((b) => b.toString(16).padStart(2, '0')).join('')
  if (expected.length !== signature.length) return false
  let diff = 0
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i)
  }
  return diff === 0
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
    const secret = Deno.env.get('MERCURY_WEBHOOK_SECRET')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const mercuryKey = Deno.env.get('MERCURY_API_KEY')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!

    if (!secret?.trim() || !serviceKey || !mercuryKey?.trim()) {
      console.error('mercury-webhook: missing MERCURY_WEBHOOK_SECRET, service role, or MERCURY_API_KEY')
      return new Response(JSON.stringify({ error: 'Server misconfigured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = await req.text()
    const sigHeader = req.headers.get('Mercury-Signature') ?? req.headers.get('mercury-signature')
    const ok = await verifyMercurySignature(body, sigHeader, secret)
    if (!ok) {
      return new Response(JSON.stringify({ error: 'Invalid signature' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let event: { resourceType?: string; resourceId?: string }
    try {
      event = JSON.parse(body) as { resourceType?: string; resourceId?: string }
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (event.resourceType !== 'transaction' || !event.resourceId) {
      return new Response(JSON.stringify({ received: true, skipped: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const txUrl = `${MERCURY_BASE}/transaction/${encodeURIComponent(event.resourceId)}`
    const mRes = await fetch(txUrl, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${mercuryKey}`,
      },
    })

    if (!mRes.ok) {
      const errText = await mRes.text()
      console.error('Mercury GET transaction', mRes.status, errText)
      return new Response(JSON.stringify({ error: 'Mercury fetch failed', status: mRes.status }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const t = (await mRes.json()) as Record<string, unknown>
    const syncedAt = new Date().toISOString()
    const row = mapMercuryTransactionToRow(t, syncedAt)
    const admin = createClient(supabaseUrl, serviceKey)
    const { error: upsertErr } = await admin.from('mercury_transactions').upsert([row], { onConflict: 'mercury_id' })
    if (upsertErr) {
      console.error('mercury-webhook upsert', upsertErr)
      return new Response(JSON.stringify({ error: upsertErr.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error(e)
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
