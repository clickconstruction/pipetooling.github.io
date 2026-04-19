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

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

interface Body {
  job_id: string
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
    const token = authHeader.replace(/^Bearer\s+/i, '')

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnon = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!serviceKey) {
      return jsonResponse({ error: 'Server misconfigured' }, 500)
    }
    if (!anyStripeApiKeyConfigured()) {
      return jsonResponse({ error: 'Stripe not configured' }, 500)
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

    const body = (await req.json()) as Body
    const jobId = typeof body.job_id === 'string' ? body.job_id.trim() : ''
    if (!jobId) {
      return jsonResponse({ error: 'job_id required' }, 400)
    }

    const admin = createClient(supabaseUrl, serviceKey)
    const { data: roleRow } = await admin.from('users').select('role').eq('id', user.id).maybeSingle()
    const role = (roleRow as { role?: string } | null)?.role

    if (role !== 'subcontractor') {
      return jsonResponse({ error: 'Only subcontractors can start terminal collection' }, 403)
    }

    const { data: team } = await admin
      .from('jobs_ledger_team_members')
      .select('job_id')
      .eq('job_id', jobId)
      .eq('user_id', user.id)
      .maybeSingle()
    if (!team) {
      return jsonResponse({ error: 'Forbidden' }, 403)
    }

    const { data: flow, error: flowErr } = await admin
      .from('job_collect_payment_flows')
      .select(
        'id, status, job_id, stripe_invoice_id, jobs_ledger_invoice_id, stripe_payment_intent_id',
      )
      .eq('job_id', jobId)
      .maybeSingle()

    if (flowErr || !flow) {
      return jsonResponse({ error: 'No collect payment flow for this job' }, 400)
    }
    const f = flow as {
      status: string
      stripe_invoice_id: string | null
      jobs_ledger_invoice_id: string | null
      stripe_payment_intent_id: string | null
    }
    if (f.status !== 'approved_for_terminal') {
      return jsonResponse({ error: 'Flow is not approved for terminal' }, 400)
    }
    const stripeInvId = (f.stripe_invoice_id ?? '').trim()
    if (!stripeInvId) {
      return jsonResponse({ error: 'Missing Stripe invoice on flow' }, 400)
    }
    const invoiceRowId = f.jobs_ledger_invoice_id
    if (!invoiceRowId) {
      return jsonResponse({ error: 'Missing jobs_ledger_invoice_id on flow' }, 400)
    }

    const stripeMode = resolveStripeBillingMode(body.stripe_mode)
    const stripeSecret = stripeApiKeyForMode(stripeMode)
    if (!stripeSecret) {
      return jsonResponse({ error: `Stripe ${stripeMode} mode not configured` }, 500)
    }
    const stripe = new Stripe(stripeSecret, { apiVersion: '2024-06-20' })

    const inv = await stripe.invoices.retrieve(stripeInvId, { expand: ['lines'] })
    const amountRemaining =
      typeof inv.amount_remaining === 'number' && inv.amount_remaining > 0
        ? inv.amount_remaining
        : typeof inv.amount_due === 'number' && inv.amount_due > 0
          ? inv.amount_due
          : 0

    if (amountRemaining <= 0) {
      return jsonResponse({ error: 'Invoice has no open balance in Stripe' }, 400)
    }

    const currency = (inv.currency ?? 'usd').toLowerCase()

    const existingPiId = (f.stripe_payment_intent_id ?? '').trim()
    if (existingPiId) {
      const existing = await stripe.paymentIntents.retrieve(existingPiId)
      const open =
        existing.status === 'requires_payment_method' ||
        existing.status === 'requires_confirmation' ||
        existing.status === 'requires_capture' ||
        existing.status === 'requires_action'
      if (open && existing.client_secret) {
        return jsonResponse({
          payment_intent_client_secret: existing.client_secret,
          payment_intent_id: existing.id,
          amount_cents: existing.amount,
          currency: existing.currency ?? currency,
          stripe_mode: stripeMode,
          reused: true,
        })
      }
    }

    const idemKey = `terminal_collect_${jobId}_${invoiceRowId}`.slice(0, 255)

    const pi = await stripe.paymentIntents.create(
      {
        amount: amountRemaining,
        currency,
        payment_method_types: ['card_present'],
        capture_method: 'automatic',
        metadata: {
          pipe_collect_flow: '1',
          job_id: jobId,
          jobs_ledger_invoice_id: invoiceRowId,
          stripe_invoice_id: stripeInvId,
        },
      },
      { idempotencyKey: idemKey },
    )

    const { error: upErr } = await admin
      .from('job_collect_payment_flows')
      .update({ stripe_payment_intent_id: pi.id, last_error: null })
      .eq('job_id', jobId)
      .eq('status', 'approved_for_terminal')

    if (upErr) {
      console.error('[create-terminal-collect-payment-intent] flow update failed', upErr)
      return jsonResponse({ error: 'Failed to persist payment intent' }, 500)
    }

    if (!pi.client_secret) {
      return jsonResponse({ error: 'Stripe did not return client_secret' }, 500)
    }

    return jsonResponse({
      payment_intent_client_secret: pi.client_secret,
      payment_intent_id: pi.id,
      amount_cents: amountRemaining,
      currency,
      stripe_mode: stripeMode,
    })
  } catch (e) {
    console.error('[create-terminal-collect-payment-intent]', e)
    return jsonResponse(
      { error: e instanceof Error ? e.message : 'Unexpected error' },
      500,
    )
  }
})
