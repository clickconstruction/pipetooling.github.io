import { describe, expect, it } from 'vitest'
import { buildPayStubHtml, type PayStubHtmlContext } from './buildPayStubHtml'
import { PAY_REPORT_EMPLOYER_NAME, PAY_REPORT_EIN } from '../../constants/payReportEmployerHeader'

function baseCtx(overrides: Partial<PayStubHtmlContext> = {}): PayStubHtmlContext {
  return {
    personName: 'Jane Doe',
    contact: { email: 'jane@example.com', phone: '555-1212' },
    periodStart: '2026-01-05',
    periodEnd: '2026-01-11',
    hourlyWage: 25,
    hoursRows: [
      { date: '2026-01-05', hours: 8 },
      { date: '2026-01-06', hours: 7.5 },
    ],
    hoursTotal: 15.5,
    grossPay: 387.5,
    ...overrides,
  }
}

describe('buildPayStubHtml', () => {
  it('renders the employer header, person name, contact, and gross pay', () => {
    const html = buildPayStubHtml(baseCtx())
    expect(html).toContain(PAY_REPORT_EMPLOYER_NAME)
    expect(html).toContain(`EIN: ${PAY_REPORT_EIN}`)
    expect(html).toContain('Jane Doe')
    expect(html).toContain('jane@example.com')
    expect(html).toContain('555-1212')
    expect(html).toContain('Gross Pay: $387.50')
    expect(html).toContain('Hourly wage: $25.00/hr')
    // Day rows include the weekday suffix.
    expect(html).toContain('2026-01-05 (Mon)')
    // Total row.
    expect(html).toContain('15.50')
  })

  it('omits contact lines when email/phone are null', () => {
    const html = buildPayStubHtml(baseCtx({ contact: { email: null, phone: null } }))
    expect(html).not.toContain('@example.com')
    expect(html).not.toContain('555-1212')
  })

  it('shows a dash for wage when hourly wage is zero (salary)', () => {
    const html = buildPayStubHtml(baseCtx({ hourlyWage: 0 }))
    expect(html).toContain('Hourly wage: —')
  })

  it('renders the Jobs / Bids column when rowsWithJobs is provided', () => {
    const html = buildPayStubHtml(
      baseCtx({
        rowsWithJobs: [{ date: '2026-01-05', hours: 8, jobsText: 'HCP-100 Smith Residence' }],
      }),
    )
    expect(html).toContain('Jobs / Bids')
    expect(html).toContain('HCP-100 Smith Residence')
  })

  it('computes Additional, Less totals and Net Pay', () => {
    const html = buildPayStubHtml(
      baseCtx({
        additionalLines: [{ description: 'Bonus', quantity: 1, rate: 100, line_total: 100 }],
        lessDeductionLines: [{ amount: 50, description: 'Tool charge', source: 'manual' }],
      }),
    )
    expect(html).toContain('Total Additional: $100.00')
    expect(html).toContain('Total Less: $50.00')
    // Net = gross (387.50) + additional (100) - less (50) = 437.50
    expect(html).toContain('Net Pay: $437.50')
    // Manual deduction tag.
    expect(html).toContain('Manual: Tool charge')
  })

  it('labels offset-sourced deductions as Offset', () => {
    const html = buildPayStubHtml(
      baseCtx({
        lessDeductionLines: [{ amount: 20, description: 'Backcharge', source: 'offset' }],
      }),
    )
    expect(html).toContain('Offset: Backcharge')
  })

  it('renders pending offsets, physical payments, vehicles and housing sections', () => {
    const html = buildPayStubHtml(
      baseCtx({
        pendingOffsets: [{ type: 'employee_credit', amount: 30, description: 'advance' }],
        physicalPayments: [{ paid_at: '2026-01-12T12:00:00Z', amount: 200, memo: 'check #45' }],
        vehicles: [
          { year: 2020, make: 'Ford', model: 'F-150', vin: 'ABC123', weekly_insurance_cost: 40, weekly_registration_cost: 5 },
        ],
        housingRows: [{ address: '1 Main St', rent_per_week: 100, utilities_per_week: 20, insurance_per_week: 10 }],
      }),
    )
    expect(html).toContain('Pending Offsets')
    expect(html).toContain('Employee credit (advance): $30.00')
    expect(html).toContain('Physical payments')
    expect(html).toContain('check #45')
    expect(html).toContain('Total paid: $200.00')
    expect(html).toContain('Vehicle: 2020 Ford F-150 (VIN: ABC123)')
    expect(html).toContain('Housing')
    expect(html).toContain('Address: 1 Main St')
  })

  it('escapes HTML in the person name', () => {
    const html = buildPayStubHtml(baseCtx({ personName: 'A <b>& "C"' }))
    expect(html).toContain('A &lt;b&gt;&amp; &quot;C&quot;')
    expect(html).not.toContain('<b>&')
  })
})
