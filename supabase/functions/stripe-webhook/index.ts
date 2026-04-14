import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@16.12.0?target=denonext'
import {
  anyStripeApiKeyConfigured,
  stripeApiKeyForMode,
  stripeWebhookDebugFingerprintsEnabled,
  stripeWebhookEnvFingerprints,
  stripeWebhookSecretsOrdered,
} from '../_shared/stripeSecrets.ts'
import { parseOobPaymentMetadataFromStripe } from '../_shared/pipetoolingStripeOobPaymentMetadata.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
}

function jsonOk(body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function jsonBadRequest(body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status: 400,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function webhookLog(
  level: 'warn' | 'error',
  event: Pick<Stripe.Event, 'id' | 'type'> | null,
  message: string,
  detail?: unknown,
) {
  const prefix = event
    ? `[stripe-webhook] ${event.id} ${event.type}`
    : '[stripe-webhook]'
  if (detail !== undefined) {
    console[level](prefix, message, detail)
  } else {
    console[level](prefix, message)
  }
}

/** Sync Stripe invoice.status into jobs_ledger_invoices.stripe_invoice_status only (no payment RPC). */
async function syncJobsLedgerStripeInvoiceStatus(
  admin: SupabaseClient,
  stripeInvId: string,
  stripeStatus: string,
  event: Pick<Stripe.Event, 'id' | 'type'>,
): Promise<void> {
  const { data: rows, error: qErr } = await admin
    .from('jobs_ledger_invoices')
    .select('id, status')
    .eq('stripe_invoice_id', stripeInvId)
    .limit(1)

  if (qErr) {
    webhookLog('error', event, 'stripe-webhook lookup failed', qErr)
    return
  }

  const row = rows?.[0]
  if (!row) {
    webhookLog('warn', event, 'No jobs_ledger_invoices for stripe invoice', stripeInvId)
    return
  }

  if (row.status === 'paid' && stripeStatus !== 'paid') {
    return
  }

  const { error: upErr } = await admin
    .from('jobs_ledger_invoices')
    .update({ stripe_invoice_status: stripeStatus })
    .eq('id', row.id)

  if (upErr) {
    webhookLog('error', event, 'stripe-webhook status update failed', upErr)
  }
}

/** Postgres unique_violation — duplicate Stripe event id (dedupe). */
function isUniqueViolation(err: { code?: string } | null): boolean {
  return err?.code === '23505'
}

/** `invoice.paid` (classic) and `invoice.payment_succeeded` (newer API / dashboard) — same PipeTooling handling. */
async function handleStripeInvoicePaidEvent(
  admin: SupabaseClient,
  inv: Stripe.Invoice,
  eventForLog: Pick<Stripe.Event, 'id' | 'type'>,
): Promise<Response> {
  const stripeInvId = inv.id
  if (!stripeInvId) {
    return jsonOk({ received: true, skipped: 'no invoice id' })
  }

  const { data: rows, error: qErr } = await admin
    .from('jobs_ledger_invoices')
    .select('id, status')
    .eq('stripe_invoice_id', stripeInvId)
    .limit(1)

  if (qErr) {
    webhookLog('error', eventForLog, 'invoice paid lookup failed', qErr)
    return jsonOk({ received: true, applied: false, reason: 'invoice_lookup_failed' })
  }

  const row = rows?.[0]
  if (!row) {
    webhookLog('warn', eventForLog, 'No jobs_ledger_invoices for stripe invoice', stripeInvId)
    return jsonOk({ received: true, skipped: 'unknown invoice' })
  }

  if (row.status === 'paid') {
    await admin.from('jobs_ledger_invoices').update({ stripe_invoice_status: 'paid' }).eq('id', row.id)
  } else {
    const md = inv.metadata && typeof inv.metadata === 'object' && !Array.isArray(inv.metadata)
      ? (inv.metadata as Record<string, string>)
      : undefined
    const oob = parseOobPaymentMetadataFromStripe(md)
    const rpcArgs: {
      p_invoice_id: string
      p_payment_type?: string
      p_reference_number?: string
      p_paid_on?: string
      p_internal_note?: string
    } = { p_invoice_id: row.id }
    if (oob.p_payment_type) rpcArgs.p_payment_type = oob.p_payment_type
    if (oob.p_reference_number) rpcArgs.p_reference_number = oob.p_reference_number
    if (oob.p_paid_on) rpcArgs.p_paid_on = oob.p_paid_on
    if (oob.p_internal_note) rpcArgs.p_internal_note = oob.p_internal_note
    const { data: rpcData, error: rpcErr } = await admin.rpc('mark_invoice_paid_from_stripe', rpcArgs)

    if (rpcErr) {
      webhookLog('error', eventForLog, 'mark_invoice_paid_from_stripe rpc failed', rpcErr)
      return jsonOk({ received: true, applied: false, reason: 'mark_paid_rpc_failed' })
    }

    const result = rpcData as { error?: string; ok?: boolean } | null
    if (result && typeof result === 'object' && result.error) {
      webhookLog('warn', eventForLog, 'mark_invoice_paid_from_stripe business error', result.error)
      return jsonOk({ received: true, applied: false, reason: 'mark_paid_rejected', detail: result.error })
    }

    await admin.from('jobs_ledger_invoices').update({ stripe_invoice_status: 'paid' }).eq('id', row.id)
  }

  return jsonOk({ received: true })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  let eventForLog: Pick<Stripe.Event, 'id' | 'type'> | null = null

  try {
    const webhookSecrets = stripeWebhookSecretsOrdered()
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim() ?? ''
    const supabaseUrl = Deno.env.get('SUPABASE_URL')?.trim() ?? ''

    const stripeInitKey =
      stripeApiKeyForMode('test') ?? stripeApiKeyForMode('live') ?? ''

    if (!anyStripeApiKeyConfigured() || webhookSecrets.length === 0 || !serviceKey || !stripeInitKey) {
      console.error(
        '[stripe-webhook] missing Stripe API key(s), webhook signing secret(s), or SUPABASE_SERVICE_ROLE_KEY',
      )
      return jsonOk({ received: true, applied: false, reason: 'misconfigured' })
    }

    const debugFp = stripeWebhookDebugFingerprintsEnabled()
    if (debugFp) {
      console.info(
        '[stripe-webhook] STRIPE_WEBHOOK_DEBUG_FINGERPRINT: signing secrets (fingerprints only)',
        stripeWebhookEnvFingerprints(),
      )
    }

    const signature =
      req.headers.get('stripe-signature') ?? req.headers.get('Stripe-Signature')
    if (!signature) {
      return jsonBadRequest({ error: 'No signature' })
    }

    const body = new TextDecoder('utf-8', { fatal: false }).decode(await req.arrayBuffer())
    const stripe = new Stripe(stripeInitKey, { apiVersion: '2024-06-20' })
    /** Deno / Supabase Edge has no Node `crypto`; sync `constructEvent` often fails verification. Use Web Crypto. */
    const cryptoProvider = Stripe.createSubtleCryptoProvider()
    let event: Stripe.Event | null = null
    let lastVerifyErr: string | null = null
    for (const whsec of webhookSecrets) {
      try {
        event = await stripe.webhooks.constructEventAsync(body, signature, whsec, undefined, cryptoProvider)
        break
      } catch (e) {
        lastVerifyErr = e instanceof Error ? e.message : String(e)
      }
    }
    if (!event) {
      const fps = stripeWebhookEnvFingerprints()
      console.error(
        '[stripe-webhook] signature verification failed (secrets_tried=%s last_error=%s) webhook_secret_fingerprints=%s',
        String(webhookSecrets.length),
        lastVerifyErr ?? 'unknown',
        JSON.stringify(fps),
      )
      return jsonBadRequest({
        error: 'Invalid signature',
        ...(lastVerifyErr ? { detail: lastVerifyErr } : {}),
        ...(debugFp ? { webhook_secret_fingerprints: fps } : {}),
      })
    }

    eventForLog = { id: event.id, type: event.type }
    const admin = createClient(supabaseUrl, serviceKey)

    const { error: dedupeErr } = await admin.from('stripe_webhook_events').insert({
      stripe_event_id: event.id,
      event_type: event.type,
    })

    if (dedupeErr && isUniqueViolation(dedupeErr)) {
      return jsonOk({ received: true, duplicate: true })
    }
    if (dedupeErr) {
      webhookLog('error', eventForLog, 'stripe_webhook_events insert failed (continuing)', dedupeErr)
    }

    if (event.type === 'invoice.paid' || event.type === 'invoice.payment_succeeded') {
      const inv = event.data.object as Stripe.Invoice
      return await handleStripeInvoicePaidEvent(admin, inv, eventForLog)
    } else if (
      event.type === 'invoice.updated' ||
      event.type === 'invoice.voided' ||
      event.type === 'invoice.payment_failed'
    ) {
      const inv = event.data.object as Stripe.Invoice
      const stripeInvId = inv.id
      const st = inv.status
      if (stripeInvId && st) {
        await syncJobsLedgerStripeInvoiceStatus(admin, stripeInvId, st, eventForLog)
      }
    }

    return jsonOk({ received: true })
  } catch (e) {
    console.error('[stripe-webhook] unhandled', eventForLog, e)
    return jsonOk({
      received: true,
      applied: false,
      reason: 'unhandled_exception',
      message: e instanceof Error ? e.message : String(e),
    })
  }
})
