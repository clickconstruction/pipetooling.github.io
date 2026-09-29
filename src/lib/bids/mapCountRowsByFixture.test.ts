import { describe, expect, it } from 'vitest'
import { mapCountRowsByFixture } from './mapCountRowsByFixture'

describe('mapCountRowsByFixture', () => {
  it('maps rows whose names match exactly (trimmed, case-insensitive)', () => {
    const m = mapCountRowsByFixture(
      [
        { id: 's1', fixture: 'WCO' },
        { id: 's2', fixture: ' 3/4in 90 water ' },
      ],
      [
        { id: 't1', fixture: 'wco' },
        { id: 't2', fixture: '3/4IN 90 WATER' },
      ],
    )
    expect(m.get('s1')).toBe('t1')
    expect(m.get('s2')).toBe('t2')
  })

  it('drops source rows with no target counterpart (different takeoffs)', () => {
    const m = mapCountRowsByFixture(
      [{ id: 's1', fixture: 'MS-1' }, { id: 's2', fixture: 'WCO' }],
      [{ id: 't1', fixture: 'WCO' }],
    )
    expect(m.has('s1')).toBe(false)
    expect(m.get('s2')).toBe('t1')
  })

  it('a name duplicated on the TARGET side matches nothing (never guess)', () => {
    const m = mapCountRowsByFixture(
      [{ id: 's1', fixture: 'WCO' }],
      [{ id: 't1', fixture: 'WCO' }, { id: 't2', fixture: 'WCO' }],
    )
    expect(m.size).toBe(0)
  })

  it('a name duplicated on the SOURCE side matches nothing (two prices, one row)', () => {
    const m = mapCountRowsByFixture(
      [{ id: 's1', fixture: 'WCO' }, { id: 's2', fixture: 'WCO' }],
      [{ id: 't1', fixture: 'WCO' }],
    )
    expect(m.size).toBe(0)
  })

  it('blank and null names never match', () => {
    const m = mapCountRowsByFixture(
      [{ id: 's1', fixture: '' }, { id: 's2', fixture: null }],
      [{ id: 't1', fixture: '' }, { id: 't2', fixture: null }],
    )
    expect(m.size).toBe(0)
  })

  it('scoped (v2.4194): the same fixture in the base and in an alternate pairs with its own counterpart', () => {
    const scope = (r: { group_tag?: string | null }) => ((r.group_tag ?? '').toLowerCase() === 'break room' ? 'break room' : '')
    const source = [{ id: 's1', fixture: 'WC', group_tag: 'Restroom A' }, { id: 's2', fixture: 'WC', group_tag: 'Break room' }]
    const target = [{ id: 't1', fixture: 'WC', group_tag: null }, { id: 't2', fixture: 'WC', group_tag: 'break room' }]
    expect(mapCountRowsByFixture(source, target)).toEqual(new Map())                          // unscoped: still ambiguous
    expect(mapCountRowsByFixture(source, target, scope)).toEqual(new Map([['s1', 't1'], ['s2', 't2']]))
  })
})
