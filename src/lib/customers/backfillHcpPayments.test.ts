import { describe, expect, it } from 'vitest'
import {
  backfillPaymentNote,
  normalizeHcpNumber,
  parseHcpJobsExport,
  planHcpPaymentBackfill,
  type BackfillJobInput,
} from './backfillHcpPayments'

const HEADER = ['Job #', 'Customer name', 'Job created date', 'Job completed date', 'Job paid in full date', 'Paid amount']

function csvRow(over: Partial<Record<(typeof HEADER)[number], string>>): string[] {
  return HEADER.map((h) => over[h] ?? '')
}

function job(over: Partial<BackfillJobInput>): BackfillJobInput {
  return {
    id: 'j1',
    hcp_number: '010',
    click_number: null,
    job_name: 'Aaron Berg',
    customer_name: 'Aaron Berg',
    status: 'paid',
    revenue: 3732.5,
    created_at: '2026-02-26T10:00:00Z',
    ...over,
  }
}

describe('normalizeHcpNumber', () => {
  it('strips Excel quoting and leading zeros', () => {
    expect(normalizeHcpNumber('="010"')).toBe('10')
    expect(normalizeHcpNumber('010')).toBe('10')
    expect(normalizeHcpNumber(' 858 ')).toBe('858')
    expect(normalizeHcpNumber(null)).toBe('')
  })
})

describe('parseHcpJobsExport', () => {
  it('extracts dates and paid amount by header name', () => {
    const rows = parseHcpJobsExport([
      HEADER,
      csvRow({ 'Job #': '="010"', 'Job created date': '2026-02-01 08:00', 'Job paid in full date': '2026-03-04', 'Paid amount': '$3,732.50' }),
    ])
    expect(rows).toEqual([
      { hcpNumber: '10', paidOn: '2026-03-04', completedOn: null, createdOn: '2026-02-01', paidAmount: 3732.5 },
    ])
  })

  it('returns null when required headers are missing', () => {
    expect(parseHcpJobsExport([['Something', 'Else'], ['1', '2']])).toBeNull()
    expect(parseHcpJobsExport([])).toBeNull()
  })

  it('keeps the row with a paid date when a number appears twice', () => {
    const rows = parseHcpJobsExport([
      HEADER,
      csvRow({ 'Job #': '21', 'Job created date': '2026-01-01' }),
      csvRow({ 'Job #': '="021"', 'Job created date': '2026-01-01', 'Job paid in full date': '2026-02-02' }),
      csvRow({ 'Job #': '21', 'Job created date': '2026-03-03' }),
    ])
    expect(rows).toHaveLength(1)
    expect(rows![0]!.paidOn).toBe('2026-02-02')
  })
})

describe('planHcpPaymentBackfill', () => {
  const exportRows = parseHcpJobsExport([
    HEADER,
    csvRow({ 'Job #': '="010"', 'Job created date': '2026-02-01', 'Job completed date': '2026-02-20', 'Job paid in full date': '2026-03-04', 'Paid amount': '$3,732.50' }),
    csvRow({ 'Job #': '="020"', 'Job created date': '2026-02-05', 'Job completed date': '2026-02-21', 'Paid amount': '$100.00' }),
    csvRow({ 'Job #': '="030"', 'Job created date': '2026-02-06' }),
  ])!

  it('uses the HCP paid-in-full date when present', () => {
    const plan = planHcpPaymentBackfill([job({})], exportRows, new Set())
    expect(plan).toHaveLength(1)
    expect(plan[0]).toMatchObject({ jobId: 'j1', amount: 3732.5, paidOn: '2026-03-04', dateSource: 'hcp_paid', hcpPaid: 3732.5, label: '010' })
  })

  it('falls back completed → created → ledger created', () => {
    const completed = planHcpPaymentBackfill([job({ id: 'a', hcp_number: '020' })], exportRows, new Set())
    expect(completed[0]).toMatchObject({ paidOn: '2026-02-21', dateSource: 'hcp_completed' })
    const created = planHcpPaymentBackfill([job({ id: 'b', hcp_number: '030' })], exportRows, new Set())
    expect(created[0]).toMatchObject({ paidOn: '2026-02-06', dateSource: 'hcp_created' })
    const ledger = planHcpPaymentBackfill([job({ id: 'c', hcp_number: '999' })], exportRows, new Set())
    expect(ledger[0]).toMatchObject({ paidOn: '2026-02-26', dateSource: 'ledger_created' })
  })

  it('skips unpaid jobs, $0 shells, and jobs that already have payment rows', () => {
    const jobs = [
      job({ id: 'billed', status: 'billed' }),
      job({ id: 'zero', revenue: 0 }),
      job({ id: 'has-rows' }),
      job({ id: 'ok' }),
    ]
    const plan = planHcpPaymentBackfill(jobs, exportRows, new Set(['has-rows']))
    expect(plan.map((p) => p.jobId)).toEqual(['ok'])
  })

  it('newest payments first', () => {
    const plan = planHcpPaymentBackfill(
      [job({ id: 'old', hcp_number: '020' }), job({ id: 'new', hcp_number: '010' })],
      exportRows,
      new Set(),
    )
    expect(plan.map((p) => p.jobId)).toEqual(['new', 'old'])
  })
})

describe('backfillPaymentNote', () => {
  it('names the date source and flags an HCP amount mismatch', () => {
    const plan = planHcpPaymentBackfill([job({ revenue: 3000 })], parseHcpJobsExport([
      HEADER,
      csvRow({ 'Job #': '010', 'Job created date': '2026-02-01', 'Job paid in full date': '2026-03-04', 'Paid amount': '$3,732.50' }),
    ])!, new Set())
    expect(backfillPaymentNote(plan[0]!)).toBe('HCP payment backfill · date from HCP paid-in-full date · HCP recorded $3732.50')
  })

  it('omits the HCP amount when it matches', () => {
    const plan = planHcpPaymentBackfill([job({})], parseHcpJobsExport([
      HEADER,
      csvRow({ 'Job #': '010', 'Job created date': '2026-02-01', 'Job paid in full date': '2026-03-04', 'Paid amount': '$3,732.50' }),
    ])!, new Set())
    expect(backfillPaymentNote(plan[0]!)).toBe('HCP payment backfill · date from HCP paid-in-full date')
  })
})
