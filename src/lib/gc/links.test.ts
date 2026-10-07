import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { GC_PROJECT_WORDS, gcFocusFromSearch, gcProjectHref } from './links'

describe('GC project links', () => {
  it('opens a GC project on its card on the GC projects page', () => {
    expect(gcProjectHref('ef8905d1-039a-4cbc-9d69-9468cfea50e0')).toBe('/gc?focus=ef8905d1-039a-4cbc-9d69-9468cfea50e0')
    expect(gcFocusFromSearch(new URLSearchParams('focus=abc'))).toBe('abc')
    expect(gcFocusFromSearch(new URLSearchParams('book=1'))).toBeNull()
    expect(gcFocusFromSearch(new URLSearchParams('focus=%20'))).toBeNull()
  })

  it('says it in plain words', () => {
    for (const [key, words] of Object.entries(GC_PROJECT_WORDS)) expect(plainWordsFailures(words), key).toEqual([])
  })
})
