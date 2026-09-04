import { describe, expect, it } from 'vitest'
import { fixtureKey, fixtureKeysEqual, normalizeFixtureName, stripPlanTag } from './takeoffFixtureKey'

describe('normalizeFixtureName', () => {
  it('lowercases, trims, and collapses whitespace without stripping anything', () => {
    expect(normalizeFixtureName('  WC-12 ')).toBe('wc-12')
    expect(normalizeFixtureName('ft  of   3/4in Water')).toBe('ft of 3/4in water')
    expect(normalizeFixtureName(null)).toBe('')
  })
})

describe('fixtureKey — the 15 most common prod names', () => {
  it.each([
    ['wco', 'wco'],
    ['fco', 'fco'],
    ['ft of 3/4in water', 'ft of 3/4in water'],
    ['ft of 4in waste', 'ft of 4in waste'],
    ['ft of 1/2in water', 'ft of 1/2in water'],
    ['lav-1', 'lav'],
    ['2in 90 waste', '2in 90 waste'],
    ['4in 90 waste', '4in 90 waste'],
    ['3/4in t water', '3/4in t water'],
    ['2in t waste', '2in t waste'],
    ['1/2in 90 water', '1/2in 90 water'],
    ['WC-12', 'wc'],
    ['fd-2', 'fd'],
    ['S-1', 's'],
    ['L-4', 'l'],
  ])('%s → %s', (raw, key) => {
    expect(fixtureKey(raw)).toBe(key)
  })

  it('strips a spaced tag only when the rest holds no digit', () => {
    expect(fixtureKey('lav 1')).toBe('lav')
    expect(fixtureKey('WH 2a')).toBe('wh')
    expect(fixtureKey('2in 90')).toBe('2in 90')
    expect(fixtureKey('1/2in 90')).toBe('1/2in 90')
  })

  it('strips one tag only and never returns an empty key for a bare tag', () => {
    expect(fixtureKey('wc-12-3')).toBe('wc-12')
    expect(fixtureKey('-12')).toBe('-12')
    expect(stripPlanTag('12')).toBe('12')
  })

  it('leaves line-feet and pixel rows whole', () => {
    expect(fixtureKey('ft of 2in waste 2')).toBe('ft of 2in waste 2')
    expect(fixtureKey('px of 1in gas-1')).toBe('px of 1in gas-1')
  })
})

describe('fixtureKeysEqual', () => {
  it('matches plan tags to bare fixtures and never matches empties', () => {
    expect(fixtureKeysEqual('WC-12', 'wc')).toBe(true)
    expect(fixtureKeysEqual('WC-12', 'WC-3')).toBe(true)
    expect(fixtureKeysEqual('wc', 'wco')).toBe(false)
    expect(fixtureKeysEqual('', '')).toBe(false)
    expect(fixtureKeysEqual(null, undefined)).toBe(false)
  })
})
