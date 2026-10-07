import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@16.12.0?target=deno'
import {
  anyStripeApiKeyConfigured,
  effectiveRowStripeMode,
  stripeApiKeyForMode,
  type StripeBillingMode,
} from '../_shared/stripeSecrets.ts'
import {
  stripeInvoiceMetadataForOobPayment,
  truncateStripeMetadataValue,
} from '../_shared/pipetoolingStripeOobPaymentMetadata.ts'

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

function isInvoiceAlreadyPaidStripeError(e: unknown): boolean {
  if (!e || typeof e !== 'object') return false
  const err = e as { code?: string; message?: string; type?: string }
  const msg = (err.message ?? '').toLowerCase()
  if (err.code === 'invoice_already_paid') return true
  if (msg.includes('already been paid') || msg.includes('already paid')) return true
  return false
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** The line the customer reads on the pay link and the invoice PDF (mirrors src/lib/jobs/stripePartPayment.ts). */
function partPaymentCreditLine(paymentType: string, paidOn: string, amount: number, reference?: string): string {
  const type = paymentType.trim() || 'Payment'
  const ref = (reference ?? '').trim()
  const who = type === 'Check' && ref ? `Check #${ref}` : type
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(paidOn)
  const when = m ? `${MONTHS[Number(m[2]) - 1]} ${Number(m[3])}` : paidOn
  const money = amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return `${who} received ${when} · $${money}`
}

interface Body {
  jobs_ledger_invoice_id: string
  /** Up to the open balance. At the balance: paid out-of-band (webhook writes the row). Under it (v2.3695): a credit note + the row, written here. */
  amount_dollars: number
  paid_on: string
  payment_type: string
  reference_number?: string
  internal_note?: string
  stripe_mode?: StripeBillingMode
  /**
   * v2.1639 (AR auto-close): accept an invoice already `paid` in the app.
   * The AR allocation records the payment and flips the invoice to paid FIRST,
   * then calls here to close the Stripe invoice — the webhook's paid handler
   * no-ops on already-paid rows, so no second payment row is created.
   */
  allow_app_paid?: boolean
  /**
   * v2.4847: a payment row the app already counts toward this bill (recorded before the Stripe
   * bill existed, or matched in Accounts Receivable) that Stripe never heard of. The amount, date,
   * type and reference come from the row; the credit note is written for it and stamped on it,
   * and the row is pinned to the bill. Under the balance only — at the balance the bill is a
   * whole-bill close (Mark Paid). `amount_dollars`, `paid_on` and `payment_type` are ignored.
   */
  payment_id?: string
}

type ExistingPaymentRow = {
  id: string
  job_id: string
  invoice_id: string | null
  amount: number | null
  paid_on: string | null
  payment_type: string | null
  reference_number: string | null
  note: string | null
  stripe_credit_note_id: string | null
  mercury_transaction_id: string | null
}

/**
 * v2.4847: the type word the customer reads on the credit line for an existing row — a bank row's
 * Mercury kind ("checkDeposit", "incomingDomesticWire") and the office's spellings ("Cheque") become
 * Check · Wire · ACH · Card · Cash; anything else reads Payment. Mirrors src/lib/jobs/applyPaymentToStripeBill.ts.
 */
function customerPaymentTypeWord(paymentType: string | null | undefined): string {
  const t = (paymentType ?? '').trim().toLowerCase()
  if (!t) return 'Payment'
  if (/che(ck|que)/.test(t)) return 'Check'
  if (/card/.test(t)) return 'Card'
  if (/wire/.test(t)) return 'Wire'
  if (/ach|transfer/.test(t)) return 'ACH'
  if (/cash/.test(t)) return 'Cash'
  return 'Payment'
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
    } = await userClient.auth.getUser(authHeader.replace(/^Bearer\s+/i, ''))
    if (authErr || !user) {
      return jsonResponse({ error: 'Invalid session' }, 401)
    }

    const body = (await req.json()) as Body
    const { jobs_ledger_invoice_id, stripe_mode: stripeModeRaw } = body
    let { amount_dollars: amountRaw, paid_on: paidOnRaw, payment_type: paymentTypeRaw, reference_number, internal_note } = body

    if (!jobs_ledger_invoice_id?.trim()) {
      return jsonResponse({ error: 'Missing jobs_ledger_invoice_id' }, 400)
    }

    // v2.4847: an existing row supplies its own facts. Read with the service role so the
    // function sees the row the way the app does; the invoice read below still runs as the
    // caller, which is the access check.
    const existingPaymentId = (body.payment_id ?? '').trim()
    let existingRow: ExistingPaymentRow | null = null
    if (existingPaymentId) {
      const serviceKeyForRow = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
      if (!serviceKeyForRow) {
        return jsonResponse({ error: 'Server misconfigured: SUPABASE_SERVICE_ROLE_KEY' }, 500)
      }
      const adminForRow = createClient(supabaseUrl, serviceKeyForRow)
      const { data: rowData, error: rowErr } = await adminForRow
        .from('jobs_ledger_payments')
        .select('id, job_id, invoice_id, amount, paid_on, payment_type, reference_number, note, stripe_credit_note_id, mercury_transaction_id')
        .eq('id', existingPaymentId)
        .maybeSingle()
      if (rowErr || !rowData) {
        return jsonResponse({ error: 'Payment not found' }, 404)
      }
      existingRow = rowData as ExistingPaymentRow
      if ((existingRow.stripe_credit_note_id ?? '').trim()) {
        return jsonResponse({ error: 'Stripe already holds this payment as a credit line.' }, 400)
      }
      amountRaw = Number(existingRow.amount ?? 0)
      paidOnRaw = existingRow.paid_on ? String(existingRow.paid_on).slice(0, 10) : ''
      if (!paidOnRaw) {
        return jsonResponse({ error: 'This payment has no received date. Add the date first, under Edit details.' }, 400)
      }
      paymentTypeRaw = customerPaymentTypeWord(existingRow.payment_type)
      // A bank row's reference is the bank's id, never a check number the customer should read.
      reference_number = (existingRow.mercury_transaction_id ?? '').trim() ? undefined : existingRow.reference_number ?? undefined
      internal_note = existingRow.note ?? undefined
    }
    const payment_type = (paymentTypeRaw ?? '').trim()
    if (!payment_type) {
      return jsonResponse({ error: 'Payment type is required' }, 400)
    }
    const paid_on = (paidOnRaw ?? '').trim()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(paid_on)) {
      return jsonResponse({ error: 'paid_on must be YYYY-MM-DD' }, 400)
    }
    if (typeof amountRaw !== 'number' || !Number.isFinite(amountRaw) || amountRaw <= 0) {
      return jsonResponse({ error: 'amount_dollars must be a positive number' }, 400)
    }

    const { data: invRow, error: invErr } = await userClient
      .from('jobs_ledger_invoices')
      .select('id, job_id, amount, status, stripe_invoice_id, stripe_mode')
      .eq('id', jobs_ledger_invoice_id.trim())
      .maybeSingle()

    if (invErr || !invRow) {
      return jsonResponse({ error: 'Invoice not found or access denied' }, 403)
    }

    if (existingRow) {
      if (existingRow.job_id !== invRow.job_id) {
        return jsonResponse({ error: 'This payment sits on another job.' }, 400)
      }
      if (existingRow.invoice_id && existingRow.invoice_id !== invRow.id) {
        return jsonResponse({ error: 'This payment is pinned to another bill.' }, 400)
      }
    }

    if (invRow.status !== 'billed' && !(body.allow_app_paid === true && invRow.status === 'paid')) {
      return jsonResponse({ error: 'Invoice must be in Billed status' }, 400)
    }

    // A3: the row's recorded stripe_mode is authoritative for this operation.
    const modeRes = effectiveRowStripeMode(invRow.stripe_mode, stripeModeRaw)
    if (modeRes.conflict) {
      return jsonResponse(
        {
          error: `Invoice lives in Stripe ${modeRes.conflict.row_mode} mode; the request asked for ${modeRes.conflict.requested_mode}. No changes made.`,
          code: 'stripe_mode_mismatch',
          ...modeRes.conflict,
        },
        409,
      )
    }
    const stripeMode = modeRes.mode
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

    const stripeInvId = (invRow.stripe_invoice_id ?? '').trim()
    if (!stripeInvId) {
      return jsonResponse({ error: 'Invoice has no Stripe invoice' }, 400)
    }

    const amountCents = Math.round(amountRaw * 100)
    if (amountCents < 1) {
      return jsonResponse({ error: 'Amount too small' }, 400)
    }

    let stripeInv: Stripe.Invoice
    try {
      stripeInv = await stripe.invoices.retrieve(stripeInvId)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error('record-stripe-invoice-out-of-band-payment: retrieve failed', msg)
      return jsonResponse({ error: msg }, 502)
    }

    if (stripeInv.status === 'paid') {
      return jsonResponse({ success: true, idempotent: true, stripe_status: 'paid' })
    }

    const remaining = stripeInv.amount_remaining
    if (remaining == null) {
      return jsonResponse({ error: 'Stripe invoice has no amount_remaining' }, 502)
    }
    if (amountCents > remaining) {
      return jsonResponse(
        {
          error: `That is more than the open balance on the Stripe invoice ($${(remaining / 100).toFixed(2)}). Record up to the open balance.`,
          stripe_amount_remaining_cents: remaining,
          amount_dollars_submitted: amountRaw,
        },
        400,
      )
    }

    if (existingRow && amountCents >= remaining) {
      return jsonResponse(
        {
          error: `This payment covers the whole open balance on the Stripe invoice ($${(remaining / 100).toFixed(2)}). Mark the bill paid instead.`,
          stripe_amount_remaining_cents: remaining,
        },
        400,
      )
    }

    if (amountCents < remaining) {
      // v2.3695 — part payment in cash or by check. Stripe has no partial
      // out-of-band pay, so the cash becomes a credit note on the open invoice
      // (the pay link then asks for the rest, with the memo as its line) and
      // this function writes the ledger row itself — no webhook fires a
      // payment for a credit note. The row remembers the note for Undo.
      const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
      if (!serviceKey) {
        return jsonResponse({ error: 'Server misconfigured: SUPABASE_SERVICE_ROLE_KEY' }, 500)
      }
      const admin = createClient(supabaseUrl, serviceKey)

      const { data: appliedRows, error: appliedErr } = await admin
        .from('jobs_ledger_payments')
        .select('id, amount, sequence_order')
        .eq('invoice_id', invRow.id)
      if (appliedErr) {
        return jsonResponse({ error: appliedErr.message }, 502)
      }
      let appliedCents = 0
      let maxSeq = -1
      for (const r of (appliedRows ?? []) as Array<{ id?: string; amount: number | null; sequence_order: number | null }>) {
        // v2.4847: the existing row is the payment being applied, not money already on the bill.
        if (existingRow && r.id === existingRow.id) continue
        appliedCents += Math.round(Number(r.amount ?? 0) * 100)
        const seq = typeof r.sequence_order === 'number' ? r.sequence_order : -1
        if (seq > maxSeq) maxSeq = seq
      }
      const { count: jobRowCount } = await admin
        .from('jobs_ledger_payments')
        .select('id', { count: 'exact', head: true })
        .eq('job_id', invRow.job_id)
      const appRemainingCents = Math.round(Number(invRow.amount ?? 0) * 100) - appliedCents
      if (amountCents > appRemainingCents) {
        return jsonResponse(
          {
            error: `That is more than what ClickTooling shows open on this bill ($${(appRemainingCents / 100).toFixed(2)}).`,
            app_amount_remaining_cents: appRemainingCents,
          },
          400,
        )
      }

      const creditLine = partPaymentCreditLine(payment_type, paid_on, amountRaw, reference_number)
      const noteTrim = (internal_note ?? '').trim()
      const memo = noteTrim ? `${creditLine} — ${noteTrim}` : creditLine
      let creditNote: Stripe.CreditNote
      try {
        creditNote = await stripe.creditNotes.create({
          invoice: stripeInvId,
          amount: amountCents,
          memo: memo.slice(0, 5000),
          metadata: {
            pipetooling_part_payment: '1',
            ...stripeInvoiceMetadataForOobPayment({
              paid_on_yyyy_mm_dd: paid_on,
              payment_type: truncateStripeMetadataValue(payment_type),
              reference_number: reference_number?.trim() || undefined,
              internal_note: noteTrim || undefined,
            }),
          },
        })
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        console.error('record-stripe-invoice-out-of-band-payment: part-payment credit note failed', msg)
        return jsonResponse({ error: msg }, 502)
      }

      if (existingRow) {
        // v2.4847: stamp the note on the row that already exists and pin it to the bill.
        const { error: updErr } = await admin
          .from('jobs_ledger_payments')
          .update({ invoice_id: invRow.id, stripe_credit_note_id: creditNote.id })
          .eq('id', existingRow.id)
          .is('stripe_credit_note_id', null)
        if (updErr) {
          try {
            await stripe.creditNotes.voidCreditNote(creditNote.id)
          } catch (voidErr) {
            console.error('record-stripe-invoice-out-of-band-payment: void after update failure failed', voidErr)
          }
          return jsonResponse(
            { error: `Stripe credited the invoice but the payment could not be stamped, so the credit note was voided. ${updErr.message}`.trim() },
            502,
          )
        }
        return jsonResponse({
          success: true,
          partial: true,
          applied_existing: true,
          stripe_invoice_id: stripeInvId,
          stripe_credit_note_id: creditNote.id,
          payment_id: existingRow.id,
          amount_remaining_cents: remaining - amountCents,
          credit_line: creditLine,
          message: `Applied. Stripe now shows $${((remaining - amountCents) / 100).toFixed(2)} due on the invoice.`,
        })
      }

      const { data: inserted, error: insErr } = await admin
        .from('jobs_ledger_payments')
        .insert({
          job_id: invRow.job_id,
          amount: amountRaw,
          sequence_order: Math.max(maxSeq + 1, jobRowCount ?? 0),
          paid_on,
          note: noteTrim || null,
          payment_type,
          reference_number: reference_number?.trim() || null,
          invoice_id: invRow.id,
          stripe_credit_note_id: creditNote.id,
          // v2.4289: the service role has no auth.uid(); name the caller so the job history and
          // the Accounts Receivable trail say who recorded the payment.
          created_by: user.id,
        })
        .select('id')
        .single()
      if (insErr || !inserted) {
        try {
          await stripe.creditNotes.voidCreditNote(creditNote.id)
        } catch (voidErr) {
          console.error('record-stripe-invoice-out-of-band-payment: void after insert failure failed', voidErr)
        }
        return jsonResponse(
          {
            error: `Stripe credited the invoice but the payment could not be recorded, so the credit note was voided. ${insErr?.message ?? ''}`.trim(),
          },
          502,
        )
      }

      return jsonResponse({
        success: true,
        partial: true,
        stripe_invoice_id: stripeInvId,
        stripe_credit_note_id: creditNote.id,
        payment_id: inserted.id,
        amount_remaining_cents: remaining - amountCents,
        credit_line: creditLine,
        message: `Recorded. Stripe now shows $${((remaining - amountCents) / 100).toFixed(2)} due on the invoice.`,
      })
    }

    const oobMeta = stripeInvoiceMetadataForOobPayment({
      paid_on_yyyy_mm_dd: paid_on,
      payment_type: truncateStripeMetadataValue(payment_type),
      reference_number: reference_number?.trim() || undefined,
      internal_note: internal_note?.trim() || undefined,
      // v2.4289: the webhook writes the full-payment row with the service role; the caller rides on the metadata.
      recorded_by: user.id,
    })

    const existingMeta = stripeInv.metadata && typeof stripeInv.metadata === 'object'
      ? { ...stripeInv.metadata }
      : {}

    try {
      await stripe.invoices.update(stripeInvId, {
        metadata: { ...existingMeta, ...oobMeta },
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error('record-stripe-invoice-out-of-band-payment: metadata update failed', msg)
      return jsonResponse({ error: msg }, 502)
    }

    try {
      await stripe.invoices.pay(stripeInvId, { paid_out_of_band: true })
    } catch (e) {
      if (isInvoiceAlreadyPaidStripeError(e)) {
        const again = await stripe.invoices.retrieve(stripeInvId)
        if (again.status === 'paid') {
          return jsonResponse({ success: true, idempotent: true, stripe_status: 'paid' })
        }
      }
      const msg = e instanceof Error ? e.message : String(e)
      console.error('record-stripe-invoice-out-of-band-payment: pay failed', msg)
      return jsonResponse({ error: msg }, 502)
    }

    return jsonResponse({
      success: true,
      stripe_invoice_id: stripeInvId,
      message:
        'Stripe invoice marked paid out-of-band. Ledger updates when the Stripe webhook runs (usually within seconds).',
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('record-stripe-invoice-out-of-band-payment:', e)
    return jsonResponse({ error: msg }, 500)
  }
})
