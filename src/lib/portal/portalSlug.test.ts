import { describe, expect, it } from 'vitest'
import {
  appendRandomTail,
  isValidSlug,
  normalizeSlugInput,
  slugGuessability,
  suggestSlugFromName,
} from './portalSlug'

describe('isValidSlug', () => {
  it('mirrors the DB constraint', () => {
    expect(isValidSlug('knight-contracting')).toBe(true)
    expect(isValidSlug('ab')).toBe(false) // too short
    expect(isValidSlug('abc')).toBe(true)
    expect(isValidSlug('-abc')).toBe(false)
    expect(isValidSlug('abc-')).toBe(false)
    expect(isValidSlug('Knight')).toBe(false) // uppercase
    expect(isValidSlug('a'.repeat(60))).toBe(true)
    expect(isValidSlug('a'.repeat(61))).toBe(false)
  })
})

describe('normalizeSlugInput', () => {
  it('lowercases, dashes spaces, strips illegal chars, collapses runs', () => {
    expect(normalizeSlugInput('Knight Contracting')).toBe('knight-contracting')
    expect(normalizeSlugInput("Terry's Lake_House")).toBe('terrys-lake-house')
    expect(normalizeSlugInput('a  --  b')).toBe('a-b')
    expect(normalizeSlugInput('--lead')).toBe('lead')
  })

  it('keeps a trailing dash while typing (validity gate catches it)', () => {
    expect(normalizeSlugInput('knight-')).toBe('knight-')
    expect(isValidSlug('knight-')).toBe(false)
  })

  it('caps at 60 chars', () => {
    expect(normalizeSlugInput('x'.repeat(80))).toHaveLength(60)
  })
})

describe('suggestSlugFromName', () => {
  it('slugifies the customer name cleanly', () => {
    expect(suggestSlugFromName('Knight Contracting, LLC.')).toBe('knight-contracting-llc')
    expect(suggestSlugFromName('DSI ')).toBe('dsi')
  })
  it('returns empty when nothing usable survives', () => {
    expect(suggestSlugFromName('李')).toBe('')
    expect(suggestSlugFromName('AB')).toBe('')
  })
})

describe('slugGuessability (advisory only)', () => {
  it('flags short or single plain words as easy', () => {
    expect(slugGuessability('dsi')).toBe('easy')
    expect(slugGuessability('knight')).toBe('easy')
    expect(slugGuessability('plumbing1')).toBe('hard') // digit → composite
    expect(slugGuessability('knight-gc')).toBe('hard')
    expect(slugGuessability('knight-contracting')).toBe('hard')
    expect(slugGuessability('bexarlofts')).toBe('hard') // 10+ chars
  })
})

describe('appendRandomTail', () => {
  it('appends a 4-char tail from the non-confusable alphabet', () => {
    const out = appendRandomTail('knight', () => 0.5)
    expect(out).toMatch(/^knight-[a-km-np-z2-9]{4}$/)
    expect(out).not.toMatch(/[l1o0]/)
  })
  it('is deterministic under an injected rng and keeps within 60 chars', () => {
    const a = appendRandomTail('x'.repeat(70), () => 0)
    expect(a.length).toBeLessThanOrEqual(60)
    expect(a.endsWith('-aaaa')).toBe(true)
  })
  it('handles an empty base', () => {
    expect(appendRandomTail('', () => 0)).toBe('aaaa')
  })
})
