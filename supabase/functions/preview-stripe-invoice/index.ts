import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno'

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
    const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY')

    if (!serviceKey) {
      return jsonResponse({ error: 'Server misconfigured: SUPABASE_SERVICE_ROLE_MISSING' }, 500)
    }
    if (!stripeSecret) {
      return jsonResponse({ error: 'Server misconfigured: STRIPE_SECRET_KEY' }, 500)
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

    const d = daysUntilDue(due_date.trim())
    const lineDesc = `${jobRow.job_name ?? 'Job'} · HCP ${jobRow.hcp_number ?? '—'}`
    const stripe = new Stripe(stripeSecret, { apiVersion: '2023-10-16' })

    const stripeCustomerId = custRow.stripe_customer_id?.trim() || null

    const previewParams: Record<string, unknown> = {
      collection_method: 'send_invoice',
      days_until_due: d,
      description: memo?.trim() || undefined,
      currency: 'usd',
      invoice_items: [
        {
          amount: amountCents,
          currency: 'usd',
          description: lineDesc,
        },
      ],
    }

    if (stripeCustomerId) {
      previewParams.customer = stripeCustomerId
    } else {
      previewParams.customer_details = {
        email: customer_email.trim(),
        name: customer_name.trim(),
      }
    }

    const invoices = stripe.invoices as typeof stripe.invoices & {
      createPreview: (p: Record<string, unknown>) => Promise<Stripe.Invoice>
    }
    const preview = await invoices.createPreview(previewParams)

    const rawLines = preview.lines?.data ?? []
    const lines = rawLines.map((li) => ({
      description: li.description ?? '',
      amount: typeof li.amount === 'number' ? li.amount : 0,
    }))

    return jsonResponse({
      success: true,
      currency: preview.currency ?? 'usd',
      subtotal: preview.subtotal ?? 0,
      total: preview.total ?? 0,
      amount_due: preview.amount_due ?? preview.total ?? 0,
      lines,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('preview-stripe-invoice:', e)
    return jsonResponse({ error: msg }, 500)
  }
})
