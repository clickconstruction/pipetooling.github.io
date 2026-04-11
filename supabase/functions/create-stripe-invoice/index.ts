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
  clearCustomerStripeCustomerId,
  isMissingStripeCustomerError,
} from '../_shared/stripeStaleCustomer.ts'
import { stripeInvoiceSnapshotForResponse } from '../_shared/stripeInvoiceSnapshot.ts'
import { buildStripeInvoiceLineDescription } from '../_shared/stripeLineDescription.ts'
import { stripeInvoiceMemoFromStripe } from '../_shared/stripeInvoiceMemoFromStripe.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CreateStripeInvoiceBody {
  jobs_ledger_invoice_id: string
  customer_id: string
  amount_dollars: number
  customer_email: string
  customer_name: string
  due_date: string
  memo?: string
  /** Optional: `test` | `live`. Omit to use server default (legacy / non-UI callers). */
  stripe_mode?: StripeBillingMode
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function daysUntilDue(isoDate: string): number {
  const due = new Date(isoDate + 'T12:00:00Z')
  const now = new Date()
  const ms = due.getTime() - now.getTime()
  return Math.max(1, Math.ceil(ms / (86400 * 1000)))
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

    const body = (await req.json()) as CreateStripeInvoiceBody
    const {
      jobs_ledger_invoice_id,
      customer_id,
      amount_dollars,
      customer_email,
      customer_name,
      due_date,
      memo,
      stripe_mode: stripeModeRaw,
    } = body

    if (
      !jobs_ledger_invoice_id ||
      !customer_id ||
      typeof amount_dollars !== 'number' ||
      amount_dollars <= 0 ||
      !customer_email?.trim() ||
      !customer_name?.trim() ||
      !due_date?.trim()
    ) {
      return jsonResponse(
        {
          error:
            'Missing or invalid fields: jobs_ledger_invoice_id, customer_id, amount_dollars, customer_email, customer_name, due_date',
        },
        400
      )
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
      .select(
        'id, job_id, amount, status, stripe_invoice_id, hosted_invoice_url, stripe_invoice_status, stripe_invoice_memo',
      )
      .eq('id', jobs_ledger_invoice_id)
      .maybeSingle()

    if (invErr || !invRow) {
      return jsonResponse({ error: 'Invoice not found or access denied' }, 403)
    }

    // After a successful create, status is `billed` and retries must still return the Stripe URL.
    if (invRow.stripe_invoice_id && invRow.hosted_invoice_url) {
      let invoice_preview: Record<string, unknown> | undefined
      try {
        const existing = await stripe.invoices.retrieve(invRow.stripe_invoice_id, { expand: ['lines.data'] })
        invoice_preview = await stripeInvoiceSnapshotForResponse(stripe, existing)
        const memoFromStripe = stripeInvoiceMemoFromStripe(existing)
        const memoStored =
          typeof invRow.stripe_invoice_memo === 'string' ? invRow.stripe_invoice_memo.trim() : ''
        if (memoFromStripe && !memoStored) {
          const admin = createClient(supabaseUrl, serviceKey)
          const { error: memoUpErr } = await admin
            .from('jobs_ledger_invoices')
            .update({ stripe_invoice_memo: memoFromStripe })
            .eq('id', jobs_ledger_invoice_id)
          if (memoUpErr) {
            console.warn('create-stripe-invoice: idempotent stripe_invoice_memo backfill failed', memoUpErr)
          }
        }
      } catch (e) {
        console.warn('create-stripe-invoice: idempotent invoice retrieve failed', e)
      }
      return jsonResponse({
        success: true,
        stripe_invoice_id: invRow.stripe_invoice_id,
        hosted_invoice_url: invRow.hosted_invoice_url,
        stripe_invoice_status: invRow.stripe_invoice_status,
        idempotent: true,
        ...(invoice_preview ? { invoice_preview } : {}),
      })
    }

    if (invRow.status !== 'ready_to_bill') {
      return jsonResponse({ error: 'Invoice must be Ready to Bill' }, 400)
    }

    const admin = createClient(supabaseUrl, serviceKey)

    const { data: jobRow, error: jobErr } = await admin
      .from('jobs_ledger')
      .select('id, master_user_id, hcp_number, job_name, customer_id')
      .eq('id', invRow.job_id)
      .single()

    if (jobErr || !jobRow) {
      return jsonResponse({ error: 'Job not found' }, 400)
    }

    if (!jobRow.customer_id) {
      return jsonResponse({ error: 'Job must be linked to a customer before creating a Stripe invoice.' }, 400)
    }

    if (jobRow.customer_id !== customer_id) {
      return jsonResponse({ error: 'Customer must match the job linked customer.' }, 400)
    }

    const { data: custRow, error: custErr } = await admin
      .from('customers')
      .select('id, master_user_id, name, stripe_customer_id, contact_info')
      .eq('id', customer_id)
      .single()

    if (custErr || !custRow) {
      return jsonResponse({ error: 'Customer not found' }, 400)
    }

    if (custRow.master_user_id !== jobRow.master_user_id) {
      return jsonResponse({ error: 'Customer does not belong to this job master' }, 400)
    }

    let stripeCustomerId = custRow.stripe_customer_id?.trim() || null
    if (stripeCustomerId) {
      try {
        await stripe.customers.update(stripeCustomerId, {
          email: customer_email.trim(),
          name: customer_name.trim(),
        })
      } catch (e) {
        if (!isMissingStripeCustomerError(e)) {
          throw e
        }
        console.warn(
          'create-stripe-invoice: stale stripe_customer_id, clearing and creating new Stripe customer',
          stripeCustomerId,
        )
        await clearCustomerStripeCustomerId(admin, customer_id)
        stripeCustomerId = null
      }
    }
    if (!stripeCustomerId) {
      const created = await stripe.customers.create({
        email: customer_email.trim(),
        name: customer_name.trim(),
        metadata: { pipetooling_customer_id: customer_id },
      })
      stripeCustomerId = created.id
      await admin
        .from('customers')
        .update({ stripe_customer_id: stripeCustomerId })
        .eq('id', customer_id)
    }

    const amountCents = Math.round(amount_dollars * 100)
    if (amountCents < 1) {
      return jsonResponse({ error: 'Amount too small' }, 400)
    }

    const d = daysUntilDue(due_date.trim())

    const invoice = await stripe.invoices.create({
      customer: stripeCustomerId!,
      collection_method: 'send_invoice',
      days_until_due: d,
      description: memo?.trim() || undefined,
      metadata: {
        pipetooling_invoice_id: jobs_ledger_invoice_id,
        pipetooling_job_id: invRow.job_id,
      },
    })

    await stripe.invoiceItems.create({
      customer: stripeCustomerId!,
      invoice: invoice.id,
      amount: amountCents,
      currency: 'usd',
      description: buildStripeInvoiceLineDescription(
        customer_name.trim(),
        jobRow.job_name,
        jobRow.hcp_number,
      ),
    })

    const finalized = await stripe.invoices.finalizeInvoice(invoice.id)
    const hostedUrl = finalized.hosted_invoice_url

    if (!hostedUrl) {
      return jsonResponse({ error: 'Stripe did not return hosted_invoice_url' }, 500)
    }

    const invoice_preview = await stripeInvoiceSnapshotForResponse(stripe, finalized)

    const memoTrimmed = memo?.trim() || null
    const patch: Record<string, unknown> = {
      stripe_invoice_id: finalized.id,
      stripe_invoice_status: finalized.status,
      hosted_invoice_url: hostedUrl,
      status: 'billed',
      external_send_channel: 'stripe',
      sent_to_customer_at: new Date().toISOString(),
      stripe_invoice_memo: memoTrimmed,
    }
    if (Number(invRow.amount) !== amount_dollars) {
      patch.amount = amount_dollars
    }

    const { error: upErr } = await admin.from('jobs_ledger_invoices').update(patch).eq('id', jobs_ledger_invoice_id)

    if (upErr) {
      console.error('DB update after Stripe finalize:', upErr)
      return jsonResponse(
        {
          error: 'Invoice created in Stripe but failed to save to database',
          stripe_invoice_id: finalized.id,
          hosted_invoice_url: hostedUrl,
          invoice_preview,
        },
        500
      )
    }

    return jsonResponse({
      success: true,
      stripe_invoice_id: finalized.id,
      hosted_invoice_url: hostedUrl,
      stripe_invoice_status: finalized.status,
      invoice_preview,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('create-stripe-invoice:', e)
    return jsonResponse({ error: msg }, 500)
  }
})
