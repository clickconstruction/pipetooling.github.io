import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@16.12.0?target=deno'
import { stripeApiKeyForMode, type StripeBillingMode } from '../_shared/stripeSecrets.ts'
import {
  decideLinkRefresh,
  emptyTally,
  groupRowsByStripeMode,
  statusDrifted,
  summarizeLinkRefresh,
  type OpenStripeBillRow,
} from '../_shared/stripeInvoiceLinkRefresh.ts'

/**
 * refresh-stripe-invoice-links (v2.3589) — the nightly sweep that keeps every
 * open Stripe bill's stored `hosted_invoice_url` live.
 *
 * Stripe expires a hosted-invoice link 30 days after the invoice's due date;
 * the app stores the link once at creation and every reader hands the stored
 * copy out, so a customer chased on an old bill landed on Stripe's "link
 * expired" page (Taunya, 2026-09-18). Retrieving the invoice through the API
 * returns a fresh link, so every night pg_cron calls this with X-Cron-Secret:
 * every `jobs_ledger_invoices` row with `status = 'billed'` and a
 * `stripe_invoice_id` is retrieved from Stripe in its own mode (the row's
 * `stripe_mode`; NULL = live) and, when Stripe's link differs, the row's
 * `hosted_invoice_url` is replaced. Nothing else on the row changes — status
 * stays the webhook's; a Stripe status the row does not carry is only counted
 * in the summary line. One summary line is logged per run.
 *
 * Body: `{}`; `{ "dry_run": true }` retrieves everything and writes nothing;
 * `{ "invoice_ids": ["…"] }` limits the sweep to those jobs_ledger_invoices
 * rows (the office-side refresh in PR 2 calls it this way).
 * Auth: `X-Cron-Secret` (or `cron_secret` in the body) = `CRON_SECRET`;
 * gateway `verify_jwt = false`. Secrets: `SUPABASE_URL`,
 * `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `STRIPE_SECRET_KEY_LIVE` /
 * `STRIPE_SECRET_KEY_TEST` (legacy `STRIPE_SECRET_KEY`).
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
}
/** Rows retrieved per run; a night with more leaves the rest for tomorrow (62 open bills on 2026-09-18). */
const MAX_ROWS = 400
/** Stripe retrieves in flight at once — well under the 100 req/s live limit. */
const CONCURRENCY = 5

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

async function mapLimit<T, R>(items: readonly T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let next = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++
      out[i] = await fn(items[i]!)
    }
  })
  await Promise.all(workers)
  return out
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  let body: { cron_secret?: unknown; dry_run?: unknown; invoice_ids?: unknown } = {}
  try {
    body = (await req.json()) ?? {}
  } catch {
    body = {}
  }
  const cronSecret = Deno.env.get('CRON_SECRET')
  const given = req.headers.get('x-cron-secret') ?? (typeof body.cron_secret === 'string' ? body.cron_secret : null)
  if (!cronSecret || given !== cronSecret) return jsonResponse({ error: 'Unauthorized' }, 401)
  const dryRun = body.dry_run === true
  const onlyIds = Array.isArray(body.invoice_ids) ? body.invoice_ids.filter((x): x is string => typeof x === 'string' && x.trim() !== '') : null

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (!supabaseUrl || !serviceKey) return jsonResponse({ error: 'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not configured' }, 500)
  const admin = createClient(supabaseUrl, serviceKey)

  try {
    let q = admin
      .from('jobs_ledger_invoices')
      .select('id, stripe_invoice_id, stripe_mode, hosted_invoice_url, stripe_invoice_status')
      .eq('status', 'billed')
      .not('stripe_invoice_id', 'is', null)
      .order('billed_at', { ascending: true, nullsFirst: true })
      .limit(MAX_ROWS)
    if (onlyIds && onlyIds.length > 0) q = q.in('id', onlyIds)
    const { data, error } = await q
    if (error) return jsonResponse({ error: error.message }, 500)
    const rows = (data ?? []) as OpenStripeBillRow[]

    const tally = emptyTally()
    tally.open = rows.length
    const groups = groupRowsByStripeMode(rows)
    tally.live = groups.live.length
    tally.test = groups.test.length
    const renewed: Array<{ id: string; url: string }> = []
    const drifted: Array<{ id: string; row: string | null; stripe: string | null }> = []

    for (const mode of ['live', 'test'] as StripeBillingMode[]) {
      const group = groups[mode]
      if (group.length === 0) continue
      const key = stripeApiKeyForMode(mode)
      if (!key) {
        tally.skippedNoKey += group.length
        console.warn(`refresh-stripe-invoice-links: no Stripe key for ${mode} — ${group.length} row(s) skipped`)
        continue
      }
      const stripe = new Stripe(key, { apiVersion: '2024-06-20' })
      await mapLimit(group, CONCURRENCY, async (row) => {
        try {
          const inv = await stripe.invoices.retrieve(row.stripe_invoice_id)
          const fetched = { hosted_invoice_url: inv.hosted_invoice_url ?? null, status: inv.status ?? null }
          if (statusDrifted(row, fetched)) {
            tally.statusDrift += 1
            drifted.push({ id: row.id, row: row.stripe_invoice_status, stripe: fetched.status })
          }
          const decision = decideLinkRefresh(row, fetched)
          if (decision.kind === 'unchanged') tally.unchanged += 1
          else if (decision.kind === 'no_link') tally.noLink += 1
          else {
            if (!dryRun) {
              const { error: upErr } = await admin.from('jobs_ledger_invoices').update({ hosted_invoice_url: decision.url }).eq('id', row.id)
              if (upErr) throw new Error(upErr.message)
            }
            tally.renewed += 1
            renewed.push({ id: row.id, url: decision.url })
          }
        } catch (e) {
          tally.failed += 1
          console.warn(`refresh-stripe-invoice-links: ${row.id} (${mode} ${row.stripe_invoice_id}) failed —`, e instanceof Error ? e.message : String(e))
        }
      })
    }

    const summary = summarizeLinkRefresh(tally, dryRun)
    console.log(summary)
    if (drifted.length > 0) console.log('refresh-stripe-invoice-links: status drift (row → Stripe):', JSON.stringify(drifted.slice(0, 50)))
    return jsonResponse({ ok: true, dry_run: dryRun, summary, tally, renewed: renewed.map((r) => r.id), status_drift: drifted })
  } catch (e) {
    console.error('refresh-stripe-invoice-links failed', e)
    return jsonResponse({ error: e instanceof Error ? e.message : 'Unexpected error' }, 500)
  }
})
