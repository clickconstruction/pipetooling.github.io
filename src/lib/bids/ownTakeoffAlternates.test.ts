import { describe, expect, it } from 'vitest'
import { alternateCardNumbers, alternateOnScreenWords, sameGcAlternateVersions, sameGcBaseVersions } from './ownTakeoffAlternates'
import { plainWordsFailures } from '../plainWords'

describe('sameGcAlternateVersions', () => {
  const versions = [
    { id: 'base', customer_id: null, is_alternate: false },
    { id: 'alt-pex', customer_id: null, is_alternate: true },
    { id: 'alt-ci', customer_id: null, is_alternate: true },
    { id: 'other-gc-base', customer_id: 'gc-2', is_alternate: false },
    { id: 'other-gc-alt', customer_id: 'gc-2', is_alternate: true },
  ]

  it('returns the active GC group’s alternates, never the active version', () => {
    expect(sameGcAlternateVersions(versions, 'base').map((v) => v.id)).toEqual(['alt-pex', 'alt-ci'])
  })

  it('groups by GC override — another GC’s alternates stay out', () => {
    expect(sameGcAlternateVersions(versions, 'other-gc-base').map((v) => v.id)).toEqual(['other-gc-alt'])
  })

  it('viewing an alternate shows its siblings, not itself', () => {
    expect(sameGcAlternateVersions(versions, 'alt-pex').map((v) => v.id)).toEqual(['alt-ci'])
  })

  it('unsplit bid (no active version) → none', () => {
    expect(sameGcAlternateVersions(versions, null)).toEqual([])
    expect(sameGcAlternateVersions(versions, 'gone')).toEqual([])
  })

  it('missing is_alternate reads as base', () => {
    expect(sameGcAlternateVersions([{ id: 'a', customer_id: null }, { id: 'b', customer_id: null }], 'a')).toEqual([])
  })
})

describe('alternateCardNumbers', () => {
  // The mockup's story: base cost $45,447 of which $14,730 copper; the PEX
  // takeoff runs $9,214 → alternate cost $39,931.
  const base = { baseMaterials: 14730, baseTotalCost: 45447 }

  it('swaps the alternate’s materials into the shared cost', () => {
    const n = alternateCardNumbers({ revenue: 102300, altMaterials: 9214, ...base })
    expect(n.cost).toBe(39931)
    expect(n.profit).toBe(62369)
    expect(n.margin).toBeCloseTo(0.6097, 3)
    expect(n.materialsDelta).toBe(-5516)
  })

  it('null materials (exact/PO model) falls back to the shared cost — today’s margin', () => {
    const n = alternateCardNumbers({ revenue: 102300, altMaterials: null, ...base })
    expect(n.cost).toBe(45447)
    expect(n.profit).toBe(56853)
    expect(n.margin).toBeCloseTo(0.5558, 3)
    expect(n.materialsDelta).toBeNull()
  })

  it('no revenue → no margin, but the delta still reads', () => {
    const n = alternateCardNumbers({ revenue: null, altMaterials: 9214, ...base })
    expect(n.margin).toBeNull()
    expect(n.profit).toBeNull()
    expect(n.materialsDelta).toBe(-5516)
    expect(alternateCardNumbers({ revenue: 0, altMaterials: 9214, ...base }).margin).toBeNull()
  })

  it('pricier alternate materials raise the cost and read as a positive delta', () => {
    const n = alternateCardNumbers({ revenue: 130000, altMaterials: 21000, ...base })
    expect(n.cost).toBe(45447 - 14730 + 21000)
    expect(n.materialsDelta).toBe(6270)
  })
})

describe('sameGcBaseVersions (v2.6000, Wendi’s video of 2026-10-27)', () => {
  const versions = [
    { id: 'alt-ci', customer_id: null, is_alternate: true, sort_order: 2 },
    { id: 'base', customer_id: null, is_alternate: false, sort_order: 0 },
    { id: 'alt-pex', customer_id: null, is_alternate: true, sort_order: 1 },
    { id: 'other-gc-base', customer_id: 'gc-2', is_alternate: false, sort_order: 3 },
    { id: 'other-gc-alt', customer_id: 'gc-2', is_alternate: true, sort_order: 4 },
  ]

  it('on an own-takeoff alternate, the same GC’s base rides the row', () => {
    expect(sameGcBaseVersions(versions, 'alt-pex').map((v) => v.id)).toEqual(['base'])
    expect(sameGcBaseVersions(versions, 'other-gc-alt').map((v) => v.id)).toEqual(['other-gc-base'])
  })

  it('on the base itself, nothing: the alternates ride that row instead', () => {
    expect(sameGcBaseVersions(versions, 'base')).toEqual([])
    expect(sameGcBaseVersions(versions, 'other-gc-base')).toEqual([])
  })

  it('an unsplit bid, or a version that is gone, has no base card', () => {
    expect(sameGcBaseVersions(versions, null)).toEqual([])
    expect(sameGcBaseVersions(versions, 'gone')).toEqual([])
  })

  it('two bases on one GC come in sort order, and a missing is_alternate reads as base', () => {
    const two = [
      { id: 'alt', customer_id: null, is_alternate: true, sort_order: 9 },
      { id: 'b2', customer_id: null, sort_order: 5 },
      { id: 'b1', customer_id: null, is_alternate: false, sort_order: 1 },
    ]
    expect(sameGcBaseVersions(two, 'alt').map((v) => v.id)).toEqual(['b1', 'b2'])
  })
})

describe('alternateOnScreenWords (v2.6000)', () => {
  it('names the version, says what the cards are and where the base sits, in plain words', () => {
    const words = alternateOnScreenWords({ versionName: 'INCLUDING WATER SOFTENER', hasBaseCard: true })
    expect(words).toBe('You are on INCLUDING WATER SOFTENER, an alternate with its own takeoff. The cards below are its prices. The base is the first card.')
    expect(plainWordsFailures(words)).toEqual([])
  })

  it('with no base to offer, the last sentence stays out', () => {
    const words = alternateOnScreenWords({ versionName: 'PEX in lieu', hasBaseCard: false })
    expect(words).toBe('You are on PEX in lieu, an alternate with its own takeoff. The cards below are its prices.')
    expect(plainWordsFailures(words)).toEqual([])
  })
})
