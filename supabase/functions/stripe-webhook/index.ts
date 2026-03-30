import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY')
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!

    if (!stripeSecret || !webhookSecret || !serviceKey) {
      console.error('stripe-webhook: missing env')
      return new Response(JSON.stringify({ error: 'Server misconfigured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const signature = req.headers.get('stripe-signature')
    if (!signature) {
      return new Response(JSON.stringify({ error: 'No signature' }), { status: 400 })
    }

    const body = await req.text()
    const stripe = new Stripe(stripeSecret, { apiVersion: '2023-10-16' })
    let event: Stripe.Event
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
    } catch (err) {
      console.error('Webhook signature verification failed', err)
      return new Response(JSON.stringify({ error: 'Invalid signature' }), { status: 400 })
    }

    const admin = createClient(supabaseUrl, serviceKey)

    if (event.type === 'invoice.paid') {
      const inv = event.data.object as Stripe.Invoice
      const stripeInvId = inv.id
      if (!stripeInvId) {
        return new Response(JSON.stringify({ received: true, skipped: 'no invoice id' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const { data: rows, error: qErr } = await admin
        .from('jobs_ledger_invoices')
        .select('id, status')
        .eq('stripe_invoice_id', stripeInvId)
        .limit(1)

      if (qErr) {
        console.error('Lookup invoice:', qErr)
        return new Response(JSON.stringify({ error: 'Database error' }), { status: 500 })
      }

      const row = rows?.[0]
      if (!row) {
        console.warn('No jobs_ledger_invoices for stripe invoice', stripeInvId)
        return new Response(JSON.stringify({ received: true, skipped: 'unknown invoice' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      if (row.status === 'paid') {
        await admin
          .from('jobs_ledger_invoices')
          .update({ stripe_invoice_status: 'paid' })
          .eq('id', row.id)
      } else {
        const { data: rpcData, error: rpcErr } = await admin.rpc('mark_invoice_paid_from_stripe', {
          p_invoice_id: row.id,
        })

        if (rpcErr) {
          console.error('mark_invoice_paid_from_stripe:', rpcErr)
          return new Response(JSON.stringify({ error: rpcErr.message }), { status: 500 })
        }

        const result = rpcData as { error?: string; ok?: boolean } | null
        if (result && typeof result === 'object' && result.error) {
          console.warn('mark_invoice_paid_from_stripe result:', result)
        }

        await admin
          .from('jobs_ledger_invoices')
          .update({ stripe_invoice_status: 'paid' })
          .eq('id', row.id)
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error('stripe-webhook:', e)
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
