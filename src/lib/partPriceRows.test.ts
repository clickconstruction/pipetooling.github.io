import { describe, expect, it } from 'vitest'
import {
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
