import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@16.12.0?target=deno'
import { customerEmailFromStripeInvoice } from '../_shared/stripeInvoiceCustomerEmail.ts'
import { sendEmailViaResend } from '../_shared/resendSendEmail.ts'
import { buildStripeBillCopyEmail } from '../_shared/stripeBillCopyEmail.ts'
import { PORTAL_COMPANY } from '../_shared/portalCompany.ts'
import { loadPortalReturnUrl } from '../_shared/customerPortalReturnUrl.ts'
import { ensurePortalShortAddress } from '../_shared/portalShortAddress.ts'
import { billEmailSenderFromEnv, planBillEmail, type BillEmailOutcome, type BillEmailPlan } from '../_shared/billEmailPlan.ts'
import { copyEmailsFromRow, planBillCopies, type BillCopiesOutcome } from '../_shared/billCopyPlan.ts'
import { buildStripeBillEmail } from '../_shared/stripeBillEmail.ts'
import { PORTAL_QR_CONTENT_ID, PORTAL_QR_FILENAME } from '../_shared/portalAccountCard.ts'
import { qrMatrix } from '../_shared/qrMatrix.ts'
import { bytesToBase64, qrPngBytes } from '../_shared/qrPng.ts'
import { payLinkAddress } from '../_shared/payLink.ts'
import { customerBillingEmail, effectiveInvoiceParty, payerCustomerId } from '../_shared/billToParty.ts'
import {
  anyStripeApiKeyConfigured,
  effectiveRowStripeMode,
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

async function persistSendAfterEmail(args: {
  admin: ReturnType<typeof createClient>
  jobsLedgerInvoiceId: string
  sentAtIso: string
  stripeInvoiceStatus: string | null
  /** The signed-in sender (v2.3711): this write runs as the service role, so the activity trigger reads the actor off the row. */
  sentByUserId: string
}): Promise<{ ok: true } | { ok: false; error: unknown }> {
  const patch = {
    sent_to_customer_at: args.sentAtIso,
    stripe_invoice_status: args.stripeInvoiceStatus,
    sent_by_user_id: args.sentByUserId,
  }
  const maxAttempts = 3
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const { error } = await args.admin
      .from('jobs_ledger_invoices')
      .update(patch)
      .eq('id', args.jobsLedgerInvoiceId)
    if (!error) return { ok: true }
    console.error(`send-stripe-invoice: DB persist attempt ${attempt}/${maxAttempts}`, error)
    if (attempt < maxAttempts) {
      await new Promise((r) => setTimeout(r, 150 * attempt))
    }
  }
  return { ok: false, error: 'persist_failed' }
}

function payerNameFromStripe(inv: Stripe.Invoice): string {
  const cust = inv.customer
  if (cust != null && typeof cust === 'object' && !('deleted' in cust && (cust as { deleted?: boolean }).deleted)) {
    const n = (cust as Stripe.Customer).name
    if (typeof n === 'string' && n.trim()) return n.trim()
  }
  return typeof inv.customer_name === 'string' ? inv.customer_name.trim() : ''
}

/**
 * The bill's copies. Who they go to is `planBillCopies`' call: every address on the copy list
 * on a live bill; on a test-mode bill one copy to the sender and nothing to the copy list — a
 * test must not email the customer's people, the GC or a one-off address.
 */
async function sendBillCopies(args: {
  admin: ReturnType<typeof createClient>
  jobsLedgerInvoiceId: string
  inv: Stripe.Invoice
  payerName: string
  callerEmail: string | null
  stripeMode: StripeBillingMode
}): Promise<BillCopiesOutcome> {
  const { data: row } = await args.admin
    .from('jobs_ledger_invoices')
    .select('copy_emails, job_id, bill_to_name, bill_to_party, bill_to_email')
    .eq('id', args.jobsLedgerInvoiceId)
    .maybeSingle()
  const plan = planBillCopies({
    stripeMode: args.stripeMode,
    invoiceLivemode: args.inv.livemode,
    copyEmails: copyEmailsFromRow((row as { copy_emails?: unknown } | null)?.copy_emails),
    callerEmail: args.callerEmail,
  })
  if (plan.kind === 'none') return { copies_sent: [], copies_failed: [] }
  // On a test-mode bill every answer names the copy list nothing went to.
  const heldBack = plan.kind === 'live' ? {} : { copies_held_back: plan.heldBack }
  if (plan.kind === 'skip') return { copies_sent: [], copies_failed: [], copies_skipped: plan.reason, ...heldBack }
  const resendApiKey = Deno.env.get('RESEND_API_KEY')
  if (!resendApiKey) {
    console.error('send-stripe-invoice: RESEND_API_KEY missing — bill copies not sent')
    return { copies_sent: [], copies_failed: [], copies_skipped: 'no_resend_key', ...heldBack }
  }
  const hosted = (args.inv.hosted_invoice_url ?? '').trim()
  if (!hosted) return { copies_sent: [], copies_failed: [], copies_skipped: 'no_hosted_url', ...heldBack }

  const jobId = (row as { job_id?: string | null } | null)?.job_id ?? null
  let jobLabel = ''
  let jobAddress = ''
  // Whose statement each copy should point at (v2.3362): the payer's people get
  // the payer's portal (the same link the Stripe footer carries), the other
  // party (the GC on a customer-pays job, the customer on a GC-pays job) gets
  // its own, a one-off address gets none. Resolved from the same who-pays rule
  // create-stripe-invoice used; every lookup fails soft to "no link".
  const portalByEmail = new Map<string, string | null>()
  if (jobId) {
    const { data: job } = await args.admin
      .from('jobs_ledger')
      .select('job_name, job_address, hcp_number, click_number, customer_id, gc_customer_id, bill_to_party, customer_email')
      .eq('id', jobId)
      .maybeSingle()
    const j = job as {
      job_name?: string | null
      job_address?: string | null
      hcp_number?: string | null
      click_number?: string | null
      customer_id?: string | null
      gc_customer_id?: string | null
      bill_to_party?: string | null
      customer_email?: string | null
    } | null
    const num = (j?.hcp_number ?? '').trim() || (j?.click_number ?? '').trim()
    jobLabel = [num ? `J${num.replace(/^J/i, '')}` : '', (j?.job_name ?? '').trim()].filter(Boolean).join(' · ')
    jobAddress = (j?.job_address ?? '').trim()
    // A test copy stands in for the whole list, so it carries nobody's statement.
    if (plan.kind === 'live') {
      try {
        const invParty = row as { bill_to_party?: string | null; bill_to_email?: string | null } | null
        const party = effectiveInvoiceParty(j, invParty)
        const payerId = payerCustomerId(j, party)
        const custId = (j?.customer_id ?? '').trim() || null
        const gcId = (j?.gc_customer_id ?? '').trim() || null
        const otherId = party === 'other' || !gcId || gcId === custId ? null : party === 'gc' ? custId : gcId
        const appOrigin = Deno.env.get('APP_ORIGIN')?.trim() || 'https://clicktooling.com'
        const linkFor = async (id: string | null) => (id ? await loadPortalReturnUrl(args.admin, id, appOrigin, { paid: false }) : null)
        const [payerLink, otherLink] = await Promise.all([linkFor(payerId), linkFor(otherId)])
        // The other party's address: its billing email (a GC) or the job's customer email.
        if (otherId) {
          const { data: other } = await args.admin.from('customers').select('billing_email, contact_info').eq('id', otherId).maybeSingle()
          const otherEmail = (party === 'gc' ? (j?.customer_email ?? '').trim() : customerBillingEmail(other as never)).toLowerCase()
          if (otherEmail) portalByEmail.set(otherEmail, otherLink)
        }
        if (payerId) {
          const { data: people } = await args.admin.from('customer_contact_persons').select('email').eq('customer_id', payerId)
          for (const p of (people ?? []) as Array<{ email?: string | null }>) {
            const e = (p.email ?? '').trim().toLowerCase()
            if (e && !portalByEmail.has(e)) portalByEmail.set(e, payerLink)
          }
        }
      } catch (e) {
        console.error('send-stripe-invoice: portal links for copies skipped', e)
      }
    }
  }
  // The payer as the copy reads it: the typed bill-to name wins (someone else), else Stripe's customer name.
  const billToName = ((row as { bill_to_name?: string | null } | null)?.bill_to_name ?? '').trim()
  const emailBase = {
    payerName: billToName || args.payerName,
    jobLabel,
    jobAddress,
    invoiceNumber: (args.inv.number ?? '').trim(),
    amountDueCents: typeof args.inv.amount_remaining === 'number' ? args.inv.amount_remaining : args.inv.amount_due ?? 0,
    dueDateUnix: typeof args.inv.due_date === 'number' ? args.inv.due_date : null,
    hostedInvoiceUrl: hosted,
    invoicePdfUrl: (args.inv.invoice_pdf ?? '').trim() || null,
    companyName: PORTAL_COMPANY.name,
  }
  if (plan.kind === 'test') {
    const email = buildStripeBillCopyEmail({ ...emailBase, portalUrl: null, testHeldBack: plan.heldBack })
    const res = await sendEmailViaResend(plan.to, email.subject, email.text, email.html, resendApiKey, {
      replyTo: plan.to,
      emailType: 'stripe_bill_copy',
    })
    if (res.success) return { copies_sent: [], copies_failed: [], copies_test_to: plan.to, ...heldBack }
    console.error('send-stripe-invoice: test bill copy failed', res.error)
    return { copies_sent: [], copies_failed: [{ email: plan.to, error: res.error ?? 'send failed' }], ...heldBack }
  }
  // Each statement's code is drawn once (the payer's people share one, the other party has its
  // own) and rides as an inline attachment on every copy that points at that statement.
  const qrByPortal = new Map<string, string | null>()
  const qrFor = (portalUrl: string): string | null => {
    if (!qrByPortal.has(portalUrl)) {
      const modules = qrMatrix(portalUrl)
      qrByPortal.set(portalUrl, modules ? bytesToBase64(qrPngBytes(modules)) : null)
    }
    return qrByPortal.get(portalUrl) ?? null
  }
  const sent: string[] = []
  const failed: Array<{ email: string; error: string }> = []
  for (const to of plan.to) {
    const portalUrl = portalByEmail.get(to) ?? null
    const qr = portalUrl ? qrFor(portalUrl) : null
    const email = buildStripeBillCopyEmail({ ...emailBase, portalUrl, qrImgSrc: qr ? `cid:${PORTAL_QR_CONTENT_ID}` : null })
    const res = await sendEmailViaResend(to, email.subject, email.text, email.html, resendApiKey, {
      ...(args.callerEmail ? { replyTo: args.callerEmail } : {}),
      ...(qr ? { attachments: [{ filename: PORTAL_QR_FILENAME, content: qr, content_id: PORTAL_QR_CONTENT_ID }] } : {}),
      emailType: 'stripe_bill_copy',
    })
    if (res.success) sent.push(to)
    else failed.push({ email: to, error: res.error ?? 'send failed' })
  }
  if (failed.length) console.error('send-stripe-invoice: bill copies failed', failed)
  return { copies_sent: sent, copies_failed: failed }
}

/** Stripe's PDF is a few pages; past this the email links it instead of carrying it. */
const BILL_PDF_MAX_BYTES = 8 * 1024 * 1024

/** The invoice PDF as base64, or null — a bill with a link to its PDF beats one that waited on a download. */
async function fetchInvoicePdfBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) })
    if (!res.ok) return null
    const bytes = new Uint8Array(await res.arrayBuffer())
    // "%PDF" — Stripe answers an expired link with a web page, which must not ride as the invoice.
    const isPdf = bytes.length > 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46
    if (!isPdf || bytes.length > BILL_PDF_MAX_BYTES) return null
    return bytesToBase64(bytes)
  } catch (e) {
    console.error('send-stripe-invoice: invoice PDF not attached', e)
    return null
  }
}

/**
 * The payer's own bill email, from us. The payer's statement rides with it as a short address
 * and a QR code — assigned here when they have a portal and no address yet — unless the bill
 * goes to someone else (a typed bill-to is not the portal holder). A test-mode bill reads a
 * saved address but never assigns one: a test must not change a customer's record.
 */
async function sendOwnBillEmail(args: {
  // deno-lint-ignore no-explicit-any
  admin: any
  jobsLedgerInvoiceId: string
  inv: Stripe.Invoice
  plan: Extract<BillEmailPlan, { via: 'clicktooling' }>
  payerName: string
  callerEmail: string | null
  callerUserId: string
  resendApiKey: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const appOrigin = Deno.env.get('APP_ORIGIN')?.trim() || 'https://clicktooling.com'
    const { data: row } = await args.admin
      .from('jobs_ledger_invoices')
      .select('job_id, bill_to_name, bill_to_party, bill_to_email')
      .eq('id', args.jobsLedgerInvoiceId)
      .maybeSingle()
    const r = row as { job_id?: string | null; bill_to_name?: string | null; bill_to_party?: string | null; bill_to_email?: string | null } | null
    let jobAddress = ''
    let portalUrl: string | null = null
    if (r?.job_id) {
      const { data: job } = await args.admin
        .from('jobs_ledger')
        .select('job_address, customer_id, gc_customer_id, bill_to_party')
        .eq('id', r.job_id)
        .maybeSingle()
      const j = job as { job_address?: string | null; customer_id?: string | null; gc_customer_id?: string | null; bill_to_party?: string | null } | null
      jobAddress = (j?.job_address ?? '').trim()
      const payerId = payerCustomerId(j, effectiveInvoiceParty(j, r))
      if (payerId) {
        if (!args.plan.testIntendedFor) await ensurePortalShortAddress(args.admin, payerId, args.callerUserId)
        portalUrl = await loadPortalReturnUrl(args.admin, payerId, appOrigin, { paid: false })
      }
    }

    const attachments: Array<{ filename: string; content: string; content_id?: string }> = []
    const modules = portalUrl ? qrMatrix(portalUrl) : null
    if (modules) attachments.push({ filename: PORTAL_QR_FILENAME, content: bytesToBase64(qrPngBytes(modules)), content_id: PORTAL_QR_CONTENT_ID })
    const pdfUrl = (args.inv.invoice_pdf ?? '').trim() || null
    const pdf = pdfUrl ? await fetchInvoicePdfBase64(pdfUrl) : null
    const number = (args.inv.number ?? '').trim()
    if (pdf) attachments.push({ filename: `Invoice-${number.replace(/[^0-9A-Za-z-]+/g, '') || 'bill'}.pdf`, content: pdf })

    const email = buildStripeBillEmail({
      companyName: PORTAL_COMPANY.name,
      companyPhone: PORTAL_COMPANY.phone,
      payerName: (r?.bill_to_name ?? '').trim() || args.payerName,
      jobAddress,
      invoiceNumber: number,
      amountDueCents: typeof args.inv.amount_remaining === 'number' ? args.inv.amount_remaining : args.inv.amount_due ?? 0,
      dueDateUnix: typeof args.inv.due_date === 'number' ? args.inv.due_date : null,
      payUrl: payLinkAddress(appOrigin, args.jobsLedgerInvoiceId),
      invoicePdfUrl: pdfUrl,
      pdfAttached: pdf != null,
      portalUrl,
      qrImgSrc: modules ? `cid:${PORTAL_QR_CONTENT_ID}` : null,
      canReply: Boolean(args.callerEmail),
      testIntendedFor: args.plan.testIntendedFor,
    })
    const res = await sendEmailViaResend(args.plan.to, email.subject, email.text, email.html, args.resendApiKey, {
      ...(args.callerEmail ? { replyTo: args.callerEmail } : {}),
      ...(attachments.length ? { attachments } : {}),
      emailType: 'stripe_bill',
    })
    return res.success ? { ok: true } : { ok: false, error: res.error ?? 'send failed' }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
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

    const { data: roleRow, error: roleErr } = await userClient
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    if (roleErr || !roleRow?.role) {
      return jsonResponse({ error: 'Could not resolve user role' }, 403)
    }

    const callerRole = roleRow.role
    // Field-collect path (strict: team member + approved flow). Superintendent
    // added v2.2637 — supers ride the same guarded path as subs, never the
    // office RLS path.
    const isSubcontractor =
      callerRole === 'subcontractor' || callerRole === 'helpers' || callerRole === 'superintendent'

    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!serviceKey?.trim()) {
      return jsonResponse({ error: 'Server misconfigured: SUPABASE_SERVICE_ROLE_MISSING' }, 500)
    }
    const admin = createClient(supabaseUrl, serviceKey)

    let invRow: { id: string; status: string; stripe_invoice_id: string | null; stripe_mode: string | null }

    if (isSubcontractor) {
      const { data: inv, error: invErr } = await admin
        .from('jobs_ledger_invoices')
        .select('id, job_id, status, stripe_invoice_id, stripe_mode')
        .eq('id', jobsLedgerInvoiceId)
        .maybeSingle()

      if (invErr || !inv) {
        return jsonResponse({ error: 'Invoice not found or access denied' }, 403)
      }

      const { data: tm } = await admin
        .from('jobs_ledger_team_members')
        .select('job_id')
        .eq('job_id', inv.job_id)
        .eq('user_id', user.id)
        .maybeSingle()

      if (!tm) {
        return jsonResponse({ error: 'Invoice not found or access denied' }, 403)
      }

      const { data: flow } = await admin
        .from('job_collect_payment_flows')
        .select('status, jobs_ledger_invoice_id')
        .eq('job_id', inv.job_id)
        .maybeSingle()

      if (
        !flow ||
        flow.status !== 'approved_for_terminal' ||
        flow.jobs_ledger_invoice_id == null ||
        String(flow.jobs_ledger_invoice_id) !== String(inv.id)
      ) {
        return jsonResponse(
          {
            error:
              'Only an active collect payment request can email this invoice from the field',
          },
          403,
        )
      }

      invRow = { id: inv.id, status: inv.status, stripe_invoice_id: inv.stripe_invoice_id, stripe_mode: inv.stripe_mode }
    } else {
      const { data: inv, error: invErr } = await userClient
        .from('jobs_ledger_invoices')
        .select('id, status, stripe_invoice_id, stripe_mode')
        .eq('id', jobsLedgerInvoiceId)
        .maybeSingle()

      if (invErr || !inv) {
        return jsonResponse({ error: 'Invoice not found or access denied' }, 403)
      }
      invRow = inv
    }

    const stripeInvoiceId = (invRow.stripe_invoice_id ?? '').trim()
    if (!stripeInvoiceId) {
      return jsonResponse({ error: 'No Stripe invoice on this billing line' }, 400)
    }

    if (invRow.status !== 'billed') {
      return jsonResponse({ error: 'Invoice must be Billed Awaiting Payment to send from Stripe' }, 400)
    }

    // A3: the row's recorded stripe_mode is authoritative for this send.
    const modeRes = effectiveRowStripeMode(invRow.stripe_mode, body.stripe_mode)
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

    let inv: Stripe.Invoice
    try {
      inv = await stripe.invoices.retrieve(stripeInvoiceId, {
        expand: ['customer'],
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error('send-stripe-invoice: retrieve', e)
      return jsonResponse({ error: msg }, 502)
    }

    const st = inv.status
    if (st === 'draft') {
      return jsonResponse({ error: 'Stripe invoice is still a draft; finalize it first' }, 400)
    }
    if (st === 'void' || st === 'uncollectible') {
      return jsonResponse({ error: `Cannot send a Stripe invoice in status "${st}"` }, 400)
    }
    if (st === 'paid') {
      return jsonResponse({ error: 'This Stripe invoice is already paid' }, 400)
    }
    if (st !== 'open') {
      return jsonResponse({ error: `Stripe invoice status "${st}" cannot be sent` }, 400)
    }

    const ar = inv.amount_remaining
    const amountRemaining = typeof ar === 'number' && !Number.isNaN(ar) ? ar : 0
    if (amountRemaining <= 0) {
      return jsonResponse({ error: 'Nothing left to collect on this Stripe invoice' }, 400)
    }

    const email = customerEmailFromStripeInvoice(inv)
    if (!email) {
      return jsonResponse(
        { error: 'Stripe has no email for this customer; add an email in Stripe or on the customer record' },
        400,
      )
    }

    // Who sends it (the bill email with the statement's QR code): ours by default, Stripe's
    // when the BILL_EMAIL_SENDER secret says so or ours cannot go — the bill goes out either way.
    const resendApiKey = Deno.env.get('RESEND_API_KEY')?.trim() ?? ''
    const plan = planBillEmail({
      sender: billEmailSenderFromEnv(Deno.env.get('BILL_EMAIL_SENDER')),
      hasResendKey: Boolean(resendApiKey),
      stripeMode,
      customerEmail: email,
      callerEmail: user.email ?? null,
    })
    let outcome: BillEmailOutcome | null = null
    if (plan.via === 'clicktooling') {
      const own = await sendOwnBillEmail({
        admin,
        jobsLedgerInvoiceId,
        inv,
        plan,
        payerName: payerNameFromStripe(inv),
        callerEmail: user.email ?? null,
        callerUserId: user.id,
        resendApiKey,
      })
      if (own.ok) {
        outcome = { sent_by: 'clicktooling', delivered_to: plan.to, ...(plan.testIntendedFor ? { test_redirected: true } : {}) }
      } else {
        console.error('send-stripe-invoice: our bill email failed, Stripe sends it', own.error)
      }
    }

    let sent: Stripe.Invoice = inv
    if (!outcome) {
      try {
        sent = await stripe.invoices.sendInvoice(stripeInvoiceId)
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        console.error('send-stripe-invoice: send', e)
        return jsonResponse({ error: msg }, 502)
      }
      const reason = plan.via === 'stripe' ? plan.reason : 'send_failed'
      outcome = { sent_by: 'stripe', delivered_to: email, ...(reason !== 'configured' ? { fallback_reason: reason } : {}) }
    }

    const sentAtIso = new Date().toISOString()
    const stripeStatus = sent.status ?? null
    const persist = await persistSendAfterEmail({
      admin,
      jobsLedgerInvoiceId,
      sentAtIso,
      stripeInvoiceStatus: stripeStatus,
      sentByUserId: user.id,
    })
    if (!persist.ok) {
      return jsonResponse(
        {
          error:
            outcome.sent_by === 'stripe'
              ? 'Stripe may have emailed the customer, but ClickTooling could not record the send time. Check Stripe before sending again.'
              : 'The bill email went out, but ClickTooling could not record the send time. Check Settings → Notifications before sending again.',
          stripe_may_have_sent: outcome.sent_by === 'stripe',
          ...outcome,
          stripe_invoice_status: stripeStatus,
          customer_email: email,
          stripe_mode: stripeMode,
        },
        502,
      )
    }

    // Bills also go to (v2.3359): the bill email goes to one address, so
    // everyone on the bill's copy list — fixed when the office pressed Create
    // Stripe invoice — gets a copy from us with the same Pay link. One email
    // per address (a copy never shows the others), each logged to
    // email_send_log. A copy failure never fails the send already made.
    // A test-mode bill copies only the sender (planBillCopies).
    const copies = await sendBillCopies({ admin, jobsLedgerInvoiceId, inv: sent, payerName: payerNameFromStripe(sent), callerEmail: user.email ?? null, stripeMode })

    // The send log row carries the copies that actually went out (v2.3362), so
    // the confirm dialog's history answers "did DRF get it" per send.
    const { error: logErr } = await admin.from('jobs_ledger_invoice_stripe_email_sends').insert({
      jobs_ledger_invoice_id: jobsLedgerInvoiceId,
      sent_at: sentAtIso,
      stripe_invoice_id: stripeInvoiceId,
      copy_emails: copies.copies_sent.length ? copies.copies_sent : null,
    })
    if (logErr) {
      console.error('send-stripe-invoice: append send log failed (invoice row updated)', logErr)
    }

    return jsonResponse({
      success: true,
      stripe_invoice_status: stripeStatus,
      customer_email: email,
      stripe_mode: stripeMode,
      ...outcome,
      ...copies,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('send-stripe-invoice:', e)
    return jsonResponse({ error: msg }, 500)
  }
})
