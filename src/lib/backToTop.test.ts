import { describe, expect, it } from 'vitest'
import { BACK_TO_TOP_LABEL, BACK_TO_TOP_MIN_SCREENS, backToTopScrollBehavior, backToTopShown } from './backToTop'

describe('backToTopShown', () => {
  it('shows on a page two screens tall or more, and not on a shorter one', () => {
    expect(BACK_TO_TOP_MIN_SCREENS).toBe(2)
    expect(backToTopShown({ pageHeight: 5200, viewportHeight: 844 })).toBe(true)
    expect(backToTopShown({ pageHeight: 1688, viewportHeight: 844 })).toBe(true)
    expect(backToTopShown({ pageHeight: 1687, viewportHeight: 844 })).toBe(false)
    expect(backToTopShown({ pageHeight: 900, viewportHeight: 844 })).toBe(false)
  })

  it('a page with no layout yet is a short page', () => {
    expect(backToTopShown({ pageHeight: null, viewportHeight: 844 })).toBe(false)
    expect(backToTopShown({ pageHeight: 5200, viewportHeight: 0 })).toBe(false)
    expect(backToTopShown({ pageHeight: Number.NaN, viewportHeight: 844 })).toBe(false)
    expect(backToTopShown({ pageHeight: 5200, viewportHeight: undefined })).toBe(false)
  })
})

describe('backToTopScrollBehavior', () => {
  it('glides, and jumps at once for a person who asked for less motion', () => {
    expect(backToTopScrollBehavior(false)).toBe('smooth')
    expect(backToTopScrollBehavior(true)).toBe('instant')
  })
})

describe('the words', () => {
  it('names the act', () => {
    expect(BACK_TO_TOP_LABEL).toBe('Back to top')
  })
})
