import { describe, expect, it } from 'vitest'
import {
  buildGcReviewShareAllEmailHtml,
  buildGcReviewShareAllEmailText,
  buildGcStatementEmailHtml,
  buildGcStatementEmailText,
  gcStatementEmailSubject,
} from './gcStatementEmail'
import {
  gcStatementSubject,
  renderGcShareAllHtml,
  renderGcShareAllText,
  renderGcStatementHtml,
  renderGcStatementText,
  type GcStatementPayload,
  type GcStatementPayloadGroup,
} from '../../../supabase/functions/gc-statement-email-dispatch/render'
import type { GcReviewGroup } from '../gcReviewRollup'
import { billPaidByWords } from '../../../supabase/functions/_shared/billPaidBy'

/**
 * Journey-map #46: three lanes build the GC's statement — Draft Message
 * (client HTML + text, also what Copy for email pastes and what Preview
 * shows) and the scheduled dispatcher (render.ts from the RPC payload). Since
 * v2.4255 both call one renderer (`_shared/gcStatementByProperty.ts`); what can
 * still drift is each lane's mapping of its own rows onto it, and the
 * hand-mirrored Share-all table. This test is the seam that keeps them one email.
 */

const DATE = 'Sep 5, 2026'
const PHONE = '(512) 360-0599'
const PORTAL = 'https://my.clickplumbing.com/knight'
const INTRO = 'Hi there — here is where things stand this week.\nThanks for your business.'
const QR = 'cid:portal-qr'

/**
 * The facts, once: the bills and payments each job carries. The server maps them from the
 * payload; the client row carries what the board computed from the same rows.
 */
const j1Bills = [{ id: 'i1', amount: 1450, status: 'billed', sequence_order: 1, billed_at: '2026-07-21' }]
const j1Payments = [{ invoice_id: 'i1', amount: 1000, paid_on: '2026-08-15', payment_type: 'check', reference_number: '4821', sequence_order: 1 }]
const j3Bills = [{ id: 'i3', amount: 4000, status: 'billed', sequence_order: 1, billed_at: '2026-08-30' }]
/** Job 4: a bill with money on the JOB that no bill carries — neither lane may count it toward the bill. */
const j4Bills = [{ id: 'i4', amount: 900, status: 'billed', sequence_order: 1, billed_at: '2026-08-20' }]
const j4Payments = [{ invoice_id: null, amount: 900, paid_on: '2026-01-10', payment_type: 'check', reference_number: '3001', sequence_order: 1 }]
/** Job 5: a job balance with no bill behind it — what the job has been paid is every payment on it. */
const j5Payments = [{ invoice_id: null, amount: 250, paid_on: '2026-08-01', payment_type: 'ach', reference_number: null, sequence_order: 1 }]
const PAID_BY_J1 = billPaidByWords({ bills: j1Bills, payments: j1Payments, retainageHeld: null }, { id: 'i1', amount: 1450 })
const PAID_BY_J3 = billPaidByWords({ bills: j3Bills, payments: [], retainageHeld: null }, { id: 'i3', amount: 4000 })
/** The Share-all table still words a bill by the oldest-bill-first rule (v2.4100) — the client row carries those words. */
const PAID_BY_J4 = billPaidByWords({ bills: j4Bills, payments: j4Payments, retainageHeld: null }, { id: 'i4', amount: 900 })
const PAID_BY_J5 = billPaidByWords({ bills: [], payments: j5Payments, retainageHeld: null }, null)

/** The same jobs in both shapes: address-led, address-less (name leads once), number-less, two spellings of one property, a job balance. */
const clientGroup: GcReviewGroup = {
  key: 'gc-1',
  gcId: 'gc-1',
  gcName: 'Knight & Sons <Contracting>',
  isNoGc: false,
  jobCount: 5,
  subtotal: 7_300,
  oldestAgeDays: 45,
  rows: [
    { key: 'i1', jobId: 'j1', hcp: '916', jobName: 'SVP Manor', jobAddress: '11915 Ring Dr, Manor TX', customerName: 'Knight', referenceDateDisplay: 'Jul 21, 2026', referenceYmd: '2026-07-21', referenceIsEstimate: false, ageDays: 45, remaining: 450, inCollections: false, paidBy: PAID_BY_J1, propertyId: 'prop-ring', billed: 1450, billPayments: j1Payments, retainageHeld: null, unmatchedOnJob: 0 },
    { key: 'j2', jobId: 'j2', hcp: '948', jobName: 'Water Heater', jobAddress: '', customerName: 'Knight', referenceDateDisplay: 'Aug 2, 2026 (est.)', referenceYmd: '2026-08-02', referenceIsEstimate: true, ageDays: 30, remaining: 1_200, inCollections: false },
    { key: 'i3', jobId: 'j3', hcp: '—', jobName: 'Connect sink', jobAddress: '12803 El Dorado, Universal City TX', customerName: 'Knight', referenceDateDisplay: 'Aug 30, 2026', referenceYmd: '2026-08-30', referenceIsEstimate: false, ageDays: 6, remaining: 4_000, inCollections: false, paidBy: PAID_BY_J3, propertyId: null, billed: 4000, billPayments: [], retainageHeld: null, unmatchedOnJob: 0 },
    { key: 'i4', jobId: 'j4', hcp: '951', jobName: 'Knight', jobAddress: '11915 Ring Drive, Manor, TX 78653', customerName: 'Knight', referenceDateDisplay: 'Aug 20, 2026', referenceYmd: '2026-08-20', referenceIsEstimate: false, ageDays: 16, remaining: 900, inCollections: false, paidBy: PAID_BY_J4, propertyId: 'prop-ring', billed: 900, billPayments: [], retainageHeld: null, unmatchedOnJob: 900 },
    { key: 'j5', jobId: 'j5', hcp: '960', jobName: 'Gas test', jobAddress: '12803 El Dorado, Universal City, TX', customerName: 'Knight', referenceDateDisplay: '—', referenceYmd: null, referenceIsEstimate: false, ageDays: null, remaining: 750, inCollections: false, paidBy: PAID_BY_J5, propertyId: null, billed: null, billPayments: j5Payments, retainageHeld: null, unmatchedOnJob: 0 },
  ],
}

const payloadGroup: GcStatementPayloadGroup = {
  entity_id: 'gc-1',
  entity_name: 'Knight & Sons <Contracting>',
  is_no_entity: false,
  job_count: 5,
  subtotal: 7_300,
  oldest_age_days: 45,
  rows: [
    { job_id: 'j1', row_key: 'i1', display_number: '916', job_name: 'SVP Manor', job_address: '11915 Ring Dr, Manor TX', customer_name: 'Knight', ref_date: '2026-07-21', ref_is_estimate: false, age_days: 45, remaining: 450, in_collections: false, invoice_id: 'i1', invoice_amount: 1450, retainage_held: null, job_bills: j1Bills, job_payments: j1Payments },
    { job_id: 'j2', row_key: 'j2', display_number: '948', job_name: 'Water Heater', job_address: null, customer_name: 'Knight', ref_date: '2026-08-02', ref_is_estimate: true, age_days: 30, remaining: 1_200, in_collections: false },
    { job_id: 'j3', row_key: 'i3', display_number: null, job_name: 'Connect sink', job_address: '12803 El Dorado, Universal City TX', customer_name: 'Knight', ref_date: '2026-08-30', ref_is_estimate: false, age_days: 6, remaining: 4_000, in_collections: false, invoice_id: 'i3', invoice_amount: 4000, retainage_held: null, job_bills: j3Bills, job_payments: [] },
    { job_id: 'j4', row_key: 'i4', display_number: '951', job_name: 'Knight', job_address: '11915 Ring Drive, Manor, TX 78653', customer_name: 'Knight', ref_date: '2026-08-20', ref_is_estimate: false, age_days: 16, remaining: 900, in_collections: false, invoice_id: 'i4', invoice_amount: 900, retainage_held: null, job_bills: j4Bills, job_payments: j4Payments },
    { job_id: 'j5', row_key: 'j5', display_number: '960', job_name: 'Gas test', job_address: '12803 El Dorado, Universal City, TX', customer_name: 'Knight', ref_date: null, ref_is_estimate: false, age_days: null, remaining: 750, in_collections: false, invoice_id: null, invoice_amount: null, retainage_held: null, job_bills: [], job_payments: j5Payments },
  ],
}
/** What the dispatcher reads beside the payload: each job's property record. */
const PROPERTY_BY_JOB = { j1: 'prop-ring', j2: null, j3: null, j4: 'prop-ring', j5: null }
/** "Payments we have received" (v2.4260): the block is built once from the checks and handed to both lanes. */
const RECEIVED = [{ key: 'ref:4821|2026-08-15', onYmd: '2026-08-15', label: 'Check #4821', amount: 1000, where: ['11915 Ring Dr · Job 916'] }]
const RECEIVED_SINCE = '2026-08-06'
const EXTRAS = { propertyIdByJob: PROPERTY_BY_JOB, qrImgSrc: QR, received: RECEIVED, receivedSinceYmd: RECEIVED_SINCE }

const PAY_LINK_HTML = '<a href="https://my.clickplumbing.com/knight?src=gc-statement" style="color: #b0662f; font-weight: 600; text-decoration: none;">my.clickplumbing.com/knight</a>'
const PAY_LINE_TEXT = 'Pay online any time at https://my.clickplumbing.com/knight?src=gc-statement — this statement stays current there.'

describe('GC statement — the client builders and the dispatcher render the same email', () => {
  it('HTML: Draft Message == scheduled dispatcher — intro, portal, QR code, phone, property records', () => {
    const client = buildGcStatementEmailHtml(clientGroup, { dateStr: DATE, officePhone: PHONE, portalUrl: PORTAL, introText: INTRO, qrImgSrc: QR, received: RECEIVED, receivedSinceYmd: RECEIVED_SINCE })
    const server = renderGcStatementHtml(payloadGroup, DATE, PHONE, PORTAL, INTRO, EXTRAS)
    expect(client).toBe(server)
    expect(client).toContain('Check #4821<span style="color:#5b6676"> to 11915 Ring Dr · Job 916</span>')
  })

  it('text: the plain-text twins match too', () => {
    const client = buildGcStatementEmailText(clientGroup, { dateStr: DATE, officePhone: PHONE, portalUrl: PORTAL, introText: INTRO, received: RECEIVED, receivedSinceYmd: RECEIVED_SINCE })
    const server = renderGcStatementText(payloadGroup, DATE, PHONE, PORTAL, INTRO, EXTRAS)
    expect(client).toBe(server)
    expect(client).toContain('- Aug 15 — Check #4821 to 11915 Ring Dr · Job 916 — $1,000.00')
  })

  it('without intro, portal or code (the personal Copy lane) they still match', () => {
    expect(buildGcStatementEmailHtml(clientGroup, { dateStr: DATE, officePhone: null })).toBe(renderGcStatementHtml(payloadGroup, DATE, null, null, null, { propertyIdByJob: PROPERTY_BY_JOB }))
    expect(buildGcStatementEmailText(clientGroup, { dateStr: DATE })).toBe(renderGcStatementText(payloadGroup, DATE, null, null, null, { propertyIdByJob: PROPERTY_BY_JOB }))
  })

  it('subjects agree', () => {
    expect(gcStatementEmailSubject(clientGroup, DATE)).toBe(gcStatementSubject(DATE))
  })

  it('every lane carries exactly one pay link, tagged for attribution, and it is the same link', () => {
    const html = buildGcStatementEmailHtml(clientGroup, { dateStr: DATE, portalUrl: PORTAL })
    const text = buildGcStatementEmailText(clientGroup, { dateStr: DATE, portalUrl: PORTAL })
    const serverHtml = renderGcStatementHtml(payloadGroup, DATE, null, PORTAL, null, { propertyIdByJob: PROPERTY_BY_JOB })
    const serverText = renderGcStatementText(payloadGroup, DATE, null, PORTAL, null, { propertyIdByJob: PROPERTY_BY_JOB })
    for (const h of [html, serverHtml]) {
      expect(h.split(PAY_LINK_HTML).length - 1).toBe(1)
      expect(h).toContain('Pay online and see every open bill and payment, with no login.')
    }
    for (const t of [text, serverText]) {
      expect(t.split(PAY_LINE_TEXT).length - 1).toBe(1)
    }
    // A token-style portal URL keeps its own query and appends the tag.
    const tokenHtml = buildGcStatementEmailHtml(clientGroup, { dateStr: DATE, portalUrl: 'https://pipetooling.com/portal?t=abc' })
    expect(tokenHtml).toContain('href="https://pipetooling.com/portal?t=abc&amp;src=gc-statement"')
    expect(tokenHtml).toContain('>Open your statement</a>')
  })

  it('no portal → no pay line anywhere; the footer still says how to reach the office', () => {
    for (const body of [
      buildGcStatementEmailHtml(clientGroup, { dateStr: DATE, officePhone: PHONE }),
      buildGcStatementEmailText(clientGroup, { dateStr: DATE, officePhone: PHONE }),
      renderGcStatementHtml(payloadGroup, DATE, PHONE, null),
      renderGcStatementText(payloadGroup, DATE, PHONE, null),
    ]) {
      expect(body).not.toContain('Pay online')
      expect(body).toContain('call the office at')
    }
  })

  it('one block per property, in both lanes: the property record joins two spellings, the cleaned address joins two jobs', () => {
    for (const body of [buildGcStatementEmailText(clientGroup, { dateStr: DATE }), renderGcStatementText(payloadGroup, DATE, null, null, null, { propertyIdByJob: PROPERTY_BY_JOB })]) {
      expect(body).toContain(
        [
          'Owed now: $7,300.00',
          '5 open bills at 3 properties. $8,550.00 billed, $1,250.00 paid so far.',
          '',
          // "Ring Dr" and "Ring Drive" are one property record; the heading is the spelling used most, first seen on a tie.
          '11915 Ring Dr, Manor — $1,350.00',
          '- Job 916 · SVP Manor — sent Jul 21 — $450.00 ($1,000.00 paid by #4821 on Aug 15, of $1,450.00 billed)',
          // Job 951's name is only the customer's; its $900 sits on the job, not the bill — the bill reads owed in full.
          '- Job 951 — sent Aug 20 — $900.00',
          '',
          '12803 El Dorado, Universal City — $4,750.00',
          '- Connect sink — sent Aug 30 — $4,000.00',
          '- Job 960 · Gas test — sent — — $750.00 ($250.00 paid by ACH on Aug 1, of $1,000.00 billed)',
          '',
          'Water Heater — $1,200.00',
          '- Job 948 — sent Aug 2 (est.) — $1,200.00',
          '',
          'Total owed: $7,300.00',
        ].join('\n'),
      )
    }
  })

  it('an address-less job prints its name once (J20-F8), and a number-less row never prints "Job —"', () => {
    for (const body of [buildGcStatementEmailHtml(clientGroup, { dateStr: DATE }), renderGcStatementHtml(payloadGroup, DATE, null, null, null, { propertyIdByJob: PROPERTY_BY_JOB })]) {
      expect(body.split('Water Heater').length - 1).toBe(1)
      expect(body).toContain('<strong>Water Heater</strong>')
      expect(body).not.toContain('Job —')
    }
  })

  it('without the property records the dispatcher still groups by cleaned address', () => {
    const text = renderGcStatementText(payloadGroup, DATE)
    // "Ring Dr" and "Ring Drive" are two addresses until a property record says otherwise.
    expect(text).toContain('4 properties.')
    expect(text).toContain('12803 El Dorado, Universal City — $4,750.00')
  })

  it('a payload from before the bill and its payments rode along words no payment', () => {
    const bare: GcStatementPayloadGroup = { ...payloadGroup, rows: payloadGroup.rows.map((r) => ({ job_id: r.job_id, display_number: r.display_number, job_name: r.job_name, job_address: r.job_address, customer_name: r.customer_name, ref_date: r.ref_date, ref_is_estimate: r.ref_is_estimate, age_days: r.age_days, remaining: r.remaining, in_collections: r.in_collections })) }
    const text = renderGcStatementText(bare, DATE)
    expect(text).not.toContain('paid')
    expect(text).toContain('Total owed: $7,300.00')
  })

  it('the intro sits inside the statement, escaped, with line breaks', () => {
    const html = buildGcStatementEmailHtml(clientGroup, { dateStr: DATE, introText: 'Line <one>\nLine two' })
    expect(html).toContain('max-width:560px;color:#16283c">\n  <p style="margin:0 0 12px;font-size:14px;color:#111827;line-height:1.45">Line &lt;one&gt;<br>Line two</p>')
    const text = buildGcStatementEmailText(clientGroup, { dateStr: DATE, introText: ' Line one ' })
    expect(text.startsWith('Line one\n\nClick Plumbing and Electrical\n')).toBe(true)
    // Blank intro → no paragraph at all.
    expect(buildGcStatementEmailHtml(clientGroup, { dateStr: DATE, introText: '  ' })).toBe(buildGcStatementEmailHtml(clientGroup, { dateStr: DATE }))
  })

  it('whole-report (Share all) twins match as well', () => {
    const payload: GcStatementPayload = { generated_at: '2026-09-05T12:00:00Z', group_by: 'gc', include_collections: true, grand_total: 7_300, groups: [payloadGroup] }
    const report = { groups: [clientGroup], grandTotal: 7_300 }
    expect(buildGcReviewShareAllEmailHtml(report, { dateStr: DATE, groupBy: 'gc', officePhone: PHONE, introText: INTRO })).toBe(renderGcShareAllHtml(payload, DATE, PHONE, INTRO))
    expect(buildGcReviewShareAllEmailText(report, { dateStr: DATE, groupBy: 'gc', officePhone: PHONE, introText: INTRO })).toBe(renderGcShareAllText(payload, DATE, PHONE, INTRO))
  })
})
