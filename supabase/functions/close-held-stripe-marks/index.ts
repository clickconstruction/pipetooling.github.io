/**
 * close-held-stripe-marks (v2.4801): the sweep behind "a check on a Stripe bill holds the
 * Stripe close". Mark Paid · Check records the ledger row only; the bill reads Paid in the
 * app while the Stripe invoice stays open, so for CHECK_CLEAR_DAYS the row can be moved to
 * the right job or taken off like any hand-typed payment. pg_cron calls this daily with
 * X-Cron-Secret; it finds Stripe bills the app shows paid and Stripe still shows open, and —
 * once every check on the bill is CHECK_CLEAR_DAYS old and no linked deposit came back from
 * the bank — closes the Stripe invoice out of band with the same metadata Mark Paid used to
 * write (the webhook then no-ops on the already-paid row and stamps stripe_invoice_status).
 * Kill switch: app_settings key held_stripe_marks_sweep_disabled_v1 = '1'.
 * Body: { dry_run?: true, invoice_id?: '<one bill>' } for a hand run.
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@16.12.0?target=deno'
import { defaultStripeBillingMode, effectiveRowStripeMode, stripeApiKeyForMode } from '../_shared/stripeSecrets.ts'
import { stripeInvoiceMetadataForOobPayment, truncateStripeMetadataValue } from '../_shared/pipetoolingStripeOobPaymentMetadata.ts'
import { todayYmdInAppTz, ymdAddDays } from '../_shared/appTimeZone.ts'

/** Mirrors src/lib/jobs/checkClearing.ts — the owner's seven days (2026-10-01). */
const CHECK_CLEAR_DAYS = 7
const KILL_SWITCH_KEY = 'held_stripe_marks_sweep_disabled_v1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

type InvoiceRow = {
  id: string
  job_id: string
  amount: number | null
  status: string | null
  stripe_invoice_id: string | null
  stripe_mode: string | null
  stripe_invoice_status: string | null
}

type PaymentRow = {
  id: string
  amount: number | null
  paid_on: string | null
  payment_type: string | null
  reference_number: string | null
  note: string | null
  created_by: string | null
  mercury_transaction_id: string | null
  stripe_credit_note_id: string | null
}

type Outcome = { invoice_id: string; job_id: string; result: string; detail?: string }

/** "Check", "Cheque", "checkDeposit", "ck" — the app's own reading (src/lib/jobs/checkClearing.ts). */
function isCheck(paymentType: string | null): boolean {
  return /check|cheque|\bck\b/i.test(paymentType ?? '')
}

function isYmd(s: string | null | undefined): s is string {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s)
}

function isInvoiceAlreadyPaidStripeError(e: unknown): boolean {
  if (!e || typeof e !== 'object') return false
  const err = e as { code?: string; message?: string }
  const msg = (err.message ?? '').toLowerCase()
  return err.code === 'invoice_already_paid' || msg.includes('already been paid') || msg.includes('already paid')
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  try {
    const cronSecret = Deno.env.get('CRON_SECRET')
    if (!cronSecret) return json({ error: 'CRON_SECRET not configured' }, 500)
    const body = (await req.json().catch(() => ({}))) as { cron_secret?: string; dry_run?: boolean; invoice_id?: string }
    if (req.headers.get('X-Cron-Secret') !== cronSecret && body.cron_secret !== cronSecret) {
      return json({ error: 'Unauthorized - Invalid or missing cron secret' }, 401)
    }
    const dryRun = body.dry_run === true
    const onlyInvoice = (body.invoice_id ?? '').trim() || null

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: kill } = await admin.from('app_settings').select('value_text').eq('key', KILL_SWITCH_KEY).maybeSingle()
    if (((kill as { value_text?: string | null } | null)?.value_text ?? '').trim() === '1') {
      return json({ ok: true, skipped: 'disabled', closed: [] })
    }

    const today = todayYmdInAppTz()

    let q = admin
      .from('jobs_ledger_invoices')
      .select('id, job_id, amount, status, stripe_invoice_id, stripe_mode, stripe_invoice_status')
      .eq('status', 'paid')
      .not('stripe_invoice_id', 'is', null)
    if (onlyInvoice) q = q.eq('id', onlyInvoice)
    const { data: invRaw, error: invErr } = await q
    if (invErr) return json({ error: invErr.message }, 500)

    // A held mark: paid here, not yet paid (or dead) in Stripe.
    const held = ((invRaw ?? []) as InvoiceRow[]).filter((inv) => {
      if (!(inv.stripe_invoice_id ?? '').trim()) return false
      const st = (inv.stripe_invoice_status ?? '').trim()
      return st !== 'paid' && st !== 'void' && st !== 'uncollectible'
    })

    const closed: Outcome[] = []
    const skipped: Outcome[] = []
    const errors: Outcome[] = []

    for (const inv of held) {
      const { data: payRaw, error: payErr } = await admin
        .from('jobs_ledger_payments')
        .select('id, amount, paid_on, payment_type, reference_number, note, created_by, mercury_transaction_id, stripe_credit_note_id')
        .eq('invoice_id', inv.id)
      if (payErr) {
        errors.push({ invoice_id: inv.id, job_id: inv.job_id, result: 'payments_read_failed', detail: payErr.message })
        continue
      }
      const pays = (payRaw ?? []) as PaymentRow[]
      const checks = pays.filter((p) => isCheck(p.payment_type) && !(p.stripe_credit_note_id ?? '').trim())
      if (checks.length === 0) {
        skipped.push({ invoice_id: inv.id, job_id: inv.job_id, result: 'no_check' })
        continue
      }
      const sum = pays.reduce((a, p) => a + Number(p.amount ?? 0), 0)
      if (sum + 0.005 < Number(inv.amount ?? 0)) {
        skipped.push({ invoice_id: inv.id, job_id: inv.job_id, result: 'not_covered', detail: `${sum.toFixed(2)} of ${Number(inv.amount ?? 0).toFixed(2)}` })
        continue
      }
      // Every check on the bill has had its clearing days.
      let dueYmd: string | null = null
      for (const c of checks) {
        if (!isYmd(c.paid_on)) {
          dueYmd = null
          break
        }
        const d = ymdAddDays(c.paid_on, CHECK_CLEAR_DAYS)
        if (!dueYmd || d > dueYmd) dueYmd = d
      }
      if (!dueYmd) {
        skipped.push({ invoice_id: inv.id, job_id: inv.job_id, result: 'check_without_date' })
        continue
      }
      if (dueYmd > today) {
        skipped.push({ invoice_id: inv.id, job_id: inv.job_id, result: 'clearing', detail: `closes ${dueYmd}` })
        continue
      }
      // A deposit the bank sent back: the office takes the row off (Unlink and remove); never close on it.
      const depositIds = pays.map((p) => (p.mercury_transaction_id ?? '').trim()).filter(Boolean)
      if (depositIds.length > 0) {
        const { data: txRaw } = await admin.from('mercury_transactions').select('id, status').in('id', depositIds)
        const failed = ((txRaw ?? []) as Array<{ id: string; status: string | null }>).find((t) => (t.status ?? '').trim() === 'failed')
        if (failed) {
          skipped.push({ invoice_id: inv.id, job_id: inv.job_id, result: 'bank_returned', detail: failed.id })
          continue
        }
      }

      const stripeInvId = (inv.stripe_invoice_id ?? '').trim()
      // Nothing is requested, so there is never a conflict; the row's mode, else the default.
      const mode = effectiveRowStripeMode(inv.stripe_mode, undefined).mode ?? defaultStripeBillingMode()
      const key = stripeApiKeyForMode(mode)
      if (!key) {
        errors.push({ invoice_id: inv.id, job_id: inv.job_id, result: 'stripe_key_missing', detail: mode })
        continue
      }
      const stripe = new Stripe(key, { apiVersion: '2024-06-20' })
      let sInv: Stripe.Invoice
      try {
        sInv = await stripe.invoices.retrieve(stripeInvId)
      } catch (e) {
        errors.push({ invoice_id: inv.id, job_id: inv.job_id, result: 'stripe_retrieve_failed', detail: e instanceof Error ? e.message : String(e) })
        continue
      }
      const st = sInv.status ?? 'open'
      if (st === 'paid' || st === 'void' || st === 'uncollectible') {
        // Stripe already knows; the ledger just had not heard.
        if (!dryRun) await admin.from('jobs_ledger_invoices').update({ stripe_invoice_status: st }).eq('id', inv.id)
        skipped.push({ invoice_id: inv.id, job_id: inv.job_id, result: `stripe_already_${st}` })
        continue
      }
      if (st !== 'open') {
        skipped.push({ invoice_id: inv.id, job_id: inv.job_id, result: `stripe_${st}` })
        continue
      }
      const remaining = sInv.amount_remaining ?? 0
      const coveredCents = Math.round(sum * 100)
      if (remaining <= 0 || remaining > coveredCents + 1) {
        skipped.push({ invoice_id: inv.id, job_id: inv.job_id, result: 'stripe_remaining_mismatch', detail: `remaining ${remaining}¢, ledger ${coveredCents}¢` })
        continue
      }

      // The mark, from the latest check on the bill — the same keys Mark Paid wrote directly.
      const latest = checks.reduce((a, c) => (isYmd(c.paid_on) && (!isYmd(a.paid_on) || c.paid_on > a.paid_on) ? c : a), checks[0]!)
      const noteParts = [(latest.note ?? '').trim(), `Held check closed by the sweep ${today}`].filter(Boolean)
      const oobMeta = stripeInvoiceMetadataForOobPayment({
        paid_on_yyyy_mm_dd: latest.paid_on!,
        payment_type: truncateStripeMetadataValue(latest.payment_type ?? 'Check'),
        reference_number: latest.reference_number ?? undefined,
        internal_note: noteParts.join(' · '),
        recorded_by: latest.created_by ?? undefined,
      })

      if (dryRun) {
        closed.push({ invoice_id: inv.id, job_id: inv.job_id, result: 'would_close', detail: `${remaining}¢ · ${latest.paid_on}` })
        continue
      }

      try {
        const existingMeta = sInv.metadata && typeof sInv.metadata === 'object' ? { ...sInv.metadata } : {}
        await stripe.invoices.update(stripeInvId, { metadata: { ...existingMeta, ...oobMeta } })
        try {
          await stripe.invoices.pay(stripeInvId, { paid_out_of_band: true })
        } catch (e) {
          if (!isInvoiceAlreadyPaidStripeError(e)) throw e
        }
      } catch (e) {
        errors.push({ invoice_id: inv.id, job_id: inv.job_id, result: 'stripe_close_failed', detail: e instanceof Error ? e.message : String(e) })
        continue
      }
      // The webhook stamps this too; stamping here keeps the row honest if the event is slow.
      const { error: upErr } = await admin.from('jobs_ledger_invoices').update({ stripe_invoice_status: 'paid' }).eq('id', inv.id)
      closed.push({ invoice_id: inv.id, job_id: inv.job_id, result: 'closed', detail: upErr ? `stamp failed: ${upErr.message}` : undefined })
    }

    console.log(`close-held-stripe-marks: ${today} held=${held.length} closed=${closed.length} skipped=${skipped.length} errors=${errors.length}${dryRun ? ' (dry run)' : ''}`)
    return json({ ok: true, today, dry_run: dryRun, held: held.length, closed, skipped, errors })
  } catch (e) {
    console.error('close-held-stripe-marks:', e)
    return json({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
