import { describe, expect, it } from 'vitest'
import { DEFAULT_TEST_REPORT_EMAIL_TEMPLATE, buildTestReportEmail, testReportEmailSubject } from './testReportEmail'

const base = {
  reportLabel: 'Sewer Pre-Test Hydrostatic',
  address: '112 Seidel St, Marion, TX 78124',
  companyName: 'Click Plumbing',
  officePhone: '(512) 360-0599',
  bodyTemplate: DEFAULT_TEST_REPORT_EMAIL_TEMPLATE,
}

describe('buildTestReportEmail', () => {
  it('writes the email Taunya wrote by hand, pay link and amount included', () => {
    const e = buildTestReportEmail({ ...base, payUrl: 'https://invoice.stripe.com/i/acct_x/live_y', amountLabel: '$250.00' })
    expect(e.subject).toBe('Sewer Pre-Test Hydrostatic Test Report — 112 Seidel St')
    expect(e.text).toBe(
      'Attached is the Sewer Pre-Test Hydrostatic report for 112 Seidel St, Marion, TX 78124 and below is the invoice link. Please let us know if you have any questions.\n\nhttps://invoice.stripe.com/i/acct_x/live_y\n($250.00)\n\n— Click Plumbing · (512) 360-0599',
    )
    expect(e.html).toContain('<a href="https://invoice.stripe.com/i/acct_x/live_y"')
    expect(e.html).toContain('($250.00)')
    expect((e.html.match(/<p /g) ?? []).length).toBe(3)
  })

  it('drops the link line and the "and below is the invoice link" clause when there is no bill', () => {
    const e = buildTestReportEmail({ ...base, payUrl: null, amountLabel: null })
    expect(e.text).toBe('Attached is the Sewer Pre-Test Hydrostatic report for 112 Seidel St, Marion, TX 78124. Please let us know if you have any questions.\n\n— Click Plumbing · (512) 360-0599')
    expect(e.html).not.toContain('<a ')
  })

  it('honors a custom template and escapes HTML in the text', () => {
    const e = buildTestReportEmail({ ...base, payUrl: null, amountLabel: null, bodyTemplate: 'Report for {address} <attached>. {payLink}\n{company}' })
    expect(e.text).toBe('Report for 112 Seidel St, Marion, TX 78124 <attached>. \nClick Plumbing')
    expect(e.html).toContain('&lt;attached&gt;')
  })

  it('subjects fall back without an address, use the street only, and never say "Test Test" (v2.3326)', () => {
    expect(testReportEmailSubject('Gas Test', '')).toBe('Gas Test Report')
    expect(testReportEmailSubject('Gas Test', '4419 Duval Rd\nAustin TX')).toBe('Gas Test Report — 4419 Duval Rd')
    expect(testReportEmailSubject('Pinpoint Test', '12925 FM 20, Kingsbury, TX')).toBe('Pinpoint Test Report — 12925 FM 20')
    expect(testReportEmailSubject('Sewer Pre-Test Hydrostatic', '112 Seidel St, Marion')).toBe('Sewer Pre-Test Hydrostatic Test Report — 112 Seidel St')
  })
})
