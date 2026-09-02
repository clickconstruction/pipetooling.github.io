import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { PORTAL_COMPANY } from '../_shared/portalCompany.ts'
import {
  buildSubDocuments,
  buildSubOffers,
  buildSubPaymentLines,
  buildSubSheets,
  buildSubTotals,
  nextPayRunYmd,
  addDaysYmd,
  type SubDocRow,
  type SubItemRow,
  type SubOfferRow,
  type SubPaymentRow,
  type SubSheetRow,
} from '../_shared/subPortalStatement.ts'

/**
 * Sub portal payload (sub-portal train): resolves a sub portal link token OR
 * a custom address slug and returns ONLY that person's Work & Pay statement —
 * sheets with line items and open balances, the payment ledger (memos are
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
    if ((!rawToken || rawToken.length < 16 || rawToken.length > 128) && !rawSlug) {
      return jsonResponse({ error: 'Missing token' }, 400)
    }

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false },
    })

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
      .select('id, name')
      .eq('id', link.person_id)
      .maybeSingle()
    if (!person) return jsonResponse({ error: 'Not found' }, 404)
    const personName = ((person as { name: string | null }).name ?? '').trim() || 'Subcontractor'

    // View counting — fire-and-forget, the statement never fails on measurement.
    void admin
      .from('public_page_views')
      .insert({ surface: 'sub_portal', entity_id: link.person_id, via: rawToken ? 'token' : 'slug' })
      .then(() => {}, () => {})

    const todayYmd = new Date().toISOString().slice(0, 10)

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
        .select('id, address, job_number, job_date, labor_rate, portal_status, payable_after, pay_hold_reason')
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

    const sheets = buildSubSheets(sheetRows, itemRows, paymentRows)
    const totals = buildSubTotals(sheets)
    const openSheets = sheets.filter((s) => s.open > 0)
    const sheetsById = new Map(sheetRows.map((s) => [s.id, s]))
    const payments = buildSubPaymentLines(paymentRows, sheetsById, addDaysYmd(todayYmd, -90))

    // Open offers with the step name for the card title.
    const { data: offersRaw } = await admin
      .from('step_commitments')
      .select('id, step_id, amount, notes, offer_scope_snapshot, offer_expires_at, proposed_start, proposed_end')
      .eq('person_id', link.person_id)
      .eq('status', 'offered')
      .limit(20)
    const offerRowsRaw = (offersRaw ?? []) as Array<SubOfferRow & { step_id: string }>
    const stepIds = [...new Set(offerRowsRaw.map((o) => o.step_id))]
    const stepNames = new Map<string, string>()
    if (stepIds.length > 0) {
      const { data: steps } = await admin.from('project_workflow_steps').select('id, name').in('id', stepIds)
      for (const s of (steps ?? []) as Array<{ id: string; name: string | null }>) {
        if (s.name) stepNames.set(s.id, s.name)
      }
    }
    const offers = buildSubOffers(
      offerRowsRaw.map((o) => ({ ...o, step_name: stepNames.get(o.step_id) ?? null })),
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
    })
  } catch (e) {
    console.error('sub-portal error', e)
    return jsonResponse({ error: 'Something went wrong. Please try again.' }, 500)
  }
})
