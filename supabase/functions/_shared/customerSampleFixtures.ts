/**
 * The sample responses the public fetch functions return for the sample token (What customers
 * see, Settings dev tab). Each one lays the live Settings over `customerSample.ts` so the page
 * renders exactly what a real customer would get with today's copy, terms, footer and brand.
 */
import { roomCounts, type RoomRow, type SubmittalRoomPayload } from './submittalRoomPayload.ts'
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
export function sampleCustomerPortalResponse(company: SamplePortalCompany, state: SampleState, todayYmd: string, appOrigin: string): Record<string, unknown> {
  const gc = state === 'gc'
  const payUrl = `${appOrigin.replace(/\/$/, '')}/portal?t=${SAMPLE_TOKEN}#pay`
  const openBill = {
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
    },
    issuer: { companyName: company.name, addressText: '', phone: company.phone, email: company.email, tagline: company.cityLine, licenseLine: company.licenseLine },
    brand: 'plum',
  }
}

/**
 * get-submittal-room's answer for the sample tokens (v2.3511): the Cedar Bend bid's product
 * decisions as the GC's architect reads them. `live` is open with two rows waiting on a call;
 * `done` is the same room after Alex Sample sent the review. No row, no view stamp, no event.
 */
export function sampleSubmittalRoomResponse(state: SampleState, company: SamplePortalCompany, todayYmd: string): SubmittalRoomPayload {
  const done = state === 'done'
  const decidedAt = `${todayYmd}T15:10:00.000Z`
  const by = { byName: 'Alex Sample', byPersonId: 'sample-person', at: decidedAt }
  const rows: RoomRow[] = [
    { id: 'sample-row-wc', tag: 'WC-1', kind: 'differs', plans: 'TOTO CT708UVG · wall-hung, 1.28 gpf', proposed: 'TOTO CT728CUVG#01', why: 'The specified product has a long lead time · about 6 weeks · this one is in stock.', performanceChange: false, sheetPages: 2, decision: done ? { kind: 'approved', note: null, ...by } : null },
    { id: 'sample-row-wh', tag: 'WH-1', kind: 'differs', plans: 'A.O. Smith BTH-120 · 120 gal, 199,000 BTU', proposed: 'Bradford White eF100T199 · 100 gal, 199,000 BTU', why: 'A performance value differs from the plans · the specified product is discontinued.', performanceChange: true, sheetPages: 3, decision: done ? { kind: 'revise', note: 'Keep 120 gal — confirm with the engineer.', ...by } : null },
    { id: 'sample-row-tp', tag: 'TP-1', kind: 'added', plans: '', proposed: 'PPP PR-500 trap primer', why: 'Required by the fixture; the plans leave it to the contractor.', performanceChange: false, sheetPages: 1, decision: null },
    { id: 'sample-row-lav', tag: 'L-1', kind: 'matches', plans: 'Kohler K-2210 Caxton · undermount', proposed: 'Kohler K-2210 Caxton', why: '', performanceChange: false, sheetPages: 1, decision: null },
    { id: 'sample-row-mb', tag: 'MB-1', kind: 'not_quoted', plans: 'Elkay LZSTL8WSLK · bottle filler', proposed: '', why: 'Not in our scope — by others.', performanceChange: false, sheetPages: 0, decision: null },
  ]
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

/** The one sample matter (v2.3639): the shape `parseLegalPortalPayload` reads and `buildMatterPacket` runs through the desk's own kernel. */
function sampleLegalMatter(todayYmd: string): Record<string, unknown> {
  const d = (n: number) => ymdPlusDays(todayYmd, n)
  const at = (n: number, hhmm = '15:00') => `${d(n)}T${hhmm}:00Z`
  const jobId = 'sample-legal-job'
  const customerId = 'sample-legal-gc'
  const job = {
    id: jobId,
    hcp_number: '1042',
    click_number: null,
    job_name: 'Tenant finish-out — Suite 200',
    job_address: '200 Sample Pkwy, Suite 200, Kyle, TX 78640',
    status: 'billed',
    revenue: 18_400,
    payments_made: 4_000,
    pct_complete: 100,
    customer_id: customerId,
    customer_name: SAMPLE_GC.company,
    customer_email: SAMPLE_GC.email,
    customer_phone: '(512) 555-0142',
    gc_customer_id: null,
    master_user_id: 'sample-master',
    project_id: null,
    project: null,
    bid_id: null,
    google_drive_link: null,
    job_plans_link: null,
    job_pictures_link: null,
    collections_at: at(-21),
    collections_by: 'sample-office',
    collections_by_name: 'Taunya',
    collections_note: 'Two promises missed; the GC says the owner has not funded the draw.',
    fixtures: [],
    materials: [],
    team_members: [],
    payments: [{ id: 'sample-legal-pay-1', job_id: jobId, amount: 4_000, payment_date: d(-95), payment_type: 'check', reference: '2291', memo: 'Partial — first draw', invoice_id: 'sample-legal-inv-1', sequence_order: 0, created_at: at(-95) }],
    invoices: [
      { id: 'sample-legal-inv-1', job_id: jobId, amount: 18_400, sequence_order: 0, status: 'billed', estimated_bill_date: null, billed_at: at(-124, '12:00'), external_send_channel: 'email', stripe_invoice_id: null, stripe_invoice_status: null, sent_to_customer_at: at(-124, '12:05'), is_primary_rtb_bundle: false, created_at: at(-124, '12:00') },
    ],
    created_at: at(-170),
    updated_at: at(-21),
  }
  return {
    id: 'sample-legal-matter',
    stage: 'referred',
    payer: { key: `c:${customerId}`, name: SAMPLE_GC.company, customerId },
    handling: SAMPLE_FIRM.handling,
    noteToFirm: 'Start with a demand on the GC. The owner paid the GC in full in June — we have that in writing from the owner’s rep.',
    releasedAt: d(-6),
    feesToStatement: true,
    sharedOverrides: {},
    jobs: [job],
    customer: { id: customerId, name: SAMPLE_GC.company, address: '410 Sample Commerce Dr, Austin, TX 78744', contact_info: { email: SAMPLE_GC.email, phone: '(512) 555-0142' }, customer_type: 'commercial', payment_terms: 'standard', payment_terms_note: null },
    contacts: [{ id: 'sample-legal-contact', name: SAMPLE_GC.contact, email: SAMPLE_GC.email, phone: '(512) 555-0142', role: 'Project manager', is_primary: true }],
    contactEntries: [
      { id: 'sample-ce-1', ymd: d(-88), method: 'Phone', by: 'Taunya', text: 'Pat said the balance goes out with the owner’s next draw.' },
      { id: 'sample-ce-2', ymd: d(-52), method: 'Email', by: 'Taunya', text: 'Statement re-sent with the signed agreement attached. No reply.' },
      { id: 'sample-ce-3', ymd: d(-24), method: 'Site visit', by: 'Malachi', text: 'Space is open for business. Pat would not give a date.' },
    ],
    addresses: [],
    contracts: [
      { id: 'sample-legal-contract', job_id: jobId, status: 'signed', revision: 1, recipient_email: SAMPLE_GC.email, sent_at: at(-168), last_sent_at: at(-168), view_count: 2, signed_at: at(-166), signer_printed_name: SAMPLE_GC.contact, signer_mode: 'type', voided_at: null, signed_document_url: null, signedPdfUrl: null },
    ],
    signedEstimates: [],
    demandLetters: [],
    lienFilings: [],
    promises: [{ id: 'sample-legal-promise', jobId, customerId, promisedYmd: d(-60), saidBy: SAMPLE_GC.contact, heardByName: 'Taunya', channel: 'phone', source: 'office', note: null, createdAt: at(-88) }],
    promiseRecords: [{ id: 'sample-legal-promise', jobId, customerId, promisedYmd: d(-60), createdAt: at(-88), source: 'office', billedTotal: 18_400, payments: [] }],
    chaseTouches: [],
    reports: [{ jobId, createdAt: at(-128), authorName: 'Malachi Whites', templateName: 'Top-out inspection passed', hasGps: true }],
    clockSessions: [
      { jobId, workDate: d(-140), clockedInAt: at(-140, '13:00'), clockedOutAt: at(-140, '21:30'), hasGps: true, approved: true, disqualified: false },
      { jobId, workDate: d(-129), clockedInAt: at(-129, '13:00'), clockedOutAt: at(-129, '20:00'), hasGps: true, approved: true, disqualified: false },
    ],
    threadNotes: [{ jobId, body: 'Final walk done with the GC’s super — no punch items.', createdAt: at(-127), authorName: 'Malachi Whites' }],
    entries: [{ id: 'sample-legal-entry-1', matter_id: 'sample-legal-matter', kind: 'fee', amount: 450, body: 'Demand letter drafted and sent', occurred_on: d(-4), meta: {}, via_portal: true, created_by: null, acknowledged_at: null, created_at: at(-4) }],
  }
}

/**
 * legal-portal's answer for the sample token (v2.3512; the matter since v2.3639): the firm, the
 * company particulars, the Notifications page with two recipients, and one referred matter on the
 * sample GC — a signed agreement, a bill four months old with one partial payment, a broken
 * promise, the office's calls, field evidence with GPS and a test report, and the firm's own fee
 * entry. Every date is relative to today, so the sample never ages out of its story. A real
 * matter never reaches this frame.
 */
export function sampleLegalPortalResponse(company: SamplePortalCompany, todayYmd: string): Record<string, unknown> {
  return {
    company,
    preparedOn: todayYmd,
    firm: { id: SAMPLE_FIRM.id, name: SAMPLE_FIRM.name, handling_name: SAMPLE_FIRM.handling, email: SAMPLE_FIRM.email, phone: SAMPLE_FIRM.phone, contingency_pct: 33, filing_cost: 350, active: true },
    particulars: { entity: company.name, phone: company.phone, email: company.email },
    recipients: SAMPLE_FIRM.recipients.map((r) => ({ id: r.id, name: r.name, email: r.email, role: r.role, mode: r.mode, scope: r.scope, digestWeekday: 1, digestTime: '08:00', confirmed: r.confirmed, paused: false, addedViaPortal: false })),
    firmPaused: false,
    matters: [sampleLegalMatter(todayYmd)],
  }
}
