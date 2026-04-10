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

function linesPayloadFromLineItems(
  raw: Stripe.InvoiceLineItem[],
): Array<{ description: string; quantity: number | null; amount: number }> {
  return raw.map((li) => ({
    description: li.description ?? '',
    quantity: typeof li.quantity === 'number' && !Number.isNaN(li.quantity) ? li.quantity : null,
    amount: typeof li.amount === 'number' && !Number.isNaN(li.amount) ? li.amount : 0,
  }))
}

/** Hosted invoice / PDF “From” uses customer-facing branding; `account_name` is often the legal entity. */
async function sellerDisplayName(stripe: Stripe, inv: Stripe.Invoice): Promise<string | null> {
  const fromInvoice =
    typeof inv.account_name === 'string' && inv.account_name.trim() ? inv.account_name.trim() : null

  const issuer = inv.issuer
  let connectAccountId: string | undefined
  if (
    issuer &&
    typeof issuer === 'object' &&
    issuer.type === 'account' &&
    typeof issuer.account === 'string' &&
    issuer.account.trim()
  ) {
    connectAccountId = issuer.account.trim()
  }

  try {
    const acct = connectAccountId
      ? await stripe.accounts.retrieve(connectAccountId)
      : await stripe.accounts.retrieve()
    const bp = acct.business_profile?.name
    if (typeof bp === 'string' && bp.trim()) {
      return bp.trim()
    }
  } catch (e) {
    console.warn('get-stripe-invoice-details: accounts.retrieve', e)
  }

  return fromInvoice
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

    const { data: invRow, error: invErr } = await userClient
      .from('jobs_ledger_invoices')
      .select('id, stripe_invoice_id')
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
    const desc = inv.description
    const seller_name = await sellerDisplayName(stripe, inv)

    const ap = inv.amount_paid
    const amount_paid = typeof ap === 'number' && !Number.isNaN(ap) ? ap : 0

    return jsonResponse({
      success: true,
      currency: inv.currency ?? 'usd',
      total: typeof inv.total === 'number' ? inv.total : 0,
      amount_due: typeof inv.amount_due === 'number' ? inv.amount_due : 0,
      amount_paid,
      due_date: typeof inv.due_date === 'number' ? inv.due_date : null,
      invoice_number: typeof num === 'string' && num.trim() ? num.trim() : null,
      customer_name: typeof cname === 'string' && cname.trim() ? cname.trim() : null,
      customer_email: typeof cemail === 'string' && cemail.trim() ? cemail.trim() : null,
      seller_name,
      memo: typeof desc === 'string' && desc.trim() ? desc.trim() : null,
      lines,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('get-stripe-invoice-details:', e)
    return jsonResponse({ error: msg }, 500)
  }
})
