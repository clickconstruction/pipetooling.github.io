/**
 * The sample responses the public fetch functions return for the sample token (What customers
 * see, Settings dev tab). Each one lays the live Settings over `customerSample.ts` so the page
 * renders exactly what a real customer would get with today's copy, terms, footer and brand.
 */
import { SAMPLE_BID, SAMPLE_CHANGE_ORDER, SAMPLE_CONTRACT, SAMPLE_ESTIMATE, SAMPLE_GC, SAMPLE_HOMEOWNER, SAMPLE_SUB, SAMPLE_TOKEN, ymdPlusDays, type SampleState } from './customerSample.ts'
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
    ownerName: gc ? 'Hunter Road Partners' : null,
    payments: [{ date: ymdPlusDays(todayYmd, -31), method: gc ? 'check' : 'card', amount: gc ? 9_640 : 640 }],
    totalPaid: gc ? 9_640 : 640,
  }
  return {
    company,
    customerName: gc ? SAMPLE_GC.company : SAMPLE_HOMEOWNER.name,
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
        payHoldReason: 'Final walk-through scheduled — we pay you as soon as the work is accepted.',
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
