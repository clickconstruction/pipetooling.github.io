import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { fetchMercuryTransactionById, mapMercuryTransactionToRow } from '../_shared/mercuryTransaction.ts'
import {
  matchAccountingLabelRuleCriteria,
  parseAccountingLabelRuleCriteria,
} from '../_shared/accountingLabelRuleMatch.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type, mercury-signature',
}

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function isUniqueViolation(err: { code?: string } | null): boolean {
  return err?.code === '23505'
}

function parseMercurySignatureHeader(header: string | null): { timestamp: string; signature: string } {
  let timestamp = ''
  let signature = ''
  if (!header) return { timestamp, signature }
  for (const part of header.split(',')) {
    const eq = part.indexOf('=')
    if (eq < 0) continue
    const k = part.slice(0, eq).trim()
    const v = part.slice(eq + 1)
    if (k === 't') timestamp = v
    if (k === 'v1') signature = v
  }
  return { timestamp, signature }
}

async function verifyMercurySignature(
  payload: string,
  timestamp: string,
  signature: string,
  secretKey: string,
): Promise<boolean> {
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

/**
 * Best-effort: pre-tag a freshly upserted transaction with a suggested label using
 * the same rule engine as the client. Never throws into the webhook response path —
 * the row is already saved and surfaced via Realtime regardless.
 */
async function generateSuggestion(
  admin: ReturnType<typeof createClient>,
  tx: { id: string; amount: number | string | null; counterparty_name: string | null; raw: unknown },
): Promise<void> {
  // Skip if this transaction already has a drag-sort assignment (already sorted).
  const { data: assigned } = await admin
    .from('mercury_transaction_drag_sort_assignments')
    .select('mercury_transaction_id')
    .eq('mercury_transaction_id', tx.id)
    .limit(1)
  if (assigned && assigned.length > 0) return

  const { data: rules } = await admin
    .from('mercury_accounting_label_rules')
    .select('id, label_id, sort_order, criteria')
    .eq('enabled', true)
    .order('sort_order', { ascending: true })
    .order('id', { ascending: true })

  for (const rule of (rules ?? []) as Array<{ id: string; label_id: string; criteria: unknown }>) {
    const criteria = parseAccountingLabelRuleCriteria(rule.criteria)
    if (!criteria) continue
    const matched = matchAccountingLabelRuleCriteria(
      { amount: tx.amount, counterparty_name: tx.counterparty_name, raw: tx.raw },
      criteria,
    )
    if (matched) {
      await admin.rpc('insert_accounting_label_suggestion_service', {
        p_rows: [{ mercury_transaction_id: tx.id, rule_id: rule.id, suggested_label_id: rule.label_id }],
      })
      break // first-match-wins, same as the client engine
    }
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  try {
    const secret = Deno.env.get('MERCURY_WEBHOOK_SECRET')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const mercuryKey = Deno.env.get('MERCURY_API_KEY')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!

    if (!secret?.trim() || !serviceKey || !mercuryKey?.trim()) {
      console.error('mercury-webhook: missing MERCURY_WEBHOOK_SECRET, service role, or MERCURY_API_KEY')
      return json({ error: 'Server misconfigured' }, 500)
    }

    const body = await req.text()
    const sigHeader = req.headers.get('Mercury-Signature') ?? req.headers.get('mercury-signature')
    const { timestamp, signature } = parseMercurySignatureHeader(sigHeader)
    const ok = await verifyMercurySignature(body, timestamp, signature, secret)
    if (!ok) {
      return json({ error: 'Invalid signature' }, 400)
    }

    let event: { resourceType?: string; resourceId?: string }
    try {
      event = JSON.parse(body) as { resourceType?: string; resourceId?: string }
    } catch {
      return json({ error: 'Invalid JSON' }, 400)
    }

    if (event.resourceType !== 'transaction' || !event.resourceId) {
      return json({ received: true, skipped: true })
    }

    const admin = createClient(supabaseUrl, serviceKey)

    // Insert-first dedup keyed on the per-delivery signature (HMAC of timestamp.body):
    // identical retries reuse the same signature; genuine later updates differ.
    const { error: dedupeErr } = await admin.from('mercury_webhook_events').insert({
      event_key: signature,
      resource_type: event.resourceType,
      resource_id: event.resourceId,
    })
    if (dedupeErr && isUniqueViolation(dedupeErr)) {
      return json({ received: true, duplicate: true })
    }
    if (dedupeErr) {
      // Non-fatal: dedup is an optimization; the upsert below is idempotent.
      console.error('mercury-webhook dedup insert failed (continuing)', dedupeErr)
    }

    let t: Record<string, unknown>
    try {
      t = await fetchMercuryTransactionById(event.resourceId, mercuryKey)
    } catch (e) {
      console.error('mercury-webhook fetch', e)
      return json({ error: 'Mercury fetch failed' }, 502)
    }

    const row = mapMercuryTransactionToRow(t, new Date().toISOString())
    const { data: upserted, error: upsertErr } = await admin
      .from('mercury_transactions')
      .upsert([row], { onConflict: 'mercury_id' })
      .select('id, amount, counterparty_name, raw')
      .single()
    if (upsertErr) {
      console.error('mercury-webhook upsert', upsertErr)
      return json({ error: upsertErr.message }, 500)
    }

    // Best-effort label pre-tag; failures here must not fail the delivery.
    try {
      await generateSuggestion(admin, upserted as {
        id: string
        amount: number | string | null
        counterparty_name: string | null
        raw: unknown
      })
    } catch (e) {
      console.error('mercury-webhook suggestion (non-fatal)', e)
    }

    return json({ received: true })
  } catch (e) {
    console.error(e)
    return json({ error: e instanceof Error ? e.message : 'Internal error' }, 500)
  }
})
