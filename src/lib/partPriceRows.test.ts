import { describe, expect, it } from 'vitest'
import {
  applyPartPriceRowPatch,
  isBlankPartPriceRow,
  makeBlankPartPriceRow,
  withTrailingBlankPartPriceRow,
  type PartPriceRowDraft,
} from './partPriceRows'

const blank = makeBlankPartPriceRow()
const filled: PartPriceRowDraft = { supply_house_id: 'sh1', price: '8.42', effective_date: '' }

describe('isBlankPartPriceRow', () => {
  it('is true only when all three fields are empty', () => {
    expect(isBlankPartPriceRow(blank)).toBe(true)
    expect(isBlankPartPriceRow({ ...blank, supply_house_id: 'sh1' })).toBe(false)
    expect(isBlankPartPriceRow({ ...blank, price: '1' })).toBe(false)
    expect(isBlankPartPriceRow({ ...blank, effective_date: '2026-08-03' })).toBe(false)
  })

  it('treats whitespace-only price as blank', () => {
    expect(isBlankPartPriceRow({ ...blank, price: '  ' })).toBe(true)
  })
})

describe('applyPartPriceRowPatch', () => {
  const TODAY = '2026-08-17'

  it('defaults the effective date to today when a blank row gains a supply house', () => {
    const out = applyPartPriceRowPatch(blank, { supply_house_id: 'sh1' }, TODAY)
    expect(out.supply_house_id).toBe('sh1')
    expect(out.effective_date).toBe(TODAY)
  })

  it('defaults the effective date to today when a blank row gains a price', () => {
    const out = applyPartPriceRowPatch(blank, { price: '8.42' }, TODAY)
    expect(out.effective_date).toBe(TODAY)
  })

  it('leaves the date alone when the patch sets it explicitly', () => {
    const out = applyPartPriceRowPatch(blank, { supply_house_id: 'sh1', effective_date: '2026-01-01' }, TODAY)
    expect(out.effective_date).toBe('2026-01-01')
  })

  it('does not re-default after the user clears the date on an active row', () => {
    const active = applyPartPriceRowPatch(blank, { supply_house_id: 'sh1' }, TODAY)
    const cleared = applyPartPriceRowPatch(active, { effective_date: '' }, TODAY)
    expect(cleared.effective_date).toBe('')
    const priceEdit = applyPartPriceRowPatch(cleared, { price: '9.99' }, TODAY)
    expect(priceEdit.effective_date).toBe('')
  })

  it('keeps a user-picked date when other fields change', () => {
    const dated = applyPartPriceRowPatch(blank, { effective_date: '2026-01-01' }, TODAY)
    const out = applyPartPriceRowPatch(dated, { supply_house_id: 'sh1' }, TODAY)
    expect(out.effective_date).toBe('2026-01-01')
  })

  it('leaves a still-blank row blank (no date on date-only clears or empty patches)', () => {
    const out = applyPartPriceRowPatch(blank, {}, TODAY)
    expect(isBlankPartPriceRow(out)).toBe(true)
  })

  it('treats a whitespace-only price as not activating the row', () => {
    const out = applyPartPriceRowPatch(blank, { price: '  ' }, TODAY)
    expect(out.effective_date).toBe('')
  })
})

describe('withTrailingBlankPartPriceRow', () => {
  it('seeds one blank row for an empty list', () => {
    const out = withTrailingBlankPartPriceRow([])
    expect(out).toHaveLength(1)
    expect(isBlankPartPriceRow(out[0]!)).toBe(true)
  })

  it('appends a blank row when the last row has any content', () => {
    const out = withTrailingBlankPartPriceRow([filled])
    expect(out).toHaveLength(2)
    expect(out[0]).toBe(filled)
    expect(isBlankPartPriceRow(out[1]!)).toBe(true)
  })

  it('appends when only one field of the last row is set (mid-typing)', () => {
    const out = withTrailingBlankPartPriceRow([{ ...blank, supply_house_id: 'sh2' }])
    expect(out).toHaveLength(2)
  })

  it('returns the SAME array reference when a trailing blank already exists', () => {
    const rows = [filled, makeBlankPartPriceRow()]
    expect(withTrailingBlankPartPriceRow(rows)).toBe(rows)
  })

  it('does not collapse interior blank rows', () => {
    const rows = [makeBlankPartPriceRow(), filled]
    const out = withTrailingBlankPartPriceRow(rows)
    expect(out).toHaveLength(3)
    expect(out[0]).toBe(rows[0])
    expect(out[1]).toBe(filled)
  })
})
