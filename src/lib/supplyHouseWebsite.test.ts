import { describe, expect, it } from 'vitest'
import {
  isUrlLikelyMapsOrDirectionsPortal,
  supplyHouseWebsitePortalHref,
} from './supplyHouseWebsite'

describe('isUrlLikelyMapsOrDirectionsPortal', () => {
  it('flags google.com maps paths', () => {
    expect(
      isUrlLikelyMapsOrDirectionsPortal('https://www.google.com/maps/search/?api=1&query=foo'),
    ).toBe(true)
    expect(isUrlLikelyMapsOrDirectionsPortal('https://google.com/maps/place/Example')).toBe(true)
  })

  it('flags maps.google.com', () => {
    expect(isUrlLikelyMapsOrDirectionsPortal('https://maps.google.com/?q=1')).toBe(true)
  })

  it('flags maps.app.goo.gl', () => {
    expect(isUrlLikelyMapsOrDirectionsPortal('https://maps.app.goo.gl/abc')).toBe(true)
  })

  it('flags goo.gl when path is maps', () => {
    expect(isUrlLikelyMapsOrDirectionsPortal('https://goo.gl/maps/xyz')).toBe(true)
  })

  it('does not flag a normal vendor portal', () => {
    expect(isUrlLikelyMapsOrDirectionsPortal('https://vendor.example/orders')).toBe(false)
  })

  it('returns false for unparseable href', () => {
    expect(isUrlLikelyMapsOrDirectionsPortal('not a url')).toBe(false)
  })
})

describe('supplyHouseWebsitePortalHref', () => {
  it('returns null for empty stored value', () => {
    expect(supplyHouseWebsitePortalHref(null)).toBe(null)
    expect(supplyHouseWebsitePortalHref('  ')).toBe(null)
  })

  it('returns null when stored value is a maps URL', () => {
    expect(
      supplyHouseWebsitePortalHref('https://www.google.com/maps/search/?api=1&query=foo'),
    ).toBe(null)
  })

  it('returns normalized href for a supplier URL', () => {
    expect(supplyHouseWebsitePortalHref('https://acme.com/portal')).toBe('https://acme.com/portal')
    expect(supplyHouseWebsitePortalHref('acme.com/portal')).toBe('https://acme.com/portal')
  })
})
