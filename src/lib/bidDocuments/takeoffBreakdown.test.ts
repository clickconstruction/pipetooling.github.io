import { describe, expect, it } from 'vitest'
import {
  buildExactTakeoffBreakdownHtml,
  buildRoughTakeoffBreakdownHtml,
  type ExactTakeoffBreakdownInput,
  type RoughTakeoffBreakdownInput,
} from './takeoffBreakdown'

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
    // p1: unit $1.50, qty 4, total $6.00 ; p2: unit $5.00, qty 2, total $10.00
    expect(body).toContain('$1.50')
    expect(body).toContain('$6.00')
    expect(body).toContain('$5.00')
    expect(body).toContain('$10.00')
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

describe('buildExactTakeoffBreakdownHtml', () => {
  const base: ExactTakeoffBreakdownInput = {
    title: 'My Bid — Takeoff Breakdown',
    stages: [
      {
        stageLabel: 'Rough In',
        rows: [
          {
            fixture: 'Toilet',
            count: 3,
            parts: [
              { partName: 'Closet Flange', quantity: 3, templateName: 'Toilet Rough' },
              { partName: 'Wax Ring', quantity: 3, templateName: 'Toilet Rough' },
            ],
          },
        ],
      },
      {
        stageLabel: 'Trim Set',
        rows: [{ fixture: 'Sink', count: 2, parts: [{ partName: 'Faucet', quantity: 2, templateName: 'Sink Trim' }] }],
      },
    ],
  }

  it('renders one stage heading per stage and the (Count: N) label', () => {
    const html = buildExactTakeoffBreakdownHtml(base)
    expect(html).toContain('>Rough In</h2>')
    expect(html).toContain('>Trim Set</h2>')
    expect(html).toContain('Toilet (Count: 3)')
    expect(html).toContain('Sink (Count: 2)')
  })

  it('renders parts in the given order with quantity and assembly', () => {
    const body = tbodyContents(buildExactTakeoffBreakdownHtml(base))[0] ?? ''
    expect(body.indexOf('Closet Flange')).toBeLessThan(body.indexOf('Wax Ring'))
    expect(body).toContain('Toilet Rough')
  })

  it('escapes the title, fixture, part and template names', () => {
    const html = buildExactTakeoffBreakdownHtml({
      title: 'T & <U>',
      stages: [{ stageLabel: 'Rough In', rows: [{ fixture: 'A&B', count: 1, parts: [{ partName: '<p>', quantity: 1, templateName: 'x&y' }] }] }],
    })
    expect(html).toContain('<title>T &amp; &lt;U&gt;</title>')
    expect(html).toContain('A&amp;B (Count: 1)')
    expect(html).toContain('&lt;p&gt;')
    expect(html).toContain('x&amp;y')
  })

  it('produces a doc with no sections when stages is empty', () => {
    const html = buildExactTakeoffBreakdownHtml({ title: 't', stages: [] })
    expect(html).toContain('<!DOCTYPE html>')
    expect(html).not.toContain('<h2')
  })
})
