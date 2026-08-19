import { describe, expect, it } from 'vitest'
import {
  coCostPromptConsequence,
  coCostPromptEffectiveLabel,
  coCostPromptSignedUnitCents,
  emptyCoCostPromptDraft,
  validateCoCostPromptDraft,
  type CoCostPromptDraft,
} from './coCostLinePrompt'

function draft(overrides: Partial<CoCostPromptDraft>): CoCostPromptDraft {
  return { ...emptyCoCostPromptDraft('add'), ...overrides }
}

describe('coCostPromptSignedUnitCents', () => {
  it('parses dollars to cents in add mode', () => {
    expect(coCostPromptSignedUnitCents(draft({ unitPriceText: '2840' }))).toBe(284000)
  })

  it('negates in credit mode and tolerates $ and commas', () => {
    expect(coCostPromptSignedUnitCents(draft({ mode: 'credit', unitPriceText: '$1,390.50' }))).toBe(-139050)
  })

  it('returns null on empty or negative input (magnitude only)', () => {
    expect(coCostPromptSignedUnitCents(draft({ unitPriceText: '' }))).toBeNull()
    expect(coCostPromptSignedUnitCents(draft({ unitPriceText: '-5' }))).toBeNull()
  })
})

describe('coCostPromptConsequence', () => {
  it('renders the add-mode consequence with extended amount', () => {
    expect(coCostPromptConsequence(draft({ quantityText: '2', unitPriceText: '100' }))).toBe(
      '= $200.00 added to contract',
    )
  })

  it('renders the credit-mode consequence with a signed amount', () => {
    expect(
      coCostPromptConsequence(draft({ mode: 'credit', quantityText: '1', unitPriceText: '390' })),
    ).toBe(`= ${'−'}$390.00 credited back`)
  })

  it('is empty until both numbers parse', () => {
    expect(coCostPromptConsequence(draft({ quantityText: '', unitPriceText: '5' }))).toBe('')
    expect(coCostPromptConsequence(draft({ quantityText: '1', unitPriceText: '' }))).toBe('')
  })
})

describe('coCostPromptEffectiveLabel', () => {
  it('prefixes credit labels', () => {
    expect(coCostPromptEffectiveLabel(draft({ mode: 'credit', label: 'delete hall lav' }))).toBe(
      'Credit — delete hall lav',
    )
  })

  it('does not double-prefix a label the writer already worded as a credit', () => {
    expect(coCostPromptEffectiveLabel(draft({ mode: 'credit', label: 'Credit for hall lav' }))).toBe(
      'Credit for hall lav',
    )
  })

  it('leaves add-mode labels untouched', () => {
    expect(coCostPromptEffectiveLabel(draft({ label: 'Rough-in' }))).toBe('Rough-in')
  })
})

describe('validateCoCostPromptDraft', () => {
  it('builds a normalized add line', () => {
    const v = validateCoCostPromptDraft(
      draft({ label: 'Second-floor bathroom rough-in', quantityText: '1', unitPriceText: '2840' }),
    )
    expect(v).toEqual({
      ok: true,
      line: {
        line_item: 'Second-floor bathroom rough-in',
        description: '',
        quantity: 1,
        unit_price_cents: 284000,
        amount_cents: 284000,
      },
    })
  })

  it('builds a negative credit line on the allowNegative rails', () => {
    const v = validateCoCostPromptDraft(
      draft({ mode: 'credit', label: 'delete hall lav', quantityText: '1', unitPriceText: '390' }),
    )
    expect(v.ok).toBe(true)
    if (v.ok) {
      expect(v.line.line_item).toBe('Credit — delete hall lav')
      expect(v.line.unit_price_cents).toBe(-39000)
      expect(v.line.amount_cents).toBe(-39000)
    }
  })

  it('requires a label, positive quantity, and a parseable price', () => {
    expect(validateCoCostPromptDraft(draft({ label: '', unitPriceText: '5' })).ok).toBe(false)
    expect(
      validateCoCostPromptDraft(draft({ label: 'x', quantityText: '0', unitPriceText: '5' })).ok,
    ).toBe(false)
    expect(validateCoCostPromptDraft(draft({ label: 'x', unitPriceText: '' })).ok).toBe(false)
  })

  it('allows a $0 line (price to be determined) and trims description', () => {
    const v = validateCoCostPromptDraft(
      draft({ label: 'Trim set', description: '  two fixtures  ', unitPriceText: '0' }),
    )
    expect(v).toEqual({
      ok: true,
      line: { line_item: 'Trim set', description: 'two fixtures', quantity: 1, unit_price_cents: 0, amount_cents: 0 },
    })
  })
})
