import { describe, expect, it } from 'vitest'
import {
  bankPaymentTargetsFromStageRows,
  stagesSectionKeyForJobStatus,
  buildCapableToBillBreakdownRows,
  capableToBillTotalFromWorking,
  jobCapableToBillAmounts,
  buildBilledStageRows,
  buildJobsStagesBoardLists,
  buildReadyToBillStageRows,
  clampPartialInvoiceCentsToUnallocated,
  filterJobsByStagesSearch,
  accountManFilterOptionsFromJobs,
  filterJobsByAccountMan,
  filterJobsByGcCustomer,
  gcFilterOptionsFromJobs,
  STAGES_ACCOUNT_MAN_FILTER_NONE,
  STAGES_GC_FILTER_NO_GC,
  developmentFilterOptionsFromJobs,
  filterJobsByDevelopment,
  STAGES_DEVELOPMENT_FILTER_NONE,
  jobBillingUnallocatedDollars,
  jobPartialInvoiceRemainingDollars,
  jobInCollections,
  readyToBillRowsExposureTotal,
  stagesMergedBillingInvoiceId,
  sortStagesJobsByEffectiveNumberDesc,
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
    stripe_mode: null,
    agreed_write_down_at: null,
    agreed_write_down_by: null,
    agreed_write_down_note: null,
    agreed_write_down_previous_amount: null,
    agreed_write_down_stripe_credit_note_id: null,
    bill_to_email: null,
    bill_to_name: null,
    bill_to_phone: null,
    bill_to_stripe_customer_id: null,
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
      stripe_mode: null,
      agreed_write_down_at: null,
      agreed_write_down_by: null,
      agreed_write_down_note: null,
      agreed_write_down_previous_amount: null,
      agreed_write_down_stripe_credit_note_id: null,
      bill_to_email: null,
      bill_to_name: null,
      bill_to_phone: null,
      bill_to_stripe_customer_id: null,
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
      stripe_mode: null,
      agreed_write_down_at: null,
      agreed_write_down_by: null,
      agreed_write_down_note: null,
      agreed_write_down_previous_amount: null,
      agreed_write_down_stripe_credit_note_id: null,
      bill_to_email: null,
      bill_to_name: null,
      bill_to_phone: null,
      bill_to_stripe_customer_id: null,
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

  it('GC filter: options are distinct + name-sorted; filter matches id or the no-GC sentinel (v2.1183)', () => {
    const k1 = jobStub({ id: 'j1', invoices: [], gcCustomer: { id: 'gc-k', name: 'Knight Contracting' } })
    const k2 = jobStub({ id: 'j2', invoices: [], gcCustomer: { id: 'gc-k', name: 'Knight Contracting' } })
    const a = jobStub({ id: 'j3', invoices: [], gcCustomer: { id: 'gc-a', name: 'achilles austin' } })
    const none = jobStub({ id: 'j4', invoices: [] })
    const jobsList = [k1, k2, a, none]
    expect(gcFilterOptionsFromJobs(jobsList)).toEqual([
      { id: 'gc-a', name: 'achilles austin' },
      { id: 'gc-k', name: 'Knight Contracting' },
    ])
    expect(filterJobsByGcCustomer(jobsList, null).map((j) => j.id)).toEqual(['j1', 'j2', 'j3', 'j4'])
    expect(filterJobsByGcCustomer(jobsList, 'gc-k').map((j) => j.id)).toEqual(['j1', 'j2'])
    expect(filterJobsByGcCustomer(jobsList, STAGES_GC_FILTER_NO_GC).map((j) => j.id)).toEqual(['j4'])
  })

  it('Account Man filter: options are distinct + name-sorted; filter matches user id or the no-AM sentinel (v2.1477)', () => {
    const t1 = jobStub({ id: 'j1', invoices: [], account_manager_user_id: 'u-t', account_manager: { id: 'u-t', name: 'Trace' } })
    const t2 = jobStub({ id: 'j2', invoices: [], account_manager_user_id: 'u-t', account_manager: { id: 'u-t', name: 'Trace' } })
    const m = jobStub({ id: 'j3', invoices: [], account_manager_user_id: 'u-m', account_manager: { id: 'u-m', name: 'malachi' } })
    const none = jobStub({ id: 'j4', invoices: [] })
    const jobsList = [t1, t2, m, none]
    expect(accountManFilterOptionsFromJobs(jobsList)).toEqual([
      { id: 'u-m', name: 'malachi' },
      { id: 'u-t', name: 'Trace' },
    ])
    expect(filterJobsByAccountMan(jobsList, null).map((j) => j.id)).toEqual(['j1', 'j2', 'j3', 'j4'])
    expect(filterJobsByAccountMan(jobsList, 'u-t').map((j) => j.id)).toEqual(['j1', 'j2'])
    expect(filterJobsByAccountMan(jobsList, STAGES_ACCOUNT_MAN_FILTER_NONE).map((j) => j.id)).toEqual(['j4'])
  })

  it('matches a job by its GC name (v2.1178)', () => {
    const withGc = jobStub({
      id: 'job-gc',
      hcp_number: '300',
      job_name: 'Pizza Buildout',
      job_address: '3 Elm',
      invoices: [],
      gcCustomer: { id: 'gc-1', name: 'Knight Contracting' },
    })
    const withoutGc = jobStub({
      id: 'job-plain',
      hcp_number: '301',
      job_name: 'Repipe',
      job_address: '4 Oak',
      invoices: [],
    })
    expect(filterJobsByStagesSearch([withGc, withoutGc], 'knight', null).map((j) => j.id)).toEqual(['job-gc'])
    // null gcCustomer never throws or matches
    expect(filterJobsByStagesSearch([withoutGc], 'knight', null)).toHaveLength(0)
  })

  it('development filter: options are distinct + name-sorted; filter matches id or the none sentinel (v2.1204)', () => {
    const s1 = jobStub({ id: 'j1', invoices: [], development: { id: 'dev-s', name: 'Sagebrush Phase 2' } })
    const s2 = jobStub({ id: 'j2', invoices: [], development: { id: 'dev-s', name: 'Sagebrush Phase 2' } })
    const w = jobStub({ id: 'j3', invoices: [], development: { id: 'dev-a', name: 'ash creek' } })
    const none = jobStub({ id: 'j4', invoices: [] })
    const jobsList = [s1, s2, w, none]
    expect(developmentFilterOptionsFromJobs(jobsList)).toEqual([
      { id: 'dev-a', name: 'ash creek' },
      { id: 'dev-s', name: 'Sagebrush Phase 2' },
    ])
    expect(filterJobsByDevelopment(jobsList, null).map((j) => j.id)).toEqual(['j1', 'j2', 'j3', 'j4'])
    expect(filterJobsByDevelopment(jobsList, 'dev-s').map((j) => j.id)).toEqual(['j1', 'j2'])
    expect(filterJobsByDevelopment(jobsList, STAGES_DEVELOPMENT_FILTER_NONE).map((j) => j.id)).toEqual(['j4'])
  })

  it('matches a job by its development name (v2.1199)', () => {
    const withDev = jobStub({
      id: 'job-dev',
      hcp_number: '400',
      job_name: 'Lot 12',
      job_address: '12 Bluestem',
      invoices: [],
      development: { id: 'dev-1', name: 'Sagebrush Phase 2' },
    })
    const withoutDev = jobStub({
      id: 'job-plain2',
      hcp_number: '401',
      job_name: 'Repipe',
      job_address: '4 Oak',
      invoices: [],
    })
    expect(filterJobsByStagesSearch([withDev, withoutDev], 'sagebrush', null).map((j) => j.id)).toEqual(['job-dev'])
    // null development never throws or matches
    expect(filterJobsByStagesSearch([withoutDev], 'sagebrush', null)).toHaveLength(0)
  })
})

describe('buildJobsStagesBoardLists sort modes (v2.1807)', () => {
  const older = jobStub({ id: 'older', status: 'working', invoices: [], hcp_number: '900', created_at: '2026-08-01T10:00:00Z' })
  const newest = jobStub({ id: 'newest', status: 'working', invoices: [], hcp_number: '850', created_at: '2026-08-18T10:00:00Z' })
  const middle = jobStub({ id: 'middle', status: 'working', invoices: [], hcp_number: '875', created_at: '2026-08-10T10:00:00Z' })

  it('default stays newest-number-first', () => {
    const { working } = buildJobsStagesBoardLists([older, newest, middle], '')
    expect(working.map((j) => j.id)).toEqual(['older', 'middle', 'newest'])
  })

  it("'added' orders by created_at desc inside the section", () => {
    const { working } = buildJobsStagesBoardLists([older, newest, middle], '', null, 'added')
    expect(working.map((j) => j.id)).toEqual(['newest', 'middle', 'older'])
  })

  it("'added' breaks created_at ties by effective number, missing dates sink", () => {
    const twinA = jobStub({ id: 'twin-a', status: 'working', invoices: [], hcp_number: '10', created_at: '2026-08-10T10:00:00Z' })
    const twinB = jobStub({ id: 'twin-b', status: 'working', invoices: [], hcp_number: '20', created_at: '2026-08-10T10:00:00Z' })
    const dateless = jobStub({ id: 'dateless', status: 'working', invoices: [], hcp_number: '999', created_at: null })
    const { working } = buildJobsStagesBoardLists([twinA, dateless, twinB], '', null, 'added')
    expect(working.map((j) => j.id)).toEqual(['twin-b', 'twin-a', 'dateless'])
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
      stripe_mode: null,
      agreed_write_down_at: null,
      agreed_write_down_by: null,
      agreed_write_down_note: null,
      agreed_write_down_previous_amount: null,
      agreed_write_down_stripe_credit_note_id: null,
      bill_to_email: null,
      bill_to_name: null,
      bill_to_phone: null,
      bill_to_stripe_customer_id: null,
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
      stripe_mode: null,
      agreed_write_down_at: null,
      agreed_write_down_by: null,
      agreed_write_down_note: null,
      agreed_write_down_previous_amount: null,
      agreed_write_down_stripe_credit_note_id: null,
      bill_to_email: null,
      bill_to_name: null,
      bill_to_phone: null,
      bill_to_stripe_customer_id: null,
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
      stripe_mode: null,
      agreed_write_down_at: null,
      agreed_write_down_by: null,
      agreed_write_down_note: null,
      agreed_write_down_previous_amount: null,
      agreed_write_down_stripe_credit_note_id: null,
      bill_to_email: null,
      bill_to_name: null,
      bill_to_phone: null,
      bill_to_stripe_customer_id: null,
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
      stripe_mode: null,
      agreed_write_down_at: null,
      agreed_write_down_by: null,
      agreed_write_down_note: null,
      agreed_write_down_previous_amount: null,
      agreed_write_down_stripe_credit_note_id: null,
      bill_to_email: null,
      bill_to_name: null,
      bill_to_phone: null,
      bill_to_stripe_customer_id: null,
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
      stripe_mode: null,
      agreed_write_down_at: null,
      agreed_write_down_by: null,
      agreed_write_down_note: null,
      agreed_write_down_previous_amount: null,
      agreed_write_down_stripe_credit_note_id: null,
      bill_to_email: null,
      bill_to_name: null,
      bill_to_phone: null,
      bill_to_stripe_customer_id: null,
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

describe('jobBillingUnallocatedDollars (board-merge basis: primary bundle counts as allocated)', () => {
  it('no invoices: remaining is gross (revenue minus payments)', () => {
    const job = jobStub({ id: 'job-1', revenue: 600, payments_made: 100, invoices: [] })
    expect(jobBillingUnallocatedDollars(job)).toBe(500)
  })

  it('RTB primary allocation subtracts from remaining (board reads the leftover as a real gap)', () => {
    const inv = rtbInvoiceStub({ id: 'inv-1', job_id: 'job-1', amount: 400, is_primary_rtb_bundle: true })
    const job = jobStub({ id: 'job-1', revenue: 600, payments_made: 0, invoices: [inv] })
    expect(jobBillingUnallocatedDollars(job)).toBe(200)
  })

  it('billed-only allocation subtracts from remaining', () => {
    const inv = rtbInvoiceStub({ id: 'inv-1', job_id: 'job-1', amount: 200, status: 'billed' })
    const job = jobStub({ id: 'job-1', revenue: 600, payments_made: 0, invoices: [inv] })
    expect(jobBillingUnallocatedDollars(job)).toBe(400)
  })

  it('well-synced primary reads $0 ($600 job, $200 billed, $400 RTB primary → no gap to show)', () => {
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

  it('allocations exceeding gross never go negative', () => {
    const primary = rtbInvoiceStub({ id: 'inv-1', job_id: 'job-1', amount: 900, is_primary_rtb_bundle: true })
    const job = jobStub({ id: 'job-1', revenue: 600, payments_made: 0, invoices: [primary] })
    expect(jobBillingUnallocatedDollars(job)).toBe(0)
  })
})

describe('jobPartialInvoiceRemainingDollars / clampPartialInvoiceCentsToUnallocated (partial-invoice basis: primary bundle excluded, v2.2446 rule)', () => {
  it('no invoices: remaining is gross (revenue minus payments)', () => {
    const job = jobStub({ id: 'job-1', revenue: 600, payments_made: 100, invoices: [] })
    expect(jobPartialInvoiceRemainingDollars(job)).toBe(500)
    expect(clampPartialInvoiceCentsToUnallocated(job, 200)).toBe(20000)
  })

  it('a Ready-to-Bill job with only the auto bundle has its full total left to carve', () => {
    // Taunya's job 978 start state: gross 3,630, auto draft 3,630 — the modal
    // read "Remaining $0" and clamped typed amounts to zero.
    const primary = rtbInvoiceStub({ id: 'inv-1', job_id: 'job-1', amount: 3630, is_primary_rtb_bundle: true })
    const job = jobStub({ id: 'job-1', revenue: 3630, payments_made: 0, invoices: [primary] })
    expect(jobPartialInvoiceRemainingDollars(job)).toBe(3630)
    expect(clampPartialInvoiceCentsToUnallocated(job, 1980)).toBe(198000)
    // The board-merge basis still reads 0 — that keeps the merged primary row intact.
    expect(jobBillingUnallocatedDollars(job)).toBe(0)
  })

  it('mid-flow: one segment invoice carved, auto bundle resized — remainder is the second segment', () => {
    const segment = rtbInvoiceStub({ id: 'inv-1', job_id: 'job-1', amount: 1980, is_primary_rtb_bundle: false })
    const primary = rtbInvoiceStub({
      id: 'inv-2',
      job_id: 'job-1',
      amount: 1650,
      is_primary_rtb_bundle: true,
      sequence_order: 1,
    })
    const job = jobStub({ id: 'job-1', revenue: 3630, payments_made: 0, invoices: [segment, primary] })
    expect(jobPartialInvoiceRemainingDollars(job)).toBe(1650)
    expect(clampPartialInvoiceCentsToUnallocated(job, 3630)).toBe(165000)
  })

  it('still counts a BILLED row even if it carries a stale primary flag', () => {
    const billed = rtbInvoiceStub({ id: 'inv-1', job_id: 'job-1', amount: 500, status: 'billed', is_primary_rtb_bundle: true })
    const job = jobStub({ id: 'job-1', revenue: 600, payments_made: 0, invoices: [billed] })
    expect(jobPartialInvoiceRemainingDollars(job)).toBe(100)
  })

  it('non-primary RTB + billed lines and payments all subtract from the carvable remainder', () => {
    const billed = rtbInvoiceStub({ id: 'inv-1', job_id: 'job-1', amount: 200, status: 'billed' })
    const segment = rtbInvoiceStub({ id: 'inv-2', job_id: 'job-1', amount: 150, is_primary_rtb_bundle: false, sequence_order: 1 })
    const job = jobStub({ id: 'job-1', revenue: 600, payments_made: 100, invoices: [billed, segment] })
    // 600 − 100 paid − 200 billed − 150 segment
    expect(jobPartialInvoiceRemainingDollars(job)).toBe(150)
    expect(clampPartialInvoiceCentsToUnallocated(job, 500)).toBe(15000)
    expect(clampPartialInvoiceCentsToUnallocated(job, 149.99)).toBe(14999)
  })

  it('zero remaining: clamp returns 0 for any requested amount', () => {
    const billed = rtbInvoiceStub({ id: 'inv-1', job_id: 'job-1', amount: 500, status: 'billed' })
    const job = jobStub({ id: 'job-1', revenue: 600, payments_made: 100, invoices: [billed] })
    expect(jobPartialInvoiceRemainingDollars(job)).toBe(0)
    expect(clampPartialInvoiceCentsToUnallocated(job, 100)).toBe(0)
  })

  it('allocations exceeding gross never go negative', () => {
    const billed = rtbInvoiceStub({ id: 'inv-1', job_id: 'job-1', amount: 900, status: 'billed' })
    const job = jobStub({ id: 'job-1', revenue: 600, payments_made: 0, invoices: [billed] })
    expect(jobPartialInvoiceRemainingDollars(job)).toBe(0)
    expect(clampPartialInvoiceCentsToUnallocated(job, 50)).toBe(0)
  })
})

describe('capable-to-bill kernel (quirk #8 consolidation)', () => {
  const bare = { invoices: [], payments: [] } as unknown as Pick<JobWithDetails, 'invoices' | 'payments'>

  it('computes valueCreated from pct and toBill net of amounts already off the job', () => {
    // 1000 bid, 50% done, 200 paid: 500 created − (1000 − 800 remaining) = 300 to bill
    expect(jobCapableToBillAmounts({ ...bare, revenue: 1000, payments_made: 200, pct_complete: 50 })).toEqual({
      toBill: 300,
      valueCreated: 500,
      openBilling: 0,
    })
  })

  it('treats null pct as zero value created (toBill 0 when nothing paid — remaining equals the bid)', () => {
    const r = jobCapableToBillAmounts({ ...bare, revenue: 1000, payments_made: 0, pct_complete: null })
    expect(r.valueCreated).toBe(0)
    expect(r.toBill).toBe(0)
  })

  it('clamps remaining at zero for overpaid jobs (toBill goes fully negative)', () => {
    const r = jobCapableToBillAmounts({ ...bare, revenue: 1000, payments_made: 1200, pct_complete: 50 })
    expect(r.toBill).toBe(-500)
  })

  it('subtracts billed-unpaid remainders — a billed job is no longer "capable" (v2.1927)', () => {
    // The prod shape that surfaced the bug: 40k bid, 80% done, $0 paid, full
    // 32k already sent as a bill → nothing left to ask for.
    const inv = rtbInvoiceStub({ id: 'inv-b', job_id: 'j', amount: 32_000, status: 'billed' })
    const r = jobCapableToBillAmounts({
      invoices: [inv],
      payments: [],
      revenue: 40_000,
      payments_made: 0,
      pct_complete: 80,
    } as unknown as Parameters<typeof jobCapableToBillAmounts>[0])
    expect(r.openBilling).toBe(32_000)
    expect(r.toBill).toBe(0)
  })

  it('subtracts ready-to-bill drafts too (already counted by the RTB exposure term of "ready to ask for")', () => {
    const draft = rtbInvoiceStub({ id: 'inv-r', job_id: 'j', amount: 300 })
    const r = jobCapableToBillAmounts({
      invoices: [draft],
      payments: [],
      revenue: 1000,
      payments_made: 200,
      pct_complete: 50,
    } as unknown as Parameters<typeof jobCapableToBillAmounts>[0])
    expect(r.openBilling).toBe(300)
    expect(r.toBill).toBe(0) // 500 created − 200 paid − 300 queued
  })

  it('open remainder nets payments applied to that invoice (no double subtraction with payments_made)', () => {
    // 3000 billed, 2000 applied to it: asked-for = 2000 paid + 1000 open = 3000 → 5000 done leaves 2000.
    const inv = rtbInvoiceStub({ id: 'inv-p', job_id: 'j', amount: 3000, status: 'billed' })
    const r = jobCapableToBillAmounts({
      invoices: [inv],
      payments: [{ invoice_id: 'inv-p', amount: 2000 }],
      revenue: 10_000,
      payments_made: 2000,
      pct_complete: 50,
    } as unknown as Parameters<typeof jobCapableToBillAmounts>[0])
    expect(r.openBilling).toBe(1000)
    expect(r.toBill).toBe(2000)
  })

  it('paid invoices do not reduce toBill (their money already lives in payments_made)', () => {
    const inv = rtbInvoiceStub({ id: 'inv-d', job_id: 'j', amount: 200, status: 'paid' })
    const r = jobCapableToBillAmounts({
      invoices: [inv],
      payments: [{ invoice_id: 'inv-d', amount: 200 }],
      revenue: 1000,
      payments_made: 200,
      pct_complete: 50,
    } as unknown as Parameters<typeof jobCapableToBillAmounts>[0])
    expect(r.openBilling).toBe(0)
    expect(r.toBill).toBe(300)
  })

  it('total clamps negatives per job; breakdown filters them and sorts descending', () => {
    const overbilled = rtbInvoiceStub({ id: 'inv-o', job_id: 'j', amount: 900, status: 'billed' })
    const a = { ...bare, revenue: 1000, payments_made: 200, pct_complete: 50 } // 300
    const b = { ...bare, revenue: 2000, payments_made: 0, pct_complete: 40 } // 800
    const c = { ...bare, revenue: 1000, payments_made: 0, pct_complete: null } // -1000
    const d = {
      invoices: [overbilled],
      payments: [],
      revenue: 1000,
      payments_made: 0,
      pct_complete: 60,
    } as unknown as typeof a // 600 created − 900 open = -300
    expect(capableToBillTotalFromWorking([a, b, c, d])).toBe(1100)
    const rows = buildCapableToBillBreakdownRows([a, b, c, d])
    expect(rows.map((r) => r.toBill)).toEqual([800, 300])
    expect(rows[0]!.job).toBe(b)
  })
})

describe('sortStagesJobsByEffectiveNumberDesc (C# interleaves with HCP)', () => {
  const numbered = (id: string, hcp: string | null, click: string | null, job_name = 'Job') =>
    jobStub({ id, invoices: [], hcp_number: hcp, click_number: click, job_name } as Partial<JobWithDetails> &
      Pick<JobWithDetails, 'id' | 'invoices'>)

  const order = (list: JobWithDetails[]) =>
    [...list].sort(sortStagesJobsByEffectiveNumberDesc).map((j) => j.id)

  it('interleaves a click-only job by its C#, not at the bottom', () => {
    // The reported bug: C#203 used to sink below HCP 100.
    const list = [
      numbered('hcp-100', '100', null),
      numbered('click-203', null, '203'),
      numbered('hcp-204', '204', null),
      numbered('hcp-200', '200', null),
    ]
    expect(order(list)).toEqual(['hcp-204', 'click-203', 'hcp-200', 'hcp-100'])
  })

  it('sorts numerically, not lexically (1000 beats 204)', () => {
    const list = [numbered('a', '204', null), numbered('b', '1000', null)]
    expect(order(list)).toEqual(['b', 'a'])
  })

  it('HCP wins over click number on the same job', () => {
    // hcp 100 + click 999 must sort as 100, below hcp 200.
    const list = [numbered('both', '100', '999'), numbered('plain', '200', null)]
    expect(order(list)).toEqual(['plain', 'both'])
  })

  it('treats blank/whitespace hcp as click-only', () => {
    const list = [numbered('blank-hcp', '   ', '300'), numbered('hcp-250', '250', null)]
    expect(order(list)).toEqual(['blank-hcp', 'hcp-250'])
  })

  it('puts jobs with no number at all last', () => {
    const list = [numbered('none', null, null), numbered('click-5', null, '5')]
    expect(order(list)).toEqual(['click-5', 'none'])
  })

  it('breaks ties on job name', () => {
    const list = [numbered('z', '10', null, 'Zeta'), numbered('a', '10', null, 'Alpha')]
    expect(order(list)).toEqual(['a', 'z'])
  })
})

describe('bankPaymentTargetsFromStageRows — Stripe-hosted lines (v2.1614)', () => {
  const billedInvoiceStub = (over: Partial<Record<string, unknown>> & { id: string; job_id: string; amount: number }) =>
    rtbInvoiceStub({ ...over, status: 'billed' })

  const billedJob = (id: string, invoices: unknown[]) =>
    jobStub({ id, status: 'billed', invoices: invoices as JobWithDetails['invoices'] })

  it('includes a Stripe-hosted billed line, flagged and labeled', () => {
    const inv = billedInvoiceStub({ id: 'inv-s', job_id: 'job-1', amount: 600, stripe_invoice_id: 'in_123' })
    const job = billedJob('job-1', [inv])
    const rows = buildBilledStageRows([job], [])
    const targets = bankPaymentTargetsFromStageRows(rows)
    const t = targets.find((x) => x.invoiceId === 'inv-s')
    expect(t).toBeTruthy()
    expect(t?.stripeHosted).toBe(true)
    expect(t?.label).toContain('· Stripe')
    expect(t?.searchLabel).toContain('Stripe')
  })

  it('non-Stripe billed line keeps stripeHosted false and an unmarked label', () => {
    const inv = billedInvoiceStub({ id: 'inv-n', job_id: 'job-2', amount: 600 })
    const job = billedJob('job-2', [inv])
    const rows = buildBilledStageRows([job], [])
    const targets = bankPaymentTargetsFromStageRows(rows)
    const t = targets.find((x) => x.invoiceId === 'inv-n')
    expect(t).toBeTruthy()
    expect(t?.stripeHosted).toBe(false)
    expect(t?.label).not.toContain('Stripe')
  })

  it('fully paid Stripe-hosted lines still drop out on remaining <= 0', () => {
    const inv = billedInvoiceStub({ id: 'inv-p', job_id: 'job-3', amount: 600, stripe_invoice_id: 'in_456' })
    const job = jobStub({
      id: 'job-3',
      status: 'billed',
      invoices: [inv] as JobWithDetails['invoices'],
      payments: [{ id: 'pay-1', amount: 600, invoice_id: 'inv-p' }] as JobWithDetails['payments'],
    })
    const rows = buildBilledStageRows([job], [])
    const targets = bankPaymentTargetsFromStageRows(rows)
    expect(targets.find((x) => x.invoiceId === 'inv-p')).toBeUndefined()
  })
})

describe('bankPaymentTargetsFromStageRows — payer names in targets and search', () => {
  const billedInvoiceStub = (over: Partial<Record<string, unknown>> & { id: string; job_id: string; amount: number }) =>
    rtbInvoiceStub({ ...over, status: 'billed' })

  it('carries customer and GC names and includes them in searchLabel', () => {
    const inv = billedInvoiceStub({ id: 'inv-c', job_id: 'job-c', amount: 1625 })
    const job = jobStub({
      id: 'job-c',
      status: 'billed',
      job_name: 'American Eagle',
      customer_name: 'Weiss Services LLC',
      gcCustomer: { id: 'gc-1', name: 'TF Harper Associates' },
      invoices: [inv] as JobWithDetails['invoices'],
    })
    const rows = buildBilledStageRows([job], [])
    const t = bankPaymentTargetsFromStageRows(rows).find((x) => x.invoiceId === 'inv-c')
    expect(t?.customerName).toBe('Weiss Services LLC')
    expect(t?.gcName).toBe('TF Harper Associates')
    expect(t?.searchLabel).toContain('Weiss Services LLC')
    expect(t?.searchLabel).toContain('TF Harper Associates')
  })

  it('skips a payer name already contained in the job name and blanks stay empty', () => {
    const inv = billedInvoiceStub({ id: 'inv-d', job_id: 'job-d', amount: 500 })
    const job = jobStub({
      id: 'job-d',
      status: 'billed',
      job_name: 'Weiss Services LLC- American Eagle',
      customer_name: 'Weiss Services LLC',
      invoices: [inv] as JobWithDetails['invoices'],
    })
    const rows = buildBilledStageRows([job], [])
    const t = bankPaymentTargetsFromStageRows(rows).find((x) => x.invoiceId === 'inv-d')
    expect(t?.customerName).toBe('Weiss Services LLC')
    expect(t?.gcName).toBe('')
    // Not duplicated: the job name already carries it.
    expect(t?.searchLabel.match(/Weiss Services LLC/g)?.length).toBe(1)
  })
})
