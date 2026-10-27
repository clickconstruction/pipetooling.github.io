import { describe, expect, it } from 'vitest'
import { estimatePaperModel, estimatePdfFileName, paperLines, type EstimatePaperRow } from './estimatePaper'

const line = (line_item: string, amount_cents: number, description = '') => ({ line_item, description, quantity: 1, unit_price_cents: amount_cents, amount_cents })
const pvc = { key: 'pvc', name: 'PVC water line', description: 'Supply, trench and cover.', recommended: true, kind: 'choice', line_items: [line('Water line (PVC)', 1_097_200, 'Up to 1,500 ft.')] }
const hdpe = { key: 'hdpe', name: 'HDPE water line', description: '', recommended: false, kind: 'choice', line_items: [line('Fused HDPE', 1_286_000), line('Fire connection', 55_000)] }

const row = (over: Partial<EstimatePaperRow> = {}): EstimatePaperRow => ({
  estimate_number: 175,
  title: 'Estimate for ZZ Test City',
  doc_kind: 'estimate',
  status: 'sent',
  sent_at: '2026-09-24T18:31:00Z',
  valid_until: '2026-11-26',
  line_items_snapshot: pvc.line_items,
  options_snapshot: [pvc, hdpe],
  terms_snapshot: 'Half down.\n\nThe rest on completion.',
  total_cents: 1_097_200,
  customer_email: 'clerk@zz-test.example',
  accept_header_brand: 'plum',
  change_order_fields: null,
  ...over,
})

const experience = { docTitleFallback: 'Estimate', docLineItemsHeading: 'Line items', docTermsHeading: 'Terms', docTotalLabel: 'Total', acceptPageFooter: 'Click Plumbing\n123 Main St\nLicense M-1' }

describe('estimatePaperModel', () => {
  it('a sent estimate with two options: the header, every option, the total, the terms, how to approve, no token', () => {
    const m = estimatePaperModel({ row: row(), customerName: 'ZZ Test City', forLine: '100 Test Rd, Seguin, TX', experience, termsHref: 'https://clicktooling.com/estimate/terms' })
    expect(m.fileName).toBe('Estimate 175 - ZZ Test City.pdf')
    expect(m.copyTitle).toBe('Estimate 175 · ZZ Test City')
    expect(m.company).toBe('Click Plumbing')
    expect(m.brand).toBe('plum')
    expect(m.title).toBe('Estimate for ZZ Test City')
    expect(m.kindLine).toBe('Estimate #175 · sent Sep 24, 2026')
    expect(m.forLine).toBe('For 100 Test Rd, Seguin, TX')
    expect(m.goodThrough).toBe('Good through Thu Nov 26, 2026')
    expect(m.linesHeading).toBe('What was offered')
    expect(m.blocks.map((b) => b.heading)).toEqual(['Option 1 · PVC water line', 'Option 2 · HDPE water line'])
    expect(m.blocks[0]!.tags).toEqual(['★ Recommended'])
    expect(m.blocks[0]!.pitch).toBe('Supply, trench and cover.')
    expect(m.blocks[0]!.lines).toEqual([{ name: 'Water line (PVC)', description: 'Up to 1,500 ft.', count: '1', unit: '$10,972.00', amount: '$10,972.00' }])
    expect(m.blocks[0]!.total).toBe('$10,972.00')
    expect(m.blocks[1]!.total).toBe('$13,410.00')
    expect(m.totalLine).toBe('Total $10,972.00')
    expect(m.totalNote).toBe('The recommended option, "PVC water line". The customer chooses on the acceptance page.')
    expect(m.acceptedLine).toBeNull()
    expect(m.terms).toEqual(['Half down.', 'The rest on completion.'])
    expect(m.termsLink).toBe('This estimate is subject to our Terms and Conditions: https://clicktooling.com/estimate/terms')
    expect(m.approve).toBe('To approve this estimate, open the link in the email sent to clerk@zz-test.example. The link is not in this file.')
    expect(JSON.stringify(m)).not.toMatch(/accept\?t=/)
    expect(m.footer).toEqual(['Click Plumbing', '123 Main St', 'License M-1'])
  })

  it('a single-price estimate: one block with no heading, the frozen lines, no note', () => {
    const m = estimatePaperModel({ row: row({ options_snapshot: null }), customerName: null, forLine: null, experience: null, termsHref: null })
    expect(m.fileName).toBe('Estimate 175.pdf')
    expect(m.forLine).toBeNull()
    expect(m.linesHeading).toBe('Line items')
    expect(m.blocks).toHaveLength(1)
    expect(m.blocks[0]!.heading).toBe('')
    expect(m.blocks[0]!.lines[0]!.name).toBe('Water line (PVC)')
    expect(m.totalNote).toBeNull()
    expect(m.termsLink).toBeNull()
    expect(m.company).toBe('Click Plumbing')
  })

  it('an accepted estimate draws what they took, says who accepted, and offers no approve line', () => {
    const m = estimatePaperModel({
      row: row({ status: 'customer_accepted', accepted_option_keys: ['hdpe'], accepted_option_key: 'hdpe', line_items_snapshot: hdpe.line_items, total_cents: 1_341_000, acceptor_printed_name: 'Dana Ruiz', acceptor_consented_at: '2026-10-02T20:10:00Z' }),
      customerName: 'ZZ Test City',
      forLine: null,
      experience,
      termsHref: null,
    })
    expect(m.blocks.map((b) => b.heading)).toEqual(['HDPE water line'])
    expect(m.blocks[0]!.tags).toEqual(['Accepted'])
    expect(m.totalLine).toBe('Total $13,410.00')
    expect(m.totalNote).toBe('Accepted "HDPE water line" · $13,410.00 (of 2 offered)')
    expect(m.acceptedLine).toBe('Accepted by Dana Ruiz on Oct 2, 2026.')
    expect(m.approve).toBe('')
  })

  it('a declined estimate keeps the paper and drops the approve line; no good-through when the row has none', () => {
    const m = estimatePaperModel({ row: row({ status: 'declined', valid_until: null, customer_email: null }), customerName: 'ZZ', forLine: null, experience, termsHref: null })
    expect(m.approve).toBe('')
    expect(m.goodThrough).toBeNull()
    expect(m.blocks).toHaveLength(2)
  })

  it('a change order: its facts, the signed money, no options', () => {
    const m = estimatePaperModel({
      row: row({ doc_kind: 'change_order', title: 'Add a hose bib', options_snapshot: null, total_cents: 120_000, line_items_snapshot: [line('Hose bib', 120_000)], change_order_fields: { description_of_change: 'One more bib', reason_for_change: 'Owner asked', impact_on_schedule: 'None', response_requested_by: '2026-11-01' } }),
      customerName: 'ZZ Test City',
      forLine: null,
      experience: { ...experience, docTotalLabel: 'Net change to contract', docLineItemsHeading: 'Impact on cost' },
      termsHref: null,
    })
    expect(m.fileName).toBe('Change order 175 - ZZ Test City.pdf')
    expect(m.kindLine).toBe('Change order #175 · sent Sep 24, 2026')
    expect(m.changeOrder).toEqual(['Description of change: One more bib', 'Reason for change: Owner asked', 'Impact on schedule: None', 'Response requested by: 2026-11-01'])
    expect(m.linesHeading).toBe('Impact on cost')
    expect(m.totalLine).toBe('Net change to contract $1,200.00')
    expect(m.approve).toBe('To approve this change order, open the link in the email sent to clerk@zz-test.example. The link is not in this file.')
  })

  it('file names stay file-safe and lines read their counts and money', () => {
    expect(estimatePdfFileName(9, 'A/B: "Co" <x>', 'estimate')).toBe('Estimate 9 - A B Co x.pdf')
    expect(paperLines([{ line_item: '', description: '', quantity: 2.5, unit_price_cents: 1000, amount_cents: 2500 }])).toEqual([{ name: '—', description: '', count: '2.5', unit: '$10.00', amount: '$25.00' }])
  })
})
