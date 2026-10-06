import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@16.12.0?target=denonext'
import {
  anyStripeApiKeyConfigured,
  stripeApiKeyForMode,
  stripeWebhookDebugFingerprintsEnabled,
  stripeWebhookEnvFingerprints,
  stripeWebhookSecretsWithModes,
  type StripeBillingMode,
} from '../_shared/stripeSecrets.ts'
import { parseOobPaymentMetadataFromStripe } from '../_shared/pipetoolingStripeOobPaymentMetadata.ts'
import { lienOfferWriteDown, type LienOfferRow } from '../_shared/lienPayOffer.ts'
import { APP_CALENDAR_TZ } from '../_shared/appTimeZone.ts'

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

/**
 * A2 (FRAGILITY_REMEDIATION_PLAN.md) mode gate: an event may only touch a row
 * living in the same Stripe mode. NULL-mode legacy rows self-heal from the
 * verified event mode (the signing secret + event.livemode are authoritative).
 * Returns the reason string on mismatch (caller reports applied:false), null
 * to proceed.
 */
async function gateRowModeForEvent(
  admin: SupabaseClient,
  row: { id: string; stripe_mode: string | null },
  eventMode: StripeBillingMode,
  event: Pick<Stripe.Event, 'id' | 'type'>,
): Promise<string | null> {
  if (row.stripe_mode == null) {
    const { error } = await admin
      .from('jobs_ledger_invoices')
      .update({ stripe_mode: eventMode })
      .eq('id', row.id)
      .is('stripe_mode', null)
    if (error) webhookLog('warn', event, 'stripe_mode self-heal failed (continuing)', error)
    return null
  }
  if (row.stripe_mode !== eventMode) {
    webhookLog('warn', event, 'mode mismatch: event vs invoice row', {
      event_mode: eventMode,
      invoice_mode: row.stripe_mode,
      invoice_row_id: row.id,
    })
    return 'mode_mismatch'
  }
  return null
}

/** Sync Stripe invoice.status into jobs_ledger_invoices.stripe_invoice_status only (no payment RPC). */
async function syncJobsLedgerStripeInvoiceStatus(
  admin: SupabaseClient,
  stripeInvId: string,
  stripeStatus: string,
  event: Pick<Stripe.Event, 'id' | 'type'>,
  eventMode: StripeBillingMode,
): Promise<void> {
  const { data: rows, error: qErr } = await admin
    .from('jobs_ledger_invoices')
    .select('id, status, stripe_mode, amount, lien_offer_pct, lien_offer_by, lien_offer_set_by, lien_offer_credit_note_id, lien_offer_credit_cents, lien_offer_taken_at, lien_offer_ended_at')
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

  if ((await gateRowModeForEvent(admin, row, eventMode, event)) != null) {
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

type LienOfferWebhookRow = LienOfferRow & { id: string; amount: number | null; lien_offer_set_by: string | null }

/** YYYY-MM-DD of a Stripe epoch-seconds stamp, in the company's calendar; today when Stripe gave none. */
function ymdInAppTz(epochSeconds: number | null | undefined): string {
  const d = typeof epochSeconds === 'number' && Number.isFinite(epochSeconds) && epochSeconds > 0 ? new Date(epochSeconds * 1000) : new Date()
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: APP_CALENDAR_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

/** The pay offer's write-down (v2.4704). Never throws: a bill that cannot be written down is still marked paid, with a warning line. */
async function recordLienOfferWriteDown(admin: SupabaseClient, row: LienOfferWebhookRow, inv: Stripe.Invoice, eventForLog: Pick<Stripe.Event, 'id' | 'type'>): Promise<void> {
  const plan = lienOfferWriteDown(row, Number(row.amount ?? 0), ymdInAppTz(inv.status_transitions?.paid_at))
  if (!plan) return
  if (!row.lien_offer_set_by) {
    webhookLog('warn', eventForLog, 'lien offer: no leader on the bill, write-down skipped', row.id)
    return
  }
  const { data, error } = await admin.rpc('service_apply_agreed_write_down_from_stripe', {
    p_invoice_id: row.id,
    p_new_amount: plan.newAmount,
    p_note: `${plan.note} (Stripe credit note ${row.lien_offer_credit_note_id})`,
    p_stripe_credit_note_id: row.lien_offer_credit_note_id,
    p_actor_user_id: row.lien_offer_set_by,
  })
  const result = data as { error?: string; ok?: boolean } | null
  if (error || (result && typeof result === 'object' && result.error)) {
    webhookLog('warn', eventForLog, 'lien offer: write-down refused', error ?? result?.error)
    return
  }
  const { error: upErr } = await admin.from('jobs_ledger_invoices').update({ lien_offer_taken_at: new Date().toISOString() }).eq('id', row.id)
  if (upErr) webhookLog('warn', eventForLog, 'lien offer: taken_at not stored', upErr)
}

/** `invoice.paid` (classic) and `invoice.payment_succeeded` (newer API / dashboard) — same PipeTooling handling. */
async function handleStripeInvoicePaidEvent(
  admin: SupabaseClient,
  inv: Stripe.Invoice,
  eventForLog: Pick<Stripe.Event, 'id' | 'type'>,
  eventMode: StripeBillingMode,
): Promise<Response> {
  const stripeInvId = inv.id
  if (!stripeInvId) {
    return jsonOk({ received: true, skipped: 'no invoice id' })
  }

  const { data: rows, error: qErr } = await admin
    .from('jobs_ledger_invoices')
    .select('id, status, stripe_mode')
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

  const modeGate = await gateRowModeForEvent(admin, row, eventMode, eventForLog)
  if (modeGate != null) {
    return jsonOk({
      received: true,
      applied: false,
      reason: modeGate,
      event_mode: eventMode,
      invoice_mode: row.stripe_mode,
    })
  }

  if (row.status === 'paid') {
    await admin.from('jobs_ledger_invoices').update({ stripe_invoice_status: 'paid' }).eq('id', row.id)
  } else {
    // The pay offer (v2.4704): paid in full with the leader's credit on the bill — the ledger is written down by the
    // credit, with the note, BEFORE the payment is recorded, since mark_invoice_paid_from_stripe records the ledger's
    // remaining amount, not Stripe's. The actor is the leader who gave the offer.
    await recordLienOfferWriteDown(admin, row as unknown as LienOfferWebhookRow, inv, eventForLog)
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
    // v2.4289: who pressed Mark Paid, carried on the invoice's metadata → jobs_ledger_payments.created_by.
    if (oob.p_recorded_by) rpcArgs.p_recorded_by = oob.p_recorded_by
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

  const { data: cfData, error: cfErr } = await admin.rpc('complete_job_collect_payment_flow_for_invoice', {
    p_stripe_invoice_id: stripeInvId,
  })
  if (cfErr) {
    webhookLog('warn', eventForLog, 'complete_job_collect_payment_flow_for_invoice rpc failed', cfErr)
  } else {
    const cfResult = cfData as { error?: string; ok?: boolean } | null
    if (cfResult && typeof cfResult === 'object' && cfResult.error && cfResult.error !== 'no matching flow') {
      webhookLog('warn', eventForLog, 'complete_job_collect_payment_flow_for_invoice', cfResult.error)
    }
  }

  return jsonOk({ received: true })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  let eventForLog: Pick<Stripe.Event, 'id' | 'type'> | null = null

  try {
    const webhookSecrets = stripeWebhookSecretsWithModes()
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim() ?? ''
    const supabaseUrl = Deno.env.get('SUPABASE_URL')?.trim() ?? ''

    // Only used to construct the verification client; signature checking needs
    // the whsec, not a real API key. API calls use the event-mode key below.
    const stripeInitKey =
      stripeApiKeyForMode('live') ?? stripeApiKeyForMode('test') ?? ''

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
    let verifiedSecretMode: StripeBillingMode | null = null
    let lastVerifyErr: string | null = null
    for (const { secret: whsec, mode } of webhookSecrets) {
      try {
        event = await stripe.webhooks.constructEventAsync(body, signature, whsec, undefined, cryptoProvider)
        verifiedSecretMode = mode
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

    // A2: the event's mode. event.livemode describes the object; the verifying
    // secret's env var claims a mode too — disagreement means the live/test
    // webhook endpoints share a secret (misconfiguration worth surfacing).
    const eventMode: StripeBillingMode = event.livemode ? 'live' : 'test'
    if (verifiedSecretMode != null && verifiedSecretMode !== eventMode) {
      webhookLog('warn', eventForLog, 'signing-secret mode disagrees with event.livemode', {
        secret_env_mode: verifiedSecretMode,
        event_livemode: event.livemode,
      })
    }

    const { error: dedupeErr } = await admin.from('stripe_webhook_events').insert({
      stripe_event_id: event.id,
      event_type: event.type,
      livemode: event.livemode,
    })

    if (dedupeErr && isUniqueViolation(dedupeErr)) {
      return jsonOk({ received: true, duplicate: true })
    }
    if (dedupeErr) {
      webhookLog('error', eventForLog, 'stripe_webhook_events insert failed (continuing)', dedupeErr)
    }

    if (event.type === 'invoice.paid' || event.type === 'invoice.payment_succeeded') {
      const inv = event.data.object as Stripe.Invoice
      return await handleStripeInvoicePaidEvent(admin, inv, eventForLog, eventMode)
    } else if (
      event.type === 'invoice.updated' ||
      event.type === 'invoice.voided' ||
      event.type === 'invoice.payment_failed'
    ) {
      const inv = event.data.object as Stripe.Invoice
      const stripeInvId = inv.id
      const st = inv.status
      if (stripeInvId && st) {
        await syncJobsLedgerStripeInvoiceStatus(admin, stripeInvId, st, eventForLog, eventMode)
      }
    } else if (event.type === 'credit_note.created') {
      const cn = event.data.object as Stripe.CreditNote
      const invRef = cn.invoice
      const stripeInvId = typeof invRef === 'string' ? invRef : invRef?.id
      if (stripeInvId) {
        // A2 fix: retrieve with the EVENT's mode key. The old test-first
        // stripeInitKey made every live credit-note retrieval fail silently
        // whenever both keys were configured.
        const eventModeKey = stripeApiKeyForMode(eventMode)
        if (!eventModeKey) {
          webhookLog('warn', eventForLog, `credit_note.created: no API key configured for ${eventMode} mode`)
        } else {
          try {
            const stripeForEvent = new Stripe(eventModeKey, { apiVersion: '2024-06-20' })
            const inv = await stripeForEvent.invoices.retrieve(stripeInvId)
            if (inv.status) {
              await syncJobsLedgerStripeInvoiceStatus(admin, stripeInvId, inv.status, eventForLog, eventMode)
            }
          } catch (e) {
            webhookLog('warn', eventForLog, 'credit_note.created: retrieve invoice failed', e)
          }
        }
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
