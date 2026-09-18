import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { summarizeLinkRefresh, type OpenStripeBillRow } from '../_shared/stripeInvoiceLinkRefresh.ts'
import { refreshStripeInvoiceLinks } from '../_shared/stripeInvoiceLinkRefreshIo.ts'

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
 * rows.
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

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
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

    const { tally, renewedUrls, statusDrift: drifted } = await refreshStripeInvoiceLinks(admin, rows, { dryRun, log: 'refresh-stripe-invoice-links' })
    const renewed = [...renewedUrls.keys()]

    const summary = summarizeLinkRefresh(tally, dryRun)
    console.log(summary)
    if (drifted.length > 0) console.log('refresh-stripe-invoice-links: status drift (row → Stripe):', JSON.stringify(drifted.slice(0, 50)))
    return jsonResponse({ ok: true, dry_run: dryRun, summary, tally, renewed, status_drift: drifted })
  } catch (e) {
    console.error('refresh-stripe-invoice-links failed', e)
    return jsonResponse({ error: e instanceof Error ? e.message : 'Unexpected error' }, 500)
  }
})
