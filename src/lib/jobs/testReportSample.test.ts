import { describe, expect, it } from 'vitest'
import { DEFAULT_TEST_REPORT_SETTINGS } from './testReport'
import { TEST_REPORT_SAMPLE_PAY, testReportSampleEmail } from './testReportSample'

describe('testReportSampleEmail (v2.3338)', () => {
  it('builds the send-sheet email from the sample, prefixed and with the sample pay link', () => {
    const s = testReportSampleEmail('sewer-pre-pass', DEFAULT_TEST_REPORT_SETTINGS, '2026-09-10')
    expect(s.email.subject).toBe('[Sample] Sewer Pre-Test Hydrostatic Test Report — 112 Seidel St')
    expect(s.email.text).toContain(TEST_REPORT_SAMPLE_PAY.url)
    expect(s.email.text).toContain('($250.00)')
    expect(s.email.html).toContain('<a href="https://invoice.stripe.com/i/sample/test-report"')
    expect(s.pdfFilename).toMatch(/^Test-Report-Sewer-Pre-Test-.*\.pdf$/)
    expect(s.reportLabel).toBe('Sewer Pre-Test Hydrostatic')
  })

  it('gas reads "Gas Test Report", never "Gas Test Test Report"', () => {
    expect(testReportSampleEmail('gas', DEFAULT_TEST_REPORT_SETTINGS, '2026-09-10').email.subject).toBe('[Sample] Gas Test Report — 112 Seidel St')
  })
})
