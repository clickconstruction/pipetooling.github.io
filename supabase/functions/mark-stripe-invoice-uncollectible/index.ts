/**
 * mark-stripe-invoice-uncollectible (punch list #94, v2.4792)
 *
 * The office gave up on a Collections job: its Stripe invoice is marked uncollectible too, so the
 * pay link stops asking. Stripe still accepts a late payment on an uncollectible invoice, and the
 * webhook then pays the job and clears the stamp. Idempotent: an invoice already uncollectible,
 * paid or void answers success with its status. The caller's own session reads the row (RLS);
 * the Stripe key is the server's.
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@16.12.0?target=deno'
import { anyStripeApiKeyConfigured, effectiveRowStripeMode, stripeApiKeyForMode, type StripeBillingMode } from '../_shared/stripeSecrets.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

interface Body {
  jobs_ledger_invoice_id: string
  stripe_mode?: StripeBillingMode
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) return jsonResponse({ error: 'Missing authorization' }, 401)
    if (!anyStripeApiKeyConfigured()) {
      return jsonResponse({ error: 'Server misconfigured: set STRIPE_SECRET_KEY_TEST / STRIPE_SECRET_KEY_LIVE or legacy STRIPE_SECRET_KEY' }, 500)
    }
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnon = Deno.env.get('SUPABASE_ANON_KEY')!
    const userClient = createClient(supabaseUrl, supabaseAnon, { global: { headers: { Authorization: authHeader } } })
    const { data: userRes, error: userErr } = await userClient.auth.getUser()
    if (userErr || !userRes.user) return jsonResponse({ error: 'Not authenticated' }, 401)

    const body = (await req.json().catch(() => ({}))) as Partial<Body>
    const invoiceId = (body.jobs_ledger_invoice_id ?? '').trim()
    if (!invoiceId) return jsonResponse({ error: 'jobs_ledger_invoice_id is required' }, 400)

    const { data: invRow, error: invErr } = await userClient
      .from('jobs_ledger_invoices')
      .select('id, job_id, status, stripe_invoice_id, stripe_mode')
      .eq('id', invoiceId)
      .maybeSingle()
    if (invErr || !invRow) return jsonResponse({ error: 'Invoice not found or access denied' }, 403)
    if (invRow.status !== 'billed') return jsonResponse({ error: 'Invoice must be in Billed status' }, 400)
    const stripeInvId = (invRow.stripe_invoice_id ?? '').trim()
    if (!stripeInvId) return jsonResponse({ success: true, idempotent: true, stripe_status: null, note: 'no Stripe invoice on the row' })

    const modeRes = effectiveRowStripeMode(invRow.stripe_mode, body.stripe_mode)
    if (modeRes.conflict) {
      return jsonResponse({ error: `Invoice lives in Stripe ${modeRes.conflict.row_mode} mode; the request asked for ${modeRes.conflict.requested_mode}. No changes made.`, code: 'stripe_mode_mismatch', ...modeRes.conflict }, 409)
    }
    const stripeSecret = stripeApiKeyForMode(modeRes.mode)
    if (!stripeSecret) return jsonResponse({ error: `Stripe ${modeRes.mode} mode not configured` }, 400)
    const stripe = new Stripe(stripeSecret, { apiVersion: '2024-06-20' })

    let inv: Stripe.Invoice
    try {
      inv = await stripe.invoices.retrieve(stripeInvId)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error('mark-stripe-invoice-uncollectible: retrieve failed', msg)
      return jsonResponse({ error: msg }, 502)
    }
    if (inv.status === 'uncollectible' || inv.status === 'paid' || inv.status === 'void') {
      return jsonResponse({ success: true, idempotent: true, stripe_status: inv.status })
    }
    if (inv.status !== 'open') {
      // A draft is never sent to the customer; nothing to close.
      return jsonResponse({ success: true, idempotent: true, stripe_status: inv.status, note: 'not an open invoice' })
    }
    try {
      const marked = await stripe.invoices.markUncollectible(stripeInvId)
      return jsonResponse({ success: true, stripe_status: marked.status })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error('mark-stripe-invoice-uncollectible: mark failed', msg)
      return jsonResponse({ error: msg }, 502)
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('mark-stripe-invoice-uncollectible: unexpected', msg)
    return jsonResponse({ error: msg }, 500)
  }
})
