import { describe, expect, it } from 'vitest'
import { findLooseIdentityPairs, identityKeysLooselyEqual, normalizeIdentityKey } from './identityKey'

describe('normalizeIdentityKey (T5-07)', () => {
  it('folds case, punctuation, whitespace and diacritics', () => {
    expect(normalizeIdentityKey('  José García. ')).toBe('jose garcia')
    expect(normalizeIdentityKey('WATTS')).toBe('watts')
    expect(normalizeIdentityKey('Mike. Holub')).toBe('mike holub')
  })
  it('reads "&" as "and" so "H & I" and "H&I" share a key', () => {
    expect(normalizeIdentityKey('H & I')).toBe('h and i')
    expect(normalizeIdentityKey('H&I')).toBe('h and i')
    expect(normalizeIdentityKey('H and I Builders')).toBe('h and i builders')
  })
  it('is empty for blanks', () => {
    expect(normalizeIdentityKey(null)).toBe('')
    expect(normalizeIdentityKey('  ')).toBe('')
  })
})

describe('identityKeysLooselyEqual', () => {
  it('equal keys, or ≥2-token containment on both sides', () => {
    expect(identityKeysLooselyEqual('jose garcia', 'jose garcia')).toBe(true)
    expect(identityKeysLooselyEqual('jose garcia', 'jose luis garcia')).toBe(true)
    expect(identityKeysLooselyEqual('j garcia', 'jose garcia')).toBe(true)
    expect(identityKeysLooselyEqual('garcia jose', 'jose luis garcia')).toBe(true)
  })
  it('never merges on a single token ("Summit" stays separate from "Summit General Contractors")', () => {
    expect(identityKeysLooselyEqual('summit', 'summit general contractors')).toBe(false)
    expect(identityKeysLooselyEqual('jose', 'jose garcia')).toBe(false)
    expect(identityKeysLooselyEqual('', 'jose')).toBe(false)
  })
})

describe('findLooseIdentityPairs', () => {
  it('lists distinct-key pairs the loose rule would merge, once each', () => {
    const pairs = findLooseIdentityPairs([
      { key: 'acme builders', name: 'Acme Builders' },
      { key: 'acme builders', name: 'ACME builders' },
      { key: 'acme builders llc', name: 'Acme Builders LLC' },
      { key: 'summit', name: 'Summit' },
      { key: 'summit general contractors', name: 'Summit General Contractors' },
    ])
    expect(pairs).toHaveLength(1)
    expect(pairs[0]![0].name).toBe('Acme Builders')
    expect(pairs[0]![1].name).toBe('Acme Builders LLC')
  })
})
