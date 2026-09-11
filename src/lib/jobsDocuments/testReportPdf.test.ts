import { describe, expect, it, vi } from 'vitest'

/** Recording jsPDF stand-in (the physicalInvoicePdf test's pattern): what is drawn, on which page. */
type TextCall = { page: number; text: string; x: number; y: number; align?: string; size: number; font: string }

class FakeJsPDF {
  static last: FakeJsPDF | null = null
  calls: TextCall[] = []
  pages = 1
  page = 1
  fontSize = 16
  fontStyle = 'normal'
  lines: Array<{ page: number; x1: number; y1: number; x2: number; y2: number }> = []
  internal = { pageSize: { getWidth: () => 215.9, getHeight: () => 279.4 } }
  constructor() {
    FakeJsPDF.last = this
  }
  setFontSize(n: number) { this.fontSize = n }
  setFont(_name: string, style?: string) { this.fontStyle = style ?? 'normal' }
  setTextColor() {}
  setDrawColor() {}
  setLineWidth() {}
  addPage() { this.pages += 1; this.page = this.pages }
  getTextWidth(s: string) { return s.length * this.fontSize * 0.19 }
  splitTextToSize(text: string, width: number): string[] {
    const perLine = Math.max(1, Math.floor(width / (this.fontSize * 0.19)))
    const out: string[] = []
    for (const para of String(text).split('\n')) {
      if (para.length <= perLine) { out.push(para); continue }
      const words = para.split(' ')
      let cur = ''
      for (const w of words) {
        const next = cur ? `${cur} ${w}` : w
        if (next.length > perLine && cur) { out.push(cur); cur = w } else cur = next
      }
      if (cur) out.push(cur)
    }
    return out
  }
  text(t: string | string[], x: number, y: number, opts?: { align?: string }) {
    const arr = Array.isArray(t) ? t : [t]
    arr.forEach((line, i) => this.calls.push({ page: this.page, text: line, x, y: y + i * 4, align: opts?.align, size: this.fontSize, font: this.fontStyle }))
  }
  line(x1: number, y1: number, x2: number, y2: number) { this.lines.push({ page: this.page, x1, y1, x2, y2 }) }
  output(_kind: 'blob') { return new Blob([`fake-pdf pages=${this.pages}`], { type: 'application/pdf' }) }
}

vi.mock('../loadJsPDF', () => ({ loadJsPDF: async () => FakeJsPDF }))

import { buildTestReportPdfBlob, testReportPdfToBase64 } from './testReportPdf'
import { DEFAULT_TEST_REPORT_SETTINGS, emptyTestReportData, type TestReportJobInfo } from '../jobs/testReport'

const job: TestReportJobInfo = {
  jobNumber: '1014',
  jobName: 'Johnson Pretest',
  jobAddress: '112 Seidel St, Marion, TX 78124',
  customerName: 'Anna & Jeffrey Johnson',
  customerEmail: null,
  customerPhone: '(830) 351-4600',
  customerCompany: 'Done Right Foundation Repair',
}

describe('renderTestReportPdf', () => {
  it('draws the letterhead, the columns, the verdict and the certification on one page', async () => {
    const data = { ...emptyTestReportData('pre_test', '2026-09-10'), system: 'sewer' as const, result: 'pass' as const, notes: 'PVC.' }
    const blob = await buildTestReportPdfBlob(data, job, DEFAULT_TEST_REPORT_SETTINGS)
    expect(blob.type).toBe('application/pdf')
    const pdf = FakeJsPDF.last!
    expect(pdf.pages).toBe(1)
    const texts = pdf.calls.map((c) => c.text)
    expect(texts).toContain('CLICK PLUMBING')
    expect(texts).toContain('PLUMBING, ELECTRICAL, AND HVAC')
    expect(texts).toContain('Sewer Pre-Test Hydrostatic Test Report')
    expect(texts).toContain('September 10, 2026 · Job 1014')
    expect(texts).toContain('CUSTOMER')
    expect(texts).toContain('TEST LOCATION')
    expect(texts).toContain('112 Seidel St')
    expect(texts).toContain('Done Right Foundation Repair')
    expect(texts).toContain('PASS')
    expect(texts).toContain(' — No leaks or pressure loss detected')
    expect(texts).toContain('Conclusion:')
    expect(texts).toContain('Notes:')
    expect(texts).toContain('CERTIFICATION')
    expect(texts).toContain('Malachi Whites (#RMP41130)')
    expect(texts).toContain('TSBPE: 929 East 41st St Austin TX 78751')
    // The title is right-aligned; the company is left.
    expect(pdf.calls.find((c) => c.text === 'Sewer Pre-Test Hydrostatic Test Report')?.align).toBe('right')
    expect(pdf.calls.find((c) => c.text === 'CLICK PLUMBING')?.x).toBe(18)
    // The verdict word is bold and sits on the same baseline as its explanation.
    const verdict = pdf.calls.find((c) => c.text === 'PASS')!
    const explain = pdf.calls.find((c) => c.text === ' — No leaks or pressure loss detected')!
    expect(verdict.font).toBe('bold')
    expect(explain.y).toBe(verdict.y)
  })

  it('paginates a long fail report instead of clipping', async () => {
    const data = {
      ...emptyTestReportData('pre_test', '2026-09-10'),
      system: 'supply' as const,
      result: 'fail' as const,
      notes: Array.from({ length: 40 }, (_, i) => `Observation ${i + 1}: water level dropped again during the interval, measured and photographed.`).join('\n'),
    }
    await buildTestReportPdfBlob(data, job, DEFAULT_TEST_REPORT_SETTINGS)
    const pdf = FakeJsPDF.last!
    expect(pdf.pages).toBeGreaterThan(1)
    expect(pdf.calls.filter((c) => c.page === pdf.pages).some((c) => c.text.startsWith('TSBPE'))).toBe(true)
    expect(pdf.calls.find((c) => c.text === 'FAIL')?.font).toBe('bold')
  })

  it('renders the gas sections and the total in bold', async () => {
    const data = { ...emptyTestReportData('gas', '2026-09-10'), gasPressurePsi: 0.5, gasFixtures: [{ name: 'Furnace', btuPerHour: 100_000 }, { name: 'Range', btuPerHour: 65_000 }] }
    await buildTestReportPdfBlob(data, job, DEFAULT_TEST_REPORT_SETTINGS)
    const pdf = FakeJsPDF.last!
    const texts = pdf.calls.map((c) => c.text)
    expect(texts).toContain('HOUSE PRESSURE')
    expect(texts).toContain('HOUSE UTILITIES')
    expect(texts).toContain('13.84')
    expect(texts).toContain('165,000 BTU/hr')
    expect(pdf.calls.find((c) => c.text === '165,000 BTU/hr')?.font).toBe('bold')
    // Gas puts the date under the location.
    expect(texts).toContain('Date')
  })

  it('base64-encodes the blob', async () => {
    const b64 = await testReportPdfToBase64(new Blob(['hello'], { type: 'application/pdf' }))
    expect(b64).toBe('aGVsbG8=')
  })
})
