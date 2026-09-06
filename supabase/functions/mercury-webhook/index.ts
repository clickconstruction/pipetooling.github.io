import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { fetchMercuryTransactionById, mapMercuryTransactionToRow } from '../_shared/mercuryTransaction.ts'
import {
  matchAccountingLabelRuleCriteria,
  parseAccountingLabelRuleCriteria,
} from '../_shared/accountingLabelRuleMatch.ts'
import {
  ACCOUNTING_LABEL_AUTO_APPROVE_SETTING_KEY,
  parseAutoApproveSettingValue,
  shouldAutoApproveSuggestion,
} from '../_shared/accountingLabelAutoApprove.ts'

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
  tx: { id: string; amount: number | string | null; counterparty_name: string | null; raw: unknown; mercury_category?: unknown },
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

  const parsedRules = ((rules ?? []) as Array<{ id: string; label_id: string; criteria: unknown }>).map((rule) => ({
    rule,
    criteria: parseAccountingLabelRuleCriteria(rule.criteria),
  }))
  // Live tag membership for `bankTag` clauses (Variant D, v2.2714) — the
  // snapshot inside the criteria is the fallback if this read fails.
  const tagIds = [...new Set(parsedRules.map((p) => p.criteria?.bankTag?.tagId).filter((id): id is string => !!id))]
  const tagCategoriesById = new Map<string, string[]>()
  if (tagIds.length > 0) {
    const { data: members } = await admin
      .from('mercury_category_tag_members')
      .select('tag_id, bank_category')
      .in('tag_id', tagIds)
      .not('bank_category', 'is', null)
    for (const m of (members ?? []) as Array<{ tag_id: string; bank_category: string | null }>) {
      if (!m.bank_category) continue
      const list = tagCategoriesById.get(m.tag_id) ?? []
      list.push(m.bank_category.trim().toLowerCase())
      tagCategoriesById.set(m.tag_id, list)
    }
  }
  for (const { rule, criteria } of parsedRules) {
    if (!criteria) continue
    const matched = matchAccountingLabelRuleCriteria(
      { amount: tx.amount, counterparty_name: tx.counterparty_name, raw: tx.raw, mercury_category: tx.mercury_category },
      criteria,
      { tagCategoriesById },
    )
    if (matched) {
      const { data: inserted } = await admin.rpc('insert_accounting_label_suggestion_service', {
        p_rows: [{ mercury_transaction_id: tx.id, rule_id: rule.id, suggested_label_id: rule.label_id }],
      })
      if (typeof inserted === 'number' && inserted > 0) {
        await autoApproveIfSwitchedOn(admin, tx.id, rule)
      }
      break // first-match-wins, same as the client engine
    }
  }
}

/**
 * Tier-2 #27: a rule match approves itself where it is minted when the ORG
 * switch `app_settings.accounting_label_auto_approve_rule_matches` is on. The
 * decision is the shared kernel (same order as the SQL writer); the write is
 * `auto_approve_pending_accounting_label_suggestions`, which writes exactly
 * what the client's bulk approve writes (assignment + rule attribution +
 * status) with `resolved_by = NULL` (= by the rule). Internal Transfers on a
 * transaction with job splits stays pending for a human. Best-effort: the
 * suggestion row already exists; failures here only leave it pending.
 */
async function autoApproveIfSwitchedOn(
  admin: ReturnType<typeof createClient>,
  txId: string,
  rule: { id: string; label_id: string },
): Promise<void> {
  const { data: setting } = await admin
    .from('app_settings')
    .select('value_text')
    .eq('key', ACCOUNTING_LABEL_AUTO_APPROVE_SETTING_KEY)
    .maybeSingle()
  const settings = {
    autoApproveRuleMatches: parseAutoApproveSettingValue((setting as { value_text?: string | null } | null)?.value_text),
  }
  if (!settings.autoApproveRuleMatches) return // the common case until Will flips it; no reads wasted

  const [{ data: label }, { data: splits }] = await Promise.all([
    admin.from('mercury_drag_sort_labels').select('default_key').eq('id', rule.label_id).maybeSingle(),
    admin.from('mercury_transaction_job_allocations').select('id').eq('mercury_transaction_id', txId).limit(1),
  ])
  const decision = shouldAutoApproveSuggestion(
    {
      status: 'pending',
      suggestedLabelDefaultKey: (label as { default_key?: string | null } | null)?.default_key ?? null,
      txHasJobSplits: Array.isArray(splits) && splits.length > 0,
      // generateSuggestion already returned early when the tx had an assignment.
      txHasAssignment: false,
    },
    { enabled: true }, // the rule matched from the enabled=true read above
    settings,
  )
  if (!decision.approve) {
    console.log(JSON.stringify({ event: 'label_suggestion_left_pending', reason: decision.reason, tx: txId, rule: rule.id }))
    return
  }
  const { data: approved, error } = await admin.rpc('auto_approve_pending_accounting_label_suggestions', {
    p_tx_ids: [txId],
  })
  if (error) {
    console.error('mercury-webhook auto-approve (non-fatal)', error)
    return
  }
  // Telemetry: the `by: rule` half of label_suggestion_approved (client approvals
  // record `by: user` via recordNavClick). The SQL re-checks every gate, so 0
  // here means a gate closed between the kernel and the write.
  console.log(
    JSON.stringify({ event: 'label_suggestion_approved', by: 'rule', count: typeof approved === 'number' ? approved : 0, tx: txId, rule: rule.id }),
  )
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
      .select('id, amount, counterparty_name, raw, mercury_category')
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
        mercury_category?: unknown
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
