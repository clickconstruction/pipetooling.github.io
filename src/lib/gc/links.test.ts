import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { GC_FOLLOW_UP_HREF, GC_PROJECT_WORDS, gcFocusFromSearch, gcProjectHref, gcViewFromSearch } from './links'

describe('GC project links', () => {
  it('opens a GC project on its card on the GC projects page', () => {
    expect(gcProjectHref('ef8905d1-039a-4cbc-9d69-9468cfea50e0')).toBe('/gc?focus=ef8905d1-039a-4cbc-9d69-9468cfea50e0')
    expect(gcFocusFromSearch(new URLSearchParams('focus=abc'))).toBe('abc')
    expect(gcFocusFromSearch(new URLSearchParams('book=1'))).toBeNull()
    expect(gcFocusFromSearch(new URLSearchParams('focus=%20'))).toBeNull()
  })

  it('opens the GC projects page on the view a link names', () => {
    expect(gcViewFromSearch(new URLSearchParams(GC_FOLLOW_UP_HREF.split('?')[1]))).toBe('followUp')
    expect(gcViewFromSearch(new URLSearchParams('view=partners'))).toBe('partners')
    expect(gcViewFromSearch(new URLSearchParams('focus=abc'))).toBe('board')
    expect(gcViewFromSearch(new URLSearchParams('view=portals'))).toBe('board')
  })

  it('says it in plain words', () => {
    for (const [key, words] of Object.entries(GC_PROJECT_WORDS)) expect(plainWordsFailures(words), key).toEqual([])
  })
})
