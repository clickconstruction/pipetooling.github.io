import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@16.12.0?target=deno'
import {
  anyStripeApiKeyConfigured,
  resolveStripeBillingMode,
  stripeApiKeyForMode,
  type StripeBillingMode,
} from '../_shared/stripeSecrets.ts'
import {
  stripeInvoiceMetadataForOobPayment,
  truncateStripeMetadataValue,
} from '../_shared/pipetoolingStripeOobPaymentMetadata.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function isInvoiceAlreadyPaidStripeError(e: unknown): boolean {
  if (!e || typeof e !== 'object') return false
  const err = e as { code?: string; message?: string; type?: string }
  const msg = (err.message ?? '').toLowerCase()
  if (err.code === 'invoice_already_paid') return true
  if (msg.includes('already been paid') || msg.includes('already paid')) return true
  return false
}

interface Body {
  jobs_ledger_invoice_id: string
  amount_dollars: number
  paid_on: string
  payment_type: string
  reference_number?: string
  internal_note?: string
  stripe_mode?: StripeBillingMode
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

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnon = Deno.env.get('SUPABASE_ANON_KEY')!

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
    } = await userClient.auth.getUser(authHeader.replace(/^Bearer\s+/i, ''))
    if (authErr || !user) {
      return jsonResponse({ error: 'Invalid session' }, 401)
    }

    const body = (await req.json()) as Body
    const {
      jobs_ledger_invoice_id,
      amount_dollars: amountRaw,
      paid_on: paidOnRaw,
      payment_type: paymentTypeRaw,
      reference_number,
      internal_note,
      stripe_mode: stripeModeRaw,
    } = body

    if (!jobs_ledger_invoice_id?.trim()) {
      return jsonResponse({ error: 'Missing jobs_ledger_invoice_id' }, 400)
    }
    const payment_type = (paymentTypeRaw ?? '').trim()
    if (!payment_type) {
      return jsonResponse({ error: 'Payment type is required' }, 400)
    }
    const paid_on = (paidOnRaw ?? '').trim()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(paid_on)) {
      return jsonResponse({ error: 'paid_on must be YYYY-MM-DD' }, 400)
    }
    if (typeof amountRaw !== 'number' || !Number.isFinite(amountRaw) || amountRaw <= 0) {
      return jsonResponse({ error: 'amount_dollars must be a positive number' }, 400)
    }

    const stripeMode = resolveStripeBillingMode(stripeModeRaw)
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

    const stripe = new Stripe(stripeSecret, { apiVersion: '2024-06-20' })

    const { data: invRow, error: invErr } = await userClient
      .from('jobs_ledger_invoices')
      .select('id, job_id, amount, status, stripe_invoice_id')
      .eq('id', jobs_ledger_invoice_id.trim())
      .maybeSingle()

    if (invErr || !invRow) {
      return jsonResponse({ error: 'Invoice not found or access denied' }, 403)
    }

    if (invRow.status !== 'billed') {
      return jsonResponse({ error: 'Invoice must be in Billed status' }, 400)
    }

    const stripeInvId = (invRow.stripe_invoice_id ?? '').trim()
    if (!stripeInvId) {
      return jsonResponse({ error: 'Invoice has no Stripe invoice' }, 400)
    }

    const amountCents = Math.round(amountRaw * 100)
    if (amountCents < 1) {
      return jsonResponse({ error: 'Amount too small' }, 400)
    }

    let stripeInv: Stripe.Invoice
    try {
      stripeInv = await stripe.invoices.retrieve(stripeInvId)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error('record-stripe-invoice-out-of-band-payment: retrieve failed', msg)
      return jsonResponse({ error: msg }, 502)
    }

    if (stripeInv.status === 'paid') {
      return jsonResponse({ success: true, idempotent: true, stripe_status: 'paid' })
    }

    const remaining = stripeInv.amount_remaining
    if (remaining == null) {
      return jsonResponse({ error: 'Stripe invoice has no amount_remaining' }, 502)
    }
    if (remaining !== amountCents) {
      return jsonResponse(
        {
          error:
            'Amount must match the full open balance on the Stripe invoice. Partial off-Stripe pay is not supported in this flow.',
          stripe_amount_remaining_cents: remaining,
          amount_dollars_submitted: amountRaw,
        },
        400,
      )
    }

    const oobMeta = stripeInvoiceMetadataForOobPayment({
      paid_on_yyyy_mm_dd: paid_on,
      payment_type: truncateStripeMetadataValue(payment_type),
      reference_number: reference_number?.trim() || undefined,
      internal_note: internal_note?.trim() || undefined,
    })

    const existingMeta = stripeInv.metadata && typeof stripeInv.metadata === 'object'
      ? { ...stripeInv.metadata }
      : {}

    try {
      await stripe.invoices.update(stripeInvId, {
        metadata: { ...existingMeta, ...oobMeta },
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error('record-stripe-invoice-out-of-band-payment: metadata update failed', msg)
      return jsonResponse({ error: msg }, 502)
    }

    try {
      await stripe.invoices.pay(stripeInvId, { paid_out_of_band: true })
    } catch (e) {
      if (isInvoiceAlreadyPaidStripeError(e)) {
        const again = await stripe.invoices.retrieve(stripeInvId)
        if (again.status === 'paid') {
          return jsonResponse({ success: true, idempotent: true, stripe_status: 'paid' })
        }
      }
      const msg = e instanceof Error ? e.message : String(e)
      console.error('record-stripe-invoice-out-of-band-payment: pay failed', msg)
      return jsonResponse({ error: msg }, 502)
    }

    return jsonResponse({
      success: true,
      stripe_invoice_id: stripeInvId,
      message:
        'Stripe invoice marked paid out-of-band. Ledger updates when the Stripe webhook runs (usually within seconds).',
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('record-stripe-invoice-out-of-band-payment:', e)
    return jsonResponse({ error: msg }, 500)
  }
})
