import { describe, expect, it } from 'vitest'
import {
  appendRandomTail,
  isValidSlug,
  normalizeSlugInput,
  slugGuessability,
  slugGuessabilityDetail,
  slugGuessabilityLabel,
  suggestSlugFromName,
  suggestSlugWithTail,
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

describe('suggestSlugWithTail (the default for a new address — B18 / J21-F6)', () => {
  it('is the name plus a 4-char tail, and hands back the tail-less base for re-rolls', () => {
    const out = suggestSlugWithTail('Knight Contracting', () => 0.5)
    expect(out.base).toBe('knight-contracting')
    expect(out.slug).toMatch(/^knight-contracting-[a-km-np-z2-9]{4}$/)
    expect(out.slug.startsWith(out.base + '-')).toBe(true)
  })
  it('is empty when the name yields nothing usable (no tail-only slug)', () => {
    expect(suggestSlugWithTail('AB', () => 0)).toEqual({ base: '', slug: '' })
  })
  it('stays within the 60-char constraint for long names', () => {
    const out = suggestSlugWithTail('x'.repeat(80), () => 0)
    expect(out.slug.length).toBeLessThanOrEqual(60)
  })
})

describe('slugGuessabilityDetail — the meter says why', () => {
  it('the bare name grades easy however long it is, and says so', () => {
    const d = slugGuessabilityDetail('knight-contracting', 'knight-contracting')
    expect(d).toEqual({ grade: 'easy', reason: 'just-their-name' })
    expect(slugGuessabilityLabel(d)).toBe("⚠ easy to guess — it's just their name")
    // ...but the same slug with no name to compare against keeps the old composite verdict
    expect(slugGuessabilityDetail('knight-contracting')).toEqual({ grade: 'hard', reason: 'composite' })
    expect(slugGuessability('knight-contracting')).toBe('hard')
  })
  it('the name plus a tail grades hard, reason has-tail', () => {
    const { slug } = suggestSlugWithTail('Knight Contracting', () => 0.5)
    const d = slugGuessabilityDetail(slug, 'knight-contracting')
    expect(d).toEqual({ grade: 'hard', reason: 'has-tail' })
    expect(slugGuessabilityLabel(d)).toBe('✓ hard to guess — random tail')
  })
  it('short and single plain words keep their reasons', () => {
    expect(slugGuessabilityDetail('dsi')).toEqual({ grade: 'easy', reason: 'short' })
    expect(slugGuessabilityLabel(slugGuessabilityDetail('dsi'))).toBe('⚠ easy to guess — too short')
    expect(slugGuessabilityDetail('knight')).toEqual({ grade: 'easy', reason: 'plain-word' })
    expect(slugGuessabilityDetail('knight-gc')).toEqual({ grade: 'hard', reason: 'composite' })
  })
  it('ignores a trailing dash while typing', () => {
    expect(slugGuessabilityDetail('knight-contracting-', 'knight-contracting').reason).toBe('just-their-name')
  })
})
