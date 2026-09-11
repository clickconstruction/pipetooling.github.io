import { describe, expect, it } from 'vitest'
import { jobStripePayLink, parseGasFixtures, testReportDataFromRow, testReportJobInfoFromJob, testReportRowFromData, testReportStatusLabel, type TestReportRow } from './testReportRow'
import { emptyTestReportData } from './testReport'
import type { JobWithDetails } from '../../types/jobWithDetails'

function row(over: Partial<TestReportRow> = {}): TestReportRow {
  return {
    id: 'r1',
    job_id: 'j1',
    test_type: 'pre_test',
    system: 'sewer',
    result: 'pass',
    test_date: '2026-09-10',
    duration_minutes: 60,
    notes: 'PVC.',
    pinpoint_location: '',
    pinpoint_method: '',
    pinpoint_findings: '',
    gas_pressure_psi: null,
    gas_fixtures: [],
    system_tested: null,
    test_method: null,
    test_pressure: null,
    conclusion: null,
    certifier_name: null,
    certifier_license: null,
    source_report_id: null,
    status: 'draft',
    pdf_path: null,
    pdf_version: 0,
    sent_at: null,
    sent_to: [],
    sent_cc: [],
    sent_by: null,
    sent_pay_url: null,
    created_by: null,
    created_at: '2026-09-11T00:00:00Z',
    updated_at: '2026-09-11T00:00:00Z',
    ...over,
  }
}

describe('row ↔ data', () => {
  it('reads a hydrostatic row', () => {
    const d = testReportDataFromRow(row())
    expect(d).toMatchObject({ testType: 'pre_test', system: 'sewer', result: 'pass', testDateYmd: '2026-09-10', durationMinutes: 60, notes: 'PVC.', gasFixtures: [] })
  })

  it('reads gas fixtures and a numeric-as-string pressure, dropping junk', () => {
    const d = testReportDataFromRow(row({ test_type: 'gas', system: null, result: null, gas_pressure_psi: '0.5' as unknown as number, gas_fixtures: [{ name: 'Furnace', btuPerHour: 100000 }, { name: 'Range', btuPerHour: '65000' }, 'junk', { name: 7 }] }))
    expect(d.gasPressurePsi).toBe(0.5)
    expect(d.gasFixtures).toEqual([
      { name: 'Furnace', btuPerHour: 100000 },
      { name: 'Range', btuPerHour: 65000 },
      { name: '', btuPerHour: null },
    ])
    expect(parseGasFixtures(null)).toEqual([])
  })

  it('falls back on an unknown type and tolerates nulls', () => {
    const d = testReportDataFromRow(row({ test_type: 'bogus', system: 'x', result: 'maybe', duration_minutes: null, notes: null as unknown as string }))
    expect(d.testType).toBe('pre_test')
    expect(d.system).toBeNull()
    expect(d.result).toBeNull()
    expect(d.notes).toBe('')
  })

  it('writes only the fields the type uses and blanks the overrides', () => {
    const hydro = testReportRowFromData({ ...emptyTestReportData('post_test', '2026-09-10'), system: 'supply', result: 'fail', pinpointFindings: 'stale', gasPressurePsi: 3, systemTested: '  ', conclusion: 'Custom.' })
    expect(hydro).toMatchObject({ test_type: 'post_test', system: 'supply', result: 'fail', duration_minutes: 60, pinpoint_findings: '', gas_pressure_psi: null, gas_fixtures: [], system_tested: null, conclusion: 'Custom.' })
    const gas = testReportRowFromData({ ...emptyTestReportData('gas', '2026-09-10'), system: 'sewer', result: 'pass', gasPressurePsi: 0.5, gasFixtures: [{ name: ' Furnace ', btuPerHour: 100000 }] })
    expect(gas).toMatchObject({ test_type: 'gas', system: null, result: null, duration_minutes: null, gas_pressure_psi: 0.5, gas_fixtures: [{ name: 'Furnace', btuPerHour: 100000 }] })
  })
})

describe('job reads', () => {
  const job = {
    hcp_number: ' 1014 ',
    job_name: 'Johnson Pretest',
    job_address: '112 Seidel St, Marion, TX 78124',
    customer_name: 'Anna & Jeffrey Johnson',
    customer_email: '',
    customer_phone: '(830) 555-0142',
    gcCustomer: { id: 'gc', name: 'Done Right Foundation Repair' },
    invoices: [
      { id: 'i1', status: 'paid', hosted_invoice_url: 'https://invoice.stripe.com/old', billed_at: '2026-08-01', sequence_order: 1, amount: 250 },
      { id: 'i2', status: 'billed', hosted_invoice_url: 'https://invoice.stripe.com/new', billed_at: '2026-09-11', sequence_order: 2, amount: 250 },
      { id: 'i3', status: 'billed', hosted_invoice_url: null, billed_at: '2026-09-12', sequence_order: 3, amount: 100 },
    ],
  } as unknown as JobWithDetails

  it('builds the paper header from the job and the GC', () => {
    expect(testReportJobInfoFromJob(job)).toEqual({
      jobNumber: '1014',
      jobName: 'Johnson Pretest',
      jobAddress: '112 Seidel St, Marion, TX 78124',
      customerName: 'Anna & Jeffrey Johnson',
      customerEmail: null,
      customerPhone: '(830) 555-0142',
      customerCompany: 'Done Right Foundation Repair',
    })
  })

  it('finds the newest billed Stripe link and ignores paid or link-less bills', () => {
    expect(jobStripePayLink(job)).toEqual({ url: 'https://invoice.stripe.com/new', amount: 250, invoiceId: 'i2' })
    expect(jobStripePayLink({ invoices: [] })).toBeNull()
  })

  it('labels drafts and sends', () => {
    expect(testReportStatusLabel({ status: 'draft', sent_at: null })).toBe('Draft')
    expect(testReportStatusLabel({ status: 'sent', sent_at: '2026-09-11T14:00:00Z' })).toMatch(/^Sent Sep 1[12]$/)
    expect(testReportStatusLabel({ status: 'sent', sent_at: null })).toBe('Sent')
  })
})
