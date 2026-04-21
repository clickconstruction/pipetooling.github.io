import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@16.12.0?target=deno'
import {
  anyStripeApiKeyConfigured,
  resolveStripeBillingMode,
  stripeApiKeyForMode,
  type StripeBillingMode,
} from '../_shared/stripeSecrets.ts'
import { STRIPE_OOB_META_PAYMENT_TYPE } from '../_shared/pipetoolingStripeOobPaymentMetadata.ts'

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

function invoiceHasStripeCharge(inv: Stripe.Invoice): boolean {
  const c = inv.charge
  if (typeof c === 'string') return c.trim().length > 0
  return c != null && typeof c === 'object'
}

interface Body {
  jobs_ledger_invoice_id: string
  reason: string
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
    const jobs_ledger_invoice_id = (body.jobs_ledger_invoice_id ?? '').trim()
    const reason = (body.reason ?? '').trim()
    if (!jobs_ledger_invoice_id) {
      return jsonResponse({ error: 'Missing jobs_ledger_invoice_id' }, 400)
    }
    if (reason.length < 3) {
      return jsonResponse({ error: 'Reason is required (at least 3 characters)' }, 400)
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
      .select('id, job_id, amount, status, stripe_invoice_id')
      .eq('id', jobs_ledger_invoice_id)
      .maybeSingle()

    if (invErr || !invRow) {
      return jsonResponse({ error: 'Invoice not found or access denied' }, 403)
    }

    if (invRow.status !== 'paid') {
      return jsonResponse({ error: 'Invoice must be Paid in PipeTooling to unwind out-of-band payment' }, 400)
    }

    const stripeInvId = (invRow.stripe_invoice_id ?? '').trim()
    if (!stripeInvId) {
      return jsonResponse({ error: 'Invoice has no Stripe invoice' }, 400)
    }

    const stripe = new Stripe(stripeSecret, { apiVersion: '2024-06-20' })

    let stripeInv: Stripe.Invoice
    try {
      stripeInv = await stripe.invoices.retrieve(stripeInvId)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error('reverse-stripe-invoice-out-of-band-payment: retrieve failed', msg)
      return jsonResponse({ error: msg }, 502)
    }

    const md =
      stripeInv.metadata && typeof stripeInv.metadata === 'object' && !Array.isArray(stripeInv.metadata)
        ? (stripeInv.metadata as Record<string, string>)
        : {}
    if (!(md[STRIPE_OOB_META_PAYMENT_TYPE] ?? '').trim()) {
      return jsonResponse(
        {
          error:
            'This Stripe invoice was not marked paid via PipeTooling out-of-band (missing bookkeeping metadata). Unwind in Stripe, then align the ledger manually or contact support.',
        },
        400,
      )
    }

    if (stripeInv.status !== 'paid') {
      return jsonResponse(
        { error: `Stripe invoice status is "${stripeInv.status}", not paid. Resolve in Stripe first.` },
        400,
      )
    }

    if (invoiceHasStripeCharge(stripeInv)) {
      return jsonResponse(
        {
          error:
            'This invoice has a Stripe charge (card/ACH). Refund or adjust in Stripe Dashboard; this action only supports out-of-band closes.',
        },
        400,
      )
    }

    const amountPaidFromStripe =
      typeof stripeInv.amount_paid === 'number' && !Number.isNaN(stripeInv.amount_paid) ? stripeInv.amount_paid : 0
    const totalCents =
      typeof stripeInv.total === 'number' && !Number.isNaN(stripeInv.total) ? stripeInv.total : 0
    // Out-of-band closes can leave status=paid while amount_paid stays 0; total still reflects the invoice amount.
    const amountPaid = amountPaidFromStripe > 0 ? amountPaidFromStripe : totalCents
    if (amountPaid <= 0) {
      return jsonResponse({ error: 'Stripe invoice has no amount paid' }, 400)
    }

    const existingCn = await stripe.creditNotes.list({ invoice: stripeInvId, limit: 100 })
    let creditedCents = 0
    for (const cn of existingCn.data) {
      creditedCents += typeof cn.amount === 'number' ? cn.amount : 0
    }

    let creditNoteId: string | null = null
    if (creditedCents < amountPaid - 1) {
      try {
        const cnAmount = amountPaid - creditedCents
        // When the invoice was marked paid out-of-band, Stripe often keeps amount_paid at 0; the credit note's
        // post_payment_amount must be fully allocated across refund_amount / credit_amount / out_of_band_amount.
        const cnParams: Stripe.CreditNoteCreateParams = {
          invoice: stripeInvId,
          amount: cnAmount,
          reason: 'order_change',
          metadata: { pt_oob_revert: '1' },
        }
        if (amountPaidFromStripe <= 0 && cnAmount > 0) {
          cnParams.out_of_band_amount = cnAmount
        }
        const cn = await stripe.creditNotes.create(cnParams)
        creditNoteId = cn.id
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        console.error('reverse-stripe-invoice-out-of-band-payment: credit note failed', msg)
        return jsonResponse({ error: msg }, 502)
      }
    } else {
      creditNoteId = existingCn.data[0]?.id ?? null
    }

    let stripeInvAfter: Stripe.Invoice
    try {
      stripeInvAfter = await stripe.invoices.retrieve(stripeInvId)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error('reverse-stripe-invoice-out-of-band-payment: retrieve after cn failed', msg)
      return jsonResponse({ error: msg }, 502)
    }

    const stripeStatusAfter = stripeInvAfter.status ?? 'open'

    const { data: rpcRaw, error: rpcErr } = await userClient.rpc('revert_stripe_oob_invoice_payment', {
      p_invoice_id: jobs_ledger_invoice_id,
      p_reason: reason,
      p_stripe_invoice_status_after: stripeStatusAfter,
      p_stripe_credit_note_id: creditNoteId,
    })

    if (rpcErr) {
      console.error('reverse-stripe-invoice-out-of-band-payment: rpc failed', rpcErr)
      return jsonResponse(
        {
          error: rpcErr.message,
          warning:
            'Stripe may have issued a credit note while the database update failed. Check Stripe and PipeTooling ledgers.',
        },
        502,
      )
    }

    const rpcResult = rpcRaw as { error?: string; ok?: boolean } | null
    if (rpcResult && typeof rpcResult === 'object' && typeof rpcResult.error === 'string' && rpcResult.error) {
      return jsonResponse(
        {
          error: rpcResult.error,
          warning:
            'Stripe may have issued a credit note while the database update was rejected. Check both systems.',
        },
        409,
      )
    }

    return jsonResponse({
      success: true,
      stripe_invoice_id: stripeInvId,
      stripe_credit_note_id: creditNoteId,
      stripe_invoice_status_after: stripeStatusAfter,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('reverse-stripe-invoice-out-of-band-payment:', e)
    return jsonResponse({ error: msg }, 500)
  }
})
