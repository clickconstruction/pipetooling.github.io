import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { PORTAL_COMPANY } from '../_shared/portalCompany.ts'

/**
 * Customer portal payload (portal train PR 1): resolves a portal link token
 * (sha256 hash lookup, same model as the estimate customer view) and returns
 * ONLY that customer's/GC's data — open billed lines with pay links, and the
 * jobs a visit request may reference. No auth: the token is the capability.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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

type JobRow = {
  id: string
  hcp_number: string | null
  click_number: string | null
  job_name: string | null
  job_address: string | null
  status: string | null
  revenue: number | null
  payments_made: number | null
}

function jobNumber(j: JobRow): string {
  return (j.hcp_number ?? '').trim() || (j.click_number ?? '').trim() || ''
}

function jobLabel(j: JobRow): string {
  const n = jobNumber(j)
  const name = (j.job_name ?? '').trim()
  if (n && name) return `${name} · Job ${n}`
  return name || (n ? `Job ${n}` : 'Job')
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const url = new URL(req.url)
    const raw = url.searchParams.get('token')?.trim()
    if (!raw || raw.length < 16 || raw.length > 128) {
      return jsonResponse({ error: 'Missing token' }, 400)
    }

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false },
    })

    const tokenHash = await sha256Hex(raw)
    const { data: link } = await admin
      .from('customer_portal_links')
      .select('customer_id, audience, revoked_at')
      .eq('token_hash', tokenHash)
      .maybeSingle()
    if (!link || link.revoked_at) {
      return jsonResponse({ error: 'This link is no longer active. Please contact our office for a new one.' }, 404)
    }

    const { data: customer } = await admin
      .from('customers')
      .select('id, name')
      .eq('id', link.customer_id)
      .maybeSingle()
    if (!customer) return jsonResponse({ error: 'Not found' }, 404)

    const jobFilterColumn = link.audience === 'gc' ? 'gc_customer_id' : 'customer_id'
    const { data: jobsRaw } = await admin
      .from('jobs_ledger')
      .select('id, hcp_number, click_number, job_name, job_address, status, revenue, payments_made')
      .eq(jobFilterColumn, link.customer_id)
      .limit(500)
    const jobs = (jobsRaw ?? []) as JobRow[]

    const billedJobs = jobs.filter((j) => j.status === 'billed')
    const billedJobIds = billedJobs.map((j) => j.id)

    let invoices: Array<{
      id: string
      job_id: string
      amount: number | null
      status: string
      billed_at: string | null
      sequence_order: number | null
      hosted_invoice_url: string | null
    }> = []
    let paymentsByInvoice = new Map<string, number>()
    if (billedJobIds.length > 0) {
      const { data: invRaw } = await admin
        .from('jobs_ledger_invoices')
        .select('id, job_id, amount, status, billed_at, sequence_order, hosted_invoice_url')
        .in('job_id', billedJobIds)
        .eq('status', 'billed')
      invoices = (invRaw ?? []) as typeof invoices
      if (invoices.length > 0) {
        const { data: payRaw } = await admin
          .from('jobs_ledger_payments')
          .select('invoice_id, amount')
          .in('invoice_id', invoices.map((i) => i.id))
        for (const p of (payRaw ?? []) as Array<{ invoice_id: string | null; amount: number | null }>) {
          if (!p.invoice_id) continue
          paymentsByInvoice.set(p.invoice_id, (paymentsByInvoice.get(p.invoice_id) ?? 0) + Number(p.amount ?? 0))
        }
      }
    }

    const bills: Array<{
      jobLabel: string
      jobNumber: string
      jobAddress: string | null
      amount: number
      billedOn: string | null
      payUrl: string | null
      checkRef: string
    }> = []
    const jobsWithLines = new Set(invoices.map((i) => i.job_id))
    for (const inv of invoices) {
      const open = Math.round((Number(inv.amount ?? 0) - (paymentsByInvoice.get(inv.id) ?? 0)) * 100) / 100
      if (open <= 0) continue
      const job = billedJobs.find((j) => j.id === inv.job_id)
      if (!job) continue
      bills.push({
        jobLabel: jobLabel(job),
        jobNumber: jobNumber(job),
        jobAddress: (job.job_address ?? '').trim() || null,
        amount: open,
        billedOn: inv.billed_at ? String(inv.billed_at).slice(0, 10) : null,
        payUrl: (inv.hosted_invoice_url ?? '').trim() || null,
        checkRef: jobNumber(job) || String(inv.sequence_order ?? ''),
      })
    }
    // Billed jobs with no billed line (rare shells): show the job-level remainder.
    for (const job of billedJobs) {
      if (jobsWithLines.has(job.id)) continue
      const open = Math.round((Number(job.revenue ?? 0) - Number(job.payments_made ?? 0)) * 100) / 100
      if (open <= 0) continue
      bills.push({
        jobLabel: jobLabel(job),
        jobNumber: jobNumber(job),
        jobAddress: (job.job_address ?? '').trim() || null,
        amount: open,
        billedOn: null,
        payUrl: null,
        checkRef: jobNumber(job),
      })
    }
    bills.sort((a, b) => (b.billedOn ?? '9999').localeCompare(a.billedOn ?? '9999'))

    const requestableJobs = jobs
      .filter((j) => j.status !== 'paid')
      .slice(0, 100)
      .map((j) => ({ id: j.id, label: jobLabel(j) }))

    return jsonResponse({
      company: PORTAL_COMPANY,
      customerName: (customer as { name: string | null }).name ?? 'Customer',
      audience: link.audience,
      bills,
      totalDue: Math.round(bills.reduce((s, b) => s + b.amount, 0) * 100) / 100,
      requestableJobs,
    })
  } catch (e) {
    console.error('customer-portal error', e)
    return jsonResponse({ error: 'Something went wrong. Please try again.' }, 500)
  }
})
