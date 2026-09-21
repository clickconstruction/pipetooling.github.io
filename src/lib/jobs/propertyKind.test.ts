import { describe, expect, it } from 'vitest'
import { jobsSharingProperty, normalizePropertyKind, propertyKindPatch, propertyKindWords, sharedPropertyWords } from './propertyKind'

describe('propertyKind', () => {
  it('reads only the two kinds; anything else is unset', () => {
    expect([normalizePropertyKind('residential'), normalizePropertyKind('non_residential'), normalizePropertyKind(''), normalizePropertyKind(null), normalizePropertyKind('condo')]).toEqual(['residential', 'non_residential', '', '', ''])
  })

  it('speaks each screen’s word', () => {
    expect([propertyKindWords('residential'), propertyKindWords('non_residential'), propertyKindWords('')]).toEqual(['residential', 'commercial', 'kind unknown'])
    expect([propertyKindWords('residential', 'sheet'), propertyKindWords('non_residential', 'sheet'), propertyKindWords('', 'sheet')]).toEqual(['Residential', 'Non-residential', 'kind not set'])
  })

  it('a non-residential pick clears the homestead; residential leaves it alone', () => {
    expect(propertyKindPatch('non_residential')).toEqual({ property_kind: 'non_residential', homestead: false })
    expect(propertyKindPatch('')).toEqual({ property_kind: '', homestead: false })
    expect(propertyKindPatch('residential')).toEqual({ property_kind: 'residential' })
  })

  it('finds the other jobs at the same saved property', () => {
    const addr: Record<string, string | null> = { j273: 'lenox', j881: 'lenox', j258: 'terrell', j608: 'terrell', j651: null, j706: null }
    const ids = Object.keys(addr)
    expect(jobsSharingProperty('j273', ids, (id) => addr[id])).toEqual(['j881'])
    expect(jobsSharingProperty('j651', ids, (id) => addr[id])).toEqual([])
    expect(sharedPropertyWords(['273'])).toBe('same property as 273')
    expect(sharedPropertyWords(['273', '881', '900'])).toBe('same property as 273, 881 and 900')
    expect(sharedPropertyWords([])).toBe('')
  })
})
