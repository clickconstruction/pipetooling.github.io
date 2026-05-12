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

const BILLING_ROLES = new Set(['dev', 'master_technician', 'assistant', 'primary'])

interface Body {
  jobs_ledger_invoice_id: string
  /** New invoice total obligation (USD, after discount), e.g. 1505.00 */
  new_total_dollars: number
  note: string
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
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim() ?? ''

    if (!serviceKey) {
      return jsonResponse({ error: 'Server misconfigured: SUPABASE_SERVICE_ROLE_KEY' }, 500)
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
    const adminClient = createClient(supabaseUrl, serviceKey)

    const {
      data: { user },
      error: authErr,
    } = await userClient.auth.getUser(authHeader.replace(/^Bearer\s+/i, ''))
    if (authErr || !user) {
      return jsonResponse({ error: 'Invalid session' }, 401)
    }

    const body = (await req.json()) as Body
    const jobs_ledger_invoice_id = (body.jobs_ledger_invoice_id ?? '').trim()
    const note = (body.note ?? '').trim()
    const newTotalRaw = body.new_total_dollars

    if (!jobs_ledger_invoice_id) {
      return jsonResponse({ error: 'Missing jobs_ledger_invoice_id' }, 400)
    }
    if (note.length < 3) {
      return jsonResponse({ error: 'Note is required (at least 3 characters)' }, 400)
    }
    if (typeof newTotalRaw !== 'number' || !Number.isFinite(newTotalRaw) || newTotalRaw <= 0) {
      return jsonResponse({ error: 'new_total_dollars must be a positive number' }, 400)
    }

    const { data: roleRow, error: roleErr } = await userClient
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()
    if (roleErr || !roleRow?.role || !BILLING_ROLES.has(String(roleRow.role))) {
      return jsonResponse({ error: 'Not authorized' }, 403)
    }

    const { data: invRow, error: invErr } = await userClient
      .from('jobs_ledger_invoices')
      .select('id, job_id, amount, status, stripe_invoice_id')
      .eq('id', jobs_ledger_invoice_id)
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

    const stripe = new Stripe(stripeSecret, { apiVersion: '2024-06-20' })

    let stripeInv: Stripe.Invoice
    try {
      stripeInv = await stripe.invoices.retrieve(stripeInvId)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error('stripe-invoice-agreed-write-down: retrieve failed', msg)
      return jsonResponse({ error: msg }, 502)
    }

    if (stripeInv.status === 'paid') {
      return jsonResponse({ error: 'Stripe invoice is already paid; no discount needed.' }, 400)
    }

    const paid = stripeInv.amount_paid ?? 0
    const remaining = stripeInv.amount_remaining ?? 0
    const obligation = paid + remaining
    const targetCents = Math.round(newTotalRaw * 100)

    if (targetCents < paid) {
      return jsonResponse(
        {
          error: 'New total cannot be less than amount already paid on the Stripe invoice',
          stripe_amount_paid_cents: paid,
        },
        400,
      )
    }

    const creditCents = obligation - targetCents
    if (creditCents < 1) {
      return jsonResponse(
        {
          error:
            creditCents <= 0
              ? 'New total must be less than the current Stripe obligation (no discount needed)'
              : 'Discount amount too small',
        },
        400,
      )
    }

    if (creditCents > remaining) {
      return jsonResponse(
        {
          error:
            'Discount exceeds the open balance on the Stripe invoice. Refresh and try again, or reduce the amount.',
          stripe_amount_remaining_cents: remaining,
          computed_credit_cents: creditCents,
        },
        400,
      )
    }

    let creditNote: Stripe.CreditNote
    try {
      creditNote = await stripe.creditNotes.create({
        invoice: stripeInvId,
        amount: creditCents,
        reason: 'customer_request',
        metadata: { pipetooling_write_down: '1' },
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error('stripe-invoice-agreed-write-down: credit note failed', msg)
      return jsonResponse({ error: msg }, 502)
    }

    let invAfter: Stripe.Invoice
    try {
      invAfter = await stripe.invoices.retrieve(stripeInvId)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error('stripe-invoice-agreed-write-down: retrieve after CN failed', msg)
      return jsonResponse({ error: msg }, 502)
    }

    const paidAfter = invAfter.amount_paid ?? 0
    const remainingAfter = invAfter.amount_remaining ?? 0
    const newAmountUsd = Math.round(paidAfter + remainingAfter) / 100

    const { data: rpcData, error: rpcErr } = await adminClient.rpc('service_apply_agreed_write_down_from_stripe', {
      p_invoice_id: jobs_ledger_invoice_id,
      p_new_amount: newAmountUsd,
      p_note: `${note} (Stripe credit note ${creditNote.id})`,
      p_stripe_credit_note_id: creditNote.id,
      p_actor_user_id: user.id,
    })

    if (rpcErr) {
      console.error('stripe-invoice-agreed-write-down: RPC failed', rpcErr)
      return jsonResponse({ error: rpcErr.message }, 502)
    }

    const rpcResult = rpcData as { error?: string; ok?: boolean } | null
    if (rpcResult && typeof rpcResult === 'object' && rpcResult.error) {
      return jsonResponse({ error: rpcResult.error }, 400)
    }

    return jsonResponse({
      ok: true,
      stripe_credit_note_id: creditNote.id,
      new_amount: newAmountUsd,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('stripe-invoice-agreed-write-down:', e)
    return jsonResponse({ error: msg }, 500)
  }
})
