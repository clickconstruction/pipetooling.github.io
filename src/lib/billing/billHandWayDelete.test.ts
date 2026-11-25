import { describe, expect, it } from 'vitest'
import { BILL_HAND_WAYS_BUILT_IN, type BillHandWay } from './billHandWays'
import { handWayDeleteConfirm, handWayDeleteDrawn, handWayDeleteProblem, handWayDeleteUsedProblem, handWayDeletedWords } from './billHandWayDelete'

const way = (over: Partial<BillHandWay> = {}): BillHandWay => ({
  id: 'w-1',
  key: 'w_0123456789',
  label: 'ZZ Test portal upload',
  sentHow: 'other',
  sortOrder: 5,
  retiredAtIso: '2026-11-24T18:00:00.000Z',
  retiredByName: 'Priya',
  createdByName: 'Priya',
  createdAtIso: '2026-11-24T17:00:00.000Z',
  ...over,
})

describe('handWayDeleteDrawn', () => {
  it('draws the press for a dev and for no other role', () => {
    expect(handWayDeleteDrawn('dev')).toBe(true)
    for (const role of ['master_technician', 'assistant', 'controller', 'estimator', 'primary', 'superintendent', 'subcontractor', 'helpers', '', null, undefined]) expect(handWayDeleteDrawn(role)).toBe(false)
  })
})

describe('handWayDeleteProblem', () => {
  it('lets a test way that was taken off go on to the count', () => {
    expect(handWayDeleteProblem(way())).toBe('')
    expect(handWayDeleteProblem(way({ label: 'zz anything' }))).toBe('')
  })
  it('refuses a way that is not a test way', () => {
    expect(handWayDeleteProblem(way({ label: 'Uploaded to the builder’s portal' }))).toBe('Only a test way can be deleted. Its name must start with ZZ.')
    expect(handWayDeleteProblem(way({ label: 'Test ZZ' }))).toMatch(/must start with ZZ/)
  })
  it('refuses a way still on the list, test or not', () => {
    expect(handWayDeleteProblem(way({ retiredAtIso: null }))).toBe('Take this way off the list first.')
  })
  it('refuses each of the four ways the form began with, and a way with no row', () => {
    for (const first of BILL_HAND_WAYS_BUILT_IN) {
      expect(handWayDeleteProblem(way({ key: first.key, label: `ZZ ${first.label}` }))).toMatch(/four ways the form began with/)
      expect(handWayDeleteProblem({ ...first, retiredAtIso: '2026-11-24T18:00:00.000Z', label: 'ZZ Test' })).toMatch(/four ways the form began with/)
    }
    expect(handWayDeleteProblem(way({ id: '' }))).toMatch(/four ways the form began with/)
  })
})

describe('handWayDeleteUsedProblem', () => {
  it('lets a way nobody used go', () => {
    expect(handWayDeleteUsedProblem(way(), 0)).toBe('')
  })
  it('keeps a way a bill was recorded with, and says how many', () => {
    expect(handWayDeleteUsedProblem(way(), 1)).toBe('1 bill was recorded with this way. It stays.')
    expect(handWayDeleteUsedProblem(way(), 3)).toBe('3 bills were recorded with this way. It stays.')
  })
  it('never deletes on a count that could not be read', () => {
    for (const none of [null, Number.NaN, -1]) expect(handWayDeleteUsedProblem(way(), none)).toBe('The bills recorded with this way could not be counted. Nothing was deleted.')
  })
  it('says the fixed refusal first, whatever the count', () => {
    expect(handWayDeleteUsedProblem(way({ label: 'Faxed' }), 0)).toMatch(/must start with ZZ/)
    expect(handWayDeleteUsedProblem(way({ retiredAtIso: null }), 0)).toBe('Take this way off the list first.')
  })
})

describe('the words', () => {
  it('names the act on the confirm button, never OK', () => {
    const c = handWayDeleteConfirm(way())
    expect(c.confirmLabel).toBe('Delete the way')
    expect(c.title).toBe('Delete the way ZZ Test portal upload?')
    expect(c.message).toMatch(/cannot be brought back/)
  })
  it('says what went', () => {
    expect(handWayDeletedWords(way())).toBe('ZZ Test portal upload was deleted.')
  })
})
