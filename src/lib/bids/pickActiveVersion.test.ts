import { describe, expect, it } from 'vitest'
import { deriveActivePricingId, pickActiveVersion, resolveTaggedVersion, versionSwitchStillActive } from './pickActiveVersion'

describe('pickActiveVersion', () => {
  const versions = [
    { id: 'v2', sort_order: 1 },
    { id: 'v0', sort_order: 0 },
    { id: 'v1', sort_order: 2 },
  ]

  it('returns null for an unsplit bid (no versions)', () => {
    expect(pickActiveVersion({ savedVersionId: null, bidVersions: [] })).toBeNull()
  })

  it('keeps the saved version when still present', () => {
    expect(pickActiveVersion({ savedVersionId: 'v1', bidVersions: versions })).toBe('v1')
  })

  it('falls back to lowest sort_order when saved is stale or absent', () => {
    expect(pickActiveVersion({ savedVersionId: 'gone', bidVersions: versions })).toBe('v0')
    expect(pickActiveVersion({ savedVersionId: null, bidVersions: versions })).toBe('v0')
  })
})

describe('deriveActivePricingId', () => {
  const pricings = [
    { id: 'pA', bid_version_id: 'vA' },
    { id: 'pB', bid_version_id: 'vB' },
    { id: 'pLegacy', bid_version_id: null },
  ]

  it('matches the pricing facet of the active version', () => {
    expect(deriveActivePricingId({ activeVersionId: 'vB', bidPricings: pricings, legacyFallbackPricingId: null })).toBe('pB')
  })

  it('prefers the saved (★ customer-facing) scenario among a version’s several pricings', () => {
    const multi = [
      { id: 'p1', bid_version_id: 'vA' },
      { id: 'p2', bid_version_id: 'vA' },
      { id: 'p3', bid_version_id: 'vA' },
    ]
    // Without the preference the star silently reverted to p1 on every reload.
    expect(deriveActivePricingId({ activeVersionId: 'vA', bidPricings: multi, legacyFallbackPricingId: 'p2' })).toBe('p2')
    // A saved id from another version (stale) falls back to the version's first pricing.
    expect(deriveActivePricingId({ activeVersionId: 'vA', bidPricings: multi, legacyFallbackPricingId: 'pB' })).toBe('p1')
  })

  it('prefers the saved scenario among several unsplit pricing copies', () => {
    const multiUnsplit = [
      { id: 'u1', bid_version_id: null },
      { id: 'u2', bid_version_id: null },
    ]
    expect(deriveActivePricingId({ activeVersionId: null, bidPricings: multiUnsplit, legacyFallbackPricingId: 'u2' })).toBe('u2')
    expect(deriveActivePricingId({ activeVersionId: null, bidPricings: multiUnsplit, legacyFallbackPricingId: null })).toBe('u1')
  })

  it('prefers the template that holds the bid’s rows over the viewer’s default (v2.2720)', () => {
    // BP190: no copy, no saved pointer, rows keyed to Default; the viewer's last pick is WENDI.
    expect(
      deriveActivePricingId({ activeVersionId: null, bidPricings: [], legacyFallbackPricingId: null, legacyDataPricingId: 'tDefault', defaultTemplatePricingId: 'tWendi' }),
    ).toBe('tDefault')
    // A saved pointer still wins over the data-derived template.
    expect(
      deriveActivePricingId({ activeVersionId: null, bidPricings: [], legacyFallbackPricingId: 'tSaved', legacyDataPricingId: 'tDefault', defaultTemplatePricingId: 'tWendi' }),
    ).toBe('tSaved')
    // No legacy rows → the viewer's default as before.
    expect(
      deriveActivePricingId({ activeVersionId: null, bidPricings: [], legacyFallbackPricingId: null, legacyDataPricingId: null, defaultTemplatePricingId: 'tWendi' }),
    ).toBe('tWendi')
    // A bid that owns a copy never consults it.
    expect(
      deriveActivePricingId({ activeVersionId: null, bidPricings: pricings, legacyFallbackPricingId: null, legacyDataPricingId: 'tDefault', defaultTemplatePricingId: 'tWendi' }),
    ).toBe('pLegacy')
  })

  it('returns null when the active version has no pricing facet', () => {
    expect(deriveActivePricingId({ activeVersionId: 'vNoPricing', bidPricings: pricings, legacyFallbackPricingId: 'x' })).toBeNull()
  })

  it('uses an unsplit pricing copy when unsplit', () => {
    expect(deriveActivePricingId({ activeVersionId: null, bidPricings: pricings, legacyFallbackPricingId: 'tmpl' })).toBe('pLegacy')
  })

  it('falls back to the legacy global selection when unsplit with no bid pricing', () => {
    expect(deriveActivePricingId({ activeVersionId: null, bidPricings: [], legacyFallbackPricingId: 'tmpl' })).toBe('tmpl')
    expect(deriveActivePricingId({ activeVersionId: null, bidPricings: [], legacyFallbackPricingId: null })).toBeNull()
  })

  it('falls back to the Default template when unsplit with no saved selection', () => {
    // The regression fix: bids that never picked a price book still price against "Default".
    expect(deriveActivePricingId({ activeVersionId: null, bidPricings: [], legacyFallbackPricingId: null, defaultTemplatePricingId: 'default-tmpl' })).toBe('default-tmpl')
  })

  it('prefers a saved selection over the Default template', () => {
    expect(deriveActivePricingId({ activeVersionId: null, bidPricings: [], legacyFallbackPricingId: 'saved', defaultTemplatePricingId: 'default-tmpl' })).toBe('saved')
  })

  it('does NOT use the Default template for a split version with no pricing', () => {
    expect(deriveActivePricingId({ activeVersionId: 'vNoPricing', bidPricings: [], legacyFallbackPricingId: 'saved', defaultTemplatePricingId: 'default-tmpl' })).toBeNull()
  })
})

describe('resolveTaggedVersion', () => {
  it('returns the version when the ref is tagged for the requested bid', () => {
    expect(resolveTaggedVersion({ bidId: 'bidA', versionId: 'vX' }, 'bidA')).toBe('vX')
  })

  it('preserves a null version for the matching bid (unsplit bid)', () => {
    expect(resolveTaggedVersion({ bidId: 'bidA', versionId: null }, 'bidA')).toBeNull()
  })

  it('returns null (Base) when the ref belongs to a different bid', () => {
    // The key safety property: never filter bid B's takeoff with bid A's version.
    expect(resolveTaggedVersion({ bidId: 'bidA', versionId: 'vX' }, 'bidB')).toBeNull()
  })

  it('returns null when the ref is unset', () => {
    expect(resolveTaggedVersion(null, 'bidA')).toBeNull()
  })
})

describe('versionSwitchStillActive', () => {
  it('lets the switch that is still active write', () => {
    expect(versionSwitchStillActive({ bidId: 'b1', versionId: 'vA' }, 'b1', 'vA')).toBe(true)
  })

  it('blocks a switch the user has already moved off', () => {
    // in flight for vA, but the ref has moved to vB
    expect(versionSwitchStillActive({ bidId: 'b1', versionId: 'vB' }, 'b1', 'vA')).toBe(false)
  })

  it('blocks a switch belonging to a different bid', () => {
    expect(versionSwitchStillActive({ bidId: 'b2', versionId: 'vA' }, 'b1', 'vA')).toBe(false)
  })

  it('handles the unsplit (null version) switch on both sides', () => {
    expect(versionSwitchStillActive({ bidId: 'b1', versionId: null }, 'b1', null)).toBe(true)
    expect(versionSwitchStillActive({ bidId: 'b1', versionId: null }, 'b1', 'vA')).toBe(false)
    expect(versionSwitchStillActive({ bidId: 'b1', versionId: 'vA' }, 'b1', null)).toBe(false)
  })

  it('blocks when there is no ref yet', () => {
    expect(versionSwitchStillActive(null, 'b1', 'vA')).toBe(false)
  })

  it('A -> B -> A: the two A switches both still match, and agree', () => {
    // Clicking back to A means the ref is A again; the first A switch finishing
    // late is harmless because it resolves the same facet.
    expect(versionSwitchStillActive({ bidId: 'b1', versionId: 'vA' }, 'b1', 'vA')).toBe(true)
  })
})

describe('the reported disappearing-pricing race', () => {
  // BP364: two Versions, only the primary has a pricing copy. Switching to the
  // other and back used to let the stale switch write null and stick.
  const pricings = [{ id: 'pSPC', bid_version_id: 'vSPC' }]
  const resolveFor = (versionId: string | null) =>
    deriveActivePricingId({ activeVersionId: versionId, bidPricings: pricings, legacyFallbackPricingId: null })

  it('a version with no pricing copy resolves to null — the empty state seen on screen', () => {
    expect(resolveFor('vBURD')).toBeNull()
    expect(resolveFor('vSPC')).toBe('pSPC')
  })

  it('the guard drops the stale write, so the active version keeps its pricing', () => {
    // user is back on SPC; the BURD switch finishes late
    const refNowSPC = { bidId: 'b1', versionId: 'vSPC' }
    const staleAllowed = versionSwitchStillActive(refNowSPC, 'b1', 'vBURD')
    expect(staleAllowed).toBe(false)
    // what would have been written had it been allowed
    expect(resolveFor('vBURD')).toBeNull()
    // what the UI keeps instead
    expect(resolveFor('vSPC')).toBe('pSPC')
  })
})
