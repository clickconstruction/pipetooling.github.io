/**
 * The sample responses the public fetch functions return for the sample token (What customers
 * see, Settings dev tab). Each one lays the live Settings over `customerSample.ts` so the page
 * renders exactly what a real customer would get with today's copy, terms, footer and brand.
 */
import { rollUpPartDecisions, roomCounts, roomRowsFrom, type RoomItemSource, type RoomPartSource, type RoomRow, type SubmittalRoomPayload } from './submittalRoomPayload.ts'
import { SAMPLE_BID, SAMPLE_CHANGE_ORDER, SAMPLE_CONTRACT, SAMPLE_ESTIMATE, SAMPLE_GC, SAMPLE_HOMEOWNER, SAMPLE_SUB, SAMPLE_TOKEN, ymdPlusDays, type SampleState, SAMPLE_JOB_CONTRACT } from './customerSample.ts'
import { gcPortalStages } from './gcStages.ts'
import { resolveEstimateCustomerExperience, toClientCustomerExperience } from './estimateCustomerExperience.ts'
import type { SharedBidRoomPayload } from './bidRoomPayload.ts'

export type AppSettingRow = { key: string; value_text: string | null }

export const ESTIMATE_PUBLIC_TERMS_KEY = 'estimate_public_terms_body'
export const BID_COVER_LETTER_TERMS_KEY = 'bid_cover_letter_terms_default_v1'
export const BID_COVER_LETTER_EXCLUSIONS_KEY = 'bid_cover_letter_exclusions_default_v1'

function setting(rows: AppSettingRow[], key: string): string | null {
  const v = rows.find((r) => r.key === key)?.value_text
  const t = (v ?? '').trim()
  return t ? t : null
}

/** get-estimate-for-customer, sample token: 200 with the live estimate, or the 409 the thank-you page reads. */
export function sampleEstimateResponse(rows: AppSettingRow[], state: SampleState, todayYmd: string): { status: number; body: Record<string, unknown> } {
  const resolved = resolveEstimateCustomerExperience(rows, null, { acceptUrl: '', title: SAMPLE_ESTIMATE.title, estimateNumber: SAMPLE_ESTIMATE.number }, { docKind: 'estimate' })
  const customer_experience = toClientCustomerExperience(resolved)
  if (state === 'done') {
    return { status: 409, body: { error: 'Already accepted', code: 'already_accepted', customer_experience, accept_header_brand: 'plum' } }
  }
  return {
    status: 200,
    body: {
      id: SAMPLE_ESTIMATE.id,
      title: SAMPLE_ESTIMATE.title,
      line_items_snapshot: SAMPLE_ESTIMATE.lines,
      terms_snapshot: setting(rows, ESTIMATE_PUBLIC_TERMS_KEY) ?? SAMPLE_ESTIMATE.termsFallback,
      total_cents: SAMPLE_ESTIMATE.totalCents,
      valid_until: ymdPlusDays(todayYmd, SAMPLE_ESTIMATE.validDays),
      for_line: SAMPLE_HOMEOWNER.address,
      customer_experience,
      accept_header_brand: 'plum',
      customer_attachment: null,
      doc_kind: 'estimate',
      change_order_fields: null,
      options: [],
    },
  }
}

/** get-bid-proposal-room, sample token: the room with one pending change order; `done` = signed. */
export function sampleBidRoomResponse(rows: AppSettingRow[], state: SampleState, nowIso: string, todayYmd: string): Record<string, unknown> {
  const payload: SharedBidRoomPayload = {
    v: 1,
    add_ons: [],
    project_name: SAMPLE_BID.projectName,
    project_address: SAMPLE_BID.projectAddress,
    gc_name: SAMPLE_GC.company,
    service_type_name: SAMPLE_BID.serviceTypeName,
    options: SAMPLE_BID.options.map((o) => ({ key: o.key, name: o.name, is_base: o.is_base, total_cents: o.total_cents, fixture_rows: o.fixture_rows.map((r) => ({ ...r })) })),
    inclusions: SAMPLE_BID.inclusions,
    exclusions: setting(rows, BID_COVER_LETTER_EXCLUSIONS_KEY) ?? SAMPLE_BID.exclusionsFallback,
    terms: setting(rows, BID_COVER_LETTER_TERMS_KEY) ?? SAMPLE_BID.termsFallback,
    header_brand: SAMPLE_BID.headerBrand,
  }
  const base = SAMPLE_BID.options[0]
  const signed = state === 'done'
  return {
    revision: { id: 'sample-revision', rev_number: signed ? 2 : 1, note: signed ? SAMPLE_BID.revisionNote : '', published_at: nowIso },
    payload,
    attachment: null,
    outcome: signed
      ? { event_type: 'signed', metadata: { option_key: base.key, option_name: base.name, total_cents: base.total_cents, printed_name: SAMPLE_GC.contact }, occurred_at: nowIso }
      : null,
    documents: [
      {
        id: SAMPLE_CHANGE_ORDER.id,
        title: SAMPLE_CHANGE_ORDER.title,
        change_order_fields: {
          description_of_change: SAMPLE_CHANGE_ORDER.description,
          reason_for_change: SAMPLE_CHANGE_ORDER.reason,
          impact_on_schedule: '+2 working days',
          response_requested_by: ymdPlusDays(todayYmd, 7),
        },
        line_items_snapshot: SAMPLE_CHANGE_ORDER.lines,
        terms_snapshot: null,
        total_cents: SAMPLE_CHANGE_ORDER.netChangeCents,
        status: signed ? 'customer_accepted' : 'sent',
        sent_at: nowIso,
        acceptor_printed_name: signed ? SAMPLE_GC.contact : null,
        acceptor_consented_at: signed ? nowIso : null,
      },
    ],
  }
}

/** The letterhead block both portals show; the same constant the live functions use. */
export type SamplePortalCompany = { name: string; cityLine: string; licenseLine: string; phone: string; email: string }

/** The sample GC's stage sequence (Stage Plan PR 5): four stages in order, two change orders — the mock-up's job, dated around today. */
function sampleGcStages(todayYmd: string, jobLabel: string, jobAddress: string) {
  const d = (n: number) => ymdPlusDays(todayYmd, n)
  const iso = (n: number) => `${d(n)}T15:00:00Z`
  const fx = (id: string, name: string, seq: number, price: number, kind: 'order' | 'any' | null, shared: boolean, invoice: string | null = null, count = 1) => ({ id, name, count, line_unit_price: price, sequence_order: seq, invoice_id: invoice, stage_kind: kind, shared_with_gc: shared })
  const out = gcPortalStages({
    fixtures: [
      fx('sf-rough', 'Rough-in', 1, 12_465, 'order', true, 'si-1'),
      fx('sf-top', 'Top-out', 2, 12_465, 'order', true, 'si-2'),
      fx('sf-trim', 'Trim & final', 3, 8_310, 'order', true, null, 2),
      fx('sf-final', 'Final inspection', 4, 0, 'order', true),
      fx('sf-co2', 'Relocate water heater', 5, 1_850, 'any', true),
      fx('sf-co3', 'Add hose bib, garage', 6, 420, 'any', false),
      fx('sf-permit', 'Permit & misc', 7, 600, null, false),
    ],
    windows: [
      { id: 'sw-rough', fixture_id: 'sf-rough', window_start: d(-9), window_end: d(-5) },
      { id: 'sw-top', fixture_id: 'sf-top', window_start: d(-1), window_end: d(3) },
      { id: 'sw-trim', fixture_id: 'sf-trim', window_start: d(13), window_end: d(23) },
      { id: 'sw-co2', fixture_id: 'sf-co2', window_start: d(-6), window_end: d(-2) },
    ],
    orders: [
      { id: 'so-rough', stage_window_id: 'sw-rough', status: 'settled', picked_start: d(-8), picked_end: d(-6), labor_job_id: 'ss-rough' },
      { id: 'so-top', stage_window_id: 'sw-top', status: 'accepted', picked_start: d(0), picked_end: d(1), labor_job_id: 'ss-top' },
      { id: 'so-co2', stage_window_id: 'sw-co2', status: 'accepted', picked_start: d(-4), picked_end: d(-3), labor_job_id: 'ss-co2' },
    ],
    sheets: [
      { id: 'ss-rough', stage: 'customer_pay', progress_pct: 100, stage_changed_at: iso(-5) },
      { id: 'ss-top', stage: 'working', progress_pct: 50, progress_at: iso(0) },
      { id: 'ss-co2', stage: 'walkthrough', progress_pct: 100, stage_changed_at: iso(-3) },
    ],
    invoices: [
      { id: 'si-1', status: 'paid', billed_at: iso(-12) },
      { id: 'si-2', status: 'billed', billed_at: iso(-4) },
    ],
    payments: [{ invoice_id: 'si-1', paid_on: d(-9) }],
    todayYmd,
  })
  return [{ jobId: 'sample-job-open', jobLabel, jobAddress, view: out.view, askWindowId: out.askWindowId, askWindow: { start: d(13), end: d(23) }, entries: [] }]
}

/** customer-portal, sample token: the homeowner's statement (one fresh bill, one partly paid), or (`gc`) the contractor's view of the properties they GC. */
type SampleWaiverHalf = { state: 'signed' | 'sent'; ymd: string; formType: string }
/** One sample waiver row (v2.4304), the shape `_shared/portalWaivers.ts` sends after the PDF links are signed. */
function sampleWaiver(
  audience: 'payer' | 'owner',
  jobId: string,
  bill: { jobLabel: string; jobAddress: string },
  invoiceId: string,
  billLabel: string,
  amount: number,
  billedYmd: string,
  paid: boolean,
  final: boolean,
  conditional: SampleWaiverHalf | null,
  unconditional: SampleWaiverHalf | null,
): Record<string, unknown> {
  const half = (h: SampleWaiverHalf | null) =>
    h ? { state: h.state, ymd: h.ymd, pdfUrl: null, releaseId: null, formType: h.formType, signerName: 'Malachi Whites' } : { state: 'none', ymd: null, pdfUrl: null, releaseId: null, formType: null, signerName: null }
  return { audience, jobId, jobLabel: bill.jobLabel, jobAddress: bill.jobAddress, invoiceId, billLabel, amount, billedYmd, paid, final, conditional: half(conditional), unconditional: half(unconditional) }
}

export function sampleCustomerPortalResponse(company: SamplePortalCompany, state: SampleState, todayYmd: string, appOrigin: string): Record<string, unknown> {
  const gc = state === 'gc'
  const payUrl = `${appOrigin.replace(/\/$/, '')}/portal?t=${SAMPLE_TOKEN}#pay`
  const openBill = {
    invoiceId: 'sample-inv-open',
    jobLabel: gc ? 'Cedar Bend Apartments · Job 1002' : 'Water heater replacement · Job 1001',
    jobNumber: gc ? '1002' : '1001',
    jobName: gc ? 'Cedar Bend Apartments' : 'Water heater replacement',
    serviceTag: 'plum',
    jobAddress: gc ? SAMPLE_BID.projectAddress : SAMPLE_HOMEOWNER.address,
    amount: gc ? 18_200 : 4_380,
    billedOn: ymdPlusDays(todayYmd, -3),
    payUrl,
    checkRef: gc ? 'CB-1002' : 'WH-1001',
    asGc: gc,
    billedTo: null,
    ownerName: gc ? 'Cedar Bend Owner LLC' : null,
    payments: [],
    totalPaid: 0,
  }
  const paidBill = {
    invoiceId: 'sample-inv-paid',
    jobLabel: gc ? 'Hunter Road Studios · Job 0998' : 'Kitchen faucet and disposal · Job 0994',
    jobNumber: gc ? '0998' : '0994',
    jobName: gc ? 'Hunter Road Studios' : 'Kitchen faucet and disposal',
    serviceTag: 'plum',
    jobAddress: gc ? '1900 Hunter Rd, San Marcos, TX 78666' : SAMPLE_HOMEOWNER.address,
    amount: gc ? 2_560 : 560,
    billedOn: ymdPlusDays(todayYmd, -40),
    payUrl,
    checkRef: gc ? 'HR-0998' : 'KF-0994',
    asGc: gc,
    billedTo: null,
    ownerName: gc ? 'Hunter Road Partners' : null,
    payments: [{ date: ymdPlusDays(todayYmd, -31), method: gc ? 'check' : 'card', amount: gc ? 9_640 : 640 }],
    totalPaid: gc ? 9_640 : 640,
  }
  return {
    company,
    customerName: gc ? SAMPLE_GC.company : SAMPLE_HOMEOWNER.name,
    // Customer Waiting (v2.3249): the number on file, so the sample form shows the prefill.
    customerPhone: gc ? '(512) 555-0188' : '(512) 555-0142',
    audience: gc ? 'gc' : 'all',
    bills: [openBill, paidBill],
    totalDue: openBill.amount + paidBill.amount,
    requestableJobs: [{ id: 'sample-job-open', label: openBill.jobLabel }],
    requestableProperties: gc
      ? [
          { jobId: 'sample-job-open', street: '2530 Hunter Rd', city: 'San Marcos' },
          { jobId: 'sample-job-paid', street: '1900 Hunter Rd', city: 'San Marcos' },
        ]
      : [{ jobId: 'sample-job-open', street: '100 Sample St', city: 'Kyle' }],
    requestToken: SAMPLE_TOKEN,
    slug: gc ? SAMPLE_GC.portalSlug : SAMPLE_HOMEOWNER.portalSlug,
    agreements: gc
      ? [{ jobLabel: openBill.jobLabel, jobAddress: openBill.jobAddress, status: 'signed', templateName: 'Commercial plumbing agreement', amountCents: 5_634_300, signedAt: ymdPlusDays(todayYmd, -20), signerName: SAMPLE_GC.contact, sentAt: ymdPlusDays(todayYmd, -21), signUrl: null }]
      : [{ jobLabel: openBill.jobLabel, jobAddress: openBill.jobAddress, status: 'signed', templateName: 'Residential service agreement', amountCents: 438_000, signedAt: ymdPlusDays(todayYmd, -5), signerName: SAMPLE_HOMEOWNER.name, sentAt: ymdPlusDays(todayYmd, -6), signUrl: null }],
    // Test reports (v2.3304): sent reports on the company's jobs — the inline line on the job and the standing card.
    testReports: gc
      ? [
          { id: 'sample-report-1', jobId: 'sample-job-open', jobNumber: openBill.jobNumber, jobLabel: openBill.jobLabel, jobAddress: openBill.jobAddress, reportLabel: 'Sewer Pre-Test Hydrostatic', title: 'Sewer Pre-Test Hydrostatic Test Report', result: 'pass', testDateYmd: ymdPlusDays(todayYmd, -4), certifierName: 'Malachi Whites', certifierLicense: '#RMP41130', sentAt: ymdPlusDays(todayYmd, -3) },
          { id: 'sample-report-2', jobId: 'sample-job-paid', jobNumber: paidBill.jobNumber, jobLabel: paidBill.jobLabel, jobAddress: paidBill.jobAddress, reportLabel: 'Sewer Post-Test Hydrostatic', title: 'Sewer Post-Test Hydrostatic Test Report', result: 'pass', testDateYmd: ymdPlusDays(todayYmd, -41), certifierName: 'Malachi Whites', certifierLicense: '#RMP41130', sentAt: ymdPlusDays(todayYmd, -40) },
        ]
      : [{ id: 'sample-report-1', jobId: 'sample-job-open', jobNumber: openBill.jobNumber, jobLabel: openBill.jobLabel, jobAddress: openBill.jobAddress, reportLabel: 'Gas Test', title: 'Gas Test Report', result: null, testDateYmd: ymdPlusDays(todayYmd, -4), certifierName: 'Malachi Whites', certifierLicense: '#RMP41130', sentAt: ymdPlusDays(todayYmd, -3) }],
    // Lien waivers (v2.4304): the GC's signed waivers — a note on each open bill and the Your papers rows. No files behind sample rows.
    waivers: gc
      ? [
          sampleWaiver('payer', 'sample-job-open', openBill, 'sample-inv-open', 'Bill 2 of 3', 18_200, ymdPlusDays(todayYmd, -3), false, false, { state: 'signed', ymd: ymdPlusDays(todayYmd, -2), formType: 'conditional_progress' }, null),
          sampleWaiver('payer', 'sample-job-paid', paidBill, 'sample-inv-paid', 'Bill', 12_200, ymdPlusDays(todayYmd, -40), false, true, { state: 'sent', ymd: ymdPlusDays(todayYmd, -40), formType: 'conditional_final' }, null),
          sampleWaiver('payer', 'sample-job-open', openBill, 'sample-inv-open-1', 'Bill 1 of 3', 14_050, ymdPlusDays(todayYmd, -30), true, false, { state: 'sent', ymd: ymdPlusDays(todayYmd, -26), formType: 'conditional_progress' }, { state: 'sent', ymd: ymdPlusDays(todayYmd, -13), formType: 'unconditional_progress' }),
        ]
      : [],
    stages: gc ? sampleGcStages(todayYmd, openBill.jobLabel, openBill.jobAddress) : [],
    // Bank transfer details (v2.3308): invented numbers so the walkthrough shows the collapsed
    // card; the live row lives in company_bank_transfer_details, never in this file.
    bankTransfer: {
      payee_name: 'Sample Plumbing LLC',
      bank_name: 'Sample Bank',
      bank_note: 'Your bank may show this name instead of ours — that is correct.',
      routing_number: '000000000',
      account_number: '000012345678',
      account_kind: 'Checking',
      beneficiary_address: '100 Sample St, Kyle, TX 78640',
      check_mailing_address: 'PO Box 118, Kyle, TX 78640',
      show_on_portal: true,
    },
  }
}

/** sub-portal, sample token: Sam's Plumbing's Work & pay statement; pay-run settings come from the live function. */
export function sampleSubPortalResponse(company: SamplePortalCompany, todayYmd: string, payRun: { day: string | null; nextRun: string | null; explainer: string | null }): Record<string, unknown> {
  return {
    company,
    subName: SAMPLE_SUB.company,
    preparedOn: todayYmd,
    sheets: [
      {
        id: 'sample-sheet-1',
        jobNumber: 'J-1002',
        address: SAMPLE_BID.projectAddress,
        stage: 'walkthrough',
        stageChangedOn: ymdPlusDays(todayYmd, -1),
        stageSource: 'portal',
        items: [
          { label: '14 × Top out fixtures — 3.5 hr each @ $58/hr', amount: 2_842 },
          { label: 'Water heater set (fixed price)', amount: 278 },
        ],
        agreed: 3_120,
        paid: 1_500,
        backcharges: 0,
        open: 1_620,
        payableAfter: ymdPlusDays(todayYmd, 2),
        payHoldReason: 'Top out passed inspection — queued for the next pay run.',
        agreement: {
          signedOn: ymdPlusDays(todayYmd, -21),
          signerName: SAMPLE_SUB.contact,
          amount: 3_120,
          lines: [{ label: 'Top out — 14 fixtures per plan sheet P-2', amount: null }, { label: 'Water heater set', amount: null }],
          exclusions: [],
          references: [{ kind: 'book', name: 'General Conditions for Subcontractors', versionDate: ymdPlusDays(todayYmd, -80) }],
          acknowledgements: ['My insurance certificate stays current for the whole job.'],
        },
      },
      {
        id: 'sample-sheet-2',
        jobNumber: 'J-1001',
        address: SAMPLE_HOMEOWNER.address,
        stage: 'customer_pay',
        stageChangedOn: ymdPlusDays(todayYmd, -3),
        stageSource: 'office',
        items: [{ label: 'Water heater replacement — trim and test (fixed price)', amount: 900 }],
        agreed: 900,
        paid: 0,
        backcharges: 0,
        open: 900,
        payableAfter: ymdPlusDays(todayYmd, 5),
        payHoldReason: 'Customer paid — this goes out on the next pay run.',
      },
    ],
    payments: [
      { date: ymdPlusDays(todayYmd, -13), jobNumber: 'J-1002', memo: 'Progress payment — rough passed', amount: 1_500 },
      { date: ymdPlusDays(todayYmd, -20), jobNumber: 'J-0991', memo: 'Final payment', amount: 3_940 },
      { date: ymdPlusDays(todayYmd, -20), jobNumber: 'J-0991', memo: 'Restock: cracked lav (supply house)', amount: -180 },
    ],
    totals: { earned: 21_460, paid: 18_940, open: 2_520 },
    offers: [
      {
        id: 'sample-offer-1',
        title: 'Rough-in · 407 Sample Ct',
        lines: [
          { label: 'Rough-in — 22 fixtures per plan sheet P-2', amount: 4_350 },
          { label: 'Water/gas stub-outs, garage', amount: 500 },
        ],
        total: 4_850,
        startsLabel: 'Starts in two weeks · about 6 working days',
        expiresOn: ymdPlusDays(todayYmd, 8),
        anchor: 'sheet',
        exclusions: ['Sales tax on materials when the project carries a tax-exempt certificate.'],
        references: [
          { kind: 'book', name: 'General Conditions for Subcontractors', versionDate: ymdPlusDays(todayYmd, -80) },
          { kind: 'setting', name: 'How pay works here', versionDate: null },
          { kind: 'compliance', name: 'Insurance requirements (certificate on file)', versionDate: ymdPlusDays(todayYmd, 27) },
        ],
        acknowledgements: ["I will bill through the portal by the billing cutoff with the sheet's paperwork.", 'My insurance certificate stays current for the whole job.'],
        bond: 'none',
        specialProvisions: null,
      },
    ],
    documents: [
      { id: 'sample-doc-agreement', name: SAMPLE_CONTRACT.documentName, state: 'action_needed', detail: { kind: 'needs_signature' }, signable: true },
      { id: 'sample-doc-w9', name: 'W-9', state: 'on_file', detail: { kind: 'on_file' }, signable: false },
      { id: 'sample-doc-coi', name: 'Insurance certificate (COI)', state: 'expiring', detail: { kind: 'expires', on: ymdPlusDays(todayYmd, 27) }, signable: false },
    ],
    payRun,
    requestToken: SAMPLE_TOKEN,
    slug: SAMPLE_SUB.portalSlug,
  }
}

/** get-contract-for-signer, sample token: the sample agreement, or (`done`) the 409 the thank-you reads. */
export function sampleContractResponse(state: SampleState): { status: number; body: Record<string, unknown> } {
  if (state === 'done') {
    return { status: 409, body: { error: 'Already signed', code: 'already_signed', thank_you_title: 'Thank you', thank_you_body: 'This record has already been completed.' } }
  }
  return {
    status: 200,
    body: {
      id: SAMPLE_CONTRACT.id,
      person_name: SAMPLE_SUB.contact,
      document_name: SAMPLE_CONTRACT.documentName,
      signing_body_html: SAMPLE_CONTRACT.bodyHtml,
      signing_body_format: 'html',
      canonical_document_url: null,
    },
  }
}

/**
 * get-job-contract's answer for the sample tokens (v2.3510): the shape the customer's signing
 * page reads. `live` is out for signature; `done` is signed on the page by Sam Sample. No row,
 * no view stamp, no event.
 */
export function sampleJobContractResponse(state: SampleState, company: SamplePortalCompany, todayYmd: string): Record<string, unknown> {
  const done = state === 'done'
  const sentAt = `${ymdPlusDays(todayYmd, -1)}T15:00:00.000Z`
  const signedAt = `${todayYmd}T14:30:00.000Z`
  return {
    contract: {
      id: SAMPLE_JOB_CONTRACT.id,
      status: done ? 'signed' : 'sent',
      revision: 1,
      heading: SAMPLE_JOB_CONTRACT.heading,
      job_number: SAMPLE_JOB_CONTRACT.jobNumber,
      job_address: SAMPLE_JOB_CONTRACT.jobAddress,
      customer_name: SAMPLE_HOMEOWNER.name,
      recipient_name: SAMPLE_HOMEOWNER.name,
      fields: {
        scope_lines: [...SAMPLE_JOB_CONTRACT.scopeLines],
        exclusions: 'Drywall repair after the work; upgrades to the gas line beyond the heater connection.',
        amount_cents: SAMPLE_JOB_CONTRACT.amountCents,
        payment_terms_key: 'half_down',
        payment_terms_text: '',
        start_date: ymdPlusDays(todayYmd, 3),
        completion_date: ymdPlusDays(todayYmd, 4),
        note: '',
      },
      body_html: SAMPLE_JOB_CONTRACT.bodyHtml,
      body_format: 'html',
      template_name: 'Service agreement',
      template_version_date: todayYmd,
      sent_at: sentAt,
      signed_at: done ? signedAt : null,
      signer_printed_name: done ? SAMPLE_HOMEOWNER.name : null,
      signer_mode: done ? 'type' : null,
      signer_consented_at: done ? signedAt : null,
      signature_url: null,
      signed_pdf_url: null,
      co_signer_name: null,
      co_signed_at: null,
      co_signer_printed_name: null,
      co_signer_mode: null,
      co_signer_consented_at: null,
      co_signature_url: null,
    },
    issuer: { companyName: company.name, addressText: '', phone: company.phone, email: company.email, tagline: company.cityLine, licenseLine: company.licenseLine },
    brand: 'plum',
  }
}

/**
 * get-submittal-room's answer for the sample tokens (v2.3511): the Cedar Bend bid's product
 * decisions as the GC's architect reads them. `live` is open with three products waiting on an
 * answer; `done` is the same room after Alex Sample sent the review. No row, no view stamp, no event.
 *
 * v2.4595 (punch list #62): the rows are sample submittal rows and parts run through the room's
 * own kernel (`roomRowsFrom` → `roomCounts`), the call the function makes for a real bid, so
 * the sample can only say what a real room can. They were written by hand before: a to-follow
 * row read "Not in our scope — by others.", no row had parts, and no row was a product we
 * intend to install. The order-only row and part are here so the sample goes through the same
 * filter as a real room; neither reaches the page.
 */
export function sampleSubmittalRoomResponse(state: SampleState, company: SamplePortalCompany, todayYmd: string): SubmittalRoomPayload {
  const done = state === 'done'
  const decidedAt = `${todayYmd}T15:10:00.000Z`
  const open = { review_decision: null, review_note: null, reviewed_by_name: null, reviewed_by_person_id: null, reviewed_at: null }
  const answer = (decision: 'approved' | 'revise' | 'rejected', note: string | null = null) =>
    done ? { review_decision: decision, review_note: note, reviewed_by_name: 'Alex Sample', reviewed_by_person_id: 'sample-person', reviewed_at: decidedAt } : open
  const row = (o: Partial<RoomItemSource> & Pick<RoomItemSource, 'id' | 'tag' | 'sequence_order' | 'status'>): RoomItemSource => ({
    specified_manufacturer: null, specified_model: null, specified_description: null, submitted_manufacturer: null, submitted_model: null, submitted_label: null,
    reason_kind: null, reason_note: null, lead_time_days: null, sheet_pages: [], ...open, ...o,
  })
  const part = (id: string, sequence_order: number, label: string, o: Partial<RoomPartSource> = {}): RoomPartSource => ({ id, item_id: 'sample-row-wc', sequence_order, label, quantity: 1, on_submittal: true, ...open, ...o })
  // WC-1 is a fixture of parts: the architect answers each one, and the row reads their roll-up, as the function writes it.
  const wcParts = [
    part('sample-part-bowl', 1, 'TOTO CT728CUVG#01 Elongated bowl, wall-hung', answer('approved')),
    part('sample-part-seat', 2, 'TOTO SS114#01 SoftClose seat', answer('approved')),
    part('sample-part-carrier', 3, 'ZURN Z1203-N Carrier, single', answer('revise', 'Match the wall depth on A-501.')),
    part('sample-part-stop', 4, 'BRASSCRAFT KTCR19X Supply stop', { on_submittal: false }),
  ]
  const items: RoomItemSource[] = [
    row({ id: 'sample-row-wc', tag: 'WC-1', sequence_order: 1, status: 'alternate', specified_manufacturer: 'TOTO', specified_model: 'CT708UVG', specified_description: 'wall-hung, 1.28 gpf', submitted_label: 'TOTO CT728CUVG#01 + TOTO SS114#01 + ZURN Z1203-N', reason_kind: 'lead_time', reason_note: 'about 6 weeks for the model on the plans', lead_time_days: 0, sheet_pages: [1, 2, 3], ...rollUpPartDecisions(wcParts) }),
    row({ id: 'sample-row-lav', tag: 'L-1', sequence_order: 2, status: 'as_specified', specified_manufacturer: 'Kohler', specified_model: 'K-2210 Caxton', specified_description: 'undermount', submitted_label: 'Kohler K-2210 Caxton', sheet_pages: [4] }),
    row({ id: 'sample-row-sh', tag: 'SH-1', sequence_order: 3, status: 'proposed', specified_description: 'Shower valve, pressure-balance', submitted_label: 'Symmons S-9600-1 Temptrol', lead_time_days: 14, sheet_pages: [5, 6], ...answer('approved') }),
    row({ id: 'sample-row-wh', tag: 'WH-1', sequence_order: 4, status: 'design_change', specified_manufacturer: 'A.O. Smith', specified_model: 'BTH-120', specified_description: '120 gal, 199,000 BTU', submitted_label: 'Bradford White eF100T199 · 100 gal, 199,000 BTU', reason_kind: 'discontinued', sheet_pages: [7, 8, 9], ...answer('revise', 'Keep 120 gal — confirm with the engineer.') }),
    row({ id: 'sample-row-mb', tag: 'MB-1', sequence_order: 5, status: 'missing', specified_manufacturer: 'Elkay', specified_model: 'LZSTL8WSLK', specified_description: 'bottle filler' }),
    row({ id: 'sample-row-tp', tag: 'TP-1', sequence_order: 6, status: 'accessory', submitted_label: 'PPP PR-500 trap primer', sheet_pages: [10] }),
    row({ id: 'sample-row-hb', tag: 'HB-1', sequence_order: 7, status: 'as_specified', specified_description: 'Hose bibb', submitted_label: 'Woodford 24P', order_only: true }),
  ]
  const rows: RoomRow[] = roomRowsFrom(items, new Map([['sample-row-wc', wcParts]]))
  return {
    status: 'open',
    closedAt: null,
    bid: { label: 'BP482', projectName: SAMPLE_BID.projectName, address: '4400 Sample Pkwy, Kyle, TX 78640' },
    company: { name: company.name, tagline: company.cityLine, phone: company.phone },
    person: done ? { id: 'sample-person', name: 'Alex Sample', role: 'architect', mayDecide: true } : null,
    revisions: [{ id: 'sample-rev-1', rev: 1, sharedAt: `${ymdPlusDays(todayYmd, -2)}T16:00:00.000Z`, current: true, hasPackage: false, rows, counts: roomCounts(rows) }],
  }
}

/** Sample Supply Co. — the fifth audience (v2.3512). */
export const SAMPLE_HOUSE = { name: 'Sample Supply Co.', contact: 'Chris Counter', email: 'counter@samplesupply.example.com' } as const

export const SAMPLE_RFQ_LINES: ReadonlyArray<{ fixture: string; count: number; unit: string | null }> = [
  { fixture: 'Water closet, wall-hung, 1.28 gpf', count: 24, unit: 'ea' },
  { fixture: 'Lavatory, undermount, 19"', count: 24, unit: 'ea' },
  { fixture: 'Shower valve, pressure-balance, with trim', count: 20, unit: 'ea' },
  { fixture: 'Water heater, 100 gal, 199,000 BTU', count: 2, unit: 'ea' },
  { fixture: '3/4" PEX-A, coil', count: 6, unit: '300 ft' },
]

/** get-rfq-quote-page's answer for the sample tokens: `live` is open; `done` carries the house's own prices from last time. */
export function sampleRfqQuotePageResponse(state: SampleState, todayYmd: string): Record<string, unknown> {
  const done = state === 'done'
  const prices: Record<string, number> = {}
  if (done) for (const [i, l] of SAMPLE_RFQ_LINES.entries()) prices[l.fixture.trim().toLowerCase()] = [31800, 18900, 24400, 412000, 9800][i] ?? 0
  return {
    prior: done ? { newestAt: `${ymdPlusDays(todayYmd, -20)}T15:00:00.000Z`, prices } : null,
    status: done ? 'quoted' : 'sent',
    bidName: `BP482 · ${SAMPLE_BID.projectName}`,
    supplyHouse: SAMPLE_HOUSE.name,
    neededBy: ymdPlusDays(todayYmd, 5),
    sentAt: `${ymdPlusDays(todayYmd, -1)}T14:00:00.000Z`,
    plansLink: null,
    lines: SAMPLE_RFQ_LINES.map((l) => ({ ...l })),
  }
}

/** Sample & Partner, PLLC — the collections law firm (v2.3512). */
export const SAMPLE_FIRM = {
  id: 'sample-firm',
  name: 'Sample & Partner, PLLC',
  handling: 'Ann Sample',
  email: 'ann@samplepartner.example.com',
  phone: '(512) 555-0199',
  recipients: [
    { id: 'sample-rec-1', name: 'Ann Sample', email: 'ann@samplepartner.example.com', role: 'Attorney', mode: 'now', scope: 'all', confirmed: true },
    { id: 'sample-rec-2', name: 'Bo Sample', email: 'bo@samplepartner.example.com', role: 'Paralegal', mode: 'digest', scope: 'mine', confirmed: false },
  ],
} as const

/**
 * The sample's statutory day (v2.4638): the 15th of the Nth month after a work month, rolled off a
 * weekend. Mirrors `statutoryFifteenth` in src/lib/jobs/lienDeadlines.ts (the client's clock), which
 * a `_shared` fixture cannot import; `legalPortalSample.test.ts` holds the two to the same day.
 */
export function sampleStatutoryFifteenth(workYmd: string, monthsAfter: number): string {
  const y = Number(workYmd.slice(0, 4))
  const m = Number(workYmd.slice(5, 7))
  const d = new Date(Date.UTC(y, m - 1 + monthsAfter, 15))
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

/** The sample firm's matter and the sample lien book share these ids. */
const SAMPLE_LEGAL = {
  matterId: 'sample-legal-matter',
  jobId: 'sample-legal-job',
  gcId: 'sample-legal-gc',
  ownerCustomerId: 'sample-legal-owner',
  propertyId: 'sample-legal-property',
  noticeFilingId: 'sample-legal-notice',
  noticeItemId: 'sample-legal-notice-item',
  owner: 'Alvarado Holdings LLC',
  ownerMailing: 'PO Box 4100, San Marcos, TX 78667',
} as const

/**
 * The sample matter's GC (v2.4638 review): a plausible fictional company, not the other sample
 * surfaces' "Sample Contracting", so the firm's demo reads like a real file. Its office is in Hays
 * County, with the property.
 */
const LEGAL_GC = { company: 'Brazos Ridge Contracting', contact: 'Pat Holloway', email: 'pat.holloway@brazosridge.example.com', phone: '(512) 555-0142', office: '1150 Hunter Rd, Suite 300, San Marcos, TX 78666' } as const

/** The building's record, the job's own property (#85 item 6 reads it from `jobAddresses`). */
const LEGAL_PROPERTY_ROW = { id: 'sample-legal-property', customer_id: 'sample-legal-owner', address: '200 Creekside Pkwy, Suite 200, Kyle, TX 78640', county: 'Hays', legal_description: 'Lot 4, Block B, Creekside Commerce Park, Section 2, Hays County, Texas', property_kind: 'commercial', homestead: false, owner_mode: 'building_owner', owner_name: 'Jordan Reyes', owner_company: 'Alvarado Holdings LLC', owner_mailing_address: 'PO Box 4100, San Marcos, TX 78667', parcel_id: 'R104417', is_primary: true, sequence_order: 0 } as const

/**
 * The one sample matter (v2.3639; one coherent story since v2.4638): the shape `parseLegalPortalPayload`
 * reads and `buildMatterPacket` runs through the desk's own kernel. Click is the plumbing sub on a
 * commercial finish-out; Brazos Ridge Contracting is the GC and the payer; Alvarado Holdings LLC owns the
 * building. Every row has the columns `legal-portal` selects for a real matter, and every date is
 * relative to today, so the story never ages:
 *
 *   work on site from 110 to 66 days ago (four clock sessions, two field reports with GPS) ·
 *   a $4,000 progress bill 100 days ago, a promise 92 days ago, paid by check 84 days ago (kept) ·
 *   the final $14,400 bill 60 days ago, a second promise 50 days ago, missed (broken) ·
 *   the § 53.056 notice to the owner and the GC 40 days ago, covering every work month in time ·
 *   the owner's call 33 days ago: still owes the GC $12,000 and holds the 10% (pile A) ·
 *   a final demand on the GC by certified mail 28 days ago, its deadline passed 18 days ago ·
 *   moved to Collections 21 days ago, referred 6 days ago · the firm's fee, its question and the
 *   office's answer in the last four days. The affidavit window is still open (the Lien grid shows it).
 */
function sampleLegalMatter(todayYmd: string): Record<string, unknown> {
  const d = (n: number) => ymdPlusDays(todayYmd, n)
  const at = (n: number, hhmm = '15:00') => `${d(n)}T${hhmm}:00+00:00`
  const { jobId, gcId, matterId } = SAMPLE_LEGAL
  const workDays = [-110, -96, -82, -66]
  const workMonths = [...new Set(workDays.map((n) => d(n).slice(0, 7)))].sort()
  const invoices = [
    { id: 'sample-legal-inv-1', job_id: jobId, amount: 4_000, status: 'billed', billed_at: at(-100, '16:00'), sent_to_customer_at: at(-100, '16:05'), external_send_channel: 'email', stripe_invoice_status: null, stripe_invoice_id: null, sequence_order: 0, agreed_write_down_at: null, agreed_write_down_note: null, agreed_write_down_previous_amount: null },
    { id: 'sample-legal-inv-2', job_id: jobId, amount: 14_400, status: 'billed', billed_at: at(-60, '16:00'), sent_to_customer_at: at(-60, '16:05'), external_send_channel: 'email', stripe_invoice_status: null, stripe_invoice_id: null, sequence_order: 1, agreed_write_down_at: null, agreed_write_down_note: null, agreed_write_down_previous_amount: null },
  ]
  // The real row's columns (`jobs_ledger_payments`): a dated check with its number.
  const payments = [{ id: 'sample-legal-pay-1', job_id: jobId, invoice_id: 'sample-legal-inv-1', amount: 4_000, paid_on: d(-84), sent_on: d(-86), payment_type: 'check', reference_number: '2291' }]
  const job = {
    id: jobId,
    hcp_number: '1042',
    click_number: null,
    job_name: 'Tenant finish-out — Suite 200',
    job_address: '200 Creekside Pkwy, Suite 200, Kyle, TX 78640',
    // The building's owner is the job's customer; the GC is who hired Click and who pays.
    customer_id: SAMPLE_LEGAL.ownerCustomerId,
    customer_name: SAMPLE_LEGAL.owner,
    customer_email: null,
    customer_phone: null,
    gc_customer_id: gcId,
    customer_address_id: SAMPLE_LEGAL.propertyId,
    revenue: 18_400,
    payments_made: 4_000,
    status: 'billed',
    last_bill_date: d(-60),
    last_work_date: d(-66),
    created_at: at(-125),
    lien_contract_ended_on: null,
    lien_retainage_held: 1_840,
    lien_payment_bond: 'no',
    collections_at: at(-21),
    collections_by: 'sample-office',
    collections_note: 'Paid the first draw on its promise, then missed the second. The GC says the owner has not funded the draw; the owner told us they still hold $12,000 owed to the GC.',
    job_pictures_link: null,
    google_drive_link: null,
    invoices,
    payments,
    gcCustomer: { id: gcId, name: LEGAL_GC.company },
    collections_by_name: 'Taunya',
  }
  const noticeSentOn = d(-40)
  return {
    id: matterId,
    stage: 'referred',
    payer: { key: `c:${gcId}`, name: LEGAL_GC.company, customerId: gcId },
    handling: SAMPLE_FIRM.handling,
    noteToFirm: 'Start with a demand on Brazos Ridge Contracting, the GC. Our § 53.056 notice reached the owner in time, and the owner says it still holds $12,000 owed to the GC plus the 10% retainage. The affidavit window is still open; the Lien grid has the date.',
    releasedAt: d(-6),
    feesToStatement: true,
    sharedOverrides: {},
    jobs: [job],
    customer: { id: gcId, name: LEGAL_GC.company, address: LEGAL_GC.office, contact_info: { email: LEGAL_GC.email, phone: LEGAL_GC.phone }, customer_type: 'commercial', payment_terms: 'standard', payment_terms_note: null },
    contacts: [{ name: LEGAL_GC.contact, email: LEGAL_GC.email, phone: LEGAL_GC.phone, note: 'Project manager' }],
    contactEntries: [
      { id: 'sample-ce-1', ymd: d(-92), method: 'Phone', by: 'Taunya', text: 'Pat said the first draw check goes out by the end of next week.' },
      { id: 'sample-ce-2', ymd: d(-48), method: 'Email', by: 'Taunya', text: 'Statement re-sent with the signed agreement attached. No reply.' },
      { id: 'sample-ce-3', ymd: d(-24), method: 'Site visit', by: 'Malachi', text: 'Suite is open for business. Pat would not give a date.' },
    ],
    // The property record: county, owner of record, legal description and parcel.
    addresses: [{ ...LEGAL_PROPERTY_ROW }],
    // The record the job names and the jobs' owner overrides (#85 item 6's keys; none overrides here).
    jobAddresses: [{ ...LEGAL_PROPERTY_ROW }],
    jobOwners: [],
    contracts: [
      { id: 'sample-legal-contract', job_id: jobId, status: 'signed', revision: 1, recipient_email: LEGAL_GC.email, sent_at: at(-124), last_sent_at: at(-124), view_count: 2, signed_at: at(-122), signer_printed_name: LEGAL_GC.contact, signer_mode: 'type', voided_at: null, signed_document_url: null, recipient_name: LEGAL_GC.contact, signer_consented_at: at(-122), co_signer_name: null, co_signed_at: null, co_signer_printed_name: null, signedPdfUrl: null },
    ],
    signedEstimates: [],
    demandLetters: [
      { id: 'sample-legal-demand', job_id: jobId, amount: 14_400, sent_at: at(-28), sent_method: 'certified_mail', tracking_number: '9407 1118 9956 2310 0028 41', deadline_date: d(-18), recipient_name: LEGAL_GC.company, fields: { feeClockYmd: d(-28), enclosures: [{ label: 'A', kind: 'invoice', title: `Invoice 1042-1, as sent ${d(-100)}`, pages: 1 }, { label: 'A-2', kind: 'invoice', title: `Invoice 1042-2, as sent ${d(-60)}`, pages: 1 }, { label: 'B', kind: 'agreement', title: `Signed agreement, ${d(-122)}`, pages: 3 }] }, voided_at: null, created_at: at(-29) },
    ],
    lienFilings: [
      { id: SAMPLE_LEGAL.noticeFilingId, job_id: jobId, kind: 'notice_53_056', amount: 14_400, months_covered: workMonths, filed_at: null, served_at: null, serve_due: null, county: 'Hays', recording_number: '', sends: [{ recipient: 'owner', method: 'certified_mail', tracking: '9407 1118 9956 2310 0040 17', sent_on: noticeSentOn }, { recipient: 'original_contractor', method: 'certified_mail', tracking: '9407 1118 9956 2310 0041 24', sent_on: noticeSentOn }], document_url: null, packet_id: null, printed_claim: null, by_hand: false, voided_at: null, created_at: at(-40, '14:00') },
    ],
    // The desk item that sent the notice, shaped as the function shapes it: the owner's answers only.
    lienDeskItems: [
      { id: SAMPLE_LEGAL.noticeItemId, job_id: jobId, kind: 'notice_53_056', status: 'sent', sent_at: at(-40), sent_filing_id: SAMPLE_LEGAL.noticeFilingId, created_at: at(-44), voided_at: null, fields: { letterTwo: null, gcAuthorizedDirectPay: null, ownerCall: { at: at(-33, '16:30'), name: 'Taunya', owesGc: 'yes', owesAmount: 12_000, reserved: 'held', originalContractCompletedOn: null, note: 'Jordan Reyes, the owner’s manager, called after the letter.' } } },
    ],
    promises: [
      { id: 'sample-legal-promise-1', jobId, customerId: gcId, promisedYmd: d(-85), saidBy: LEGAL_GC.contact, heardByName: 'Taunya', channel: 'phone', source: 'office', note: 'the first draw', createdAt: at(-92) },
      { id: 'sample-legal-promise-2', jobId, customerId: gcId, promisedYmd: d(-42), saidBy: LEGAL_GC.contact, heardByName: 'Taunya', channel: 'phone', source: 'office', note: 'the final bill', createdAt: at(-50) },
    ],
    // What was billed on the job when each promise was made, and the job's dated payments — the office's own rule.
    promiseRecords: [
      { id: 'sample-legal-promise-1', jobId, customerId: gcId, promisedYmd: d(-85), createdAt: at(-92), source: 'office', billedTotal: 4_000, payments: [{ paidOn: d(-84), amount: 4_000 }] },
      { id: 'sample-legal-promise-2', jobId, customerId: gcId, promisedYmd: d(-42), createdAt: at(-50), source: 'office', billedTotal: 18_400, payments: [{ paidOn: d(-84), amount: 4_000 }] },
    ],
    chaseTouches: [],
    reports: [
      { jobId, createdAt: at(-96), authorName: 'Malachi Whites', templateName: 'Rough-in inspection passed', hasGps: true },
      { jobId, createdAt: at(-66), authorName: 'Malachi Whites', templateName: 'Final walk with the GC’s super', hasGps: true },
    ],
    clockSessions: workDays.map((n) => ({ jobId, workDate: d(n), clockedInAt: at(n, '13:00'), clockedOutAt: at(n, '21:00'), hasGps: true, approved: true, disqualified: false })),
    threadNotes: [{ jobId, body: 'Final walk done with the GC’s super; no punch items.', createdAt: at(-66, '21:30'), authorName: 'Malachi Whites' }],
    entries: [
      { id: 'sample-legal-entry-fee', matter_id: matterId, kind: 'fee', amount: 450, body: 'Demand letter on firm letterhead', occurred_on: d(-4), meta: {}, via_portal: true, created_by: null, acknowledged_at: at(-3), created_at: at(-4) },
      { id: 'sample-legal-entry-q', matter_id: matterId, kind: 'question', amount: null, body: 'Is the owner’s answer about the $12,000 in writing, or only your call notes?', occurred_on: d(-3), meta: {}, via_portal: true, created_by: null, acknowledged_at: at(-2), created_at: at(-3) },
      { id: 'sample-legal-entry-a', matter_id: matterId, kind: 'answer', amount: null, body: 'Call notes only, logged the same afternoon. The owner’s manager agreed to confirm by email; we will forward it here.', occurred_on: d(-2), meta: {}, via_portal: false, created_by: 'sample-office', acknowledged_at: null, created_at: at(-2) },
    ],
  }
}

/**
 * The sample's Lien grid (v2.4638): the book's raw rows for three jobs — the matter's job (every
 * month noticed, the affidavit window open), another GC's job with its next notice inside the desk's
 * 30-day lead, and an original contractor's residential repipe whose affidavit was filed two days ago
 * and must be served. The grid's default view (Something due) is never empty. Deadlines come from the same
 * statutory rule the RPCs use; the rows carry the columns `legal-portal` sends.
 */
function sampleLegalLienBook(todayYmd: string): Record<string, unknown> {
  const d = (n: number) => ymdPlusDays(todayYmd, n)
  const at = (n: number, hhmm = '15:00') => `${d(n)}T${hhmm}:00+00:00`
  const { jobId, gcId } = SAMPLE_LEGAL
  const gc2 = 'sample-book-gc-2'
  const dentalJob = 'sample-book-job-dental'
  const repipeJob = 'sample-book-job-repipe'
  const matterMonths = [...new Set([-110, -96, -82, -66].map((n) => d(n).slice(0, 7)))].sort()
  const monthRow = (job: string, month: string, kind: string, gc: string | null, customer: string, open: number, noticed: boolean, item: string | null) => ({
    job_id: job, work_month: month, approved_hours: 16, deadline: sampleStatutoryFifteenth(`${month}-01`, kind === 'residential' ? 2 : 3), noticed, open_balance: open, customer_id: customer, gc_customer_id: gc, property_kind: kind, has_owner: true, desk_item_id: item, desk_status: item ? 'sent' : null, desk_months: item ? matterMonths : null, month_source: 'hours',
  })
  // Another GC's job with its next notice due inside the desk's 30-day lead: the work month whose deadline is the first one not yet passed.
  const monthStart = (offset: number) => {
    const t = new Date(Date.UTC(Number(todayYmd.slice(0, 4)), Number(todayYmd.slice(5, 7)) - 1 + offset, 10))
    return t.toISOString().slice(0, 10)
  }
  const dentalWork = sampleStatutoryFifteenth(monthStart(-3), 3) >= todayYmd ? monthStart(-3) : monthStart(-2)
  const dentalMonth = dentalWork.slice(0, 7)
  return {
    rows: [
      ...matterMonths.map((m) => monthRow(jobId, m, 'commercial', gcId, SAMPLE_LEGAL.ownerCustomerId, 14_400, true, SAMPLE_LEGAL.noticeItemId)),
      monthRow(dentalJob, dentalMonth, 'commercial', gc2, 'sample-book-owner-2', 6_200, false, null),
    ],
    affidavitRows: [
      { job_id: jobId, last_month: d(-66).slice(0, 7), deadline: sampleStatutoryFifteenth(d(-66), 4), is_sub: true, noticed: true, filed: false, open_balance: 14_400, customer_id: SAMPLE_LEGAL.ownerCustomerId, gc_customer_id: gcId, property_kind: 'commercial', has_owner: true, has_legal: true, homestead: false, desk_item_id: null, desk_status: null, month_source: 'hours' },
      { job_id: repipeJob, last_month: d(-35).slice(0, 7), deadline: sampleStatutoryFifteenth(d(-35), 3), is_sub: false, noticed: false, filed: true, open_balance: 3_850, customer_id: 'sample-book-homeowner', gc_customer_id: null, property_kind: 'residential', has_owner: true, has_legal: false, homestead: false, desk_item_id: null, desk_status: null, month_source: 'hours' },
    ],
    items: [{ id: SAMPLE_LEGAL.noticeItemId, job_id: jobId, kind: 'notice_53_056', status: 'sent', months: matterMonths, sent_at: at(-40), sent_filing_id: SAMPLE_LEGAL.noticeFilingId, hold_until: null, created_at: at(-44), voided_at: null }],
    // The repipe's affidavit, filed two days ago: its copy is due to the owner within five days (§ 53.055).
    filings: [{ id: 'sample-book-affidavit', job_id: repipeJob, kind: 'affidavit', filed_at: d(-2), served_at: null, serve_due: d(3), months_covered: [d(-35).slice(0, 7)], county: 'Hays', amount: 3_850, recording_number: '2026-031417', created_at: at(-2), voided_at: null }],
    jobs: [
      { id: jobId, hcp_number: '1042', click_number: null, job_name: 'Tenant finish-out — Suite 200', job_address: '200 Creekside Pkwy, Suite 200, Kyle, TX 78640', gc_customer_id: gcId, customer_address_id: SAMPLE_LEGAL.propertyId, revenue: 18_400, payments_made: 4_000, last_work_date: d(-66), lien_payment_bond: 'no', lien_contract_ended_on: null },
      { id: dentalJob, hcp_number: '1057', click_number: null, job_name: 'Plum Creek Dental — rough-in', job_address: '18 Windy Hill Rd, Buda, TX 78610', gc_customer_id: gc2, customer_address_id: null, revenue: 6_200, payments_made: 0, last_work_date: dentalWork, lien_payment_bond: 'unknown', lien_contract_ended_on: null },
      { id: repipeJob, hcp_number: '1063', click_number: null, job_name: 'Whitfield residence — repipe', job_address: '7 Willow Ct, San Marcos, TX 78666', gc_customer_id: null, customer_address_id: null, revenue: 3_850, payments_made: 0, last_work_date: d(-35), lien_payment_bond: null, lien_contract_ended_on: null },
    ],
    gcs: [
      { id: gcId, name: LEGAL_GC.company, lien_notice_policy: 'ask' },
      { id: gc2, name: 'Hill Country Builders', lien_notice_policy: 'send' },
    ],
    addresses: [{ ...LEGAL_PROPERTY_ROW }],
    owners: [
      { job_id: dentalJob, owner_mode: 'building_owner', owner_name: null, company_name: 'Plum Creek Dental Properties LLC', mailing_address: '18 Windy Hill Rd, Buda, TX 78610' },
      { job_id: repipeJob, owner_mode: 'homeowner', owner_name: 'Sam Whitfield', company_name: null, mailing_address: '7 Willow Ct, San Marcos, TX 78666' },
    ],
  }
}

/**
 * legal-portal's answer for the sample token (v2.3512; the matter since v2.3639; one story and the
 * Lien grid since v2.4638): the firm, Click's particulars filled with plainly-sample values, the
 * Notifications page with two recipients, the referred matter on the sample GC and the book behind
 * the Lien grid. Every date is relative to today. A real matter never reaches this frame; the firm's
 * page builds the same answer itself for the sample token, so the sample needs no deploy.
 */
export function sampleLegalPortalResponse(company: SamplePortalCompany, todayYmd: string): Record<string, unknown> {
  return {
    company,
    preparedOn: todayYmd,
    firm: { id: SAMPLE_FIRM.id, name: SAMPLE_FIRM.name, handling_name: SAMPLE_FIRM.handling, email: SAMPLE_FIRM.email, phone: SAMPLE_FIRM.phone, contingency_pct: 33, filing_cost: 350, active: true },
    particulars: {
      entity: company.name,
      license: 'Master Plumber M-41207 (sample)',
      agent: 'Lone Star Registered Agents, Inc. · 100 Congress Ave, Austin, TX 78701 (sample)',
      custodian: 'Robin Ortega, office manager (sample)',
      affiant: 'Casey Lindell, owner (sample)',
      phone: company.phone,
      email: company.email,
      w9: 'on request from the office',
    },
    // Who the firm calls (v2.4755): sample people on the letterhead's number, and a sample controller.
    officeContacts: { phone: company.phone, assistants: ['Robin Ortega', 'Dana Whitlock'], controllers: [{ name: 'Morgan Ellis', phone: '(512) 555-0142' }] },
    recipients: SAMPLE_FIRM.recipients.map((r) => ({ id: r.id, name: r.name, email: r.email, role: r.role, mode: r.mode, scope: r.scope, digestWeekday: 1, digestTime: '08:00', confirmed: r.confirmed, paused: false, addedViaPortal: false })),
    firmPaused: false,
    matters: [sampleLegalMatter(todayYmd)],
    lienBook: sampleLegalLienBook(todayYmd),
  }
}
