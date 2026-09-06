import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { PORTAL_COMPANY } from '../_shared/portalCompany.ts'
import { sampleStateFromToken } from '../_shared/customerSample.ts'
import { sampleSubPortalResponse } from '../_shared/customerSampleFixtures.ts'
import {
  attachSheetAgreements,
  buildSubDocuments,
  buildSubOffers,
  buildSubPaymentLines,
  buildSubSheets,
  buildSubTotals,
  nextPayRunYmd,
  addDaysYmd,
  type SubAgreementRow,
  type SubDocRow,
  type SubItemRow,
  type SubOfferRow,
  type SubPaymentRow,
  type SubSheetRow,
} from '../_shared/subPortalStatement.ts'
import { todayYmdInAppTz } from '../_shared/appTimeZone.ts'
import { publicViewDecision } from '../_shared/publicViewCounting.ts'
import { grantPlansLink } from '../_shared/viewGrant.ts'

/**
 * Sub portal payload (sub-portal train): resolves a sub portal link token OR
 * a custom address slug and returns ONLY that person's Work & Pay statement —
 * sheets with line items, open balances and their stage (working →
 * walkthrough → customer_pay, v2.2767), the payment ledger (memos are
 * sub-visible unless hidden), open work offers, and paperwork STATUS (never
 * document contents). No auth: the link is the capability.
 *
 * The customer portal is the architectural template (customer-portal/index.ts)
 * — same token/slug resolution, same no-mint-on-demand rule for slugs, same
 * fire-and-forget view counting.
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
    const sample = sampleStateFromToken(rawToken)
    if (!sample && (!rawToken || rawToken.length < 16 || rawToken.length > 128) && !rawSlug) {
      return jsonResponse({ error: 'Missing token' }, 400)
    }

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false },
    })

    // What customers see (Settings dev tab): the sample token renders Sam's Plumbing's hard-coded
    // statement over the live pay-run settings — no sign-in. No person, no rows.
    if (sample) {
      const { data: sampleSettings } = await admin.from('app_settings').select('key, value_text').in('key', ['sub_pay_run_day', 'sub_pay_explainer'])
      const m = new Map(((sampleSettings ?? []) as Array<{ key: string; value_text: string | null }>).map((r) => [r.key, r.value_text]))
      const day = (m.get('sub_pay_run_day') ?? '').trim() || null
      const today = todayYmdInAppTz()
      return jsonResponse(sampleSubPortalResponse(PORTAL_COMPANY, today, { day, nextRun: nextPayRunYmd(today, day), explainer: (m.get('sub_pay_explainer') ?? '').trim() || null }))
    }

    let link: { person_id: string; revoked_at: string | null; token?: string | null } | null = null

    if (rawToken) {
      link = (await admin
        .from('sub_portal_links')
        .select('person_id, revoked_at, token')
        .eq('token', rawToken)
        .maybeSingle()).data
      if (!link) {
        const tokenHash = await sha256Hex(rawToken)
        link = (await admin
          .from('sub_portal_links')
          .select('person_id, revoked_at, token')
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
        .from('sub_portal_slugs')
        .select('person_id, slug, locked_at')
        .eq('slug', rawSlug)
        .maybeSingle()
      if (!slugRow) return jsonResponse({ error: LINK_INACTIVE_MSG }, 404)
      // No mint-on-demand — a turned-off portal stays off however addressed.
      link = (await admin
        .from('sub_portal_links')
        .select('person_id, revoked_at, token')
        .eq('person_id', slugRow.person_id)
        .is('revoked_at', null)
        .maybeSingle()).data
      if (!link) return jsonResponse({ error: LINK_INACTIVE_MSG }, 404)
      if (!slugRow.locked_at) {
        await admin
          .from('sub_portal_slugs')
          .update({ locked_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq('person_id', slugRow.person_id)
          .is('locked_at', null)
        await admin
          .from('sub_portal_slug_events')
          .insert({ person_id: slugRow.person_id, event: 'locked', slug: slugRow.slug })
      }
    }
    if (!link) return jsonResponse({ error: LINK_INACTIVE_MSG }, 404)

    const { data: person } = await admin
      .from('people')
      .select('id, name, email')
      .eq('id', link.person_id)
      .maybeSingle()
    if (!person) return jsonResponse({ error: 'Not found' }, 404)
    const personName = ((person as { name: string | null }).name ?? '').trim() || 'Subcontractor'
    const personEmail = ((person as { email?: string | null }).email ?? '').trim() || null

    // View counting — fire-and-forget, the statement never fails on measurement. Office
    // previews (`?preview=1`) and verified staff sessions do not count (journey-map #37;
    // shared predicate in `_shared/publicViewCounting.ts`).
    // v2.2922 (visit trail): EVERY validated load is written, stamped with who it was —
    // outside (counts), staff (a signed-in teammate, with their user id) or preview. If the
    // viewer columns are not there yet (function deployed before the migration), fall back
    // to the pre-v2.2922 row for counted loads only, so outside opens are never lost.
    const viewDecision = await publicViewDecision(req, admin, Deno.env.get('SUPABASE_ANON_KEY'))
    const viaWord = rawToken ? 'token' : 'slug'
    void admin
      .from('public_page_views')
      .insert({ surface: 'sub_portal', entity_id: link.person_id, via: viaWord, viewer: viewDecision.viewer, viewer_user_id: viewDecision.staffUserId })
      .then(
        ({ error }: { error: unknown }) => {
          if (error && viewDecision.count) {
            void admin
              .from('public_page_views')
              .insert({ surface: 'sub_portal', entity_id: link.person_id, via: viaWord })
              .then(() => {}, () => {})
          }
        },
        () => {},
      )

    const todayYmd = todayYmdInAppTz()

    // Sheets: junction-first (people_labor_job_assignees keys on people.id —
    // rename-proof). Sheets the junction doesn't cover are legacy multi-name
    // rows; those stay office-only rather than risking another sub's money.
    const { data: junctionRows } = await admin
      .from('people_labor_job_assignees')
      .select('labor_job_id')
      .eq('person_id', link.person_id)
    const laborJobIds = [
      ...new Set(((junctionRows ?? []) as Array<{ labor_job_id: string }>).map((r) => r.labor_job_id)),
    ]

    let sheetRows: SubSheetRow[] = []
    let itemRows: SubItemRow[] = []
    let paymentRows: SubPaymentRow[] = []
    if (laborJobIds.length > 0) {
      const { data: sheetsRaw } = await admin
        .from('people_labor_jobs')
        .select('id, address, job_number, job_date, labor_rate, stage, stage_changed_at, stage_source, payable_after, pay_hold_reason, progress_pct, progress_note, progress_at')
        .in('id', laborJobIds)
        .limit(500)
      sheetRows = (sheetsRaw ?? []) as SubSheetRow[]
      const { data: itemsRaw } = await admin
        .from('people_labor_job_items')
        .select('job_id, fixture, count, hrs_per_unit, is_fixed, labor_rate, direct_labor_amount, sequence_order')
        .in('job_id', laborJobIds)
      itemRows = (itemsRaw ?? []) as SubItemRow[]
      const { data: paymentsRaw } = await admin
        .from('people_labor_job_payments')
        .select('job_id, amount, memo, payment_date, created_at, hidden_from_sub, sequence_order')
        .in('job_id', laborJobIds)
      paymentRows = (paymentsRaw ?? []) as SubPaymentRow[]
    }

    // Plans online (v2.2922): the sheet's Pipeline job carries a plans link (Edit Job → Files &
    // Plans); its bid carries the CountTooling set. Job link first, bid as the fallback, else none.
    const jobNumbers = [...new Set(sheetRows.map((s) => (s.job_number ?? '').trim()).filter(Boolean))]
    if (jobNumbers.length > 0) {
      const { data: jobsRaw } = await admin
        .from('jobs_ledger')
        .select('hcp_number, job_plans_link, bid:bid_id(count_tooling_plans_link)')
        .in('hcp_number', jobNumbers)
        .limit(500)
      const plansByNumber = new Map<string, string>()
      for (const j of (jobsRaw ?? []) as Array<{ hcp_number: string | null; job_plans_link: string | null; bid: { count_tooling_plans_link: string | null } | { count_tooling_plans_link: string | null }[] | null }>) {
        const key = (j.hcp_number ?? '').trim().toLowerCase()
        const bid = Array.isArray(j.bid) ? j.bid[0] ?? null : j.bid
        const url = (j.job_plans_link ?? '').trim() || (bid?.count_tooling_plans_link ?? '').trim()
        if (key && url && !plansByNumber.has(key)) plansByNumber.set(key, url)
      }
      for (const s of sheetRows) s.plans_url = plansByNumber.get((s.job_number ?? '').trim().toLowerCase()) ?? null
      // Viewer grants (2026-09-06): a CountTooling view link gets a short-lived, signed grant
      // (`&g=`) that vouches for this sub, so CountTooling skips its email gate and logs the
      // visit under their name (_shared/viewGrant.ts; CountTooling verifies with the same
      // secret). Drive / PDF links pass through untouched; no secret = the bare link.
      const grantSecret = Deno.env.get('COUNTTOOLING_VIEW_GRANT_SECRET') ?? ''
      if (grantSecret) {
        for (const s of sheetRows) {
          if (s.plans_url) s.plans_url = await grantPlansLink(s.plans_url, { name: personName, email: personEmail, person: link.person_id }, grantSecret)
        }
      }
    }

    // Signed sheet work orders (v2.2789): "what you agreed to" on each sheet card.
    let agreementRows: SubAgreementRow[] = []
    if (laborJobIds.length > 0) {
      const { data: agreementsRaw } = await admin
        .from('step_commitments')
        .select('id, labor_job_id, amount, signed_at, accepted_at, signer_printed_name, offer_scope_snapshot, signer_acknowledgements, work_days, picked_start, picked_end, proposed_start, proposed_end, stage_window_id, change_requested_at, change_requested_note')
        .in('labor_job_id', laborJobIds)
        .is('step_id', null)
        .in('status', ['accepted', 'approved', 'settled'])
      agreementRows = (agreementsRaw ?? []) as Array<SubAgreementRow & { stage_window_id?: string | null }>
    }
    // Stage windows (v2.2928): the span a signed order's dates may move inside, and the span an open offer is picked against.
    const windowById = new Map<string, { window_start: string | null; window_end: string | null }>()
    const loadWindows = async (ids: string[]) => {
      const missing = [...new Set(ids)].filter((id) => id && !windowById.has(id))
      if (missing.length === 0) return
      const { data: winRaw } = await admin.from('job_stage_windows').select('id, window_start, window_end').in('id', missing)
      for (const w of (winRaw ?? []) as Array<{ id: string; window_start: string | null; window_end: string | null }>) windowById.set(w.id, { window_start: w.window_start, window_end: w.window_end })
    }
    await loadWindows(agreementRows.map((a) => (a as { stage_window_id?: string | null }).stage_window_id ?? '').filter(Boolean))
    for (const a of agreementRows as Array<SubAgreementRow & { stage_window_id?: string | null }>) {
      const w = a.stage_window_id ? windowById.get(a.stage_window_id) : null
      a.window_start = w?.window_start ?? null
      a.window_end = w?.window_end ?? null
    }
    const sheets = attachSheetAgreements(buildSubSheets(sheetRows, itemRows, paymentRows), agreementRows, todayYmd)
    const totals = buildSubTotals(sheets)
    const openSheets = sheets.filter((s) => s.open > 0)
    const sheetsById = new Map(sheetRows.map((s) => [s.id, s]))
    const payments = buildSubPaymentLines(paymentRows, sheetsById, addDaysYmd(todayYmd, -90))

    // Open offers with the step name for the card title.
    const { data: offersRaw } = await admin
      .from('step_commitments')
      .select('id, step_id, labor_job_id, amount, notes, offer_scope_snapshot, offer_expires_at, proposed_start, proposed_end, work_days, stage_window_id')
      .eq('person_id', link.person_id)
      .eq('status', 'offered')
      .limit(20)
    const offerRowsRaw = (offersRaw ?? []) as Array<SubOfferRow & { step_id: string | null; stage_window_id?: string | null }>
    await loadWindows(offerRowsRaw.map((o) => o.stage_window_id ?? '').filter(Boolean))
    for (const o of offerRowsRaw) {
      const w = o.stage_window_id ? windowById.get(o.stage_window_id) : null
      o.window_start = w?.window_start ?? null
      o.window_end = w?.window_end ?? null
    }
    // Sheet work orders (v2.2789) have no step — their title comes from the snapshot's sheet label.
    const stepIds = [...new Set(offerRowsRaw.map((o) => o.step_id).filter((id): id is string => !!id))]
    const stepNames = new Map<string, string>()
    if (stepIds.length > 0) {
      const { data: steps } = await admin.from('project_workflow_steps').select('id, name').in('id', stepIds)
      for (const s of (steps ?? []) as Array<{ id: string; name: string | null }>) {
        if (s.name) stepNames.set(s.id, s.name)
      }
    }
    const offers = buildSubOffers(
      offerRowsRaw.map((o) => ({ ...o, step_name: o.step_id ? stepNames.get(o.step_id) ?? null : null })),
      todayYmd,
    )

    // Paperwork STATUS only — never contents. person_id first, trimmed-name
    // fallback for legacy rows (the person_contract_documents precedent).
    const { data: docsByIdRaw } = await admin
      .from('person_contract_documents')
      .select('id, document_name, doc_type, status, signed_at, expires_at, person_id, person_name')
      .eq('person_id', link.person_id)
    const { data: docsByNameRaw } = await admin
      .from('person_contract_documents')
      .select('id, document_name, doc_type, status, signed_at, expires_at, person_id, person_name')
      .is('person_id', null)
      .eq('person_name', personName)
    const docRowsById = new Map<string, SubDocRow>()
    for (const d of [
      ...((docsByIdRaw ?? []) as SubDocRow[]),
      ...((docsByNameRaw ?? []) as SubDocRow[]),
    ]) {
      docRowsById.set(d.id, d)
    }
    const documents = buildSubDocuments([...docRowsById.values()], todayYmd)

    // Pay-run settings (Settings → Sub portal · pay schedule).
    const { data: settingsRaw } = await admin
      .from('app_settings')
      .select('key, value_text')
      .in('key', ['sub_pay_run_day', 'sub_pay_explainer'])
    const settings = new Map(
      ((settingsRaw ?? []) as Array<{ key: string; value_text: string | null }>).map((r) => [r.key, r.value_text]),
    )
    const payRunDay = (settings.get('sub_pay_run_day') ?? '').trim() || null
    const payExplainer = (settings.get('sub_pay_explainer') ?? '').trim() || null

    const { data: slugRow } = await admin
      .from('sub_portal_slugs')
      .select('slug')
      .eq('person_id', link.person_id)
      .maybeSingle()
    const slug = ((slugRow as { slug?: string | null } | null)?.slug ?? '').trim() || null

    // Your days (v2.2930): dated work from every live signed order (their pick, else the
    // office's span), office-set sheets with a date that no order already covers, and days off.
    const bookings: Array<{ start: string; end: string; label: string; address: string | null; jobNumber: string | null; source: 'pick' | 'office'; commitmentId: string | null; note: string | null }> = []
    {
      const { data: liveRaw } = await admin
        .from('step_commitments')
        .select('id, labor_job_id, job_id, picked_start, picked_end, proposed_start, proposed_end, stage_window_id, job:job_id(hcp_number, job_address)')
        .eq('person_id', link.person_id)
        .in('status', ['accepted', 'approved'])
        .limit(100)
      const live = (liveRaw ?? []) as Array<{ id: string; labor_job_id: string | null; job_id: string | null; picked_start: string | null; picked_end: string | null; proposed_start: string | null; proposed_end: string | null; stage_window_id: string | null; job: { hcp_number: string | null; job_address: string | null } | { hcp_number: string | null; job_address: string | null }[] | null }>
      const stageNames = new Map<string, string>()
      const winIds = [...new Set(live.map((o) => o.stage_window_id).filter((id): id is string => !!id))]
      if (winIds.length > 0) {
        const { data: wins } = await admin.from('job_stage_windows').select('id, fixture:fixture_id(name)').in('id', winIds)
        for (const w of (wins ?? []) as Array<{ id: string; fixture: { name: string | null } | { name: string | null }[] | null }>) {
          const f = Array.isArray(w.fixture) ? w.fixture[0] ?? null : w.fixture
          if (f?.name) stageNames.set(w.id, f.name.trim())
        }
      }
      const coveredSheetIds = new Set<string>()
      for (const o of live) {
        const start = (o.picked_start ?? '').trim() || (o.proposed_start ?? '').trim()
        if (!start) continue
        const end = ((o.picked_start ? o.picked_end : o.proposed_end) ?? '').trim() || start
        if (end < todayYmd) continue
        const job = Array.isArray(o.job) ? o.job[0] ?? null : o.job
        const num = (job?.hcp_number ?? '').trim() || null
        const stage = o.stage_window_id ? stageNames.get(o.stage_window_id) ?? null : null
        bookings.push({ start, end, label: [stage, num ? `#${num}` : null].filter(Boolean).join(' · ') || 'Work order', address: (job?.job_address ?? '').trim() || null, jobNumber: num, source: o.picked_start ? 'pick' : 'office', commitmentId: o.id, note: null })
        if (o.labor_job_id) coveredSheetIds.add(o.labor_job_id)
      }
      for (const sh of sheetRows) {
        const d = (sh.job_date ?? '').trim()
        if (!d || d < todayYmd || coveredSheetIds.has(sh.id)) continue
        const num = (sh.job_number ?? '').trim() || null
        bookings.push({ start: d, end: d, label: num ? `#${num}` : 'Sheet', address: (sh.address ?? '').trim() || null, jobNumber: num, source: 'office', commitmentId: null, note: null })
      }
    }
    const { data: offRaw } = await admin.from('person_availability').select('day').eq('person_id', link.person_id).eq('kind', 'off').gte('day', addDaysYmd(todayYmd, -7)).limit(200)
    const offDays = ((offRaw ?? []) as Array<{ day: string }>).map((r) => r.day).sort()

    return jsonResponse({
      company: PORTAL_COMPANY,
      subName: personName,
      preparedOn: todayYmd,
      sheets: openSheets,
      payments,
      totals,
      offers,
      documents,
      payRun: {
        day: payRunDay,
        nextRun: nextPayRunYmd(todayYmd, payRunDay),
        explainer: payExplainer,
      },
      // The slug and the token are the same capability — lets a slug-opened
      // page submit forms and sign offers.
      requestToken: link.token ?? null,
      slug,
      days: { bookings, offDays },
    })
  } catch (e) {
    console.error('sub-portal error', e)
    return jsonResponse({ error: 'Something went wrong. Please try again.' }, 500)
  }
})
