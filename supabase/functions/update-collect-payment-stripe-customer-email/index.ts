import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@16.12.0?target=deno'
import { isMissingStripeCustomerError } from '../_shared/stripeStaleCustomer.ts'
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
  customer_email: string
  stripe_mode?: StripeBillingMode
}

const EMAIL_MAX_LEN = 320

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

/** CRM shape: { phone?, email? } — preserve phone when updating email. */
function mergeContactInfoWithEmail(contactInfo: unknown, emailNorm: string): Record<string, unknown> {
  let phone: string | null = null
  if (contactInfo != null && typeof contactInfo === 'object') {
    const o = contactInfo as Record<string, unknown>
    const p = o.phone
    if (typeof p === 'string' && p.trim()) phone = p.trim()
  }
  const out: Record<string, unknown> = { email: emailNorm }
  if (phone) out.phone = phone
  return out
}

function normalizeEmail(raw: string): { ok: true; email: string } | { ok: false; error: string } {
  const t = raw.trim()
  if (!t) return { ok: false, error: 'Email is required' }
  if (t.length > EMAIL_MAX_LEN) return { ok: false, error: 'Email is too long' }
  if (!t.includes('@')) return { ok: false, error: 'Invalid email' }
  return { ok: true, email: t }
}

/** Invoices with a Stripe Customer take payer email from the Customer; `invoices.update({ customer_email })` is invalid and fails. */
function stripeInvoiceHasCustomer(inv: Stripe.Invoice): boolean {
  const c = inv.customer
  if (c == null) return false
  if (typeof c === 'string') return c.length > 0
  if (typeof c === 'object' && 'deleted' in c && (c as { deleted?: boolean }).deleted) return false
  return true
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

    const emailNormResult = normalizeEmail(body.customer_email ?? '')
    if (!emailNormResult.ok) {
      return jsonResponse({ error: emailNormResult.error }, 400)
    }
    const emailNorm = emailNormResult.email

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

    if (roleRow.role !== 'subcontractor') {
      return jsonResponse({ error: 'Only subcontractors can update email from collect payment' }, 403)
    }

    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!serviceKey?.trim()) {
      return jsonResponse({ error: 'Server misconfigured: SUPABASE_SERVICE_ROLE_MISSING' }, 500)
    }
    const admin = createClient(supabaseUrl, serviceKey)

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
          error: 'Only an active collect payment request can update customer email from the field',
        },
        403,
      )
    }

    const stripeInvoiceId = (inv.stripe_invoice_id ?? '').trim()
    if (!stripeInvoiceId) {
      return jsonResponse({ error: 'No Stripe invoice on this billing line' }, 400)
    }

    if (inv.status !== 'billed') {
      return jsonResponse({ error: 'Invoice must be Billed Awaiting Payment' }, 400)
    }

    const { data: jobRow, error: jobErr } = await admin
      .from('jobs_ledger')
      .select('id, customer_id, master_user_id')
      .eq('id', inv.job_id)
      .maybeSingle()

    if (jobErr || !jobRow?.customer_id) {
      return jsonResponse({ error: 'Job must be linked to a customer' }, 400)
    }

    const { data: custRow, error: custErr } = await admin
      .from('customers')
      .select('id, master_user_id, stripe_customer_id, contact_info, name')
      .eq('id', jobRow.customer_id)
      .maybeSingle()

    if (custErr || !custRow) {
      return jsonResponse({ error: 'Customer not found' }, 400)
    }

    if (custRow.master_user_id !== jobRow.master_user_id) {
      return jsonResponse({ error: 'Customer does not belong to this job master' }, 400)
    }

    const stripeCustomerId = (custRow.stripe_customer_id ?? '').trim()
    if (!stripeCustomerId) {
      return jsonResponse({ error: 'Customer has no Stripe customer id; contact office' }, 400)
    }

    const stripe = new Stripe(stripeSecret, { apiVersion: '2024-06-20' })

    try {
      await stripe.customers.update(stripeCustomerId, { email: emailNorm })
    } catch (e) {
      if (isMissingStripeCustomerError(e)) {
        return jsonResponse(
          {
            error:
              'Stripe customer is missing or invalid for this mode. Ask office to fix the customer link in Stripe or PipeTooling.',
          },
          400,
        )
      }
      const msg = e instanceof Error ? e.message : String(e)
      console.error('update-collect-payment-stripe-customer-email: customers.update', e)
      return jsonResponse({ error: msg }, 502)
    }

    let stripeInv: Stripe.Invoice
    try {
      stripeInv = await stripe.invoices.retrieve(stripeInvoiceId, { expand: ['customer'] })
    } catch (e) {
      console.error('update-collect-payment-stripe-customer-email: invoices.retrieve', e)
      return jsonResponse(
        {
          error:
            'Stripe customer email was updated, but the invoice could not be loaded. Ask office to confirm the invoice in Stripe.',
        },
        502,
      )
    }

    // Guest / no-customer invoices: sync email on the invoice. Customer-linked invoices use Customer.email (already updated above).
    if (!stripeInvoiceHasCustomer(stripeInv)) {
      try {
        await stripe.invoices.update(stripeInvoiceId, { customer_email: emailNorm })
      } catch (e) {
        console.error('update-collect-payment-stripe-customer-email: invoices.update', e)
        return jsonResponse(
          {
            error:
              'Stripe customer email was updated, but the invoice email could not be synced. Ask office to fix the invoice in Stripe or try again.',
          },
          502,
        )
      }
    }

    const { error: jlErr } = await admin
      .from('jobs_ledger')
      .update({ customer_email: emailNorm })
      .eq('id', jobRow.id)

    if (jlErr) {
      console.error('update-collect-payment-stripe-customer-email: jobs_ledger update', jlErr)
      return jsonResponse(
        { error: 'Stripe was updated but the job could not be saved. Contact office.' },
        502,
      )
    }

    const mergedContact = mergeContactInfoWithEmail(custRow.contact_info, emailNorm)
    const { error: cuErr } = await admin
      .from('customers')
      .update({ contact_info: mergedContact })
      .eq('id', custRow.id)

    if (cuErr) {
      console.error('update-collect-payment-stripe-customer-email: customers update', cuErr)
      return jsonResponse(
        { error: 'Stripe and job were updated but the customer record could not be saved. Contact office.' },
        502,
      )
    }

    return jsonResponse({ success: true, customer_email: emailNorm, stripe_mode: stripeMode })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('update-collect-payment-stripe-customer-email:', e)
    return jsonResponse({ error: msg }, 500)
  }
})
