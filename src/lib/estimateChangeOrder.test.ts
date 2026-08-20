import { describe, expect, it } from 'vitest'
import {
  buildEstimateChangeOrderDocHtml,
  buildEstimateChangeOrderDocText,
  changeOrderDocDisplayTitle,
  changeOrderNetChangeCents,
  EMPTY_ESTIMATE_CHANGE_ORDER_FIELDS,
  formatSignedCentsUsd,
  isChangeOrderDocKind,
  parseEstimateChangeOrderFields,
  type EstimateChangeOrderDocArgs,
} from './estimateChangeOrder'
import { computeEstimateLineExtendedCents, normalizeEstimateLineItemsFromJson } from './estimateLineItemNormalize'

describe('parseEstimateChangeOrderFields', () => {
  it('parses a full jsonb payload', () => {
    expect(
      parseEstimateChangeOrderFields({
        description_of_change: 'Reroute condensate',
        reason_for_change: 'RTU moved',
        impact_on_schedule: '+2 days',
        response_requested_by: '2026-08-26',
      })
    ).toEqual({
      description_of_change: 'Reroute condensate',
      reason_for_change: 'RTU moved',
      impact_on_schedule: '+2 days',
      response_requested_by: '2026-08-26',
    })
  })

  it('null / arrays / junk values fall back to empty fields', () => {
    expect(parseEstimateChangeOrderFields(null)).toEqual(EMPTY_ESTIMATE_CHANGE_ORDER_FIELDS)
    expect(parseEstimateChangeOrderFields([1, 2])).toEqual(EMPTY_ESTIMATE_CHANGE_ORDER_FIELDS)
    expect(parseEstimateChangeOrderFields({ description_of_change: 42 })).toEqual(EMPTY_ESTIMATE_CHANGE_ORDER_FIELDS)
  })
})

describe('doc kind + money', () => {
  it('isChangeOrderDocKind only for change_order', () => {
    expect(isChangeOrderDocKind('change_order')).toBe(true)
    expect(isChangeOrderDocKind('estimate')).toBe(false)
    expect(isChangeOrderDocKind(null)).toBe(false)
  })

  it('net change sums signed amounts (credits subtract)', () => {
    expect(changeOrderNetChangeCents([{ amount_cents: 284000 }, { amount_cents: -39000 }])).toBe(245000)
  })

  it('formatSignedCentsUsd renders credits with a minus sign', () => {
    expect(formatSignedCentsUsd(245000)).toBe('$2,450.00')
    expect(formatSignedCentsUsd(-39000)).toBe('−$390.00')
  })
})

describe('changeOrderDocDisplayTitle', () => {
  it('rewrites the "Estimate for" default to "Change Order for"', () => {
    expect(changeOrderDocDisplayTitle('Estimate for Knight Contracting')).toBe('Change Order for Knight Contracting')
    expect(changeOrderDocDisplayTitle('  estimate for Knight Contracting  ')).toBe('Change Order for Knight Contracting')
    expect(changeOrderDocDisplayTitle('Estimate for customer')).toBe('Change Order for customer')
  })

  it('rewrites bare generic estimate titles to "Change order"', () => {
    expect(changeOrderDocDisplayTitle('Estimate')).toBe('Change order')
    expect(changeOrderDocDisplayTitle('New estimate')).toBe('Change order')
  })

  it('leaves hand-written titles and empties alone', () => {
    expect(changeOrderDocDisplayTitle('Deep cleaning of AC units')).toBe('Deep cleaning of AC units')
    expect(changeOrderDocDisplayTitle('Change Order for Knight Contracting')).toBe('Change Order for Knight Contracting')
    expect(changeOrderDocDisplayTitle('Revised estimate for review')).toBe('Revised estimate for review')
    expect(changeOrderDocDisplayTitle('')).toBe('')
    expect(changeOrderDocDisplayTitle('Estimate for ')).toBe('Estimate for')
  })
})

describe('negative lines via allowNegative (credits)', () => {
  it('normalize keeps negative unit prices only when opted in', () => {
    const raw = [{ line_item: 'Credit', description: 'delete stub-out', quantity: 1, unit_price_cents: -39000 }]
    expect(normalizeEstimateLineItemsFromJson(raw)[0]!.amount_cents).toBe(0)
    expect(normalizeEstimateLineItemsFromJson(raw, { allowNegative: true })[0]!.amount_cents).toBe(-39000)
  })

  it('extended cents multiplies signed prices when opted in', () => {
    expect(computeEstimateLineExtendedCents(2, -500, { allowNegative: true })).toBe(-1000)
    expect(computeEstimateLineExtendedCents(2, -500)).toBe(0)
  })
})

const docArgs: EstimateChangeOrderDocArgs = {
  documentLabel: 'Change Order #1044',
  customerName: 'Summit GC',
  customerAddress: '3915 N Loop 1604 E, San Antonio, TX',
  projectLabel: 'J804 · Auto Zone',
  projectAddress: '3915 N Loop 1604 E, San Antonio, TX',
  fields: {
    description_of_change: 'Reroute 2" condensate line <per plan>',
    reason_for_change: 'Owner-directed RTU relocation',
    impact_on_schedule: '+2 working days',
    response_requested_by: '2026-08-26',
  },
  lines: [
    { line_item: 'Reroute', description: 'labor + materials', quantity: 1, unit_price_cents: 284000, amount_cents: 284000 },
    { line_item: 'Credit', description: 'delete original stub-out', quantity: 1, unit_price_cents: -39000, amount_cents: -39000 },
  ],
  companyName: 'Click Plumbing and Electrical',
}

describe('document builders', () => {
  it('html carries label, both blocks, escaped narrative, cost rows, net change', () => {
    const html = buildEstimateChangeOrderDocHtml(docArgs)
    expect(html).toContain('Change Order #1044')
    expect(html).toContain('<strong>Summit GC</strong>')
    expect(html).toContain('J804 · Auto Zone')
    expect(html).toContain('Reroute 2&quot; condensate line &lt;per plan&gt;')
    expect(html).toContain('Response requested by 2026-08-26')
    expect(html).toContain('Reroute — labor + materials')
    expect(html).toContain('−$390.00')
    expect(html).toContain('Net change to contract')
    expect(html).toContain('$2,450.00')
    expect(html).toContain('Click Plumbing and Electrical')
  })

  it('text mirrors the html content', () => {
    const text = buildEstimateChangeOrderDocText(docArgs)
    expect(text).toContain('Change Order #1044')
    expect(text).toContain('Description of change:')
    expect(text).toContain('  Credit — delete original stub-out: −$390.00')
    expect(text).toContain('  Net change to contract: $2,450.00')
    expect(text).toContain('Impact on schedule:')
  })

  it('blank optional pieces are omitted (response-by, company); empty narrative renders —', () => {
    const html = buildEstimateChangeOrderDocHtml({
      ...docArgs,
      fields: { ...EMPTY_ESTIMATE_CHANGE_ORDER_FIELDS },
      companyName: '',
    })
    expect(html).not.toContain('Response requested by')
    expect(html).not.toContain('Click Plumbing')
    expect(html).toContain('Description of change</strong><br/>—')
  })
})
