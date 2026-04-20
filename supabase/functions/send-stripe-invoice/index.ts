import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@16.12.0?target=deno'
import { customerEmailFromStripeInvoice } from '../_shared/stripeInvoiceCustomerEmail.ts'
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

async function persistSendAfterStripeEmail(args: {
  admin: ReturnType<typeof createClient>
  jobsLedgerInvoiceId: string
  sentAtIso: string
  stripeInvoiceStatus: string | null
}): Promise<{ ok: true } | { ok: false; error: unknown }> {
  const patch = {
    sent_to_customer_at: args.sentAtIso,
    stripe_invoice_status: args.stripeInvoiceStatus,
  }
  const maxAttempts = 3
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const { error } = await args.admin
      .from('jobs_ledger_invoices')
      .update(patch)
      .eq('id', args.jobsLedgerInvoiceId)
    if (!error) return { ok: true }
    console.error(`send-stripe-invoice: DB persist attempt ${attempt}/${maxAttempts}`, error)
    if (attempt < maxAttempts) {
      await new Promise((r) => setTimeout(r, 150 * attempt))
    }
  }
  return { ok: false, error: 'persist_failed' }
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

    const { data: roleRow, error: roleErr } = await userClient
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    if (roleErr || !roleRow?.role) {
      return jsonResponse({ error: 'Could not resolve user role' }, 403)
    }

    const callerRole = roleRow.role
    const isSubcontractor = callerRole === 'subcontractor'

    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!serviceKey?.trim()) {
      return jsonResponse({ error: 'Server misconfigured: SUPABASE_SERVICE_ROLE_MISSING' }, 500)
    }
    const admin = createClient(supabaseUrl, serviceKey)

    let invRow: { id: string; status: string; stripe_invoice_id: string | null }

    if (isSubcontractor) {
      const { data: inv, error: invErr } = await admin
        .from('jobs_ledger_invoices')
        .select('id, job_id, status, stripe_invoice_id')
        .eq('id', jobsLedgerInvoiceId)
        .maybeSingle()

      if (invErr || !inv) {
        return jsonResponse({ error: 'Invoice not found or access denied' }, 403)
      }

      const { data: tm } = await admin
        .from('jobs_ledger_team_members')
        .select('job_id')
        .eq('job_id', inv.job_id)
        .eq('user_id', user.id)
        .maybeSingle()

      if (!tm) {
        return jsonResponse({ error: 'Invoice not found or access denied' }, 403)
      }

      const { data: flow } = await admin
        .from('job_collect_payment_flows')
        .select('status, jobs_ledger_invoice_id')
        .eq('job_id', inv.job_id)
        .maybeSingle()

      if (
        !flow ||
        flow.status !== 'approved_for_terminal' ||
        flow.jobs_ledger_invoice_id == null ||
        String(flow.jobs_ledger_invoice_id) !== String(inv.id)
      ) {
        return jsonResponse(
          {
            error:
              'Only an active collect payment request can email this invoice from the field',
          },
          403,
        )
      }

      invRow = { id: inv.id, status: inv.status, stripe_invoice_id: inv.stripe_invoice_id }
    } else {
      const { data: inv, error: invErr } = await userClient
        .from('jobs_ledger_invoices')
        .select('id, status, stripe_invoice_id')
        .eq('id', jobsLedgerInvoiceId)
        .maybeSingle()

      if (invErr || !inv) {
        return jsonResponse({ error: 'Invoice not found or access denied' }, 403)
      }
      invRow = inv
    }

    const stripeInvoiceId = (invRow.stripe_invoice_id ?? '').trim()
    if (!stripeInvoiceId) {
      return jsonResponse({ error: 'No Stripe invoice on this billing line' }, 400)
    }

    if (invRow.status !== 'billed') {
      return jsonResponse({ error: 'Invoice must be Billed Awaiting Payment to send from Stripe' }, 400)
    }

    const stripe = new Stripe(stripeSecret, { apiVersion: '2024-06-20' })

    let inv: Stripe.Invoice
    try {
      inv = await stripe.invoices.retrieve(stripeInvoiceId, {
        expand: ['customer'],
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error('send-stripe-invoice: retrieve', e)
      return jsonResponse({ error: msg }, 502)
    }

    const st = inv.status
    if (st === 'draft') {
      return jsonResponse({ error: 'Stripe invoice is still a draft; finalize it first' }, 400)
    }
    if (st === 'void' || st === 'uncollectible') {
      return jsonResponse({ error: `Cannot send a Stripe invoice in status "${st}"` }, 400)
    }
    if (st === 'paid') {
      return jsonResponse({ error: 'This Stripe invoice is already paid' }, 400)
    }
    if (st !== 'open') {
      return jsonResponse({ error: `Stripe invoice status "${st}" cannot be sent` }, 400)
    }

    const ar = inv.amount_remaining
    const amountRemaining = typeof ar === 'number' && !Number.isNaN(ar) ? ar : 0
    if (amountRemaining <= 0) {
      return jsonResponse({ error: 'Nothing left to collect on this Stripe invoice' }, 400)
    }

    const email = customerEmailFromStripeInvoice(inv)
    if (!email) {
      return jsonResponse(
        { error: 'Stripe has no email for this customer; add an email in Stripe or on the customer record' },
        400,
      )
    }

    let sent: Stripe.Invoice
    try {
      sent = await stripe.invoices.sendInvoice(stripeInvoiceId)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error('send-stripe-invoice: send', e)
      return jsonResponse({ error: msg }, 502)
    }

    const sentAtIso = new Date().toISOString()
    const stripeStatus = sent.status ?? null
    const persist = await persistSendAfterStripeEmail({
      admin,
      jobsLedgerInvoiceId,
      sentAtIso,
      stripeInvoiceStatus: stripeStatus,
    })
    if (!persist.ok) {
      return jsonResponse(
        {
          error:
            'Stripe may have emailed the customer, but PipeTooling could not record the send time. Check Stripe before sending again.',
          stripe_may_have_sent: true,
          stripe_invoice_status: stripeStatus,
          customer_email: email,
          stripe_mode: stripeMode,
        },
        502,
      )
    }

    const { error: logErr } = await admin.from('jobs_ledger_invoice_stripe_email_sends').insert({
      jobs_ledger_invoice_id: jobsLedgerInvoiceId,
      sent_at: sentAtIso,
      stripe_invoice_id: stripeInvoiceId,
    })
    if (logErr) {
      console.error('send-stripe-invoice: append send log failed (invoice row updated)', logErr)
    }

    return jsonResponse({
      success: true,
      stripe_invoice_status: stripeStatus,
      customer_email: email,
      stripe_mode: stripeMode,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('send-stripe-invoice:', e)
    return jsonResponse({ error: msg }, 500)
  }
})
