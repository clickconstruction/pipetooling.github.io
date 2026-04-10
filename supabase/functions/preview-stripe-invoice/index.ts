import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@16.12.0?target=deno'
import {
  anyStripeApiKeyConfigured,
  resolveStripeBillingMode,
  stripeApiKeyForMode,
  type StripeBillingMode,
} from '../_shared/stripeSecrets.ts'
import { isMissingStripeCustomerError } from '../_shared/stripeStaleCustomer.ts'
import { buildStripeInvoiceLineDescription } from '../_shared/stripeLineDescription.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface PreviewStripeInvoiceBody {
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

    const body = (await req.json()) as PreviewStripeInvoiceBody
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

    const { data: invRow, error: invErr } = await userClient
      .from('jobs_ledger_invoices')
      .select('id, job_id, amount, status')
      .eq('id', jobs_ledger_invoice_id)
      .maybeSingle()

    if (invErr || !invRow) {
      return jsonResponse({ error: 'Invoice not found or access denied' }, 403)
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
      return jsonResponse({ error: 'Job must be linked to a customer before previewing a Stripe invoice.' }, 400)
    }

    if (jobRow.customer_id !== customer_id) {
      return jsonResponse({ error: 'Customer must match the job linked customer.' }, 400)
    }

    const { data: custRow, error: custErr } = await admin
      .from('customers')
      .select('id, master_user_id, name, stripe_customer_id')
      .eq('id', customer_id)
      .single()

    if (custErr || !custRow) {
      return jsonResponse({ error: 'Customer not found' }, 400)
    }

    if (custRow.master_user_id !== jobRow.master_user_id) {
      return jsonResponse({ error: 'Customer does not belong to this job master' }, 400)
    }

    const amountCents = Math.round(amount_dollars * 100)
    if (amountCents < 1) {
      return jsonResponse({ error: 'Amount too small' }, 400)
    }

    const lineDesc = buildStripeInvoiceLineDescription(
      customer_name.trim(),
      jobRow.job_name,
      jobRow.hcp_number,
    )
    const stripe = new Stripe(stripeSecret, { apiVersion: '2024-06-20' })

    // Preview must not UPDATE customers.stripe_customer_id. Auto (live) vs Test use different Stripe accounts;
    // rewriting the row when switching modes caused heavy churn and looked like the DB "crashing".
    // Use the stored cus_ only if it exists for *this* Stripe key; otherwise a throwaway customer, then delete it.
    const storedStripeCustomerId = custRow.stripe_customer_id?.trim() || null
    const invoiceItems: Stripe.InvoiceCreatePreviewParams['invoice_items'] = [
      {
        amount: amountCents,
        currency: 'usd',
        description: lineDesc,
      },
    ]

    let preview: Stripe.Response<Stripe.Invoice>
    let ephemeralCustomerId: string | null = null

    try {
      let customerIdForPreview: string

      if (storedStripeCustomerId) {
        try {
          await stripe.customers.retrieve(storedStripeCustomerId)
          customerIdForPreview = storedStripeCustomerId
        } catch (e) {
          if (!isMissingStripeCustomerError(e)) throw e
          const ep = await stripe.customers.create({
            email: customer_email.trim(),
            name: customer_name.trim(),
            metadata: {
              pipetooling_invoice_preview_ephemeral: '1',
              pipetooling_customer_id: customer_id,
            },
          })
          ephemeralCustomerId = ep.id
          customerIdForPreview = ephemeralCustomerId
        }
      } else {
        const ep = await stripe.customers.create({
          email: customer_email.trim(),
          name: customer_name.trim(),
          metadata: {
            pipetooling_invoice_preview_ephemeral: '1',
            pipetooling_customer_id: customer_id,
          },
        })
        ephemeralCustomerId = ep.id
        customerIdForPreview = ephemeralCustomerId
      }

      preview = await stripe.invoices.createPreview({
        currency: 'usd',
        customer: customerIdForPreview,
        description: memo?.trim() || undefined,
        invoice_items: invoiceItems,
      })
    } finally {
      if (ephemeralCustomerId) {
        try {
          await stripe.customers.del(ephemeralCustomerId)
        } catch (delErr) {
          console.warn(
            'preview-stripe-invoice: ephemeral customer delete failed',
            ephemeralCustomerId,
            delErr,
          )
        }
      }
    }

    const rawLines = preview.lines?.data ?? []
    const lines = rawLines.map((li) => ({
      description: li.description ?? '',
      amount: typeof li.amount === 'number' ? li.amount : 0,
    }))

    const previewNum = preview.number

    return jsonResponse({
      success: true,
      currency: preview.currency ?? 'usd',
      subtotal: preview.subtotal ?? 0,
      total: preview.total ?? 0,
      amount_due: preview.amount_due ?? preview.total ?? 0,
      lines,
      customer_name: customer_name.trim(),
      customer_email: customer_email.trim(),
      invoice_number:
        typeof previewNum === 'string' && previewNum.trim() ? previewNum.trim() : null,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('preview-stripe-invoice:', e)
    return jsonResponse({ error: msg }, 500)
  }
})
