import { describe, expect, it } from 'vitest'

import {
  REASON_LABELS,
  STATUS_LABELS,
  deriveProductStatus,
  needsReason,
  normalizeModel,
  sameUnitNear,
  statusCounts,
  statusSummaryLine,
  type ProductStatus,
  type ReasonKind,
} from './productStatus'

const spec = (model: string | null, manufacturer: string | null = 'TOTO') => ({ manufacturer, model })
const sub = (model: string | null, manufacturer: string | null = 'TOTO', label: string | null = null) => ({ manufacturer, model, label })

describe('normalizeModel', () => {
  it('upper-cases, drops the finish suffix from # on, and strips punctuation', () => {
    expect(normalizeModel('CT708UVG#01')).toBe('CT708UVG')
    expect(normalizeModel('ct708uvg')).toBe('CT708UVG')
    expect(normalizeModel('B74-CH')).toBe('B74CH')
    expect(normalizeModel('K-3493-0')).toBe('K34930')
    expect(normalizeModel(' TET2UA31#SS ')).toBe('TET2UA31')
  })
  it('is empty for null/undefined/blank', () => {
    expect(normalizeModel(null)).toBe('')
    expect(normalizeModel(undefined)).toBe('')
    expect(normalizeModel('')).toBe('')
  })
})

describe('sameUnitNear', () => {
  it('equal after normalization', () => {
    expect(sameUnitNear('CT708UVG#01', 'ct708uvg#12')).toBe(true)
  })
  it('one is the other plus a 1–2 letter suffix', () => {
    expect(sameUnitNear('B74-CH', 'B74C')).toBe(true)
    expect(sameUnitNear('B74C', 'B74-CH')).toBe(true)
    expect(sameUnitNear('375', '375XL')).toBe(true)
  })
  it('not near when the suffix is longer, numeric, or the base differs', () => {
    expect(sameUnitNear('B74', 'B74CHX')).toBe(false)
    expect(sameUnitNear('375', '3751')).toBe(false)
    expect(sameUnitNear('CT708', 'CT705')).toBe(false)
    expect(sameUnitNear('', 'B74')).toBe(false)
  })
})

describe('deriveProductStatus', () => {
  it('nothing specified but something submitted → accessory', () => {
    expect(deriveProductStatus({ specified: null, submitted: sub('TET1GN32#CP') })).toEqual({ status: 'accessory', near: false })
    expect(deriveProductStatus({ specified: spec(null, null), submitted: sub(null, null, 'Wax ring') })).toEqual({ status: 'accessory', near: false })
  })
  it('specified but nothing submitted → missing', () => {
    expect(deriveProductStatus({ specified: spec('CT708UVG#01'), submitted: null })).toEqual({ status: 'missing', near: false })
    expect(deriveProductStatus({ specified: spec('CT708UVG#01'), submitted: sub(null, null, '') })).toEqual({ status: 'missing', near: false })
  })
  it('same model (ignoring the #finish) → as specified', () => {
    expect(deriveProductStatus({ specified: spec('CT708UVG#01'), submitted: sub('CT708UVG#12') })).toEqual({ status: 'as_specified', near: false })
    expect(deriveProductStatus({ specified: spec('K-3493-0', 'Kohler'), submitted: sub('K34930', 'KOHLER') })).toEqual({ status: 'as_specified', near: false })
  })
  it('B74-CH vs B74C → as specified, flagged near', () => {
    expect(deriveProductStatus({ specified: spec('B74-CH', 'Woodford'), submitted: sub('B74C', 'Woodford') })).toEqual({ status: 'as_specified', near: true })
  })
  it('a different model → alternate; the manufacturer alone never decides', () => {
    expect(deriveProductStatus({ specified: spec('CT708UVG#01'), submitted: sub('CST744S') })).toEqual({ status: 'alternate', near: false })
    expect(deriveProductStatus({ specified: spec('CT708UVG#01', 'TOTO'), submitted: sub(null, 'TOTO') })).toEqual({ status: 'alternate', near: false })
    expect(deriveProductStatus({ specified: spec('CT708UVG#01', 'TOTO'), submitted: sub('CT708UVG', 'Kohler') })).toEqual({ status: 'as_specified', near: false })
  })
  it('an unparsed quote label that carries the specified model counts as specified', () => {
    expect(deriveProductStatus({ specified: spec('CT708UVG#01'), submitted: sub(null, null, 'TOTO CT708UVG#01 WALL HUNG TOILET') })).toEqual({ status: 'as_specified', near: false })
    expect(deriveProductStatus({ specified: spec('B74-CH', 'Woodford'), submitted: sub(null, null, 'Woodford B74C hydrant') })).toEqual({ status: 'as_specified', near: true })
    expect(deriveProductStatus({ specified: spec('CT708UVG#01'), submitted: sub(null, null, 'wall hung toilet, white') })).toEqual({ status: 'alternate', near: false })
  })
  it('an override wins when both sides exist, and not otherwise', () => {
    expect(deriveProductStatus({ specified: spec('CT708UVG#01'), submitted: sub('CT708UVG#01'), override: 'superseded' })).toEqual({ status: 'superseded', near: false })
    expect(deriveProductStatus({ specified: spec('CT708UVG#01'), submitted: sub('CST744S'), override: 'equal' })).toEqual({ status: 'equal', near: false })
    expect(deriveProductStatus({ specified: spec('B74-CH'), submitted: sub('B74C'), override: 'design_change' })).toEqual({ status: 'design_change', near: false })
    expect(deriveProductStatus({ specified: spec('CT708UVG#01'), submitted: sub('CST744S'), override: null })).toEqual({ status: 'alternate', near: false })
    expect(deriveProductStatus({ specified: spec('CT708UVG#01'), submitted: null, override: 'equal' })).toEqual({ status: 'missing', near: false })
    expect(deriveProductStatus({ specified: null, submitted: sub('X1'), override: 'equal' })).toEqual({ status: 'accessory', near: false })
  })
})

describe('needsReason', () => {
  it('alternate and design change need one; nothing else does', () => {
    expect(needsReason('alternate')).toBe(true)
    expect(needsReason('design_change')).toBe(true)
    for (const s of ['as_specified', 'superseded', 'equal', 'missing', 'accessory'] as const) expect(needsReason(s)).toBe(false)
  })
})

describe('labels', () => {
  it('cover every status and reason', () => {
    expect(STATUS_LABELS).toEqual({
      as_specified: 'As specified',
      superseded: 'Superseded',
      equal: 'Equal',
      alternate: 'Alternate',
      design_change: 'Design change',
      missing: 'Missing',
      accessory: 'Accessory',
    })
    expect(REASON_LABELS).toEqual({ lead_time: 'Lead time', discontinued: 'Discontinued', in_stock: 'In stock', equal: 'Equal', cost: 'Cost', other: 'Other' })
  })
})

function rows(...pairs: Array<[ProductStatus, ReasonKind | null]>) {
  return pairs.map(([status, reasonKind]) => ({ status, reasonKind }))
}

describe('statusCounts + statusSummaryLine', () => {
  it('counts every bucket and the unreasoned alternates / design changes', () => {
    const c = statusCounts(
      rows(
        ['as_specified', null], ['as_specified', null], ['as_specified', null], ['as_specified', null], ['as_specified', null], ['as_specified', null],
        ['superseded', null],
        ['equal', 'equal'],
        ['alternate', 'lead_time'], ['alternate', 'cost'], ['alternate', 'discontinued'], ['alternate', 'in_stock'], ['alternate', 'other'],
        ['alternate', null], ['alternate', null], ['alternate', null],
        ['design_change', 'other'],
        ['missing', null],
        ['accessory', null], ['accessory', null], ['accessory', null], ['accessory', null],
      ),
    )
    expect(c.total).toBe(22)
    expect(c.byStatus).toEqual({ as_specified: 6, superseded: 1, equal: 1, alternate: 8, design_change: 1, missing: 1, accessory: 4 })
    expect(c.alternatesWithoutReason).toBe(3)
    expect(c.designChangesWithoutReason).toBe(0)
    expect(statusSummaryLine(c)).toBe('6 as specified · 1 superseded · 1 equal · 8 alternates · 3 without a reason · 1 design change · 1 missing · 4 accessories')
  })
  it('singulars and zero-omission', () => {
    const c = statusCounts(rows(['alternate', null], ['accessory', null], ['design_change', null], ['design_change', null]))
    expect(statusSummaryLine(c)).toBe('1 alternate · 1 without a reason · 2 design changes · 2 without a reason · 1 accessory')
    expect(c.designChangesWithoutReason).toBe(2)
  })
  it('an empty package', () => {
    const c = statusCounts([])
    expect(c.total).toBe(0)
    expect(statusSummaryLine(c)).toBe('No products yet')
  })
  it('a reasoned alternate does not add the "without a reason" clause', () => {
    expect(statusSummaryLine(statusCounts(rows(['alternate', 'lead_time'], ['alternate', 'cost'])))).toBe('2 alternates')
  })
})
