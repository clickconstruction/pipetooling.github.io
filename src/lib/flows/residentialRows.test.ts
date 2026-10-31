import { describe, expect, it } from 'vitest'
import type { ContactRow } from './load'
import { NO_PIPELINE_ROWS, PIPELINE_SELECTS, pipelineJobNames, residentialRowsOf, type PipelineRows } from './residentialRows'

const DANA: ContactRow = { id: 'c-dana', kind: 'residential', off_since: null, off_why: null, off_by: null }

/** Dana's water heater job and Evan's sink, read at once, with a third job the office tied to Dana that she is not the customer on. */
const ROWS: PipelineRows = {
  ...NO_PIPELINE_ROWS,
  jobs: [
    { id: 'job-1312', created_at: '2026-10-03T13:00:00Z', status: 'billed', revenue: 1850, customer_id: 'cust-dana', gc_customer_id: null, bill_to_party: 'customer', customer_name: 'Dana Whitfield', job_name: ' the water heater ' },
    { id: 'job-2000', created_at: '2026-10-04T13:00:00Z', status: 'billed', revenue: 1200, customer_id: 'cust-evan', gc_customer_id: null, bill_to_party: 'customer', customer_name: 'Evan Ortiz', job_name: 'the kitchen sink' },
    { id: 'job-1101', created_at: '2026-09-01T13:00:00Z', status: 'paid', revenue: 400, customer_id: 'cust-landlord', gc_customer_id: null, bill_to_party: 'customer', customer_name: 'Oakridge LLC', job_name: null },
  ],
  contactJobs: [
    { contact_id: 'c-dana', jobs_ledger_id: 'job-1312', is_default: true },
    { contact_id: 'c-dana', jobs_ledger_id: 'job-1101', is_default: false },
    { contact_id: 'c-evan', jobs_ledger_id: 'job-2000', is_default: true },
  ],
  blocks: [
    { job_id: 'job-1312', work_date: '2026-10-05', created_at: '2026-10-03T13:10:00Z', created_by: 'u-rosa' },
    { job_id: 'job-2000', work_date: '2026-10-06', created_at: '2026-10-04T13:10:00Z', created_by: 'u-rosa' },
  ],
  clockSessions: [{ job_ledger_id: 'job-1312', user_id: 'u-luis', clocked_in_at: '2026-10-05T14:35:00Z', revoked_at: null, rejected_at: null }],
  reports: [{ job_ledger_id: 'job-2000', created_by_user_id: 'u-luis', created_at: '2026-10-06T16:00:00Z', field_values: { 'What did you find?': 'A clogged trap.' } }],
  estimates: [{ job_ledger_id: 'job-1312', doc_kind: 'estimate', status: 'customer_accepted', sent_at: '2026-10-05T18:00:00Z', acceptor_consented_at: '2026-10-06T13:00:00Z' }],
  statusEvents: [
    { job_id: 'job-1312', to_status: 'working', changed_at: '2026-10-07T13:00:00Z', changed_by_user_id: 'u-rosa' },
    { job_id: 'job-1101', to_status: 'paid', changed_at: '2026-09-20T13:00:00Z', changed_by_user_id: 'u-rosa' },
  ],
  invoices: [
    { id: 'inv-1312', job_id: 'job-1312', status: 'billed', amount: 1850, sequence_order: 1, billed_at: '2026-10-09T15:00:00Z', sent_to_customer_at: null, estimated_bill_date: null, created_at: '2026-10-08T22:00:00Z', sent_by_user_id: 'u-rosa', bill_to_party: null, bill_to_email: null },
    { id: 'inv-2000', job_id: 'job-2000', status: 'billed', amount: 1200, sequence_order: 1, billed_at: '2026-10-09T15:00:00Z', sent_to_customer_at: null, estimated_bill_date: null, created_at: '2026-10-08T22:00:00Z', sent_by_user_id: 'u-rosa', bill_to_party: null, bill_to_email: null },
  ],
  // Evan's payment would cover Dana's bill if it leaked across.
  payments: [{ job_id: 'job-2000', invoice_id: null, amount: 1850, paid_on: '2026-10-11', sequence_order: null }],
  texts: [
    { contact_id: 'c-dana', jobs_ledger_id: 'job-1312', channel: 'text', direction: 'out', at: '2026-10-05T14:02:00Z', body: 'Dana, this is Luis with Click Plumbing. We are on our way.', who_user_id: 'u-luis', who_text: '' },
    { contact_id: 'c-evan', jobs_ledger_id: 'job-2000', channel: 'text', direction: 'out', at: '2026-10-06T14:02:00Z', body: 'Evan, this is Luis with Click Plumbing. We are on our way.', who_user_id: 'u-luis', who_text: '' },
  ],
  // The two RPCs as they answer: jsonb, which the loader's parsers read.
  paySpeeds: { company: { medianDays: 21, samples: 40 }, customers: { 'cust-dana': { medianDays: 9, samples: 2 } }, segments: { residential: null, commercial: null }, customerTypes: {}, receipts: {} },
  promisedPay: { 'job-1312': { promisedYmd: '2026-10-20', markedByName: 'Rosa', source: 'office' }, 'job-2000': { promisedYmd: 'soon', markedByName: 'Rosa' } },
}

describe('residentialRowsOf: one customer’s Pipeline rows out of everyone’s', () => {
  const dana = residentialRowsOf(ROWS, { contact: DANA, firstName: 'Dana', customerId: 'cust-dana', userNames: { 'u-luis': 'Luis' }, skips: [{ step_key: 'found', project_id: null, jobs_ledger_id: 'job-1312', why: 'No report on a quick fix.', by_name: 'Rosa', created_at: '2026-10-05T17:00:00Z', undone_at: null }] })

  it('keeps the jobs she is the customer on and the one the office tied to her, and everything on them', () => {
    expect(dana.jobs.map((j) => j.id)).toEqual(['job-1312', 'job-1101'])
    expect(dana.contactJobs).toEqual([
      { jobs_ledger_id: 'job-1312', is_default: true },
      { jobs_ledger_id: 'job-1101', is_default: false },
    ])
    expect(dana.blocks?.map((b) => b.job_id)).toEqual(['job-1312'])
    expect(dana.clockSessions).toHaveLength(1)
    expect(dana.reports).toEqual([])
    expect(dana.estimates).toHaveLength(1)
    expect(dana.statusEvents?.map((e) => e.job_id)).toEqual(['job-1312', 'job-1101'])
    expect(dana.invoices?.map((i) => i.id)).toEqual(['inv-1312'])
    // Evan's money never pays her bill.
    expect(dana.payments).toEqual([])
    expect(dana.messages?.map((m) => m.body.split(',')[0])).toEqual(['Dana'])
    expect([dana.contact, dana.firstName, dana.userNames]).toEqual([DANA, 'Dana', { 'u-luis': 'Luis' }])
  })

  it('maps flow_rows’ skips to the loader’s, on the Pipeline job', () => {
    expect(dana.skips).toEqual([{ step_key: 'found', jobs_ledger_id: 'job-1312', why: 'No report on a quick fix.', by_name: 'Rosa', created_at: '2026-10-05T17:00:00Z', undone_at: null }])
    expect(residentialRowsOf(ROWS, { contact: DANA, firstName: 'Dana', customerId: 'cust-dana' }).skips).toEqual([])
  })

  it('parses the two RPCs as the Stages tab does: her pace, and only a promise with a real day', () => {
    expect(dana.paySpeeds?.customers).toEqual({ 'cust-dana': { medianDays: 9, samples: 2 } })
    expect(dana.promisedPay).toEqual({ 'job-1312': { promisedYmd: '2026-10-20', markedByName: 'Rosa' } })
    const none = residentialRowsOf({ ...ROWS, paySpeeds: null, promisedPay: null }, { contact: DANA, firstName: 'Dana', customerId: 'cust-dana' })
    expect([none.paySpeeds, none.promisedPay]).toEqual([null, undefined])
  })

  it('leaves a contact with no customer record the jobs the office tied to them alone, and an empty read empty', () => {
    const tied = residentialRowsOf(ROWS, { contact: DANA, firstName: 'Dana', customerId: null })
    expect(tied.jobs.map((j) => j.id)).toEqual(['job-1312', 'job-1101'])
    const empty = residentialRowsOf(NO_PIPELINE_ROWS, { contact: DANA, firstName: 'Dana', customerId: 'cust-dana' })
    expect([empty.jobs, empty.invoices, empty.messages, empty.paySpeeds]).toEqual([[], [], [], null])
  })

  it('names each job for the card and {job}, trimmed, and skips one with no name', () => {
    expect(pipelineJobNames(dana.jobs)).toEqual({ 'job-1312': 'the water heater' })
  })

  it('selects the loader’s columns and no more: each select names every field of its row type the loader reads', () => {
    for (const field of ['id', 'created_at', 'status', 'revenue', 'customer_id', 'gc_customer_id', 'bill_to_party', 'customer_name', 'job_name']) expect(PIPELINE_SELECTS.jobs).toContain(field)
    for (const field of ['billed_at', 'sent_to_customer_at', 'estimated_bill_date', 'sequence_order', 'bill_to_party']) expect(PIPELINE_SELECTS.invoices).toContain(field)
    for (const field of ['revoked_at', 'rejected_at']) expect(PIPELINE_SELECTS.clockSessions).toContain(field)
    expect(PIPELINE_SELECTS.texts).toContain('who_text')
  })
})
