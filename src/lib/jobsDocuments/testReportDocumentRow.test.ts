import { describe, expect, it } from 'vitest'
import { testReportDocumentRow } from './testReportDocumentRow'

const base = { id: 'r1', test_type: 'pre_test', system: 'sewer', result: 'pass', test_date: '2026-09-10', status: 'sent', sent_at: '2026-09-11T15:00:00Z', pdf_path: 'j1/r1-v1.pdf', pdf_version: 1 }

describe('testReportDocumentRow', () => {
  it('a sent hydrostatic PASS opens its stored PDF, chipped PASS + Sent', () => {
    const r = testReportDocumentRow(base)
    expect(r.title).toBe('Sewer Pre-Test Hydrostatic test report')
    expect(r.detail).toBe('tested Sep 10')
    expect(r.chips.map((c) => c.label)).toEqual(['PASS', 'Sent Sep 11'])
    expect(r.door).toEqual({ kind: 'pdf', path: 'j1/r1-v1.pdf' })
    expect(r.searchText).toContain('hydrostatic')
    expect(r.searchText).toContain('pass')
  })

  it('a draft opens the modal and carries the Draft chip; FAIL is red', () => {
    const r = testReportDocumentRow({ ...base, result: 'fail', status: 'draft', sent_at: null, pdf_path: null })
    expect(r.chips).toEqual([
      { label: 'FAIL', tone: 'fail' },
      { label: 'Draft', tone: 'draft' },
    ])
    expect(r.door).toEqual({ kind: 'modal' })
  })

  it('gas and pinpoint carry no verdict chip and do not say "Test test report"', () => {
    const gas = testReportDocumentRow({ ...base, test_type: 'gas', system: null, result: null, pdf_version: 2 })
    expect(gas.title).toBe('Gas Test report')
    expect(gas.detail).toBe('tested Sep 10 · v2')
    expect(gas.chips.map((c) => c.label)).toEqual(['Sent Sep 11'])
    const pin = testReportDocumentRow({ ...base, test_type: 'pinpoint', system: null, result: null })
    expect(pin.title).toBe('Pinpoint Test report')
  })

  it('a sent row that lost its file falls back to the modal', () => {
    expect(testReportDocumentRow({ ...base, pdf_path: null }).door).toEqual({ kind: 'modal' })
  })
})
