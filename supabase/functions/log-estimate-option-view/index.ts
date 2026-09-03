/**
 * Estimate Options, Phase 3 (v2.2462): the acceptance page reports which option the customer
 * is looking at, so the staff activity feed shows the deliberation — "Viewed option — Tankless
 * upgrade" — not just the final pick. Public (no JWT), token-validated exactly like
 * get-estimate-for-customer: an event is only accepted for a live `sent` estimate whose token
 * hash matches, and the option key must exist in the estimate's own options. Best-effort by
 * design — the response is 200 even when the insert fails; browsing must never break.
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { insertEstimateCustomerEvent } from '../_shared/logEstimateCustomerEvent.ts'
import { normalizeSharedEstimateOptions } from '../_shared/estimateOptions.ts'
import { publicEventGate } from '../_shared/publicEventThrottle.ts'

async function sha256HexFromString(value: string): Promise<string> {
  const data = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ok = () =>
  new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  try {
    const body = (await req.json()) as { token?: string; optionKey?: string }
    const raw = body.token?.trim()
    const optionKey = body.optionKey?.trim()
    if (!raw || !optionKey) return ok() // nothing to record; never an error surface

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const tokenHash = await sha256HexFromString(raw)
    const { data: row } = await admin
      .from('estimates')
      .select('id, status, public_token_expires_at, options_snapshot')
      .eq('public_token_hash', tokenHash)
      .maybeSingle()
    if (!row || row.status !== 'sent') return ok()
    const exp = row.public_token_expires_at ? Date.parse(String(row.public_token_expires_at)) : NaN
    if (!Number.isNaN(exp) && exp < Date.now()) return ok()

    const options = normalizeSharedEstimateOptions(row.options_snapshot)
    const chosen = options.find((o) => o.key === optionKey)
    if (!chosen) return ok() // unknown key: drop silently — this endpoint proves nothing to callers

    // v2.2697: throttle. A re-tap inside the dedupe window is one signal; a loop from one IP
    // is none. Dropped events still answer 200 — browsing never depends on telemetry.
    const gate = await publicEventGate(admin, {
      table: 'estimate_customer_events',
      subjectColumn: 'estimate_id',
      subjectId: String(row.id),
      eventType: 'option_viewed',
      optionKey: chosen.key,
      clientIp: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
    })
    if (!gate.record) return ok()

    await insertEstimateCustomerEvent(admin, {
      estimateId: String(row.id),
      eventType: 'option_viewed',
      source: 'log-estimate-option-view',
      req,
      metadata: { option_key: chosen.key, option_name: chosen.name },
    })
    return ok()
  } catch (e) {
    console.error(e)
    return ok()
  }
})
