import { describe, expect, it } from 'vitest'
import { buildGcStatementReportHtml } from './gcStatementReport'
import type { GcReviewGroup } from '../gcReviewRollup'

function group(over: Partial<GcReviewGroup> = {}): GcReviewGroup {
  return {
    key: 'gc-1',
    gcId: 'gc-1',
    gcName: 'Knight Contracting',
    isNoGc: false,
    rows: [
      {
        key: 'i1',
        jobId: 'j1',
        hcp: '828',
        jobName: 'Liberty Hill Animal Hospital',
        customerName: 'Rosemary Garza',
        referenceDateDisplay: 'Jul 12, 2026',
        ageDays: 19,
        remaining: 658,
        inCollections: false,
      },
    ],
    subtotal: 658,
    jobCount: 1,
    oldestAgeDays: 19,
    ...over,
  }
}

describe('buildGcStatementReportHtml', () => {
  it('single group titles as a GC statement and includes rows + subtotal', () => {
    const html = buildGcStatementReportHtml([group()], { dateStr: '7/31/2026' })
    expect(html).toContain('GC statement — Knight Contracting — 7/31/2026')
    expect(html).toContain('Rosemary Garza')
    expect(html).toContain('828')
    expect(html).toContain('Jul 12, 2026')
    expect(html).toContain('$658.00')
    expect(html).not.toContain('Total:') // no grand total for a single section
  })

  it('multiple groups title as GC Review and append a grand total', () => {
    const html = buildGcStatementReportHtml(
      [group(), group({ key: 'no-gc', gcId: null, gcName: 'No GC set', isNoGc: true, subtotal: 42, rows: [], jobCount: 0, oldestAgeDays: null })],
      { dateStr: '7/31/2026' },
    )
    expect(html).toContain('GC Review — billed awaiting payment — 7/31/2026')
    expect(html).toContain('Total: $700.00')
  })

  it('escapes HTML in names and marks Collections rows', () => {
    const html = buildGcStatementReportHtml([
      group({
        gcName: 'A&B <Builders>',
        rows: [{ ...group().rows[0]!, customerName: '<script>', inCollections: true }],
      }),
    ])
    expect(html).toContain('A&amp;B &lt;Builders&gt;')
    expect(html).toContain('&lt;script&gt;')
    expect(html).toContain('(Collections)')
    expect(html).not.toContain('<script>')
  })
})
