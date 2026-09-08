import { describe, expect, it } from 'vitest'

import { VENDOR_KINDS, VENDOR_KIND_HINTS, VENDOR_KIND_LABELS, isInsurerFor, isQuotableVendorKind, isVendorKind, vendorKindLabel, vendorKindOf } from './vendorKind'

describe('vendorKindOf', () => {
  it('reads vendor_kind when the column is present', () => {
    expect(vendorKindOf({ vendor_kind: 'rental_yard', is_insurer: false })).toBe('rental_yard')
    expect(vendorKindOf({ vendor_kind: 'supply_house', is_insurer: true })).toBe('supply_house')
  })

  it('falls back to the legacy flag before the column is pushed', () => {
    expect(vendorKindOf({ is_insurer: true })).toBe('insurer')
    expect(vendorKindOf({ is_insurer: false })).toBe('supply_house')
    expect(vendorKindOf({ vendor_kind: null, is_insurer: null })).toBe('supply_house')
    expect(vendorKindOf({ vendor_kind: 'not-a-kind', is_insurer: true })).toBe('insurer')
  })
})

describe('kinds', () => {
  it('every kind has a label and a hint', () => {
    for (const k of VENDOR_KINDS) {
      expect(VENDOR_KIND_LABELS[k]).toBeTruthy()
      expect(VENDOR_KIND_HINTS[k]).toBeTruthy()
      expect(vendorKindLabel(k)).toBe(VENDOR_KIND_LABELS[k])
      expect(isVendorKind(k)).toBe(true)
    }
    expect(isVendorKind('vendor')).toBe(false)
  })

  it('only supply houses are quotable; every other kind derives is_insurer = true', () => {
    expect(isQuotableVendorKind('supply_house')).toBe(true)
    expect(isInsurerFor('supply_house')).toBe(false)
    for (const k of VENDOR_KINDS.filter((k) => k !== 'supply_house')) {
      expect(isQuotableVendorKind(k)).toBe(false)
      expect(isInsurerFor(k)).toBe(true)
    }
  })
})
