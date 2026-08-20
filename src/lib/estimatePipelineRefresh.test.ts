import { describe, expect, it } from 'vitest'
import {
  computeEstimateListReadiness,
  estimateDraftMeaningfulLineCount,
  isEmptyEstimateDraft,
  readinessDots,
  type EstimatePipelineRowLike,
} from './estimatePipelineRefresh'

function row(overrides: Partial<EstimatePipelineRowLike>): EstimatePipelineRowLike {
  return {
    status: 'draft',
    customer_id: null,
    customer_email: null,
    title: null,
    line_items_snapshot: [],
    total_cents: 0,
    doc_kind: 'estimate',
    change_order_fields: null,
    terms_snapshot: null,
    customers: null,
    ...overrides,
  }
}

const STUB = { line_item: 'Custom Service Visit', description: '', quantity: 1, unit_price_cents: 0, amount_cents: 0 }

describe('isEmptyEstimateDraft', () => {
  it('flags a bare draft, including one carrying only the legacy stub line', () => {
    expect(isEmptyEstimateDraft(row({}))).toBe(true)
    expect(isEmptyEstimateDraft(row({ line_items_snapshot: [STUB] }))).toBe(true)
  })

  it('spares drafts with any real content', () => {
    expect(isEmptyEstimateDraft(row({ customer_id: 'c1' }))).toBe(false)
    expect(isEmptyEstimateDraft(row({ title: 'Repipe' }))).toBe(false)
    expect(
      isEmptyEstimateDraft(row({ line_items_snapshot: [{ ...STUB, line_item: 'Water heater', amount_cents: 100 }] })),
    ).toBe(false)
    expect(
      isEmptyEstimateDraft(
        row({ doc_kind: 'change_order', change_order_fields: { description_of_change: 'add bath' } }),
      ),
    ).toBe(false)
    expect(isEmptyEstimateDraft(row({ terms_snapshot: 'Net 30' }))).toBe(false)
  })

  it('never flags non-drafts', () => {
    expect(isEmptyEstimateDraft(row({ status: 'sent' }))).toBe(false)
  })
})

describe('meaningful line count', () => {
  it('ignores the stub in both shapes and blank rows; counts priced or labeled lines', () => {
    expect(estimateDraftMeaningfulLineCount([STUB], false)).toBe(0)
    expect(
      estimateDraftMeaningfulLineCount(
        [{ line_item: '', description: 'Custom Service Visit', quantity: 1, unit_price_cents: 0, amount_cents: 0 }],
        false,
      ),
    ).toBe(0)
    expect(estimateDraftMeaningfulLineCount([{ ...STUB, unit_price_cents: 5000, amount_cents: 5000 }], false)).toBe(1)
    // CO credit lines count (negative survives normalize)
    expect(
      estimateDraftMeaningfulLineCount(
        [{ line_item: 'Credit — lav', description: '', quantity: 1, unit_price_cents: -39000, amount_cents: -39000 }],
        true,
      ),
    ).toBe(1)
  })
})

describe('list readiness', () => {
  it('reads customer email from the embedded customer contact_info', () => {
    const r = computeEstimateListReadiness(
      row({
        customer_id: 'c1',
        customers: { contact_info: { email: 'a@b.com' } },
        line_items_snapshot: [{ ...STUB, line_item: 'Repipe', unit_price_cents: 100, amount_cents: 100 }],
      }),
    )
    expect(r.sendGate.ready).toBe(true)
    const d = readinessDots(r)
    expect(d.ready).toBe(true)
    expect(d.label).toBe('ready to send')
  })

  it('dots and shortened label for an untouched CO', () => {
    const d = readinessDots(computeEstimateListReadiness(row({ doc_kind: 'change_order' })))
    expect(d.ready).toBe(false)
    expect(d.done + d.todo).toBe(5)
    expect(d.label).toBe('3 left: customer · the change · cost lines')
  })
})
