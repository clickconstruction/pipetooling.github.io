import { describe, expect, it } from 'vitest'
import {
  buildBilledStageRows,
  buildJobsStagesBoardLists,
  buildReadyToBillStageRows,
  filterJobsByStagesSearch,
  jobBillingUnallocatedDollars,
  readyToBillRowsExposureTotal,
  stagesMergedBillingInvoiceId,
  type InvoiceWithJob,
} from './jobsStagesBoard'
import type { JobWithDetails } from '../types/jobWithDetails'

function jobStub(overrides: Partial<JobWithDetails> & Pick<JobWithDetails, 'id' | 'invoices'>): JobWithDetails {
  return {
    status: 'ready_to_bill',
    revenue: 10_000,
    payments_made: 3000,
    materials: [],
    fixtures: [],
    payments: [],
    team_members: [],
    ...overrides,
  } as JobWithDetails
}

function rtbInvoiceStub(overrides: Partial<Record<string, unknown>> & { id: string; job_id: string; amount: number }) {
  return {
    sequence_order: 0,
    billed_at: null,
    created_at: null,
    estimated_bill_date: null,
    external_send_channel: null,
    external_send_note: null,
    hosted_invoice_url: null,
    sent_to_customer_at: null,
    stripe_invoice_id: null,
    stripe_invoice_memo: null,
    stripe_invoice_footer: null,
    stripe_invoice_status: null,
    agreed_write_down_at: null,
    agreed_write_down_by: null,
    agreed_write_down_note: null,
    agreed_write_down_previous_amount: null,
    agreed_write_down_stripe_credit_note_id: null,
    status: 'ready_to_bill' as const,
    is_primary_rtb_bundle: false,
    ...overrides,
  }
}

describe('buildReadyToBillStageRows', () => {
  it('job row when unallocated > 0 plus one partial invoice row', () => {
    const inv = rtbInvoiceStub({
      id: 'inv-1',
      job_id: 'job-1',
      amount: 5000,
      is_primary_rtb_bundle: false,
    })
    const job = jobStub({
      id: 'job-1',
      invoices: [inv],
    })
    const rows = buildReadyToBillStageRows([job])
    expect(rows).toHaveLength(2)
    expect(rows.filter((r) => r.kind === 'job')).toHaveLength(1)
    expect(rows.filter((r) => r.kind === 'invoice')).toHaveLength(1)
    const invRow = rows.find((r) => r.kind === 'invoice')
    expect(invRow?.kind).toBe('invoice')
    if (invRow?.kind === 'invoice') expect(invRow.inv.id).toBe('inv-1')
  })

  it('working job with partial RTB: invoice row only, no remainder job shell', () => {
    const inv = rtbInvoiceStub({
      id: 'inv-1',
      job_id: 'job-1',
      amount: 5000,
      is_primary_rtb_bundle: false,
    })
    const job = jobStub({
      id: 'job-1',
      status: 'working',
      invoices: [inv],
    })
    const rows = buildReadyToBillStageRows([job])
    expect(rows).toHaveLength(1)
    expect(rows.filter((r) => r.kind === 'job')).toHaveLength(0)
    expect(rows.filter((r) => r.kind === 'invoice')).toHaveLength(1)
    const invRow = rows[0]
    expect(invRow?.kind).toBe('invoice')
    if (invRow?.kind === 'invoice') expect(invRow.inv.id).toBe('inv-1')
  })

  it('sole primary RTB when fully allocated: merged job_with_primary_rtb row', () => {
    const inv = rtbInvoiceStub({
      id: 'inv-1',
      job_id: 'job-1',
      amount: 7000,
      is_primary_rtb_bundle: true,
    })
    const job = jobStub({
      id: 'job-1',
      invoices: [inv],
    })
    const rows = buildReadyToBillStageRows([job])
    expect(rows).toHaveLength(1)
    expect(rows[0]?.kind).toBe('job_with_primary_rtb')
    if (rows[0]?.kind === 'job_with_primary_rtb') {
      expect(rows[0].inv.id).toBe('inv-1')
    }
  })

  it('job row plus invoice when sole primary but billing-unallocated remains', () => {
    const inv = rtbInvoiceStub({
      id: 'inv-1',
      job_id: 'job-1',
      amount: 2,
      is_primary_rtb_bundle: true,
    })
    const job = jobStub({
      id: 'job-1',
      revenue: 100,
      payments_made: 10,
      invoices: [inv],
    })
    const rows = buildReadyToBillStageRows([job])
    expect(rows).toHaveLength(2)
    expect(rows.filter((r) => r.kind === 'job')).toHaveLength(1)
    expect(rows.filter((r) => r.kind === 'invoice')).toHaveLength(1)
  })

  it('job row plus invoice when line is most of balance but unallocated remains', () => {
    const inv = rtbInvoiceStub({
      id: 'inv-1',
      job_id: 'job-1',
      amount: 80,
      is_primary_rtb_bundle: true,
    })
    const job = jobStub({
      id: 'job-1',
      revenue: 100,
      payments_made: 10,
      invoices: [inv],
    })
    const rows = buildReadyToBillStageRows([job])
    expect(rows).toHaveLength(2)
    expect(rows.filter((r) => r.kind === 'job')).toHaveLength(1)
    expect(rows.filter((r) => r.kind === 'invoice')).toHaveLength(1)
  })

  it('job row plus two invoice rows when two RTB lines and unallocated > 0', () => {
    const invA = {
      id: 'inv-a',
      job_id: 'job-1',
      amount: 2000,
      status: 'ready_to_bill' as const,
      is_primary_rtb_bundle: false,
      sequence_order: 0,
      billed_at: null,
      created_at: null,
      estimated_bill_date: null,
      external_send_channel: null,
      external_send_note: null,
      hosted_invoice_url: null,
      sent_to_customer_at: null,
      stripe_invoice_id: null,
      stripe_invoice_memo: null,
      stripe_invoice_footer: null,
      stripe_invoice_status: null,
      agreed_write_down_at: null,
      agreed_write_down_by: null,
      agreed_write_down_note: null,
      agreed_write_down_previous_amount: null,
      agreed_write_down_stripe_credit_note_id: null,
    }
    const invB = { ...invA, id: 'inv-b', amount: 3000, sequence_order: 1 }
    const job = jobStub({
      id: 'job-1',
      invoices: [invA, invB],
    })
    const rows = buildReadyToBillStageRows([job])
    expect(rows).toHaveLength(3)
    expect(rows.filter((r) => r.kind === 'job')).toHaveLength(1)
    expect(rows.filter((r) => r.kind === 'invoice')).toHaveLength(2)
  })

  it('primary plus three partials: merged primary plus three invoice rows when fully allocated', () => {
    const primary = rtbInvoiceStub({
      id: 'inv-p',
      job_id: 'job-1',
      amount: 88,
      is_primary_rtb_bundle: true,
      sequence_order: 0,
    })
    const p1 = rtbInvoiceStub({
      id: 'inv-1',
      job_id: 'job-1',
      amount: 12,
      is_primary_rtb_bundle: false,
      sequence_order: 1,
    })
    const p2 = rtbInvoiceStub({
      id: 'inv-2',
      job_id: 'job-1',
      amount: 11,
      is_primary_rtb_bundle: false,
      sequence_order: 2,
    })
    const p3 = rtbInvoiceStub({
      id: 'inv-3',
      job_id: 'job-1',
      amount: 2,
      is_primary_rtb_bundle: false,
      sequence_order: 3,
    })
    const job = jobStub({
      id: 'job-1',
      revenue: 113,
      payments_made: 0,
      invoices: [primary, p1, p2, p3],
    })
    expect(jobBillingUnallocatedDollars(job)).toBe(0)
    const rows = buildReadyToBillStageRows([job])
    expect(rows).toHaveLength(4)
    expect(rows[0]?.kind).toBe('job_with_primary_rtb')
    if (rows[0]?.kind === 'job_with_primary_rtb') expect(rows[0].inv.amount).toBe(88)
    const partialAmounts = rows
      .filter((r): r is Extract<typeof r, { kind: 'invoice' }> => r.kind === 'invoice')
      .map((r) => r.inv.amount)
    expect(partialAmounts).toEqual([12, 11, 2])
  })

  it('no primary: single RTB line equal to gross remainder bundles as job_with_primary_rtb', () => {
    const inv = rtbInvoiceStub({
      id: 'inv-1',
      job_id: 'job-1',
      amount: 7000,
      is_primary_rtb_bundle: false,
    })
    const job = jobStub({
      id: 'job-1',
      invoices: [inv],
    })
    const rows = buildReadyToBillStageRows([job])
    expect(rows).toHaveLength(1)
    expect(rows[0]?.kind).toBe('job_with_primary_rtb')
  })

  it('no primary: two partials fully allocated yields job row plus two invoices (Dashboard parity)', () => {
    const invA = {
      id: 'inv-a',
      job_id: 'job-1',
      amount: 2000,
      status: 'ready_to_bill' as const,
      is_primary_rtb_bundle: false,
      sequence_order: 0,
      billed_at: null,
      created_at: null,
      estimated_bill_date: null,
      external_send_channel: null,
      external_send_note: null,
      hosted_invoice_url: null,
      sent_to_customer_at: null,
      stripe_invoice_id: null,
      stripe_invoice_memo: null,
      stripe_invoice_footer: null,
      stripe_invoice_status: null,
      agreed_write_down_at: null,
      agreed_write_down_by: null,
      agreed_write_down_note: null,
      agreed_write_down_previous_amount: null,
      agreed_write_down_stripe_credit_note_id: null,
    }
    const invB = { ...invA, id: 'inv-b', amount: 3000, sequence_order: 1 }
    const job = jobStub({
      id: 'job-1',
      revenue: 5000,
      payments_made: 0,
      invoices: [invA, invB],
    })
    expect(jobBillingUnallocatedDollars(job)).toBe(0)
    const rows = buildReadyToBillStageRows([job])
    expect(rows).toHaveLength(3)
    expect(rows.filter((r) => r.kind === 'job')).toHaveLength(1)
    expect(rows.filter((r) => r.kind === 'invoice')).toHaveLength(2)
  })
})

describe('filterJobsByStagesSearch', () => {
  it('includes job only in extraJobIds when text does not match', () => {
    const a = jobStub({
      id: 'job-a',
      hcp_number: '100',
      job_name: 'Alpha',
      job_address: '1 Main',
      invoices: [],
    })
    const b = jobStub({
      id: 'job-b',
      hcp_number: '200',
      job_name: 'Beta',
      job_address: '2 Oak',
      invoices: [],
    })
    const filtered = filterJobsByStagesSearch([a, b], 'zzz', new Set(['job-b']))
    expect(filtered.map((j) => j.id)).toEqual(['job-b'])
  })

  it('includes job when text matches even without extraJobIds', () => {
    const a = jobStub({
      id: 'job-a',
      hcp_number: '100',
      job_name: 'Alpha Plumbing',
      job_address: '1 Main',
      invoices: [],
    })
    const filtered = filterJobsByStagesSearch([a], 'plumb', null)
    expect(filtered).toHaveLength(1)
  })

  it('empty query returns full jobs list', () => {
    const a = jobStub({ id: 'job-a', invoices: [] })
    const b = jobStub({ id: 'job-b', invoices: [] })
    expect(filterJobsByStagesSearch([a, b], '', new Set(['job-a']))).toEqual([a, b])
  })
})

describe('buildJobsStagesBoardLists', () => {
  it('includes working job with ready_to_bill invoice in readyToBillRows (Break off invoice parity)', () => {
    const inv = rtbInvoiceStub({
      id: 'inv-1',
      job_id: 'job-1',
      amount: 5000,
      is_primary_rtb_bundle: false,
    })
    const job = jobStub({
      id: 'job-1',
      status: 'working',
      invoices: [inv],
    })
    const { readyToBillRows } = buildJobsStagesBoardLists([job], '')
    const direct = buildReadyToBillStageRows([job])
    expect(readyToBillRows).toEqual(direct)
    expect(readyToBillRows).toHaveLength(1)
    expect(readyToBillRows[0]?.kind).toBe('invoice')
  })

  it('working job without RTB invoices produces no readyToBillRows', () => {
    const job = jobStub({
      id: 'job-1',
      status: 'working',
      invoices: [],
    })
    const { readyToBillRows } = buildJobsStagesBoardLists([job], '')
    expect(readyToBillRows).toHaveLength(0)
  })

  it('waiting job lands in the waiting list and no other bucket', () => {
    const job = jobStub({
      id: 'job-1',
      status: 'waiting',
      invoices: [],
    })
    const lists = buildJobsStagesBoardLists([job], '')
    expect(lists.waiting).toEqual([job])
    expect(lists.working).toHaveLength(0)
    expect(lists.readyToBillJobs).toHaveLength(0)
    expect(lists.billedJobs).toHaveLength(0)
    expect(lists.paid).toHaveLength(0)
    expect(lists.readyToBillRows).toHaveLength(0)
    expect(lists.billedRows).toHaveLength(0)
  })
})

describe('readyToBillRowsExposureTotal', () => {
  it('counts job unallocated plus partial lines once (not gross plus drafts)', () => {
    const inv = rtbInvoiceStub({
      id: 'inv-1',
      job_id: 'job-1',
      amount: 5000,
      is_primary_rtb_bundle: false,
    })
    const job = jobStub({
      id: 'job-1',
      invoices: [inv],
    })
    const rows = buildReadyToBillStageRows([job])
    expect(readyToBillRowsExposureTotal(rows)).toBe(7000)
    expect(jobBillingUnallocatedDollars(job)).toBe(2000)
  })

  it('working job partial: RTB exposure is draft lines only (no remainder row in RTB)', () => {
    const inv = rtbInvoiceStub({
      id: 'inv-1',
      job_id: 'job-1',
      amount: 5000,
      is_primary_rtb_bundle: false,
    })
    const job = jobStub({
      id: 'job-1',
      status: 'working',
      invoices: [inv],
    })
    const rows = buildReadyToBillStageRows([job])
    expect(readyToBillRowsExposureTotal(rows)).toBe(5000)
    expect(jobBillingUnallocatedDollars(job)).toBe(2000)
  })

  it('sole primary fully allocated: exposure equals primary amount', () => {
    const inv = rtbInvoiceStub({
      id: 'inv-1',
      job_id: 'job-1',
      amount: 7000,
      is_primary_rtb_bundle: true,
    })
    const job = jobStub({
      id: 'job-1',
      invoices: [inv],
    })
    const rows = buildReadyToBillStageRows([job])
    expect(rows).toHaveLength(1)
    expect(rows[0]?.kind).toBe('job_with_primary_rtb')
    expect(readyToBillRowsExposureTotal(rows)).toBe(7000)
  })

  it('primary plus partial sums both lines when fully allocated', () => {
    const primary = rtbInvoiceStub({
      id: 'inv-p',
      job_id: 'job-1',
      amount: 7000,
      is_primary_rtb_bundle: true,
      sequence_order: 0,
    })
    const partial = rtbInvoiceStub({
      id: 'inv-u',
      job_id: 'job-1',
      amount: 3000,
      is_primary_rtb_bundle: false,
      sequence_order: 1,
    })
    const job = jobStub({
      id: 'job-1',
      revenue: 10_000,
      payments_made: 0,
      invoices: [primary, partial],
    })
    const rows = buildReadyToBillStageRows([job])
    expect(readyToBillRowsExposureTotal(rows)).toBe(10_000)
  })

  it('sole primary with leftover unallocated: job row plus invoice sums to gross remaining', () => {
    const inv = rtbInvoiceStub({
      id: 'inv-1',
      job_id: 'job-1',
      amount: 2,
      is_primary_rtb_bundle: true,
    })
    const job = jobStub({
      id: 'job-1',
      revenue: 100,
      payments_made: 10,
      invoices: [inv],
    })
    const rows = buildReadyToBillStageRows([job])
    expect(rows).toHaveLength(2)
    expect(readyToBillRowsExposureTotal(rows)).toBe(90)
  })

  it('two partials without primary: job unallocated plus both lines', () => {
    const invA = {
      id: 'inv-a',
      job_id: 'job-1',
      amount: 2000,
      status: 'ready_to_bill' as const,
      is_primary_rtb_bundle: false,
      sequence_order: 0,
      billed_at: null,
      created_at: null,
      estimated_bill_date: null,
      external_send_channel: null,
      external_send_note: null,
      hosted_invoice_url: null,
      sent_to_customer_at: null,
      stripe_invoice_id: null,
      stripe_invoice_memo: null,
      stripe_invoice_footer: null,
      stripe_invoice_status: null,
      agreed_write_down_at: null,
      agreed_write_down_by: null,
      agreed_write_down_note: null,
      agreed_write_down_previous_amount: null,
      agreed_write_down_stripe_credit_note_id: null,
    }
    const invB = { ...invA, id: 'inv-b', amount: 3000, sequence_order: 1 }
    const job = jobStub({
      id: 'job-1',
      invoices: [invA, invB],
    })
    const rows = buildReadyToBillStageRows([job])
    expect(readyToBillRowsExposureTotal(rows)).toBe(7000)
  })
})

describe('stagesMergedBillingInvoiceId', () => {
  it('RTB: sole primary fully allocated returns primary id', () => {
    const inv = rtbInvoiceStub({
      id: 'inv-1',
      job_id: 'job-1',
      amount: 7000,
      is_primary_rtb_bundle: true,
    })
    const job = jobStub({ id: 'job-1', invoices: [inv] })
    expect(stagesMergedBillingInvoiceId(job)).toBe('inv-1')
  })

  it('RTB: primary plus partials returns primary id', () => {
    const primary = rtbInvoiceStub({
      id: 'inv-p',
      job_id: 'job-1',
      amount: 88,
      is_primary_rtb_bundle: true,
      sequence_order: 0,
    })
    const partial = rtbInvoiceStub({
      id: 'inv-u',
      job_id: 'job-1',
      amount: 12,
      is_primary_rtb_bundle: false,
      sequence_order: 1,
    })
    const job = jobStub({
      id: 'job-1',
      revenue: 100,
      payments_made: 0,
      invoices: [primary, partial],
    })
    expect(stagesMergedBillingInvoiceId(job)).toBe('inv-p')
  })

  it('RTB: sole primary with unallocated gap returns null (split job + invoice)', () => {
    const inv = rtbInvoiceStub({
      id: 'inv-1',
      job_id: 'job-1',
      amount: 2,
      is_primary_rtb_bundle: true,
    })
    const job = jobStub({
      id: 'job-1',
      revenue: 100,
      payments_made: 10,
      invoices: [inv],
    })
    expect(stagesMergedBillingInvoiceId(job)).toBeNull()
  })

  it('RTB: no primary, single RTB equal gross remainder returns that id', () => {
    const inv = rtbInvoiceStub({
      id: 'inv-1',
      job_id: 'job-1',
      amount: 7000,
      is_primary_rtb_bundle: false,
    })
    const job = jobStub({ id: 'job-1', invoices: [inv] })
    expect(stagesMergedBillingInvoiceId(job)).toBe('inv-1')
  })

  it('billed: one billed invoice returns its id', () => {
    const inv = {
      id: 'inv-1',
      job_id: 'job-1',
      amount: 5000,
      status: 'billed' as const,
      is_primary_rtb_bundle: false,
      sequence_order: 0,
      billed_at: null,
      created_at: null,
      estimated_bill_date: null,
      external_send_channel: null,
      external_send_note: null,
      hosted_invoice_url: null,
      sent_to_customer_at: null,
      stripe_invoice_id: null,
      stripe_invoice_memo: null,
      stripe_invoice_footer: null,
      stripe_invoice_status: null,
      agreed_write_down_at: null,
      agreed_write_down_by: null,
      agreed_write_down_note: null,
      agreed_write_down_previous_amount: null,
      agreed_write_down_stripe_credit_note_id: null,
    }
    const job = jobStub({ id: 'job-1', status: 'billed', invoices: [inv] })
    expect(stagesMergedBillingInvoiceId(job)).toBe('inv-1')
  })

  it('billed: two billed invoices returns null', () => {
    const invA = {
      id: 'inv-a',
      job_id: 'job-1',
      amount: 2000,
      status: 'billed' as const,
      is_primary_rtb_bundle: false,
      sequence_order: 0,
      billed_at: null,
      created_at: null,
      estimated_bill_date: null,
      external_send_channel: null,
      external_send_note: null,
      hosted_invoice_url: null,
      sent_to_customer_at: null,
      stripe_invoice_id: null,
      stripe_invoice_memo: null,
      stripe_invoice_footer: null,
      stripe_invoice_status: null,
      agreed_write_down_at: null,
      agreed_write_down_by: null,
      agreed_write_down_note: null,
      agreed_write_down_previous_amount: null,
      agreed_write_down_stripe_credit_note_id: null,
    }
    const invB = { ...invA, id: 'inv-b', amount: 3000, sequence_order: 1 }
    const job = jobStub({ id: 'job-1', status: 'billed', invoices: [invA, invB] })
    expect(stagesMergedBillingInvoiceId(job)).toBeNull()
  })

  it('working status returns null even if RTB invoices exist', () => {
    const inv = rtbInvoiceStub({ id: 'inv-1', job_id: 'job-1', amount: 100, is_primary_rtb_bundle: true })
    const job = jobStub({ id: 'job-1', status: 'working', invoices: [inv] })
    expect(stagesMergedBillingInvoiceId(job)).toBeNull()
  })
})

describe('buildBilledStageRows', () => {
  it('merges one billed job with one billed invoice into job_with_merged_billed', () => {
    const inv = {
      id: 'inv-1',
      job_id: 'job-1',
      amount: 5000,
      status: 'billed' as const,
      is_primary_rtb_bundle: false,
      sequence_order: 0,
      billed_at: null,
      created_at: null,
      estimated_bill_date: null,
      external_send_channel: null,
      external_send_note: null,
      hosted_invoice_url: null,
      sent_to_customer_at: null,
      stripe_invoice_id: null,
      stripe_invoice_memo: null,
      stripe_invoice_footer: null,
      stripe_invoice_status: null,
      agreed_write_down_at: null,
      agreed_write_down_by: null,
      agreed_write_down_note: null,
      agreed_write_down_previous_amount: null,
      agreed_write_down_stripe_credit_note_id: null,
    }
    const job = jobStub({
      id: 'job-1',
      status: 'billed',
      invoices: [inv],
    })
    const billedInvoices: InvoiceWithJob[] = [{ ...inv, job }]
    const rows = buildBilledStageRows([job], billedInvoices)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.kind).toBe('job_with_merged_billed')
    if (rows[0]?.kind === 'job_with_merged_billed') {
      expect(rows[0].inv.id).toBe('inv-1')
    }
  })

  it('emits only invoice rows when two billed invoices exist (no bare job row)', () => {
    const invA = {
      id: 'inv-a',
      job_id: 'job-1',
      amount: 2000,
      status: 'billed' as const,
      is_primary_rtb_bundle: false,
      sequence_order: 0,
      billed_at: null,
      created_at: null,
      estimated_bill_date: null,
      external_send_channel: null,
      external_send_note: null,
      hosted_invoice_url: null,
      sent_to_customer_at: null,
      stripe_invoice_id: null,
      stripe_invoice_memo: null,
      stripe_invoice_footer: null,
      stripe_invoice_status: null,
      agreed_write_down_at: null,
      agreed_write_down_by: null,
      agreed_write_down_note: null,
      agreed_write_down_previous_amount: null,
      agreed_write_down_stripe_credit_note_id: null,
    }
    const invB = { ...invA, id: 'inv-b', amount: 3000, sequence_order: 1 }
    const job = jobStub({
      id: 'job-1',
      status: 'billed',
      invoices: [invA, invB],
    })
    const billedInvoices: InvoiceWithJob[] = [
      { ...invA, job },
      { ...invB, job },
    ]
    const rows = buildBilledStageRows([job], billedInvoices)
    expect(rows).toHaveLength(2)
    expect(rows.every((r) => r.kind === 'invoice')).toBe(true)
  })

  it('keeps a job-only row when billed job has zero billed invoices', () => {
    const job = jobStub({
      id: 'job-1',
      status: 'billed',
      invoices: [],
    })
    const rows = buildBilledStageRows([job], [])
    expect(rows).toHaveLength(1)
    expect(rows[0]?.kind).toBe('job')
  })
})
