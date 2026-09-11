import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { PORTAL_COMPANY } from '../_shared/portalCompany.ts'
import { todayYmdInAppTz } from '../_shared/appTimeZone.ts'
import { publicViewDecision } from '../_shared/publicViewCounting.ts'
import { JOB_CONTRACT_BUCKET } from '../_shared/jobContract.ts'

/**
 * Legal portal payload (Legal portal train, PR 3): resolves the collections law
 * firm's capability token (raw lookup + sha256 fallback in legal_portal_links,
 * revoked → 404) and returns every matter the office marked attorney-ready
 * (legal_matters.stage in the with-firm set) with the raw records the packet
 * kernel (src/lib/legal/legalPacket.ts) assembles on the page — jobs, invoices,
 * payments, the customer and property record, agreements (signed PDFs as
 * short-lived signed URLs), demand letters, lien filings, promises, collection
 * calls, contact history, field evidence, the matter's own entries — plus the
 * firm and Click's particulars for filing.
 *
 * HELD ENTRIES NEVER LEAVE. The office's "to counsel" decisions are applied here,
 * under the service role, with the same rule the desk uses: an entry dated before
 * the account's first bill is held unless the matter's held_overrides says false;
 * one dated on or after it goes unless held_overrides says true. Timeline keys:
 * contact:<id> · promise:<id> · call:<id> · note:<job id>.
 *
 * No auth: the link is the capability. Same shape as customer-portal / sub-portal.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const LINK_INACTIVE_MSG = 'This link is no longer active. Please contact the office for a new one.'
const WITH_FIRM_STAGES = ['referred', 'demand', 'suit', 'judgment']

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

function ymd(iso: unknown): string | null {
  const s = typeof iso === 'string' ? iso : ''
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null
}

type Row = Record<string, unknown>

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const url = new URL(req.url)
    const rawToken = url.searchParams.get('token')?.trim()
    if (!rawToken || rawToken.length < 16 || rawToken.length > 128) return jsonResponse({ error: 'Missing token' }, 400)

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })

    let link = (await admin.from('legal_portal_links').select('firm_id, revoked_at').eq('token', rawToken).maybeSingle()).data as { firm_id: string; revoked_at: string | null } | null
    if (!link) {
      const tokenHash = await sha256Hex(rawToken)
      link = (await admin.from('legal_portal_links').select('firm_id, revoked_at').eq('token_hash', tokenHash).maybeSingle()).data as { firm_id: string; revoked_at: string | null } | null
    }
    if (!link || link.revoked_at) return jsonResponse({ error: LINK_INACTIVE_MSG }, 404)

    const { data: firm } = await admin.from('legal_firms').select('id, name, handling_name, email, phone, contingency_pct, filing_cost, active').eq('id', link.firm_id).maybeSingle()
    if (!firm || !(firm as Row).active) return jsonResponse({ error: LINK_INACTIVE_MSG }, 404)

    // View counting — fire-and-forget; office previews and staff sessions do not count.
    const viewDecision = await publicViewDecision(req, admin, Deno.env.get('SUPABASE_ANON_KEY'))
    void admin
      .from('public_page_views')
      .insert({ surface: 'legal_portal', entity_id: link.firm_id, via: 'token', viewer: viewDecision.viewer, viewer_user_id: viewDecision.staffUserId })
      .then(
        ({ error }: { error: unknown }) => {
          if (error && viewDecision.count) void admin.from('public_page_views').insert({ surface: 'legal_portal', entity_id: link!.firm_id, via: 'token' }).then(() => {}, () => {})
        },
        () => {},
      )

    const todayYmd = todayYmdInAppTz()
    const { data: particularsRow } = await admin.from('app_settings').select('value_text').eq('key', 'legal_particulars_v1').maybeSingle()
    let particulars: Record<string, string> = {}
    try {
      const parsed = JSON.parse(((particularsRow as Row | null)?.value_text as string) ?? '{}')
      if (parsed && typeof parsed === 'object') particulars = parsed as Record<string, string>
    } catch {
      particulars = {}
    }

    const { data: matterRows } = await admin.from('legal_matters').select('*').eq('firm_id', link.firm_id).in('stage', WITH_FIRM_STAGES).order('released_at')
    const matters = (matterRows ?? []) as Row[]
    if (matters.length === 0) {
      return jsonResponse({ company: PORTAL_COMPANY, preparedOn: todayYmd, firm, particulars, matters: [] })
    }
    const matterIds = matters.map((m) => m.id as string)
    const { data: linkRows } = await admin.from('legal_matter_jobs').select('matter_id, job_id').in('matter_id', matterIds)
    const jobIdsByMatter = new Map<string, string[]>()
    for (const l of (linkRows ?? []) as Row[]) jobIdsByMatter.set(l.matter_id as string, [...(jobIdsByMatter.get(l.matter_id as string) ?? []), l.job_id as string])
    const allJobIds = [...new Set([...jobIdsByMatter.values()].flat())]
    const customerIds = [...new Set(matters.map((m) => m.customer_id as string | null).filter((x): x is string => Boolean(x)))]

    const [jobsRes, invRes, payRes, custRes, personsRes, addrRes, contractsRes, estRes, demandRes, filingRes, promRes, touchRes, contactRes, reportRes, tplRes, sessRes, noteRes, entryRes] = await Promise.all([
      allJobIds.length ? admin.from('jobs_ledger').select('id, hcp_number, click_number, job_name, job_address, customer_id, customer_name, customer_email, customer_phone, gc_customer_id, revenue, payments_made, status, last_bill_date, last_work_date, collections_at, collections_by, collections_note, job_pictures_link, google_drive_link').in('id', allJobIds) : Promise.resolve({ data: [] }),
      allJobIds.length ? admin.from('jobs_ledger_invoices').select('id, job_id, amount, status, billed_at, sent_to_customer_at, external_send_channel, stripe_invoice_status, stripe_invoice_id, sequence_order, agreed_write_down_at, agreed_write_down_note, agreed_write_down_previous_amount').in('job_id', allJobIds) : Promise.resolve({ data: [] }),
      allJobIds.length ? admin.from('jobs_ledger_payments').select('id, job_id, invoice_id, amount, paid_on, sent_on, payment_type, reference_number').in('job_id', allJobIds) : Promise.resolve({ data: [] }),
      customerIds.length ? admin.from('customers').select('id, name, address, contact_info, customer_type, payment_terms, payment_terms_note').in('id', customerIds) : Promise.resolve({ data: [] }),
      customerIds.length ? admin.from('customer_contact_persons').select('customer_id, name, email, phone, note').in('customer_id', customerIds) : Promise.resolve({ data: [] }),
      customerIds.length ? admin.from('customer_addresses').select('*').in('customer_id', customerIds).order('sequence_order') : Promise.resolve({ data: [] }),
      allJobIds.length ? admin.from('job_contracts').select('id, job_id, status, revision, recipient_email, sent_at, last_sent_at, view_count, signed_at, signer_printed_name, signer_mode, voided_at, signed_document_url, signed_pdf_path, paper_upload_path').in('job_id', allJobIds).is('voided_at', null) : Promise.resolve({ data: [] }),
      allJobIds.length ? admin.from('estimates').select('id, job_ledger_id, bid_id, doc_kind, status, acceptor_consented_at, acceptor_printed_name, estimate_number, total_cents').in('job_ledger_id', allJobIds).eq('status', 'customer_accepted').not('acceptor_consented_at', 'is', null) : Promise.resolve({ data: [] }),
      allJobIds.length ? admin.from('job_demand_letters').select('*').in('job_id', allJobIds) : Promise.resolve({ data: [] }),
      allJobIds.length ? admin.from('job_lien_filings').select('*').in('job_id', allJobIds) : Promise.resolve({ data: [] }),
      allJobIds.length ? admin.from('job_payment_promises').select('id, job_id, customer_id, promised_date, said_by, heard_by, channel, source, note, created_at, voided_at').in('job_id', allJobIds).is('voided_at', null) : Promise.resolve({ data: [] }),
      customerIds.length ? admin.from('job_payment_chase_touches').select('id, customer_id, job_id, outcome, note, promised_date, snooze_days, resolved_at, created_at, created_by').in('customer_id', customerIds) : Promise.resolve({ data: [] }),
      customerIds.length ? admin.from('customer_contacts').select('id, customer_id, contact_date, contact_method, details, created_by').in('customer_id', customerIds).order('contact_date') : Promise.resolve({ data: [] }),
      allJobIds.length ? admin.from('reports').select('id, job_ledger_id, created_at, created_by_user_id, template_id, reported_at_lat').in('job_ledger_id', allJobIds) : Promise.resolve({ data: [] }),
      admin.from('report_templates').select('id, name'),
      allJobIds.length ? admin.from('clock_sessions').select('job_ledger_id, work_date, clocked_in_at, clocked_out_at, clock_in_lat, approved_at, rejected_at, revoked_at').in('job_ledger_id', allJobIds).order('work_date').limit(2000) : Promise.resolve({ data: [] }),
      allJobIds.length ? admin.from('jobs_ledger_thread_notes').select('job_id, body, created_at, author_user_id').in('job_id', allJobIds).order('created_at', { ascending: false }).limit(500) : Promise.resolve({ data: [] }),
      admin.from('legal_matter_entries').select('id, matter_id, kind, amount, body, occurred_on, meta, via_portal, created_at').in('matter_id', matterIds).order('created_at'),
    ])

    const jobs = (jobsRes.data ?? []) as Row[]
    const invoices = (invRes.data ?? []) as Row[]
    const payments = (payRes.data ?? []) as Row[]
    const customers = (custRes.data ?? []) as Row[]
    const persons = (personsRes.data ?? []) as Row[]
    const addresses = (addrRes.data ?? []) as Row[]
    const contracts = (contractsRes.data ?? []) as Row[]
    const estimates = (estRes.data ?? []) as Row[]
    const demands = (demandRes.data ?? []) as Row[]
    const filings = (filingRes.data ?? []) as Row[]
    const promises = (promRes.data ?? []) as Row[]
    const touches = (touchRes.data ?? []) as Row[]
    const contacts = (contactRes.data ?? []) as Row[]
    const reports = (reportRes.data ?? []) as Row[]
    const templates = new Map(((tplRes.data ?? []) as Row[]).map((t) => [t.id as string, (t.name as string) ?? '']))
    const sessions = (sessRes.data ?? []) as Row[]
    const notes = (noteRes.data ?? []) as Row[]
    const entries = (entryRes.data ?? []) as Row[]

    // Names for the office people the packet mentions (who flagged, who logged, who heard).
    const userIds = new Set<string>()
    for (const j of jobs) if (j.collections_by) userIds.add(j.collections_by as string)
    for (const c of contacts) if (c.created_by) userIds.add(c.created_by as string)
    for (const t of touches) if (t.created_by) userIds.add(t.created_by as string)
    for (const p of promises) if (p.heard_by) userIds.add(p.heard_by as string)
    for (const r of reports) if (r.created_by_user_id) userIds.add(r.created_by_user_id as string)
    for (const n of notes) if (n.author_user_id) userIds.add(n.author_user_id as string)
    const { data: userRows } = userIds.size ? await admin.from('users').select('id, name').in('id', [...userIds]) : { data: [] }
    const userName = new Map(((userRows ?? []) as Row[]).map((u) => [u.id as string, (u.name as string | null) ?? null]))

    // Signed contract PDFs as short-lived signed URLs (one hour).
    const contractUrls = new Map<string, string>()
    for (const c of contracts) {
      const path = (c.signed_pdf_path as string | null) ?? (c.paper_upload_path as string | null)
      if (!path) continue
      const { data: signed } = await admin.storage.from(JOB_CONTRACT_BUCKET).createSignedUrl(path, 3600)
      if (signed?.signedUrl) contractUrls.set(c.id as string, signed.signedUrl)
    }

    const jobsById = new Map(jobs.map((j) => [j.id as string, j] as const))
    const out = matters.map((m) => {
      const jobIds = jobIdsByMatter.get(m.id as string) ?? []
      const mJobs = jobIds.map((id) => jobsById.get(id)).filter((j): j is Row => Boolean(j))
      const jobIdSet = new Set(jobIds)
      const customerId = (m.customer_id as string | null) ?? null
      const heldOverrides = (m.held_overrides && typeof m.held_overrides === 'object' ? (m.held_overrides as Record<string, unknown>) : {}) as Record<string, unknown>
      const firstBill = invoices
        .filter((i) => jobIdSet.has(i.job_id as string) && (i.status === 'billed' || i.status === 'paid'))
        .map((i) => ymd(i.billed_at) ?? ymd(i.sent_to_customer_at))
        .filter((y): y is string => Boolean(y))
        .sort()[0] ?? null
      const goes = (key: string, entryYmd: string): boolean => {
        const o = heldOverrides[key]
        if (typeof o === 'boolean') return !o
        return firstBill == null || entryYmd >= firstBill
      }
      const sharedOverrides: Record<string, boolean> = {}
      for (const [k, v] of Object.entries(heldOverrides)) if (v === false) sharedOverrides[k] = false

      const mInvoices = invoices.filter((i) => jobIdSet.has(i.job_id as string))
      const mPayments = payments.filter((p) => jobIdSet.has(p.job_id as string))
      const jobsWithDetails = mJobs.map((j) => ({
        ...j,
        invoices: mInvoices.filter((i) => i.job_id === j.id),
        payments: mPayments.filter((p) => p.job_id === j.id),
        gcCustomer: j.gc_customer_id ? { id: j.gc_customer_id, name: customers.find((c) => c.id === j.gc_customer_id)?.name ?? null } : null,
        collections_by_name: userName.get(j.collections_by as string) ?? null,
      }))
      const mContacts = contacts
        .filter((c) => customerId && c.customer_id === customerId)
        .map((c) => ({ id: c.id as string, ymd: ymd(c.contact_date) ?? todayYmd, method: (c.contact_method as string | null) ?? null, by: userName.get(c.created_by as string) ?? null, text: ((c.details as string | null) ?? '').trim() }))
        .filter((c) => goes(`contact:${c.id}`, c.ymd))
      const mPromises = promises
        .filter((p) => jobIdSet.has(p.job_id as string))
        .map((p) => ({ id: p.id as string, jobId: p.job_id as string, customerId: (p.customer_id as string | null) ?? null, promisedYmd: p.promised_date as string, saidBy: (p.said_by as string | null) ?? null, heardByName: userName.get(p.heard_by as string) ?? null, channel: (p.channel as string | null) ?? null, source: p.source === 'customer' ? 'customer' : 'office', note: (p.note as string | null) ?? null, createdAt: p.created_at as string }))
        .filter((p) => goes(`promise:${p.id}`, ymd(p.createdAt) ?? p.promisedYmd))
      const mTouches = touches
        .filter((t) => t.job_id ? jobIdSet.has(t.job_id as string) : customerId != null && t.customer_id === customerId)
        .map((t) => ({ id: t.id as string, customerId: t.customer_id as string, jobId: (t.job_id as string | null) ?? null, outcome: t.outcome as string, note: (t.note as string | null) ?? null, promisedYmd: (t.promised_date as string | null) ?? null, snoozeDays: (t.snooze_days as number | null) ?? null, resolvedAt: (t.resolved_at as string | null) ?? null, createdAt: t.created_at as string, createdByName: userName.get(t.created_by as string) ?? 'the office' }))
        .filter((t) => goes(`call:${t.id}`, ymd(t.createdAt) ?? todayYmd))
      // The collections note rides on the job; a held note is blanked, the job stays.
      for (const j of jobsWithDetails) {
        const noteYmd = ymd(j.collections_at) ?? todayYmd
        if (j.collections_note && !goes(`note:${j.id}`, noteYmd)) (j as Row).collections_note = null
      }
      // Promise records: the outcome inputs (billed at the promise, dated payments) — the page classifies.
      const billedTotal = mInvoices.filter((i) => i.status === 'billed' || i.status === 'paid').reduce((s, i) => s + Number(i.amount ?? 0), 0)
      const promiseRecords = mPromises.map((p) => ({
        id: p.id,
        jobId: p.jobId,
        customerId: p.customerId,
        promisedYmd: p.promisedYmd,
        createdAt: p.createdAt,
        source: p.source,
        billedTotal: mInvoices.filter((i) => i.job_id === p.jobId && (i.status === 'billed' || i.status === 'paid')).reduce((s, i) => s + Number(i.amount ?? 0), 0) || billedTotal,
        payments: mPayments.filter((x) => x.job_id === p.jobId && x.paid_on).map((x) => ({ paidOn: ymd(x.paid_on) as string, amount: Number(x.amount ?? 0) })).sort((a, b) => a.paidOn.localeCompare(b.paidOn)),
      }))
      const customer = customers.find((c) => c.id === customerId) ?? null
      return {
        id: m.id,
        stage: m.stage,
        payer: { key: m.payer_key, name: m.payer_name, customerId },
        handling: m.handling_name,
        noteToFirm: m.note_to_firm,
        releasedAt: ymd(m.released_at),
        feesToStatement: Boolean(m.fees_to_statement),
        heldCount: 0,
        sharedOverrides,
        jobs: jobsWithDetails,
        customer,
        contacts: persons.filter((p) => customerId && p.customer_id === customerId).map((p) => ({ name: p.name, email: p.email ?? null, phone: p.phone ?? null, note: p.note ?? null })),
        contactEntries: mContacts,
        addresses: addresses.filter((a) => customerId && a.customer_id === customerId),
        contracts: contracts.filter((c) => jobIdSet.has(c.job_id as string)).map((c) => ({ ...c, signedPdfUrl: contractUrls.get(c.id as string) ?? null, signed_pdf_path: undefined, paper_upload_path: undefined })),
        signedEstimates: estimates.filter((e) => jobIdSet.has(e.job_ledger_id as string)),
        demandLetters: demands.filter((d) => jobIdSet.has(d.job_id as string)),
        lienFilings: filings.filter((f) => jobIdSet.has(f.job_id as string)),
        promises: mPromises,
        promiseRecords,
        chaseTouches: mTouches,
        reports: reports.filter((r) => jobIdSet.has(r.job_ledger_id as string)).map((r) => ({ jobId: r.job_ledger_id as string, createdAt: (r.created_at as string) ?? todayYmd, authorName: userName.get(r.created_by_user_id as string) ?? '', templateName: templates.get(r.template_id as string) ?? '', hasGps: r.reported_at_lat != null })),
        clockSessions: sessions.filter((s) => jobIdSet.has(s.job_ledger_id as string)).map((s) => ({ jobId: s.job_ledger_id as string, workDate: s.work_date as string, clockedInAt: s.clocked_in_at as string, clockedOutAt: (s.clocked_out_at as string | null) ?? null, hasGps: s.clock_in_lat != null, approved: s.approved_at != null, disqualified: s.rejected_at != null || s.revoked_at != null })),
        threadNotes: notes.filter((n) => jobIdSet.has(n.job_id as string)).map((n) => ({ jobId: n.job_id as string, body: n.body as string, createdAt: n.created_at as string, authorName: userName.get(n.author_user_id as string) ?? null })),
        entries: entries.filter((e) => e.matter_id === m.id),
      }
    })

    return jsonResponse({ company: PORTAL_COMPANY, preparedOn: todayYmd, firm, particulars, matters: out })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return jsonResponse({ error: message }, 500)
  }
})
