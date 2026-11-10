import { describe, expect, it } from 'vitest'
import { prospectsPagePadding, skimCardSidePadding } from './pagePadding'

describe('the Prospects page on a phone (2026-11-10)', () => {
  it('keeps the desk margin on a desk and almost none on a phone', () => {
    expect(prospectsPagePadding(false)).toBe('1rem 1.5rem')
    expect(prospectsPagePadding(true)).toBe('0.25rem 0.25rem 1rem')
  })

  it('tightens the skim card on a phone', () => {
    expect(skimCardSidePadding(false)).toBe(16)
    expect(skimCardSidePadding(true)).toBeLessThan(16)
  })
})
