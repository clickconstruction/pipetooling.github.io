import { describe, expect, it } from 'vitest'
import { gcDisplayName, UNNAMED_GC_LABEL } from './gcDisplayName'

describe('gcDisplayName', () => {
  it('returns the trimmed name when there is one', () => {
    expect(gcDisplayName('Southern Post ')).toBe('Southern Post')
    expect(gcDisplayName({ name: ' Burd & Assoc.' })).toBe('Burd & Assoc.')
  })
  it('names an unnamed GC the same way from every input shape', () => {
    expect(gcDisplayName(null)).toBe(UNNAMED_GC_LABEL)
    expect(gcDisplayName(undefined)).toBe(UNNAMED_GC_LABEL)
    expect(gcDisplayName('')).toBe(UNNAMED_GC_LABEL)
    expect(gcDisplayName('   ')).toBe(UNNAMED_GC_LABEL)
    expect(gcDisplayName({ name: null })).toBe(UNNAMED_GC_LABEL)
    expect(gcDisplayName({})).toBe(UNNAMED_GC_LABEL)
  })
  it('treats a bare dash (the old fallback, already published into rooms) as unnamed', () => {
    expect(gcDisplayName('—')).toBe(UNNAMED_GC_LABEL)
    expect(gcDisplayName('-')).toBe(UNNAMED_GC_LABEL)
    expect(gcDisplayName(' – ')).toBe(UNNAMED_GC_LABEL)
  })
  it('keeps a real name that merely contains a dash', () => {
    expect(gcDisplayName('H&I — Austin')).toBe('H&I — Austin')
  })
})
