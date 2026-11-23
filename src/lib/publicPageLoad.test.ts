import { describe, expect, it } from 'vitest'
import {
  PUBLIC_PAGE_LOADING_WORDS,
  PUBLIC_PAGE_LOST_WORDS,
  PUBLIC_PAGE_OFFLINE_WORDS,
  PUBLIC_PAGE_SLOW_WORDS,
  PUBLIC_PAGE_STILL_OFFLINE_WORDS,
  PUBLIC_PAGE_TRY_AGAIN,
  publicPageLostView,
} from './publicPageLoad'
import { plainWordsFailures } from './plainWords'

describe('publicPageLostView', () => {
  it('online, the page says it did not load and the press reloads', () => {
    expect(publicPageLostView(true, false)).toEqual({ words: PUBLIC_PAGE_LOST_WORDS, reload: true })
  })
  it('a browser that cannot say counts as online', () => {
    expect(publicPageLostView(undefined, false).reload).toBe(true)
  })
  it('offline, it says so and the press does not reload', () => {
    expect(publicPageLostView(false, false)).toEqual({ words: PUBLIC_PAGE_OFFLINE_WORDS, reload: false })
  })
  it('a press while offline is answered in words', () => {
    expect(publicPageLostView(false, true)).toEqual({ words: PUBLIC_PAGE_STILL_OFFLINE_WORDS, reload: false })
  })
})

describe('a public page’s words while it loads', () => {
  it.each([PUBLIC_PAGE_SLOW_WORDS, PUBLIC_PAGE_LOST_WORDS, PUBLIC_PAGE_OFFLINE_WORDS, PUBLIC_PAGE_STILL_OFFLINE_WORDS])('%s is plain words', (words) => {
    expect(plainWordsFailures(words)).toEqual([])
  })
  it('names no part of the staff app', () => {
    for (const words of [PUBLIC_PAGE_LOADING_WORDS, PUBLIC_PAGE_SLOW_WORDS, PUBLIC_PAGE_LOST_WORDS, PUBLIC_PAGE_OFFLINE_WORDS, PUBLIC_PAGE_STILL_OFFLINE_WORDS, PUBLIC_PAGE_TRY_AGAIN]) {
      expect(words).not.toMatch(/\bapp\b|update|cache/i)
    }
  })
})
