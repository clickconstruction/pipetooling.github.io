/**
 * The legal portal's sample response (What customers see, Settings dev tab): the firm, one referred matter and the
 * lien book, laid over the letterhead the caller passes. Moved verbatim out of `customerSampleFixtures.ts` (v2.7135)
 * so `legal-portal` no longer uploads that file's import graph (the GC kernels copy and the generated types, about
 * 4 MB) to serve one sample. `customerSampleFixtures.ts` re-exports everything here, so its importers are unchanged.
 */
import { ymdPlusDays } from './customerSample.ts'

export type SamplePortalCompany = { name: string; cityLine: string; licenseLine: string; phone: string; email: string }

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
const LEGAL_PROPERTY_ROW = { id: 'sample-legal-property', customer_id: 'sample-legal-owner', address: '200 Creekside Pkwy, Suite 200, Kyle, TX 78640', county: 'Hays', legal_description: 'Lot 4, Block B, Creekside Commerce Park, Section 2, Hays County, Texas', property_kind: 'non_residential', homestead: false, owner_mode: 'building_owner', owner_name: 'Jordan Reyes', owner_company: 'Alvarado Holdings LLC', owner_mailing_address: 'PO Box 4100, San Marcos, TX 78667', parcel_id: 'R104417', is_primary: true, sequence_order: 0, jp_precinct: '2', jp_precinct_note: '' } as const

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
    // The office's account for the firm (v2.4812): the sample's own story, in the four parts counsel reads first.
    narrative: {
      markdown: [
        '## The parties',
        '',
        'Click was the plumbing sub to **Brazos Ridge Contracting** on the tenant finish-out at 200 Creekside Pkwy, Suite 200, Kyle. The owner of record is Alvarado Holdings LLC. Pat Holloway is the GC’s project manager.',
        '',
        '## What happened',
        '',
        `**${d(-110)} to ${d(-66)}** — rough-in and trim over four days on site, each with GPS. Two bills: the first draw was paid by check, the second is open.`,
        '',
        '**After the second bill** — Pat promised payment twice. The first promise was kept, the second was not. Our § 53.056 notice reached the owner in time, and the owner says it still holds $12,000 owed to the GC plus the 10% retainage.',
        '',
        '## What they say, what the record shows',
        '',
        '| They say | The record |',
        '|---|---|',
        '| The second bill is not due yet | It went out on the GC’s own terms, and the final demand date has passed |',
        '| The work is not finished | The final walk with the GC’s super found no punch items |',
        '',
        '## Still missing',
        '',
        'A signed change order for the extra fixtures. The superintendent approved them on site.',
      ].join('\n'),
      updatedOn: d(-6),
      updatedByName: 'Robin Ortega',
    },
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
    // Documents from the office (v2.4810): the sample carries two, without links (nothing is stored for the sample), and one held.
    documents: [
      { id: 'sample-legal-doc-1', title: 'Billing report', shows: 'The office’s itemization of both bills: days on site, hours, fixtures and the contractor discount.', mime: 'application/pdf', sizeBytes: 64_075, addedOn: d(-7), addedByName: 'Robin Ortega', url: '' },
      { id: 'sample-legal-doc-2', title: 'Emails with the GC’s project manager', shows: 'The first draw promised, the second bill acknowledged, then no answer after the demand.', mime: 'application/pdf', sizeBytes: 210_400, addedOn: d(-7), addedByName: 'Robin Ortega', url: '' },
    ],
    heldDocumentCount: 1,
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
    job_id: job, work_month: month, approved_hours: 16, deadline: sampleStatutoryFifteenth(`${month}-01`, kind === 'non_residential' ? 3 : 2), noticed, open_balance: open, customer_id: customer, gc_customer_id: gc, property_kind: kind, has_owner: true, desk_item_id: item, desk_status: item ? 'sent' : null, desk_months: item ? matterMonths : null, month_source: 'hours',
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
      ...matterMonths.map((m) => monthRow(jobId, m, 'non_residential', gcId, SAMPLE_LEGAL.ownerCustomerId, 14_400, true, SAMPLE_LEGAL.noticeItemId)),
      monthRow(dentalJob, dentalMonth, 'non_residential', gc2, 'sample-book-owner-2', 6_200, false, null),
    ],
    affidavitRows: [
      { job_id: jobId, last_month: d(-66).slice(0, 7), deadline: sampleStatutoryFifteenth(d(-66), 4), is_sub: true, noticed: true, filed: false, open_balance: 14_400, customer_id: SAMPLE_LEGAL.ownerCustomerId, gc_customer_id: gcId, property_kind: 'non_residential', has_owner: true, has_legal: true, homestead: false, desk_item_id: null, desk_status: null, month_source: 'hours' },
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
    // Start here's answers (v2.4821): the sample shows the step; the sample portal saves nothing.
    intake: { answers: {}, sentAt: null, sentBy: '' },
    officeContacts: { phone: company.phone, assistants: ['Robin Ortega', 'Dana Whitlock'], controllers: [{ name: 'Morgan Ellis', phone: '(512) 555-0142' }] },
    recipients: SAMPLE_FIRM.recipients.map((r) => ({ id: r.id, name: r.name, email: r.email, role: r.role, mode: r.mode, scope: r.scope, digestWeekday: 1, digestTime: '08:00', confirmed: r.confirmed, paused: false, addedViaPortal: false })),
    firmPaused: false,
    matters: [sampleLegalMatter(todayYmd)],
    lienBook: sampleLegalLienBook(todayYmd),
  }
}
