import { describe, expect, it } from 'vitest'
import {
  catalogEntryToLineItem,
  catalogUnitPriceInputCents,
  coerceDraftQuantity,
  DEFAULT_DRAFT_FIRST_LINE_ITEM,
  defaultDraftFirstLine,
  dollarsInputToCents,
  draftUnitPriceInputCents,
  emptyCatalogEditRow,
  emptyDraftLine,
  isBlankDraftLine,
  isDefaultDraftStubShape,
  isReplaceableStubLine,
  patchCatalogEditRow,
  patchDraftLine,
} from './estimateDraftLines'

describe('the stub shapes', () => {
  it('a new draft opens on the default line at $0; an empty line is blank', () => {
    expect(defaultDraftFirstLine()).toEqual({ line_item: DEFAULT_DRAFT_FIRST_LINE_ITEM, description: '', quantity: 1, unit_price_cents: 0, amount_cents: 0 })
    expect(emptyDraftLine()).toEqual({ line_item: '', description: '', quantity: 1, unit_price_cents: 0, amount_cents: 0 })
    expect(emptyCatalogEditRow()).toEqual({ id: '', line_item: '', description: '', quantity: 1, unit_price_cents: 0, amount_cents: 0 })
    expect(isBlankDraftLine(emptyDraftLine())).toBe(true)
    expect(isBlankDraftLine(defaultDraftFirstLine())).toBe(false)
  })

  it('both stub shapes are the placeholder — new (item + empty description) and legacy (empty item + the default in the description) — case-blind, only at $0', () => {
    expect(isDefaultDraftStubShape('Custom Service Visit', '', 0)).toBe(true)
    expect(isDefaultDraftStubShape('  custom service visit ', '', 0)).toBe(true)
    expect(isDefaultDraftStubShape('', 'Custom Service Visit', 0)).toBe(true)
    expect(isDefaultDraftStubShape('Custom Service Visit', 'with notes', 0)).toBe(false)
    expect(isDefaultDraftStubShape('Custom Service Visit', '', 500)).toBe(false)
    expect(isDefaultDraftStubShape('Water heater', '', 0)).toBe(false)
  })

  it('a replaceable last row is blank or the placeholder', () => {
    expect(isReplaceableStubLine(defaultDraftFirstLine())).toBe(true)
    expect(isReplaceableStubLine(emptyDraftLine())).toBe(true)
    expect(isReplaceableStubLine({ ...emptyDraftLine(), line_item: 'Water heater' })).toBe(false)
    expect(isReplaceableStubLine({ ...defaultDraftFirstLine(), unit_price_cents: 100, amount_cents: 100 })).toBe(false)
  })
})

describe('typed numbers', () => {
  it('a quantity is a finite number above 0, else 1', () => {
    expect(coerceDraftQuantity(3)).toBe(3)
    expect(coerceDraftQuantity('2.5')).toBe(2.5)
    expect(coerceDraftQuantity(0)).toBe(1)
    expect(coerceDraftQuantity(-4)).toBe(1)
    expect(coerceDraftQuantity('')).toBe(1)
    expect(coerceDraftQuantity('abc')).toBe(1)
    expect(coerceDraftQuantity(Infinity)).toBe(1)
    expect(coerceDraftQuantity(null)).toBe(1)
  })

  it('dollars typed become whole cents, rounded; a blank is 0', () => {
    expect(dollarsInputToCents('12.34')).toBe(1234)
    expect(dollarsInputToCents('0.005')).toBe(1)
    expect(dollarsInputToCents('1.005')).toBe(100) // the float 100.49999… rounds down — what the page always did
    expect(dollarsInputToCents('')).toBe(0)
    expect(dollarsInputToCents(undefined)).toBe(0)
  })

  it('a draft unit price keeps the typed sign unless the Credit toggle is on, which forces negative', () => {
    expect(draftUnitPriceInputCents('50')).toBe(5000)
    expect(draftUnitPriceInputCents('-50')).toBe(-5000)
    expect(draftUnitPriceInputCents('50', { credit: true })).toBe(-5000)
    expect(draftUnitPriceInputCents('-50', { credit: true })).toBe(-5000)
  })

  it('a catalog unit price never goes below 0', () => {
    expect(catalogUnitPriceInputCents('19.99')).toBe(1999)
    expect(catalogUnitPriceInputCents('-5')).toBe(0)
    expect(catalogUnitPriceInputCents('')).toBe(0)
  })
})

describe('patchDraftLine', () => {
  const cur = { line_item: 'Water heater', description: '50 gal', quantity: 2, unit_price_cents: 150_000, amount_cents: 300_000 }

  it('applies the patch and recomputes the amount; untouched fields stay', () => {
    expect(patchDraftLine(cur, { quantity: 3 })).toEqual({ ...cur, quantity: 3, amount_cents: 450_000 })
    expect(patchDraftLine(cur, { unit_price_cents: 100_000 })).toEqual({ ...cur, unit_price_cents: 100_000, amount_cents: 200_000 })
    expect(patchDraftLine(cur, { description: 'gas' })).toEqual({ ...cur, description: 'gas' })
  })

  it('a bad quantity in the patch becomes 1, not 0', () => {
    expect(patchDraftLine(cur, { quantity: 0 }).quantity).toBe(1)
    expect(patchDraftLine(cur, { quantity: 0 }).amount_cents).toBe(150_000)
    expect(patchDraftLine(cur, { quantity: Number.NaN }).quantity).toBe(1)
  })

  it('a negative price is clamped to $0 on an estimate and kept on a change order (the credit line)', () => {
    expect(patchDraftLine(cur, { unit_price_cents: -25_000 }).amount_cents).toBe(0)
    expect(patchDraftLine(cur, { unit_price_cents: -25_000 }, { allowNegative: true }).amount_cents).toBe(-50_000)
  })

  it('an explicit empty string clears text; an undefined leaves it', () => {
    expect(patchDraftLine(cur, { line_item: '' }).line_item).toBe('')
    expect(patchDraftLine(cur, { line_item: undefined }).line_item).toBe('Water heater')
  })
})

describe('the catalog', () => {
  const entry = { id: 'c1', line_item: 'Pretest', description: 'hydrostatic', quantity: 0, unit_price_cents: -1_234.6, amount_cents: 999 }

  it('an entry becomes a line with its quantity coerced, its price clamped and rounded, and the amount recomputed — never the stored amount', () => {
    expect(catalogEntryToLineItem(entry)).toEqual({ line_item: 'Pretest', description: 'hydrostatic', quantity: 1, unit_price_cents: 0, amount_cents: 0 })
    expect(catalogEntryToLineItem({ ...entry, quantity: 2, unit_price_cents: 45_000.4 })).toEqual({ line_item: 'Pretest', description: 'hydrostatic', quantity: 2, unit_price_cents: 45_000, amount_cents: 90_000 })
  })

  it('a catalog edit row recomputes on either input, coercing the quantity and clamping the price', () => {
    const row = { id: 'c1', line_item: 'Pretest', description: '', quantity: 2, unit_price_cents: 45_000, amount_cents: 90_000 }
    expect(patchCatalogEditRow(row, { quantity: 0 })).toEqual({ ...row, quantity: 1, amount_cents: 45_000 })
    expect(patchCatalogEditRow(row, { unit_price_cents: -100 })).toEqual({ ...row, unit_price_cents: 0, amount_cents: 0 })
    expect(patchCatalogEditRow(row, { unit_price_cents: 1_000.6 })).toEqual({ ...row, unit_price_cents: 1_001, amount_cents: 2_002 })
  })
})
