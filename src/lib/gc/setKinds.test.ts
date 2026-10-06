import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { SET_KIND_HELP, SET_KINDS, defaultSetKind, nextSetLabel } from './setKinds'

describe('what a later set is called', () => {
  it('starts as an addendum while we bid and a bulletin once the job is ours', () => {
    expect(defaultSetKind({ stage: 'pursuing' })).toBe('Addendum')
    expect(defaultSetKind({ stage: 'buyout' })).toBe('Bulletin')
    expect(SET_KINDS.map((k) => k.kind)).toEqual(['Addendum', 'Bulletin', 'Revised set', 'Permit set', 'Construction set'])
  })

  it('counts each numbered kind on its own, and names an unnumbered one once, then with a count', () => {
    const sets = [{ label: 'Bid set' }, { label: 'Addendum 1' }, { label: 'Addendum 2' }, { label: 'Permit set' }]
    expect(nextSetLabel({ planSets: sets }, 'Addendum')).toBe('Addendum 3')
    expect(nextSetLabel({ planSets: sets }, 'Bulletin')).toBe('Bulletin 1')
    expect(nextSetLabel({ planSets: sets }, 'Revised set')).toBe('Revised set')
    expect(nextSetLabel({ planSets: sets }, 'Permit set')).toBe('Permit set 2')
    expect(nextSetLabel({ planSets: [...sets, { label: 'Permit set 2' }] }, 'Permit set')).toBe('Permit set 3')
  })
})

describe('what the kinds of plan sets are', () => {
  it('covers the three chips in their order, and every sentence reads in plain words', () => {
    expect(SET_KIND_HELP.map((k) => k.kind)).toEqual(['Bid set', 'Pricing set', 'Permit set'])
    for (const k of SET_KIND_HELP) {
      for (const text of [k.alsoCalled ?? '', k.when, k.who, k.inIt, k.forWhat]) expect(plainWordsFailures(text)).toEqual([])
    }
  })
})
