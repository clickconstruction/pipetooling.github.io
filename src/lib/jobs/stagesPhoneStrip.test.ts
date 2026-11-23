import { describe, expect, it } from 'vitest'
import { STAGES_PHONE_CHIP_ROW_STYLE, STAGES_PHONE_FILTER_ROW_STYLE, stagesPhoneBandStyle } from './stagesPhoneStrip'

describe('the phone Pipeline band', () => {
  it('is exactly its column wide: no bleed, capped at the column, allowed to shrink', () => {
    const band = stagesPhoneBandStyle(44)
    // The fault: a negative side margin and no cap let the band run past the right edge at 393 px.
    expect(band.margin).toBeUndefined()
    expect(band.marginLeft).toBeUndefined()
    expect(band.marginRight).toBeUndefined()
    expect(band.maxWidth).toBe('100%')
    expect(band.minWidth).toBe(0)
    expect(band.boxSizing).toBe('border-box')
    expect(String(band.padding)).toMatch(/^\S+ 0 \S+$/)
    expect(band.position).toBe('sticky')
    expect(band.top).toBe(44)
  })
  it('the chips slide inside the band', () => {
    expect(STAGES_PHONE_CHIP_ROW_STYLE.overflowX).toBe('auto')
    // The chips' full width must never size an ancestor.
    expect(STAGES_PHONE_CHIP_ROW_STYLE.contain).toBe('inline-size')
    expect(STAGES_PHONE_CHIP_ROW_STYLE.minWidth).toBe(0)
    expect(STAGES_PHONE_CHIP_ROW_STYLE.maxWidth).toBe('100%')
  })
  it('the filter row wraps rather than widen the band', () => {
    expect(STAGES_PHONE_FILTER_ROW_STYLE.flexWrap).toBe('wrap')
    expect(STAGES_PHONE_FILTER_ROW_STYLE.minWidth).toBe(0)
  })
})
