import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@16.12.0?target=deno'
import {
  anyStripeApiKeyConfigured,
  resolveStripeBillingMode,
  stripeApiKeyForMode,
  type StripeBillingMode,
} from '../_shared/stripeSecrets.ts'
import { stripeSellerDisplayName } from '../_shared/stripeSellerDisplayName.ts'
import { stripeInvoiceMemoFromStripe } from '../_shared/stripeInvoiceMemoFromStripe.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Body {
  jobs_ledger_invoice_id: string
  stripe_mode?: StripeBillingMode
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function linesPayloadFromLineItems(
  raw: Stripe.InvoiceLineItem[],
): Array<{ description: string; quantity: number | null; amount: number }> {
  return raw.map((li) => ({
    description: li.description ?? '',
    quantity: typeof li.quantity === 'number' && !Number.isNaN(li.quantity) ? li.quantity : null,
    amount: typeof li.amount === 'number' && !Number.isNaN(li.amount) ? li.amount : 0,
  }))
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return jsonResponse({ error: 'Missing authorization' }, 401)
    }
    const token = authHeader.replace(/^Bearer\s+/i, '')

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnon = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!anyStripeApiKeyConfigured()) {
      return jsonResponse(
        {
          error:
            'Server misconfigured: set STRIPE_SECRET_KEY_TEST / STRIPE_SECRET_KEY_LIVE or legacy STRIPE_SECRET_KEY',
        },
        500,
      )
    }

    const userClient = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    })
    const {
      data: { user },
      error: authErr,
    } = await userClient.auth.getUser(token)
    if (authErr || !user) {
      return jsonResponse({ error: 'Invalid session' }, 401)
    }

    let body: Body
    try {
      body = (await req.json()) as Body
    } catch {
      return jsonResponse({ error: 'Invalid JSON body' }, 400)
    }
    const jobsLedgerInvoiceId = body.jobs_ledger_invoice_id?.trim()
    if (!jobsLedgerInvoiceId) {
      return jsonResponse({ error: 'Missing jobs_ledger_invoice_id' }, 400)
    }

    const stripeMode = resolveStripeBillingMode(body.stripe_mode)
    const stripeSecret = stripeApiKeyForMode(stripeMode)
    if (!stripeSecret) {
      return jsonResponse(
        {
          error:
            stripeMode === 'test'
              ? 'Stripe test mode not configured (STRIPE_SECRET_KEY_TEST or sk_test legacy key).'
              : 'Stripe live mode not configured (STRIPE_SECRET_KEY_LIVE or sk_live legacy key).',
        },
        400,
      )
    }

    const { data: invRow, error: invErr } = await userClient
      .from('jobs_ledger_invoices')
      .select('id, stripe_invoice_id, stripe_invoice_memo')
      .eq('id', jobsLedgerInvoiceId)
      .maybeSingle()

    if (invErr || !invRow) {
      return jsonResponse({ error: 'Invoice not found or access denied' }, 403)
    }

    const stripeInvoiceId = (invRow.stripe_invoice_id ?? '').trim()
    if (!stripeInvoiceId) {
      return jsonResponse({ error: 'No Stripe invoice on this billing line' }, 400)
    }

    const stripe = new Stripe(stripeSecret, { apiVersion: '2024-06-20' })
    const inv = await stripe.invoices.retrieve(stripeInvoiceId)
    const listed = await stripe.invoices.listLineItems(stripeInvoiceId, { limit: 100 })
    const lines = linesPayloadFromLineItems(listed.data)

    const num = inv.number
    const cname = inv.customer_name
    const cemail = inv.customer_email
    const seller_name = await stripeSellerDisplayName(stripe, inv)

    const ap = inv.amount_paid
    const amount_paid = typeof ap === 'number' && !Number.isNaN(ap) ? ap : 0

    const tot = typeof inv.total === 'number' && !Number.isNaN(inv.total) ? inv.total : 0
    const arm = inv.amount_remaining
    const amount_remaining =
      typeof arm === 'number' && !Number.isNaN(arm) ? Math.max(0, arm) : Math.max(0, tot - amount_paid)

    const paidAtRaw = inv.status_transitions?.paid_at
    const paid_at =
      typeof paidAtRaw === 'number' && Number.isFinite(paidAtRaw) && paidAtRaw > 0 ? paidAtRaw : null

    const memoFromStripe = stripeInvoiceMemoFromStripe(inv)
    const memoStored = typeof invRow.stripe_invoice_memo === 'string' ? invRow.stripe_invoice_memo.trim() : ''
    if (memoFromStripe && !memoStored) {
      if (serviceKey) {
        const admin = createClient(supabaseUrl, serviceKey)
        const { error: memoUpErr } = await admin
          .from('jobs_ledger_invoices')
          .update({ stripe_invoice_memo: memoFromStripe })
          .eq('id', jobsLedgerInvoiceId)
        if (memoUpErr) {
          console.warn('get-stripe-invoice-details: stripe_invoice_memo service backfill failed', memoUpErr)
        }
      } else {
        const { error: memoUpErr } = await userClient
          .from('jobs_ledger_invoices')
          .update({ stripe_invoice_memo: memoFromStripe })
          .eq('id', jobsLedgerInvoiceId)
        if (memoUpErr) {
          console.warn('get-stripe-invoice-details: stripe_invoice_memo backfill failed', memoUpErr)
        }
      }
    }

    return jsonResponse({
      success: true,
      currency: inv.currency ?? 'usd',
      total: tot,
      amount_due: typeof inv.amount_due === 'number' ? inv.amount_due : 0,
      /** Balance still owed on the invoice; use this (not `amount_due`) for paid/partial UI. */
      amount_remaining,
      amount_paid,
      /** Unix seconds — when Stripe marked the invoice paid (`status_transitions.paid_at`). */
      paid_at,
      due_date: typeof inv.due_date === 'number' ? inv.due_date : null,
      invoice_number: typeof num === 'string' && num.trim() ? num.trim() : null,
      customer_name: typeof cname === 'string' && cname.trim() ? cname.trim() : null,
      customer_email: typeof cemail === 'string' && cemail.trim() ? cemail.trim() : null,
      seller_name,
      memo: memoFromStripe,
      lines,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('get-stripe-invoice-details:', e)
    return jsonResponse({ error: msg }, 500)
  }
})
