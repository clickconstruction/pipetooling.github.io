import { describe, expect, it } from 'vitest'
import { MARGIN_REFUSAL, MARKUP_REFUSAL, markupFromMargin, markupMarginWords, marginFromMarkup, pairFromMarkup, pairTyped } from './markupMargin'

describe('markup and margin, side by side (v2.6538)', () => {
  it('converts both ways: 25% over cost is a 20% margin, and a 20% margin is 25% over cost', () => {
    expect(marginFromMarkup(25)).toBe(20)
    expect(markupFromMargin(20)).toBe(25)
    expect(markupFromMargin(50)).toBe(100)
    expect(markupFromMargin(23)).toBe(29.87)
    expect(marginFromMarkup(29.87)).toBe(23)
    expect(markupFromMargin(0)).toBe(0)
    expect(marginFromMarkup(0)).toBe(0)
  })

  it('refuses a margin at or past 100% and a markup below 0, since neither has a number on the other side', () => {
    expect(markupFromMargin(100)).toBeNull()
    expect(markupFromMargin(150)).toBeNull()
    expect(markupFromMargin(-5)).toBeNull()
    expect(marginFromMarkup(-1)).toBeNull()
    expect(marginFromMarkup(Number.NaN)).toBeNull()
  })

  it('draws the pair from a stored markup, blank when none is stored', () => {
    expect(pairFromMarkup(25)).toEqual({ markupText: '25', marginText: '20', markupPct: 25, refusal: null })
    expect(pairFromMarkup(29.875)).toEqual({ markupText: '29.88', marginText: '23', markupPct: 29.88, refusal: null })
    expect(pairFromMarkup(null)).toEqual({ markupText: '', marginText: '', markupPct: null, refusal: null })
    expect(pairFromMarkup(-3)).toEqual({ markupText: '', marginText: '', markupPct: null, refusal: null })
  })

  it('typing in either box fills the other and keeps what was typed as typed', () => {
    expect(pairTyped('markup', '30')).toEqual({ markupText: '30', marginText: '23.1', markupPct: 30, refusal: null })
    expect(pairTyped('markup', '30.')).toEqual({ markupText: '30.', marginText: '23.1', markupPct: 30, refusal: null })
    expect(pairTyped('margin', '20')).toEqual({ markupText: '25', marginText: '20', markupPct: 25, refusal: null })
    expect(pairTyped('margin', '33.3')).toEqual({ markupText: '49.93', marginText: '33.3', markupPct: 49.93, refusal: null })
    expect(pairTyped('markup', '  ')).toEqual({ markupText: '', marginText: '', markupPct: null, refusal: null })
    expect(pairTyped('margin', '')).toEqual({ markupText: '', marginText: '', markupPct: null, refusal: null })
  })

  it('a number that cannot stand leaves the other box blank and says why', () => {
    expect(pairTyped('margin', '100')).toEqual({ markupText: '', marginText: '100', markupPct: null, refusal: MARGIN_REFUSAL })
    expect(pairTyped('margin', '-2')).toEqual({ markupText: '', marginText: '-2', markupPct: null, refusal: MARGIN_REFUSAL })
    expect(pairTyped('markup', '-2')).toEqual({ markupText: '-2', marginText: '', markupPct: null, refusal: MARKUP_REFUSAL })
    expect(pairTyped('markup', 'abc')).toEqual({ markupText: 'abc', marginText: '', markupPct: null, refusal: MARKUP_REFUSAL })
  })

  it('words the pair', () => {
    expect(markupMarginWords(25)).toBe('25% over cost, a 20% margin on the sale')
    expect(markupMarginWords(0)).toBe('0% over cost, a 0% margin on the sale')
  })
})
