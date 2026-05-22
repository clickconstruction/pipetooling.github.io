/**
 * send-bid-pricing-package
 *
 * Resend-backed delivery of a bid's external Pricing package (Job Plans link + the 4-column
 * external pricing table: Fixture/Tie-in, Count, Unit price, Revenue).
 *
 * Caller flow (Bids → Pricing tab → "Package and send" modal → "Send for me"):
 *   POST { bid_id, price_book_version_id, recipient_user_id }
 *
 * Server re-computes pricing rows from the database instead of trusting any client-built
 * HTML — this guarantees the email always matches the live Pricing tab, not a stale tab.
 *
 * Recipient is an org user (non-archived, email on file). The audit row written to
 * `bid_pricing_package_sends` is inserted with the service-role client (bypasses RLS for
 * the system row). Same auth + Resend pattern as `send-estimate-to-customer/index.ts`.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

import { sendResendHtmlEmail } from '../_shared/recurringJobReportCore.ts'
import {
  DEFAULT_BID_LEDGER_PREFIX,
  formatBidLedgerNumberLabel,
} from '../_shared/ledgerDisplayPrefixes.ts'
import {
  buildBidPricingPackageEmailHtml,
  buildBidPricingPackageExternalRows,
  buildBidPricingPackagePlainText,
  buildBidPricingPackageTableHtml,
  packageRowRevenueTotalCents,
  type PackageRowInput,
} from '../_shared/bidPricingPackage.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type RequestBody = {
  bid_id?: string
  price_book_version_id?: string
  recipient_user_id?: string
}

type CountRow = { id: string; fixture: string | null; count: number | string | null }
type AssignmentRow = {
  count_row_id: string
  price_book_entry_id: string
  is_fixed_price: boolean | null
  unit_price_override: number | null
}
type CustomPriceRow = { count_row_id: string; unit_price: number | string }
type SubmissionHideRow = { count_row_id: string }
type EntryRow = {
  id: string
  total_price: number | string | null
  fixture_types: { name: string | null } | null
}
type ServiceTypeRow = { ledger_bid_prefix: string | null } | null

function jsonResponse(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function deriveRow(args: {
  countRow: CountRow
  assignment: AssignmentRow | undefined
  entriesById: Map<string, EntryRow>
  entries: EntryRow[]
  customPriceByCountRowId: Map<string, number>
  hidden: Set<string>
}): PackageRowInput {
  const { countRow, assignment, entriesById, entries, customPriceByCountRowId, hidden } = args
  const count = Number(countRow.count)

  let entry: EntryRow | undefined
  if (assignment) {
    entry = entriesById.get(assignment.price_book_entry_id)
  } else {
    entry = entries.find(
      (e) =>
        (e.fixture_types?.name ?? '').toLowerCase() === (countRow.fixture ?? '').toLowerCase(),
    )
  }
  const customPrice = customPriceByCountRowId.get(countRow.id)
  const unitPrice =
    assignment?.unit_price_override ??
    (entry ? Number(entry.total_price) : customPrice ?? 0)
  const isFixedPrice = assignment?.is_fixed_price ?? false
  const revenue = isFixedPrice ? unitPrice : count * unitPrice

  return {
    fixture: (countRow.fixture ?? '').trim(),
    count,
    unitPrice,
    revenue,
    omitFromSubmissionDocuments: hidden.has(countRow.id),
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return jsonResponse(405, { ok: false, error: 'Method not allowed' })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return jsonResponse(401, { ok: false, error: 'Unauthorized' })
    const token = authHeader.replace(/^Bearer\s+/i, '')
    if (!token) return jsonResponse(401, { ok: false, error: 'Unauthorized' })

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnon = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    if (!serviceKey) return jsonResponse(500, { ok: false, error: 'Server misconfigured' })

    const userClient = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: authErr } = await userClient.auth.getUser(token)
    if (authErr || !user) return jsonResponse(401, { ok: false, error: 'Unauthorized' })

    const body = (await req.json().catch(() => ({}))) as RequestBody
    const bidId = (body.bid_id ?? '').trim()
    const versionId = (body.price_book_version_id ?? '').trim()
    const recipientUserId = (body.recipient_user_id ?? '').trim()
    if (!bidId || !versionId || !recipientUserId) {
      return jsonResponse(400, {
        ok: false,
        error: 'bid_id, price_book_version_id, recipient_user_id required',
      })
    }

    const admin = createClient(supabaseUrl, serviceKey)

    // Sender — must be a Pricing-tab staff role.
    const { data: senderRow, error: senderErr } = await admin
      .from('users')
      .select('id, name, role, archived_at')
      .eq('id', user.id)
      .maybeSingle()
    if (senderErr || !senderRow) return jsonResponse(403, { ok: false, error: 'Sender not found' })
    if (senderRow.archived_at) return jsonResponse(403, { ok: false, error: 'Sender archived' })
    const allowedRoles = new Set(['dev', 'master_technician', 'assistant', 'estimator'])
    if (!allowedRoles.has((senderRow.role as string) ?? '')) {
      return jsonResponse(403, { ok: false, error: 'Role cannot send bid pricing packages' })
    }

    // Bid (user-scoped read — relies on bids RLS to confirm sender can see this bid).
    const { data: bidRow, error: bidErr } = await userClient
      .from('bids')
      .select('id, project_name, plans_link, bid_number, service_type_id, service_types(ledger_bid_prefix)')
      .eq('id', bidId)
      .maybeSingle<{
        id: string
        project_name: string | null
        plans_link: string | null
        bid_number: string | null
        service_type_id: string | null
        service_types: ServiceTypeRow
      }>()
    if (bidErr || !bidRow) return jsonResponse(404, { ok: false, error: 'Bid not found' })

    // Recipient (admin lookup so we can confirm email + non-archived without depending on
    // a wide-open users read policy for the sender's role).
    const { data: recipientRow, error: recipientErr } = await admin
      .from('users')
      .select('id, name, email, archived_at, role')
      .eq('id', recipientUserId)
      .maybeSingle<{
        id: string
        name: string | null
        email: string | null
        archived_at: string | null
        role: string | null
      }>()
    if (recipientErr || !recipientRow) return jsonResponse(404, { ok: false, error: 'Recipient not found' })
    const recipientEmail = (recipientRow.email ?? '').trim()
    if (!recipientEmail) return jsonResponse(400, { ok: false, error: 'Recipient has no email on file' })
    if (recipientRow.archived_at) return jsonResponse(400, { ok: false, error: 'Recipient is archived' })

    // Price book version (display name).
    const { data: versionRow, error: versionErr } = await userClient
      .from('price_book_versions')
      .select('id, name')
      .eq('id', versionId)
      .maybeSingle<{ id: string; name: string | null }>()
    if (versionErr || !versionRow) return jsonResponse(404, { ok: false, error: 'Price book version not found' })

    // Source data (user-scoped; bid_count_rows / pricing assignments policies must allow it).
    const [countRowsRes, assignmentsRes, customPricesRes, hidesRes, entriesRes] = await Promise.all([
      userClient
        .from('bids_count_rows')
        .select('id, fixture, count')
        .eq('bid_id', bidId)
        .order('created_at', { ascending: true }),
      userClient
        .from('bid_pricing_assignments')
        .select('count_row_id, price_book_entry_id, is_fixed_price, unit_price_override')
        .eq('bid_id', bidId)
        .eq('price_book_version_id', versionId),
      userClient
        .from('bid_count_row_custom_prices')
        .select('count_row_id, unit_price')
        .eq('bid_id', bidId)
        .eq('price_book_version_id', versionId),
      userClient
        .from('bid_count_row_submission_hides')
        .select('count_row_id')
        .eq('bid_id', bidId)
        .eq('price_book_version_id', versionId),
      userClient
        .from('price_book_entries')
        .select('id, total_price, fixture_types(name)')
        .eq('version_id', versionId),
    ])

    for (const res of [countRowsRes, assignmentsRes, customPricesRes, hidesRes, entriesRes]) {
      if (res.error) {
        return jsonResponse(400, { ok: false, error: res.error.message })
      }
    }

    const countRows = (countRowsRes.data as CountRow[] | null) ?? []
    const assignments = (assignmentsRes.data as AssignmentRow[] | null) ?? []
    const customPrices = (customPricesRes.data as CustomPriceRow[] | null) ?? []
    const hides = (hidesRes.data as SubmissionHideRow[] | null) ?? []
    const entries = (entriesRes.data as EntryRow[] | null) ?? []

    const entriesById = new Map<string, EntryRow>(entries.map((e) => [e.id, e]))
    const assignmentByCountRow = new Map<string, AssignmentRow>(
      assignments.map((a) => [a.count_row_id, a]),
    )
    const customPriceByCountRowId = new Map<string, number>()
    for (const cp of customPrices) {
      customPriceByCountRowId.set(cp.count_row_id, Number(cp.unit_price))
    }
    const hiddenIds = new Set(hides.map((h) => h.count_row_id))

    const pricingRows: PackageRowInput[] = countRows.map((cr) =>
      deriveRow({
        countRow: cr,
        assignment: assignmentByCountRow.get(cr.id),
        entriesById,
        entries,
        customPriceByCountRowId,
        hidden: hiddenIds,
      }),
    )

    const totalRevenue = pricingRows.reduce(
      (acc, r) => acc + (Number.isFinite(r.revenue) ? r.revenue : 0),
      0,
    )
    const externalRows = buildBidPricingPackageExternalRows(pricingRows)
    if (externalRows.length === 0) {
      return jsonResponse(400, {
        ok: false,
        error: 'No visible fixtures to send (every row is hidden or has count 0)',
      })
    }

    // Display label: same shape as Bids tab heading — `{prefix}{n} project name`.
    const bidNum = (bidRow.bid_number ?? '').trim()
    const projectName = (bidRow.project_name ?? '').trim() || 'Bid'
    const bidLabel = bidNum
      ? `${formatBidLedgerNumberLabel(
          (bidRow.service_types?.ledger_bid_prefix ?? '').trim() || DEFAULT_BID_LEDGER_PREFIX,
          bidNum,
        )} ${projectName}`
      : projectName
    const plansLink = (bidRow.plans_link ?? '').trim()
    const plansLinkOrNull = plansLink.length > 0 ? plansLink : null
    const senderName = (senderRow.name ?? '').trim() || null

    const tableHtml = buildBidPricingPackageTableHtml({ externalRows, totalRevenue })
    const htmlBody = buildBidPricingPackageEmailHtml({
      bidLabel,
      plansLink: plansLinkOrNull,
      tableHtml,
      senderName,
    })
    const textBody = buildBidPricingPackagePlainText({
      externalRows,
      totalRevenue,
      bidLabel,
      plansLink: plansLinkOrNull,
    })

    const subject = `Pricing — ${bidLabel}`

    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (!resendApiKey) {
      return jsonResponse(500, { ok: false, error: 'RESEND_API_KEY not configured' })
    }

    const send = await sendResendHtmlEmail({
      to: recipientEmail,
      subject,
      html: htmlBody,
      textFallback: textBody,
      resendApiKey,
    })

    if (!send.ok) {
      return jsonResponse(502, { ok: false, error: send.error ?? 'Resend send failed' })
    }

    // Append audit row (service-role; bypasses RLS).
    const revenueCents = packageRowRevenueTotalCents(externalRows)
    const { error: insertErr } = await admin.from('bid_pricing_package_sends').insert({
      bid_id: bidId,
      price_book_version_id: versionId,
      sent_by_user_id: senderRow.id,
      recipient_user_id: recipientRow.id,
      recipient_email: recipientEmail,
      sent_via: 'resend',
      resend_id: send.id ?? null,
      plans_link: plansLinkOrNull,
      revenue_total_cents: revenueCents,
      row_count: externalRows.length,
    })
    if (insertErr) {
      // Send succeeded; log the audit failure but don't fail the caller.
      console.error('bid_pricing_package_sends insert failed', insertErr)
    }

    return jsonResponse(200, {
      ok: true,
      resend_id: send.id ?? null,
      row_count: externalRows.length,
      revenue_total_cents: revenueCents,
    })
  } catch (e) {
    console.error('send-bid-pricing-package error', e)
    return jsonResponse(500, { ok: false, error: 'Internal error' })
  }
})
