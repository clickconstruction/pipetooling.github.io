import { describe, expect, it } from 'vitest'
import { commitPriceDraft, formatPriceDraft, parsePriceDraft } from './salePriceDraft'

describe('parsePriceDraft', () => {
  it('parses plain and decorated prices', () => {
    expect(parsePriceDraft('160')).toBe(160)
    expect(parsePriceDraft('500.25')).toBe(500.25)
    expect(parsePriceDraft('$1,200.50')).toBe(1200.5)
    expect(parsePriceDraft(' 42 ')).toBe(42)
  })

  it('keeps a trailing decimal point alive as its whole-number price', () => {
    // The bug this kernel exists for: "500." must stay a valid draft mid-typing.
    expect(parsePriceDraft('500.')).toBe(500)
  })

  it('treats partial or invalid drafts as nothing-to-preview, never zero', () => {
    expect(parsePriceDraft('')).toBeNull()
    expect(parsePriceDraft('.')).toBeNull()
    expect(parsePriceDraft('$')).toBeNull()
    expect(parsePriceDraft('abc')).toBeNull()
    expect(parsePriceDraft('0')).toBeNull()
    expect(parsePriceDraft('-50')).toBeNull()
  })
})

describe('commitPriceDraft', () => {
  it('commits valid drafts rounded to cents', () => {
    expect(commitPriceDraft('500.25')).toEqual({ kind: 'set', value: 500.25 })
    expect(commitPriceDraft('500.')).toEqual({ kind: 'set', value: 500 })
    expect(commitPriceDraft('$1,200.505')).toEqual({ kind: 'set', value: 1200.51 })
  })

  it('clears on an emptied field', () => {
    expect(commitPriceDraft('')).toEqual({ kind: 'clear' })
    expect(commitPriceDraft('   ')).toEqual({ kind: 'clear' })
  })

  it('reverts on gibberish and non-positive prices', () => {
    expect(commitPriceDraft('abc')).toEqual({ kind: 'revert' })
    expect(commitPriceDraft('0')).toEqual({ kind: 'revert' })
    expect(commitPriceDraft('-3')).toEqual({ kind: 'revert' })
  })
})

describe('formatPriceDraft', () => {
  it('keeps cents without inventing trailing zeros', () => {
    expect(formatPriceDraft(160)).toBe('160')
    expect(formatPriceDraft(500.25)).toBe('500.25')
    expect(formatPriceDraft(500.2)).toBe('500.2')
    expect(formatPriceDraft(1200.505)).toBe('1200.51')
  })
})
