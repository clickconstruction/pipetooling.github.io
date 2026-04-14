import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@16.12.0?target=deno'
import {
  anyStripeApiKeyConfigured,
  resolveStripeBillingMode,
  stripeApiKeyForMode,
  type StripeBillingMode,
} from '../_shared/stripeSecrets.ts'

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

function isMissingStripeInvoiceError(e: unknown): boolean {
  if (!e || typeof e !== 'object') return false
  const o = e as { code?: string; message?: string; type?: string }
  const msg = (o.message ?? '').toLowerCase()
  if (msg.includes('no such invoice')) return true
  if (o.code === 'resource_missing' && msg.includes('invoice')) return true
  return false
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

    if (!serviceKey) {
      return jsonResponse({ error: 'Server misconfigured: SUPABASE_SERVICE_ROLE_MISSING' }, 500)
    }
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

    const invoiceId = body.jobs_ledger_invoice_id?.trim()
    if (!invoiceId) {
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

    const { data: row, error: rowErr } = await userClient
      .from('jobs_ledger_invoices')
      .select(
        'id, status, stripe_invoice_id, external_send_channel, hosted_invoice_url',
      )
      .eq('id', invoiceId)
      .maybeSingle()

    if (rowErr || !row) {
      return jsonResponse({ error: 'Invoice not found or access denied' }, 403)
    }

    if (row.status !== 'billed') {
      return jsonResponse({ error: 'Invoice must be Billed Awaiting Payment' }, 400)
    }

    const stripeInvId = (row.stripe_invoice_id ?? '').trim()
    const isStripeChannel = row.external_send_channel === 'stripe'
    if (!stripeInvId && !isStripeChannel) {
      return jsonResponse({ error: 'Not a Stripe-backed invoice' }, 400)
    }

    const admin = createClient(supabaseUrl, serviceKey)

    const PAYMENTS_BLOCK =
      'This invoice has recorded payments. Adjust or unlink those payments before sending back.'
    const { data: paymentRows, error: payErr } = await admin
      .from('jobs_ledger_payments')
      .select('id')
      .eq('invoice_id', invoiceId)
      .limit(1)
    if (payErr) {
      console.error('void-stripe-invoice-for-revert: payments check', payErr)
      return jsonResponse({ error: 'Failed to verify invoice payments' }, 500)
    }
    if (paymentRows && paymentRows.length > 0) {
      return jsonResponse({ error: PAYMENTS_BLOCK }, 409)
    }

    if (!stripeInvId) {
      const { error: delErr } = await admin.from('jobs_ledger_invoices').delete().eq('id', invoiceId)
      if (delErr) {
        console.error('void-stripe-invoice-for-revert: db delete (no stripe id)', delErr)
        return jsonResponse({ error: 'Failed to delete invoice' }, 500)
      }
      return jsonResponse({ success: true, stripe_action: 'db_only_no_stripe_id' })
    }

    const stripe = new Stripe(stripeSecret, { apiVersion: '2024-06-20' })
    let stripeAction: 'delete_draft' | 'void' | 'noop' | 'noop_missing' = 'noop'

    try {
      const inv = await stripe.invoices.retrieve(stripeInvId)
      const st = inv.status
      const amountPaid = typeof inv.amount_paid === 'number' && !Number.isNaN(inv.amount_paid) ? inv.amount_paid : 0

      if (st === 'paid' || amountPaid > 0) {
        return jsonResponse(
          {
            error:
              'Invoice is paid or has payments in Stripe; resolve in Stripe before sending back.',
          },
          409,
        )
      }

      if (st === 'draft') {
        await stripe.invoices.del(stripeInvId)
        stripeAction = 'delete_draft'
      } else if (st === 'open') {
        await stripe.invoices.voidInvoice(stripeInvId)
        stripeAction = 'void'
      } else if (st === 'void' || st === 'uncollectible') {
        stripeAction = 'noop'
      } else {
        return jsonResponse(
          { error: `Stripe invoice status "${st}" cannot be voided automatically.` },
          409,
        )
      }
    } catch (e) {
      if (isMissingStripeInvoiceError(e)) {
        stripeAction = 'noop_missing'
      } else {
        const msg = e instanceof Error ? e.message : String(e)
        console.error('void-stripe-invoice-for-revert: stripe', e)
        return jsonResponse({ error: msg }, 502)
      }
    }

    const { error: delErr } = await admin.from('jobs_ledger_invoices').delete().eq('id', invoiceId)
    if (delErr) {
      console.error('void-stripe-invoice-for-revert: db delete', delErr)
      return jsonResponse({ error: 'Stripe updated but failed to delete invoice' }, 500)
    }

    return jsonResponse({ success: true, stripe_action: stripeAction })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('void-stripe-invoice-for-revert:', e)
    return jsonResponse({ error: msg }, 500)
  }
})
