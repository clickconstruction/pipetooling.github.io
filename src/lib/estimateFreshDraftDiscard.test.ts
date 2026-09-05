import { describe, expect, it } from 'vitest'
import { estimateDraftFormSnapshot, shouldDiscardFreshEstimateDraftOnLeave } from './estimateFreshDraftDiscard'

/** What `createDraft` inserts for an estimate: blank title, the "Custom Service Visit" stub line. */
const STUB_LINE = { line_item: 'Custom Service Visit', description: '', quantity: 1, unit_price_cents: 0, amount_cents: 0 }

function freshEstimateForm(over: Partial<Parameters<typeof estimateDraftFormSnapshot>[0]> = {}) {
  return estimateDraftFormSnapshot({
    status: 'draft',
    docKind: 'estimate',
    title: '',
    customerId: null,
    lines: [STUB_LINE],
    terms: '',
    changeOrderFields: {},
    ...over,
  })
}

describe('shouldDiscardFreshEstimateDraftOnLeave — the first-commit gate', () => {
  it('a fresh, never-saved, untouched estimate draft is discarded on leave', () => {
    expect(shouldDiscardFreshEstimateDraftOnLeave({ fresh: true, everSaved: false, form: freshEstimateForm() })).toBe(true)
  })

  it('a fresh, never-saved change order (no lines at all) is discarded on leave', () => {
    const form = freshEstimateForm({ docKind: 'change_order', lines: [] })
    expect(shouldDiscardFreshEstimateDraftOnLeave({ fresh: true, everSaved: false, form })).toBe(true)
  })

  it('a draft opened from the list (not fresh) is never discarded, even when empty', () => {
    expect(shouldDiscardFreshEstimateDraftOnLeave({ fresh: false, everSaved: false, form: freshEstimateForm() })).toBe(false)
  })

  it('any save since the mint keeps the row (autosave, Save draft, pre-send save)', () => {
    expect(shouldDiscardFreshEstimateDraftOnLeave({ fresh: true, everSaved: true, form: freshEstimateForm() })).toBe(false)
  })

  it('typing a title is a commit — kept', () => {
    const form = freshEstimateForm({ title: 'Pool liner' })
    expect(shouldDiscardFreshEstimateDraftOnLeave({ fresh: true, everSaved: false, form })).toBe(false)
  })

  it('picking a customer is a commit — kept', () => {
    const form = freshEstimateForm({ customerId: 'cust-1' })
    expect(shouldDiscardFreshEstimateDraftOnLeave({ fresh: true, everSaved: false, form })).toBe(false)
  })

  it('a priced line is a commit — kept; the untouched stub line is not', () => {
    const priced = freshEstimateForm({ lines: [{ ...STUB_LINE, unit_price_cents: 12500, amount_cents: 12500 }] })
    expect(shouldDiscardFreshEstimateDraftOnLeave({ fresh: true, everSaved: false, form: priced })).toBe(false)
    const described = freshEstimateForm({ lines: [{ ...STUB_LINE, description: 'Replace liner' }] })
    expect(shouldDiscardFreshEstimateDraftOnLeave({ fresh: true, everSaved: false, form: described })).toBe(false)
  })

  it('terms or a change-order narrative are commits — kept', () => {
    expect(
      shouldDiscardFreshEstimateDraftOnLeave({ fresh: true, everSaved: false, form: freshEstimateForm({ terms: 'Net 30' }) }),
    ).toBe(false)
    const co = freshEstimateForm({
      docKind: 'change_order',
      lines: [],
      changeOrderFields: { description_of_change: 'Add a hose bib', reason_for_change: '', impact_on_schedule: '' },
    })
    expect(shouldDiscardFreshEstimateDraftOnLeave({ fresh: true, everSaved: false, form: co })).toBe(false)
  })

  it('a row that is no longer a draft (sent while open) is never discarded', () => {
    const form = freshEstimateForm({ status: 'sent' })
    expect(shouldDiscardFreshEstimateDraftOnLeave({ fresh: true, everSaved: false, form })).toBe(false)
  })
})
