import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@16.12.0?target=deno'
import { stripeApiKeyForMode, type StripeBillingMode } from '../_shared/stripeSecrets.ts'
import { clearCustomerStripeCustomerId, isMissingStripeCustomerError, stripeCustomerIdColumnForMode } from '../_shared/stripeStaleCustomer.ts'
import { buildPipetoolingStripeInvoiceNumber } from '../_shared/pipetoolingStripeInvoiceNumber.ts'
import { stripeInvoiceFooter } from '../_shared/stripeInvoiceFooterPortalLink.ts'
import { loadPortalReturnUrl } from '../_shared/customerPortalReturnUrl.ts'
import { customerBillingEmail } from '../_shared/billToParty.ts'
import { gcPortalOwns } from '../_shared/gcPortal.ts'
import { todayYmdInAppTz } from '../_shared/appTimeZone.ts'
import {
  GC_CARD_BILL_ERRORS,
  GC_CARD_BILL_UNDO_ROLES,
  GC_CARD_BILL_WORDS,
  gcCardBillDbWords,
  gcCardBillDue,
  gcCardBillOn,
  gcCardBillStripeLines,
  gcCardBillStripeMode,
  parseGcCardBillBegun,
  parseGcCardBillRequest,
  type GcCardBillErrorKey,
} from '../_shared/gcCardBill.ts'

/**
 * gc-card-bill — GC mode, Owner Billing's O8b: the customer pays a certified GC bill by card from their portal, with
 * a 3% credit card fee (the owner's word, 2026-10-09; counsel's okay the same day). Staff never turn a bill to card.
 * The plan is to-dos/gc-mode/mockups/owner-billing-o8.md on branch spike/gc-mode; the database's half is O8a
 * (migration 20261010026000: gc_card_bill_begin, gc_card_bill_finish, gc_card_bill_undo).
 *
 * Two doors, `verify_jwt = false`:
 *
 *   POST { token, invoiceId }  — the customer's portal (no sign-in; the portal link is the capability).
 *     → { ok: true, url }       the Stripe card page to open
 *     The offer must be on (GC_CARD_BILL_ON), the link live, the bill the link's customer's, and the customer an
 *     email for Stripe's receipt. gc_card_bill_begin checks the bill and writes the pending row; this makes the card
 *     only Stripe invoice (the bill's line, then "Credit card fee (3%)"); gc_card_bill_finish writes it onto the bill.
 *     If Stripe fails, the invoice it made is voided and the pending row cleared. A bill on card answers its page.
 *
 *   POST { undo: invoiceId }   — Back to a check bill, by the money team (staff JWT, checked in the body).
 *     → { ok: true }
 *     Voids the Stripe invoice (refused once Stripe shows a payment), then gc_card_bill_undo as the caller, which puts
 *     the bill back to its base, takes the fee off and lays the revenue again.
 *
 * Refusals: `{ error: key, words }` with GC_CARD_BILL_ERRORS' status; the words are the customer's (or the office's)
 * and the page shows them as they are. Stripe runs in test mode until GC_CARD_BILL_STRIPE_MODE is `live`, the owner's
 * word. Nothing here emails: the customer is on the card page already, and Stripe's own receipt follows a payment.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

function refuse(key: GcCardBillErrorKey, words?: string): Response {
  return json({ error: key, words: words ?? GC_CARD_BILL_WORDS[key] }, GC_CARD_BILL_ERRORS[key])
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

type Admin = ReturnType<typeof createClient>

/** The Stripe customer the app keeps for this customer and mode (as create-stripe-invoice keeps it), made when none. */
async function stripeCustomerFor(stripe: Stripe, admin: Admin, mode: StripeBillingMode, customer: Record<string, unknown>, email: string): Promise<string> {
  const column = stripeCustomerIdColumnForMode(mode)
  const id = String(customer.id)
  const name = String(customer.name ?? '').trim() || email
  let stripeCustomerId = (typeof customer[column] === 'string' ? (customer[column] as string) : '').trim() || null
  if (stripeCustomerId) {
    try {
      await stripe.customers.update(stripeCustomerId, { email, name })
    } catch (e) {
      if (!isMissingStripeCustomerError(e)) throw e
      await clearCustomerStripeCustomerId(admin, id, mode)
      stripeCustomerId = null
    }
  }
  if (!stripeCustomerId) {
    const created = await stripe.customers.create({ email, name, metadata: { pipetooling_customer_id: id } })
    stripeCustomerId = created.id
    await admin.from('customers').update({ [column]: stripeCustomerId }).eq('id', id)
  }
  return stripeCustomerId
}

async function portalDoor(admin: Admin, token: string, invoiceId: string): Promise<Response> {
  if (!gcCardBillOn(Deno.env.get('GC_CARD_BILL_ON'))) return refuse('off')

  let { data: link } = await admin.from('customer_portal_links').select('id, customer_id, revoked_at').eq('token', token).maybeSingle()
  if (!link) link = (await admin.from('customer_portal_links').select('id, customer_id, revoked_at').eq('token_hash', await sha256Hex(token)).maybeSingle()).data
  if (!link || (link as { revoked_at: string | null }).revoked_at) return refuse('linkGone')
  const linkCustomerId = String((link as { customer_id: string }).customer_id)

  // The bill must be a certified bill on one of this customer's GC jobs.
  const { data: app } = await admin.from('gc_owner_pay_apps').select('project_id').eq('invoice_id', invoiceId).maybeSingle()
  const { data: project } = app
    ? await admin.from('projects').select('customer_id, name').eq('id', (app as { project_id: string }).project_id).maybeSingle()
    : { data: null }
  if (!app || !gcPortalOwns(project as { customer_id: string | null } | null, linkCustomerId)) return refuse('notYours')

  const { data: customer } = await admin
    .from('customers')
    .select('id, name, billing_email, contact_info, stripe_customer_id, stripe_customer_id_test')
    .eq('id', linkCustomerId)
    .maybeSingle()
  const email = customer ? customerBillingEmail(customer as Parameters<typeof customerBillingEmail>[0]) : ''
  if (!customer || !email) return refuse('noEmail')

  const { data: begunRaw, error: beginErr } = await admin.rpc('gc_card_bill_begin', { p_invoice_id: invoiceId })
  if (beginErr) return refuse('refused', gcCardBillDbWords(beginErr.message) ?? undefined)
  const begun = parseGcCardBillBegun(begunRaw)
  if (!begun) return refuse('failed')
  if (begun.state === 'on_card') return begun.hostedInvoiceUrl ? json({ ok: true, url: begun.hostedInvoiceUrl }) : refuse('failed')

  const mode = gcCardBillStripeMode(Deno.env.get('GC_CARD_BILL_STRIPE_MODE'))
  const key = stripeApiKeyForMode(mode)
  const abandon = async () => {
    const { error } = await admin.rpc('gc_card_bill_undo', { p_invoice_id: invoiceId })
    if (error) console.warn('gc-card-bill: the pending row stays', error.message)
  }
  if (!key) {
    await abandon()
    return refuse('stripeFailed')
  }
  const stripe = new Stripe(key, { apiVersion: '2024-06-20' })
  let made: string | null = null
  try {
    const { data: job } = await admin.from('jobs_ledger').select('hcp_number, click_number, job_name').eq('id', begun.jobId).maybeSingle()
    const jobNumber = ((job as { hcp_number?: string | null } | null)?.hcp_number ?? '').trim() || ((job as { click_number?: string | null } | null)?.click_number ?? '').trim() || null
    const jobName = String((project as { name?: string | null } | null)?.name ?? (job as { job_name?: string | null } | null)?.job_name ?? '')
    const { dueYmd, daysUntilDue } = gcCardBillDue(todayYmdInAppTz(), begun.certifiedOn, begun.ownerPayDays)
    const number = buildPipetoolingStripeInvoiceNumber(jobNumber, dueYmd, Date.now())
    if (!number.ok) throw new Error(number.error)
    const stripeCustomerId = await stripeCustomerFor(stripe, admin, mode, customer as Record<string, unknown>, email)
    const portalUrl = await loadPortalReturnUrl(admin, linkCustomerId, Deno.env.get('APP_ORIGIN')?.trim() || 'https://clicktooling.com')
    const lines = gcCardBillStripeLines(begun, jobName)

    const invoice = await stripe.invoices.create({
      customer: stripeCustomerId,
      collection_method: 'send_invoice',
      days_until_due: daysUntilDue,
      // Card only (the owner's shape (a)): the 3% is a card fee, never paid by a bank debit.
      payment_settings: { payment_method_types: ['card'] },
      description: lines[0]!.description,
      footer: stripeInvoiceFooter(null, portalUrl) ?? undefined,
      number: number.number,
      metadata: { pipetooling_invoice_id: invoiceId, pipetooling_job_id: begun.jobId ?? '', gc_card_bill: 'portal' },
    })
    made = invoice.id
    for (const line of lines) {
      await stripe.invoiceItems.create({ customer: stripeCustomerId, invoice: invoice.id, amount: line.amountCents, currency: 'usd', description: line.description })
    }
    const finalized = await stripe.invoices.finalizeInvoice(invoice.id)
    if (!finalized.hosted_invoice_url) throw new Error('Stripe did not return the card page')

    const { error: finishErr } = await admin.rpc('gc_card_bill_finish', {
      p_invoice_id: invoiceId,
      p_stripe_invoice_id: finalized.id,
      p_hosted_url: finalized.hosted_invoice_url,
      p_stripe_status: finalized.status ?? 'open',
      p_mode: mode,
    })
    if (finishErr) throw new Error(finishErr.message)
    console.log(JSON.stringify({ event: 'gc_card_bill_on_card', customer_id: linkCustomerId, invoice_id: invoiceId, stripe_invoice_id: finalized.id, mode }))
    return json({ ok: true, url: finalized.hosted_invoice_url })
  } catch (e) {
    console.error('gc-card-bill: the card page was not made', e instanceof Error ? e.message : String(e))
    if (made) {
      try {
        const inv = await stripe.invoices.retrieve(made)
        if (inv.status === 'draft') await stripe.invoices.del(made)
        else if (inv.status === 'open') await stripe.invoices.voidInvoice(made)
      } catch (v) {
        console.error('gc-card-bill: the half-made Stripe invoice stays', made, v instanceof Error ? v.message : String(v))
      }
    }
    await abandon()
    return refuse('stripeFailed')
  }
}

async function undoDoor(req: Request, admin: Admin, invoiceId: string): Promise<Response> {
  const authHeader = req.headers.get('Authorization') ?? ''
  if (!authHeader.startsWith('Bearer ')) return refuse('signIn')
  const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } })
  const { data: u } = await userClient.auth.getUser(authHeader.slice(7))
  if (!u?.user) return refuse('signIn')
  const { data: who } = await admin.from('users').select('role, read_only, is_digital_twin').eq('id', u.user.id).maybeSingle()
  const w = who as { role?: string | null; read_only?: boolean | null; is_digital_twin?: boolean | null } | null
  if (!w || !GC_CARD_BILL_UNDO_ROLES.includes(String(w.role ?? ''))) return refuse('moneyTeamOnly')
  if (w.read_only) return refuse('readOnly')
  if (w.is_digital_twin) return refuse('twin')

  const { data: card } = await admin.from('gc_owner_card_bills').select('status').eq('invoice_id', invoiceId).maybeSingle()
  const { data: bill } = await admin.from('jobs_ledger_invoices').select('stripe_invoice_id, stripe_mode').eq('id', invoiceId).maybeSingle()
  const stripeInvoiceId = ((bill as { stripe_invoice_id?: string | null } | null)?.stripe_invoice_id ?? '').trim()
  if ((card as { status?: string } | null)?.status !== 'on_card' || !stripeInvoiceId) return refuse('notOnCard')

  // Stripe first: a bill back at its base must never keep a live card page that asks the fee.
  const mode: StripeBillingMode = (bill as { stripe_mode?: string | null }).stripe_mode === 'live' ? 'live' : 'test'
  const key = stripeApiKeyForMode(mode)
  if (!key) return refuse('failed')
  const stripe = new Stripe(key, { apiVersion: '2024-06-20' })
  try {
    const inv = await stripe.invoices.retrieve(stripeInvoiceId)
    if (inv.status === 'paid' || (inv.amount_paid ?? 0) > 0) return refuse('paidOnStripe')
    if (inv.status === 'open' || inv.status === 'uncollectible') await stripe.invoices.voidInvoice(stripeInvoiceId)
    else if (inv.status === 'draft') await stripe.invoices.del(stripeInvoiceId)
  } catch (e) {
    console.error('gc-card-bill undo: Stripe', e instanceof Error ? e.message : String(e))
    return refuse('failed', 'Stripe did not take the card page down. Try again.')
  }

  const { error } = await userClient.rpc('gc_card_bill_undo', { p_invoice_id: invoiceId })
  if (error) return refuse('refused', gcCardBillDbWords(error.message) ?? GC_CARD_BILL_WORDS.failed)
  console.log(JSON.stringify({ event: 'gc_card_bill_undone', user_id: u.user.id, invoice_id: invoiceId, stripe_invoice_id: stripeInvoiceId }))
  return json({ ok: true })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return refuse('badRequest')
  try {
    const parsed = parseGcCardBillRequest(await req.json().catch(() => null))
    if (!parsed.ok) return refuse('badRequest')
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
    return parsed.req.door === 'portal' ? await portalDoor(admin, parsed.req.token, parsed.req.invoiceId) : await undoDoor(req, admin, parsed.req.invoiceId)
  } catch (e) {
    console.error('gc-card-bill error', e)
    return refuse('failed')
  }
})
