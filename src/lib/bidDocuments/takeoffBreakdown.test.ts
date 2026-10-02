import { describe, expect, it } from 'vitest'
import { buildRoughTakeoffBreakdownHtml, type RoughTakeoffBreakdownInput } from './takeoffBreakdown'

function tbodyContents(html: string): string[] {
  return Array.from(html.matchAll(/<tbody>([\s\S]*?)<\/tbody>/g)).map((m) => m[1] ?? '')
}

describe('buildRoughTakeoffBreakdownHtml', () => {
  const base: RoughTakeoffBreakdownInput = {
    title: 'My Bid — Rough Takeoff',
    rows: [
      { id: 'r1', fixture: 'Toilet', count: 3 },
      { id: 'r2', fixture: 'Sink', count: 2 },
    ],
    lines: [
      { countRowId: 'r1', partId: 'p2', quantity: 2, unitPrice: 5, sequenceOrder: 1 },
      { countRowId: 'r1', partId: 'p1', quantity: 4, unitPrice: 1.5, sequenceOrder: 0 },
    ],
    partNameById: { p1: 'PVC Pipe', p2: 'Wax Ring' },
  }

  it('emits a section only for fixtures that have lines', () => {
    const html = buildRoughTakeoffBreakdownHtml(base)
    expect(html).toContain('Toilet')
    // Sink (r2) has no lines -> no section.
    expect(html).not.toContain('Sink')
    expect(tbodyContents(html)).toHaveLength(1)
  })

  it('orders lines by sequenceOrder and formats unit/total as $x.xx', () => {
    const body = tbodyContents(buildRoughTakeoffBreakdownHtml(base))[0] ?? ''
    // p1 (seq 0) comes before p2 (seq 1).
    expect(body.indexOf('PVC Pipe')).toBeLessThan(body.indexOf('Wax Ring'))
    // Totals are count-weighted (Toilet count 3): p1 unit $1.50 x qty 4 x 3 = $18.00 ;
    // p2 unit $5.00 x qty 2 x 3 = $30.00.
    expect(body).toContain('$1.50')
    expect(body).toContain('$18.00')
    expect(body).toContain('$5.00')
    expect(body).toContain('$30.00')
  })

  it('shows the (count N) label and em dash for a null fixture', () => {
    const html = buildRoughTakeoffBreakdownHtml({
      title: 't',
      rows: [{ id: 'r1', fixture: null, count: 7 }],
      lines: [{ countRowId: 'r1', partId: 'p1', quantity: 1, unitPrice: 2, sequenceOrder: 0 }],
      partNameById: { p1: 'Elbow' },
    })
    expect(html).toContain('(count 7)')
    expect(html).toContain('—')
  })

  it('falls back to the first 8 chars of the part id when the name is missing', () => {
    const html = buildRoughTakeoffBreakdownHtml({
      title: 't',
      rows: [{ id: 'r1', fixture: 'F', count: 1 }],
      lines: [{ countRowId: 'r1', partId: 'abcdefgh-1234', quantity: 1, unitPrice: 1, sequenceOrder: 0 }],
      partNameById: {},
    })
    expect(html).toContain('abcdefgh')
    expect(html).not.toContain('abcdefgh-1234')
  })

  it('escapes the title and part names', () => {
    const html = buildRoughTakeoffBreakdownHtml({
      title: 'A & B <x>',
      rows: [{ id: 'r1', fixture: 'F', count: 1 }],
      lines: [{ countRowId: 'r1', partId: 'p1', quantity: 1, unitPrice: 1, sequenceOrder: 0 }],
      partNameById: { p1: '1/2" <pipe>' },
    })
    expect(html).toContain('<title>A &amp; B &lt;x&gt;</title>')
    expect(html).toContain('1/2&quot; &lt;pipe&gt;')
  })

  it('produces a doc with an empty body when there are no lines', () => {
    const html = buildRoughTakeoffBreakdownHtml({ title: 't', rows: [{ id: 'r1', fixture: 'F', count: 1 }], lines: [], partNameById: {} })
    expect(html).toContain('<!DOCTYPE html>')
    expect(tbodyContents(html)).toHaveLength(0)
  })
})
