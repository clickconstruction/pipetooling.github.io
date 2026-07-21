import { describe, expect, it } from 'vitest'
import {
  stagesSectionKeyForJobStatus,
  buildCapableToBillBreakdownRows,
  capableToBillTotalFromWorking,
  jobCapableToBillAmounts,
  buildBilledStageRows,
  buildJobsStagesBoardLists,
  buildReadyToBillStageRows,
  clampPartialInvoiceCentsToUnallocated,
  filterJobsByStagesSearch,
  jobBillingUnallocatedDollars,
  jobInCollections,
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

  it('matches a job by its Click number when HCP is empty', () => {
    const clickOnly = jobStub({
      id: 'job-click',
      hcp_number: '',
      click_number: 'C-777',
      job_name: 'Heron',
      job_address: '9 Pine',
      invoices: [],
    })
    expect(filterJobsByStagesSearch([clickOnly], 'c-777', null).map((j) => j.id)).toEqual(['job-click'])
    // an HCP number still matches as before
    const hcpJob = jobStub({
      id: 'job-hcp',
      hcp_number: '861',
      click_number: '',
      job_name: 'NexGen',
      job_address: '1 A',
      invoices: [],
    })
    expect(filterJobsByStagesSearch([hcpJob], '861', null).map((j) => j.id)).toEqual(['job-hcp'])
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

describe('stagesSectionKeyForJobStatus', () => {
  it('maps job statuses to Stages section keys', () => {
    expect(stagesSectionKeyForJobStatus('waiting')).toBe('waiting')
    expect(stagesSectionKeyForJobStatus('working')).toBe('working')
    expect(stagesSectionKeyForJobStatus('ready_to_bill')).toBe('readyToBill')
    expect(stagesSectionKeyForJobStatus('billed')).toBe('billed')
    expect(stagesSectionKeyForJobStatus('paid')).toBeNull()
    expect(stagesSectionKeyForJobStatus(null)).toBeNull()
  })
})

describe('jobInCollections', () => {
  it('true only for billed jobs with collections_at set', () => {
    expect(jobInCollections({ status: 'billed', collections_at: '2026-07-04T12:00:00Z' })).toBe(true)
    expect(jobInCollections({ status: 'billed', collections_at: null })).toBe(false)
    // Sticky-flag semantics: the flag alone never counts on non-billed statuses.
    expect(jobInCollections({ status: 'paid', collections_at: '2026-07-04T12:00:00Z' })).toBe(false)
    expect(jobInCollections({ status: 'working', collections_at: '2026-07-04T12:00:00Z' })).toBe(false)
  })
})

describe('collections partition in buildJobsStagesBoardLists', () => {
  const billedInvoiceStub = (id: string, jobId: string, amount: number) =>
    rtbInvoiceStub({ id, job_id: jobId, amount, status: 'billed' })

  it('flagged billed job lands in collections lists but stays in the all-billed lists', () => {
    const inv = billedInvoiceStub('inv-1', 'job-1', 7000)
    const flagged = jobStub({ id: 'job-1', status: 'billed', collections_at: '2026-07-01T00:00:00Z', invoices: [inv] })
    const active = jobStub({ id: 'job-2', status: 'billed', collections_at: null, invoices: [] })
    const lists = buildJobsStagesBoardLists([flagged, active], '')

    expect(lists.collectionsJobs.map((j) => j.id)).toEqual(['job-1'])
    expect(lists.billedActiveJobs.map((j) => j.id)).toEqual(['job-2'])
    // AR-page contract: billedJobs/billedRows keep meaning ALL billed, Collections included.
    expect(lists.billedJobs.map((j) => j.id).sort()).toEqual(['job-1', 'job-2'])
    expect(lists.billedRows).toHaveLength(2)

    expect(lists.collectionsRows).toHaveLength(1)
    expect(lists.collectionsRows[0]?.kind).toBe('job_with_merged_billed')
    expect(lists.billedActiveRows).toHaveLength(1)
    expect(lists.billedActiveRows[0]?.kind).toBe('job')
  })

  it('billed invoice rows follow their parent job flag', () => {
    const invA = billedInvoiceStub('inv-a', 'job-1', 2000)
    const invB = billedInvoiceStub('inv-b', 'job-1', 3000)
    const flagged = jobStub({ id: 'job-1', status: 'billed', collections_at: '2026-07-01T00:00:00Z', invoices: [invA, invB] })
    const lists = buildJobsStagesBoardLists([flagged], '')

    // 2+ billed invoices → invoice rows only; both must land in collectionsRows.
    expect(lists.collectionsRows).toHaveLength(2)
    expect(lists.collectionsRows.every((r) => r.kind === 'invoice')).toBe(true)
    expect(lists.billedActiveRows).toHaveLength(0)
  })

  it('flagged non-billed job appears in no collections list', () => {
    const working = jobStub({ id: 'job-1', status: 'working', collections_at: '2026-07-01T00:00:00Z', invoices: [] })
    const paid = jobStub({ id: 'job-2', status: 'paid', collections_at: '2026-07-01T00:00:00Z', invoices: [] })
    const lists = buildJobsStagesBoardLists([working, paid], '')
    expect(lists.collectionsJobs).toHaveLength(0)
    expect(lists.collectionsRows).toHaveLength(0)
    expect(lists.working.map((j) => j.id)).toEqual(['job-1'])
    expect(lists.paid.map((j) => j.id)).toEqual(['job-2'])
  })

  it('unflagged board partitions cleanly: active + collections = billed', () => {
    const jobs = [
      jobStub({ id: 'a', status: 'billed', collections_at: null, invoices: [] }),
      jobStub({ id: 'b', status: 'billed', collections_at: '2026-06-01T00:00:00Z', invoices: [] }),
      jobStub({ id: 'c', status: 'billed', collections_at: null, invoices: [] }),
    ]
    const lists = buildJobsStagesBoardLists(jobs, '')
    expect(lists.billedActiveJobs.length + lists.collectionsJobs.length).toBe(lists.billedJobs.length)
    expect(lists.billedActiveRows.length + lists.collectionsRows.length).toBe(lists.billedRows.length)
  })
})

describe('jobBillingUnallocatedDollars / clampPartialInvoiceCentsToUnallocated (Stages partial-invoice basis)', () => {
  it('no invoices: remaining is gross (revenue minus payments)', () => {
    const job = jobStub({ id: 'job-1', revenue: 600, payments_made: 100, invoices: [] })
    expect(jobBillingUnallocatedDollars(job)).toBe(500)
    expect(clampPartialInvoiceCentsToUnallocated(job, 200)).toBe(20000)
  })

  it('RTB-only allocation subtracts from remaining', () => {
    const inv = rtbInvoiceStub({ id: 'inv-1', job_id: 'job-1', amount: 400, is_primary_rtb_bundle: true })
    const job = jobStub({ id: 'job-1', revenue: 600, payments_made: 0, invoices: [inv] })
    expect(jobBillingUnallocatedDollars(job)).toBe(200)
  })

  it('billed-only allocation subtracts from remaining', () => {
    const inv = rtbInvoiceStub({ id: 'inv-1', job_id: 'job-1', amount: 200, status: 'billed' })
    const job = jobStub({ id: 'job-1', revenue: 600, payments_made: 0, invoices: [inv] })
    expect(jobBillingUnallocatedDollars(job)).toBe(400)
  })

  it('mixed RTB + billed (live repro: $600 job, $200 billed, $400 RTB primary → $0, not $600)', () => {
    const billed = rtbInvoiceStub({ id: 'inv-1', job_id: 'job-1', amount: 200, status: 'billed' })
    const primary = rtbInvoiceStub({
      id: 'inv-2',
      job_id: 'job-1',
      amount: 400,
      is_primary_rtb_bundle: true,
      sequence_order: 1,
    })
    const job = jobStub({ id: 'job-1', revenue: 600, payments_made: 0, invoices: [billed, primary] })
    expect(jobBillingUnallocatedDollars(job)).toBe(0)
  })

  it('non-billing invoice statuses (e.g. paid) do not reduce remaining', () => {
    const paid = rtbInvoiceStub({ id: 'inv-1', job_id: 'job-1', amount: 300, status: 'paid' })
    const job = jobStub({ id: 'job-1', revenue: 600, payments_made: 300, invoices: [paid] })
    expect(jobBillingUnallocatedDollars(job)).toBe(300)
  })

  it('over-allocation clamps to the unallocated remainder, not the gross remainder', () => {
    const primary = rtbInvoiceStub({ id: 'inv-1', job_id: 'job-1', amount: 350, is_primary_rtb_bundle: true })
    const job = jobStub({ id: 'job-1', revenue: 600, payments_made: 100, invoices: [primary] })
    expect(jobBillingUnallocatedDollars(job)).toBe(150)
    expect(clampPartialInvoiceCentsToUnallocated(job, 500)).toBe(15000)
    expect(clampPartialInvoiceCentsToUnallocated(job, 149.99)).toBe(14999)
  })

  it('zero remaining: clamp returns 0 for any requested amount', () => {
    const primary = rtbInvoiceStub({ id: 'inv-1', job_id: 'job-1', amount: 500, is_primary_rtb_bundle: true })
    const job = jobStub({ id: 'job-1', revenue: 600, payments_made: 100, invoices: [primary] })
    expect(jobBillingUnallocatedDollars(job)).toBe(0)
    expect(clampPartialInvoiceCentsToUnallocated(job, 100)).toBe(0)
  })

  it('allocations exceeding gross never go negative', () => {
    const primary = rtbInvoiceStub({ id: 'inv-1', job_id: 'job-1', amount: 900, is_primary_rtb_bundle: true })
    const job = jobStub({ id: 'job-1', revenue: 600, payments_made: 0, invoices: [primary] })
    expect(jobBillingUnallocatedDollars(job)).toBe(0)
    expect(clampPartialInvoiceCentsToUnallocated(job, 50)).toBe(0)
  })
})

describe('capable-to-bill kernel (quirk #8 consolidation)', () => {
  it('computes valueCreated from pct and toBill net of amounts already off the job', () => {
    // 1000 bid, 50% done, 200 paid: 500 created − (1000 − 800 remaining) = 300 to bill
    expect(jobCapableToBillAmounts({ revenue: 1000, payments_made: 200, pct_complete: 50 })).toEqual({
      toBill: 300,
      valueCreated: 500,
    })
  })

  it('treats null pct as zero value created (toBill 0 when nothing paid — remaining equals the bid)', () => {
    const r = jobCapableToBillAmounts({ revenue: 1000, payments_made: 0, pct_complete: null })
    expect(r.valueCreated).toBe(0)
    expect(r.toBill).toBe(0)
  })

  it('clamps remaining at zero for overpaid jobs (toBill goes fully negative)', () => {
    const r = jobCapableToBillAmounts({ revenue: 1000, payments_made: 1200, pct_complete: 50 })
    expect(r.toBill).toBe(-500)
  })

  it('total clamps negatives per job; breakdown filters them and sorts descending', () => {
    const a = { revenue: 1000, payments_made: 200, pct_complete: 50 } // 300
    const b = { revenue: 2000, payments_made: 0, pct_complete: 40 }  // 800
    const c = { revenue: 1000, payments_made: 0, pct_complete: null } // -1000
    expect(capableToBillTotalFromWorking([a, b, c])).toBe(1100)
    const rows = buildCapableToBillBreakdownRows([a, b, c])
    expect(rows.map((r) => r.toBill)).toEqual([800, 300])
    expect(rows[0]!.job).toBe(b)
  })
})
