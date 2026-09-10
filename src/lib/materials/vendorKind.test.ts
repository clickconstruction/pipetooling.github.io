import { describe, expect, it } from 'vitest'

import { VENDOR_KINDS, VENDOR_KIND_HINTS, VENDOR_KIND_LABELS, isQuotableVendorKind, isVendorKind, vendorKindLabel, vendorKindOf } from './vendorKind'

describe('vendorKindOf', () => {
  it('reads vendor_kind, and treats an unknown or missing kind as a supply house (v2.3244: no legacy flag)', () => {
    expect(vendorKindOf({ vendor_kind: 'rental_yard' })).toBe('rental_yard')
    expect(vendorKindOf({ vendor_kind: 'supply_house' })).toBe('supply_house')
    expect(vendorKindOf({ vendor_kind: null })).toBe('supply_house')
    expect(vendorKindOf({})).toBe('supply_house')
    expect(vendorKindOf({ vendor_kind: 'not-a-kind' })).toBe('supply_house')
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

  it('only supply houses are quotable', () => {
    expect(isQuotableVendorKind('supply_house')).toBe(true)
    for (const k of VENDOR_KINDS.filter((k) => k !== 'supply_house')) {
      expect(isQuotableVendorKind(k)).toBe(false)
    }
  })
})
