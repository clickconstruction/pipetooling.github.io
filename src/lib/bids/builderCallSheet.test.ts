import { describe, expect, it } from 'vitest'
import { buildBuilderCallSheetHtml, buildFollowupQueueCallSheetHtml, type CallSheetBuilder } from './builderCallSheet'

const BUILDER: CallSheetBuilder = {
  name: 'Sai Engineers & Contractors',
  address: '1708 W. San Antonio St, Lockhart TX',
  phone: '(512) 555-0100',
  lastContactLabel: '3 months ago',
  hitRatePct: 25,
  openValueLabel: '$360k',
  people: [{ name: 'Ravi Patel', phones: ['(512) 555-0142'], email: 'ravi@saiec.com', note: 'PM' }],
  bids: [
    { label: 'REGAN SQUARE PR5 (214)', sectionLabel: 'Not yet won or lost', dueLabel: '04/12', lastUpdateLabel: '1 month ago' },
    { label: 'Lockhart Retail Shell', sectionLabel: 'Unsent', dueLabel: '08/12', lastUpdateLabel: null },
  ],
}

describe('buildBuilderCallSheetHtml', () => {
  it('renders name, tel links, meta chips, and every bid line', () => {
    const html = buildBuilderCallSheetHtml(BUILDER, 'Aug 4, 2026 for Wendi')
    expect(html).toContain('Sai Engineers &amp; Contractors')
    expect(html).toContain('tel:(512) 555-0142')
    expect(html).toContain('25% hit rate')
    expect(html).toContain('$360k open')
    expect(html).toContain('REGAN SQUARE PR5 (214)')
    expect(html).toContain('no update')
    expect(html).toContain('Aug 4, 2026 for Wendi')
  })

  it('escapes HTML in user-entered fields', () => {
    const html = buildBuilderCallSheetHtml(
      { ...BUILDER, name: 'Evil <script>alert(1)</script> Co', people: [], bids: [] },
      'now',
    )
    expect(html).not.toContain('<script>alert')
    expect(html).toContain('&lt;script&gt;')
    expect(html).toContain('No contact people on file.')
    expect(html).toContain('No open bids.')
  })
})

describe('buildFollowupQueueCallSheetHtml', () => {
  it('renders one section per builder with a count header', () => {
    const html = buildFollowupQueueCallSheetHtml([BUILDER, { ...BUILDER, name: 'Knight Contracting' }], 'today')
    expect(html).toContain('2 builders')
    expect((html.match(/<section>/g) ?? []).length).toBe(2)
    expect(html).toContain('Knight Contracting')
  })
})
