import { describe, expect, it } from 'vitest'
import { needsFreezeAfterWrite, resolvePricingWriteTarget } from './pricingWriteTarget'

describe('resolvePricingWriteTarget', () => {
  const templates = [
    { id: 'tDefault', name: 'Default', is_robot: false },
    { id: 'tWendi', name: 'WENDI', is_robot: false },
    { id: 'tRobot', name: '🤖 Robot Default', is_robot: true },
  ]
  const own = [{ id: 'copy1' }, { id: 'copy2' }]

  it('is none when nothing is selected', () => {
    expect(resolvePricingWriteTarget({ selectedPricingVersionId: null, bidPricings: own, templates })).toEqual({ kind: 'none' })
  })

  it('is own when the selected pricing is one of the bid’s copies', () => {
    expect(resolvePricingWriteTarget({ selectedPricingVersionId: 'copy2', bidPricings: own, templates })).toEqual({ kind: 'own', versionId: 'copy2' })
  })

  it('is shared — freeze after the write — when the bid prices straight on a template', () => {
    const target = resolvePricingWriteTarget({ selectedPricingVersionId: 'tDefault', bidPricings: [], templates })
    expect(target).toEqual({ kind: 'shared', versionId: 'tDefault', name: 'Default' })
    expect(needsFreezeAfterWrite(target)).toBe(true)
  })

  it('prefers the bid’s copy over a template that happens to share the id space', () => {
    // A copy is never a template, but the ownership check must come first regardless.
    expect(resolvePricingWriteTarget({ selectedPricingVersionId: 'copy1', bidPricings: own, templates: [...templates, { id: 'copy1', name: 'x' }] }).kind).toBe('own')
  })

  it('never clones a robot template — the twin fence lives on it', () => {
    const target = resolvePricingWriteTarget({ selectedPricingVersionId: 'tRobot', bidPricings: [], templates })
    expect(target).toEqual({ kind: 'robot', versionId: 'tRobot' })
    expect(needsFreezeAfterWrite(target)).toBe(false)
  })

  it('leaves an id it cannot place alone (templates not loaded yet, a deleted book)', () => {
    const target = resolvePricingWriteTarget({ selectedPricingVersionId: 'gone', bidPricings: own, templates })
    expect(target).toEqual({ kind: 'unknown', versionId: 'gone' })
    expect(needsFreezeAfterWrite(target)).toBe(false)
  })

  it('treats a missing is_robot flag as a plain shared template', () => {
    expect(resolvePricingWriteTarget({ selectedPricingVersionId: 'tBill', bidPricings: [], templates: [{ id: 'tBill', name: 'Bill' }] })).toEqual({
      kind: 'shared',
      versionId: 'tBill',
      name: 'Bill',
    })
  })
})
