import { describe, expect, it } from 'vitest'
import { buildPartnerPayReportHtml, partnerStatementRemainder, type PartnerPayReportContext } from './partnerPayReportHtml'

function baseCtx(overrides: Partial<PartnerPayReportContext> = {}): PartnerPayReportContext {
  return {
    personName: 'Bryan',
    periodStart: '2026-08-09',
    periodEnd: '2026-08-15',
    hoursTotal: 12.8,
    grossPay: 450.1,
    days: [
      { work_date: '2026-08-10', hours: 4.2, rate: 35, paid: 147 },
      { work_date: '2026-08-13', hours: 8.6, rate: 35.25, paid: 303.1 },
    ],
    additionalLines: [],
    deductions: [],
    payments: [],
    generatedYmd: '2026-08-22',
    ...overrides,
  }
}

describe('partnerStatementRemainder', () => {
  it('is gross + additions − deductions − payouts, rounded to cents', () => {
    expect(
      partnerStatementRemainder({
        grossPay: 450.1,
        additionalLines: [{ description: 'Profit share', line_total: 100.005 }],
        deductions: [{ description: 'Back-charge', amount: 50 }],
        payments: [{ paid_at: '2026-08-13T00:00:00Z', amount: 200, memo: null }],
      }),
    ).toBe(300.11)
  })

  it('goes negative when payouts overran the statement', () => {
    expect(
      partnerStatementRemainder({ grossPay: 100, additionalLines: [], deductions: [], payments: [{ paid_at: 'x', amount: 150, memo: null }] }),
    ).toBe(-50)
  })
})

describe('buildPartnerPayReportHtml', () => {
  it('renders header, per-day rows with stamped rates, and totals', () => {
    const html = buildPartnerPayReportHtml(baseCtx())
    expect(html).toContain('Pay report — Bryan')
    expect(html).toContain('Week 2026-08-09 – 2026-08-15')
    expect(html).toContain('$35.00/hr')
    expect(html).toContain('$35.25/hr')
    expect(html).toContain('$450.10')
    expect(html).toContain('12.8 h')
  })

  it('lists attached additions, deductions, and payouts with memos', () => {
    const html = buildPartnerPayReportHtml(
      baseCtx({
        additionalLines: [{ description: 'Profit share — Job 781', line_total: 100 }],
        deductions: [{ description: 'Back-charge — return trip', amount: 50 }],
        payments: [{ paid_at: '2026-08-13T18:00:00Z', amount: 200, memo: 'CashApp advance' }],
      }),
    )
    expect(html).toContain('Plus: Profit share — Job 781')
    expect(html).toContain('Less: Back-charge — return trip')
    expect(html).toContain('CashApp advance')
    // remainder: 450.10 + 100 − 50 − 200
    expect(html).toContain('$300.10')
  })

  it('escapes HTML in descriptions and memos', () => {
    const html = buildPartnerPayReportHtml(
      baseCtx({ additionalLines: [{ description: '<script>alert(1)</script>', line_total: 1 }] }),
    )
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('shows an empty-state row when the week has no per-day detail', () => {
    const html = buildPartnerPayReportHtml(baseCtx({ days: [] }))
    expect(html).toContain('No per-day detail recorded for this week.')
  })
})
