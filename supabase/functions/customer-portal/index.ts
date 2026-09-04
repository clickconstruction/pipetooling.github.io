import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { PORTAL_COMPANY } from '../_shared/portalCompany.ts'
import { sampleStateFromToken } from '../_shared/customerSample.ts'
import { authorizeSampleViewer } from '../_shared/sampleViewer.ts'
import { sampleCustomerPortalResponse } from '../_shared/customerSampleFixtures.ts'
import { todayYmdInAppTz } from '../_shared/appTimeZone.ts'
import {
  buildPortalBills,
  dedupeJobsById,
  jobLabel,
  type PortalInvoiceRow,
  type PortalJobRow,
  type PortalPaymentRow,
} from '../_shared/portalMergedBills.ts'
import { buildPortalProperties } from '../_shared/portalProperties.ts'

/**
 * Customer portal payload (portal train PR 1; merged view + slugs in the
 * custom-links train): resolves a portal link token OR a custom address slug
 * and returns ONLY that company's data — open billed lines with pay links,
 * and the jobs a visit request may reference. No auth: the link is the
 * capability.
 *
 * Audiences: 'all' (default since the custom-links train) merges jobs where
 * the company is the customer with jobs where it is the GC (asGc/ownerName
 * mark the GC rows); 'customer' / 'gc' remain the scoped "Separate views".
 *
 * ?slug= resolves my.clickplumbing.com/<slug> → customer_portal_slugs → the
 * active 'all' link. First public resolve locks the slug (belt and
 * suspenders with the modal's Copy — catches links shared by screenshot).
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const LINK_INACTIVE_MSG = 'This link is no longer active. Please contact our office for a new one.'

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const url = new URL(req.url)
    const rawToken = url.searchParams.get('token')?.trim()
    const rawSlug = url.searchParams.get('slug')?.trim().toLowerCase()

    // What customers see (Settings dev tab): the sample token renders the fixture for a signed-in
    // office user — the homeowner's statement, or `sample-gc` for the contractor's view. No rows.
    const sample = sampleStateFromToken(rawToken)
    if (sample) {
      const gate = await authorizeSampleViewer(req)
      if (!gate.ok) return jsonResponse({ error: gate.error }, gate.status)
      return jsonResponse(sampleCustomerPortalResponse(PORTAL_COMPANY, sample, todayYmdInAppTz(), Deno.env.get('APP_ORIGIN') ?? 'https://clicktooling.com'))
    }

    if ((!rawToken || rawToken.length < 16 || rawToken.length > 128) && !rawSlug) {
      return jsonResponse({ error: 'Missing token' }, 400)
    }

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false },
    })

    let link: { customer_id: string; audience: string; revoked_at: string | null; token?: string | null } | null = null

    if (rawToken) {
      // v2 rows store the raw token; v1 hash-only rows were revoked at the v2
      // migration, but keep the hash fallback for any in-flight transition.
      link = (await admin
        .from('customer_portal_links')
        .select('customer_id, audience, revoked_at, token')
        .eq('token', rawToken)
        .maybeSingle()).data
      if (!link) {
        const tokenHash = await sha256Hex(rawToken)
        link = (await admin
          .from('customer_portal_links')
          .select('customer_id, audience, revoked_at, token')
          .eq('token_hash', tokenHash)
          .maybeSingle()).data
      }
      if (!link || link.revoked_at) {
        return jsonResponse({ error: LINK_INACTIVE_MSG }, 404)
      }
    } else if (rawSlug) {
      if (!/^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$/.test(rawSlug)) {
        return jsonResponse({ error: LINK_INACTIVE_MSG }, 404)
      }
      const { data: slugRow } = await admin
        .from('customer_portal_slugs')
        .select('customer_id, slug, locked_at')
        .eq('slug', rawSlug)
        .maybeSingle()
      if (!slugRow) return jsonResponse({ error: LINK_INACTIVE_MSG }, 404)
      // The slug resolves ONLY to the merged 'all' link; no mint-on-demand —
      // a turned-off portal stays off no matter how it is addressed.
      link = (await admin
        .from('customer_portal_links')
        .select('customer_id, audience, revoked_at, token')
        .eq('customer_id', slugRow.customer_id)
        .eq('audience', 'all')
        .is('revoked_at', null)
        .maybeSingle()).data
      if (!link) return jsonResponse({ error: LINK_INACTIVE_MSG }, 404)
      if (!slugRow.locked_at) {
        await admin
          .from('customer_portal_slugs')
          .update({ locked_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq('customer_id', slugRow.customer_id)
          .is('locked_at', null)
        await admin
          .from('customer_portal_slug_events')
          .insert({ customer_id: slugRow.customer_id, event: 'locked', slug: slugRow.slug })
      }
    }
    if (!link) return jsonResponse({ error: LINK_INACTIVE_MSG }, 404)

    const { data: customer } = await admin
      .from('customers')
      .select('id, name')
      .eq('id', link.customer_id)
      .maybeSingle()
    if (!customer) return jsonResponse({ error: 'Not found' }, 404)

    // View counting (v2.2341): one row per validated portal load — fire-and-forget,
    // the statement must never fail because measurement did.
    void admin
      .from('public_page_views')
      .insert({ surface: 'portal', entity_id: link.customer_id, via: rawToken ? 'token' : 'slug' })
      .then(() => {}, () => {})

    const jobSelect =
      'id, hcp_number, click_number, job_name, job_address, status, revenue, payments_made, customer_id, gc_customer_id, service_types:service_type_id(name)'
    let jobs: PortalJobRow[]
    if (link.audience === 'all') {
      const { data: jobsRaw } = await admin
        .from('jobs_ledger')
        .select(jobSelect)
        .or(`customer_id.eq.${link.customer_id},gc_customer_id.eq.${link.customer_id}`)
        .limit(500)
      jobs = dedupeJobsById((jobsRaw ?? []) as PortalJobRow[])
    } else {
      const jobFilterColumn = link.audience === 'gc' ? 'gc_customer_id' : 'customer_id'
      const { data: jobsRaw } = await admin
        .from('jobs_ledger')
        .select(jobSelect)
        .eq(jobFilterColumn, link.customer_id)
        .limit(500)
      jobs = (jobsRaw ?? []) as PortalJobRow[]
    }

    const billedJobIds = jobs.filter((j) => j.status === 'billed').map((j) => j.id)

    let invoices: PortalInvoiceRow[] = []
    let payments: PortalPaymentRow[] = []
    if (billedJobIds.length > 0) {
      const { data: invRaw } = await admin
        .from('jobs_ledger_invoices')
        .select('id, job_id, amount, status, billed_at, sequence_order, hosted_invoice_url')
        .in('job_id', billedJobIds)
        .eq('status', 'billed')
      invoices = (invRaw ?? []) as PortalInvoiceRow[]
      if (invoices.length > 0) {
        // paid_on + payment_type feed the statement's per-payment rows
        // (v2.2313); the internal `note` is deliberately NOT selected.
        const { data: payRaw } = await admin
          .from('jobs_ledger_payments')
          .select('invoice_id, amount, paid_on, payment_type, sequence_order')
          .in('invoice_id', invoices.map((i) => i.id))
        payments = (payRaw ?? []) as PortalPaymentRow[]
      }
    }

    // The customer's short address (footer QR + "Your account, any time").
    // Merged view only — scoped "Separate views" links exist to show a split,
    // so they never advertise the merged address.
    let slug: string | null = null
    if (link.audience === 'all') {
      const { data: slugRow } = await admin
        .from('customer_portal_slugs')
        .select('slug')
        .eq('customer_id', link.customer_id)
        .maybeSingle()
      slug = (slugRow?.slug ?? '').trim() || null
    }

    // Owner names for AS GC rows (merged view only): one lookup for the
    // distinct customer ids that differ from the viewer.
    const ownerNames: Record<string, string> = {}
    if (link.audience === 'all') {
      const ownerIds = [
        ...new Set(
          jobs
            .map((j) => j.customer_id)
            .filter((id): id is string => typeof id === 'string' && id !== link.customer_id),
        ),
      ]
      if (ownerIds.length > 0) {
        const { data: owners } = await admin.from('customers').select('id, name').in('id', ownerIds)
        for (const o of (owners ?? []) as Array<{ id: string; name: string | null }>) {
          if (o.name) ownerNames[o.id] = o.name
        }
      }
    }

    const bills = buildPortalBills({
      jobs,
      invoices,
      payments,
      viewerCustomerId: link.customer_id,
      markGcRows: link.audience === 'all',
      ownerNames,
    })

    // Your agreements (Contract Desk PR 5): the customer's job contracts —
    // signed ones as a record, sent ones with the same durable signing link.
    // Never drafts, never voided; amount from the frozen fields.
    const agreements: Array<{
      jobLabel: string
      jobAddress: string | null
      status: 'sent' | 'signed'
      templateName: string | null
      amountCents: number | null
      signedAt: string | null
      signerName: string | null
      sentAt: string | null
      signUrl: string | null
    }> = []
    if (jobs.length > 0) {
      const jobById = new Map(jobs.map((j) => [j.id, j]))
      const { data: conRaw } = await admin
        .from('job_contracts')
        .select('job_id, status, template_name, public_token, fields, signed_at, signer_printed_name, last_sent_at, voided_at')
        .in('job_id', jobs.map((j) => j.id))
        .in('status', ['sent', 'signed'])
        .is('voided_at', null)
        .order('signed_at', { ascending: false })
      const origin = (Deno.env.get('APP_ORIGIN') ?? 'https://clicktooling.com').replace(/\/$/, '')
      for (const c of (conRaw ?? []) as Array<{
        job_id: string
        status: string
        template_name: string | null
        public_token: string | null
        fields: unknown
        signed_at: string | null
        signer_printed_name: string | null
        last_sent_at: string | null
      }>) {
        const j = jobById.get(c.job_id)
        if (!j) continue
        const amt = c.fields && typeof c.fields === 'object' ? (c.fields as { amount_cents?: unknown }).amount_cents : null
        agreements.push({
          jobLabel: jobLabel(j),
          jobAddress: j.job_address ?? null,
          status: c.status === 'signed' ? 'signed' : 'sent',
          templateName: c.template_name,
          amountCents: typeof amt === 'number' && Number.isFinite(amt) ? Math.round(amt) : null,
          signedAt: c.signed_at,
          signerName: c.signer_printed_name,
          sentAt: c.last_sent_at,
          signUrl: c.public_token ? `${origin}/contract/sign?t=${encodeURIComponent(c.public_token)}` : null,
        })
      }
    }

    const requestableJobs = jobs
      .filter((j) => j.status !== 'paid')
      .slice(0, 100)
      .map((j) => ({ id: j.id, label: jobLabel(j) }))

    // Property rows for the visit picker (v2.2037): one row per address,
    // street + city only — customers never see job numbers or internal
    // names. requestableJobs stays alongside for stale-bundle clients.
    const requestableProperties = buildPortalProperties(
      jobs.map((j) => ({
        id: j.id,
        status: j.status,
        job_address: j.job_address,
        hcp_number: j.hcp_number,
        click_number: j.click_number,
      })),
    ).slice(0, 50)

    return jsonResponse({
      company: PORTAL_COMPANY,
      customerName: (customer as { name: string | null }).name ?? 'Customer',
      audience: link.audience,
      bills,
      totalDue: Math.round(bills.reduce((s, b) => s + b.amount, 0) * 100) / 100,
      requestableJobs,
      requestableProperties,
      // Lets the slug-resolved page submit request forms (the slug and the
      // token are the same capability — both open this exact statement).
      requestToken: link.token ?? null,
      slug,
      agreements,
    })
  } catch (e) {
    console.error('customer-portal error', e)
    return jsonResponse({ error: 'Something went wrong. Please try again.' }, 500)
  }
})
