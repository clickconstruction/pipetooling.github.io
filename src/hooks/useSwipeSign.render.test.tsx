// @vitest-environment jsdom
/**
 * One way of the sign that a row swipes, as a card holds it (punch list #426, v2.8604): the count is the
 * person's, read at the moment of asking, so two cards on one page share it.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useSwipeSign } from './useSwipeSign'
import { SWIPE_SIGN_PREFIX, loadSwipeSignState } from '../lib/swipeSign'
import { IMPERSONATION_ORIGINAL_STORAGE_KEY } from '../lib/impersonationSession'
import { todayYmdInAppTz } from '../utils/dateUtils'

beforeEach(() => {
  localStorage.clear()
})

describe('useSwipeSign', () => {
  it('a person with no id gets no sign', () => {
    const { result } = renderHook(() => useSwipeSign(null, 'away'))
    expect(result.current.sign).toBeUndefined()
    expect(result.current.wordsUp).toBe(false)
    act(() => result.current.learned())
    expect(localStorage.length).toBe(0)
  })

  it('showing it once counts the day, and the same card does not show it again', () => {
    const { result } = renderHook(() => useSwipeSign('me', 'away'))
    const first = result.current.sign
    expect(first!.mayPlay()).toBe(true)
    act(() => first!.played(true))
    expect(loadSwipeSignState('me').away).toEqual({ plays: 1, lastYmd: todayYmdInAppTz(), learned: false })
    expect(result.current.sign!.mayPlay()).toBe(false)
    expect(result.current.wordsUp).toBe(false)
    // The row keeps one observer: the sign's identity holds across draws.
    expect(result.current.sign).toBe(first)
  })

  it('two cards share the count: the first to show it keeps the other still that day', () => {
    const bids = renderHook(() => useSwipeSign('me', 'away'))
    const reports = renderHook(() => useSwipeSign('me', 'away'))
    expect(reports.result.current.sign!.mayPlay()).toBe(true)
    act(() => bids.result.current.sign!.played(true))
    expect(reports.result.current.sign!.mayPlay()).toBe(false)
    // The way back has its own count.
    const back = renderHook(() => useSwipeSign('me', 'back'))
    expect(back.result.current.sign!.mayPlay()).toBe(true)
  })

  it('a visit that could not slide puts the words up, and the person\'s own swipe takes them down for good', () => {
    const { result } = renderHook(() => useSwipeSign('me', 'away'))
    act(() => result.current.sign!.played(false))
    expect(result.current.wordsUp).toBe(true)
    expect(loadSwipeSignState('me').away.plays).toBe(1)
    act(() => result.current.learned())
    expect(result.current.wordsUp).toBe(false)
    expect(loadSwipeSignState('me').away.learned).toBe(true)
    const before = localStorage.getItem(SWIPE_SIGN_PREFIX + 'me')
    act(() => result.current.learned())
    expect(localStorage.getItem(SWIPE_SIGN_PREFIX + 'me')).toBe(before)
    // A new card, another day: learned is for good.
    expect(renderHook(() => useSwipeSign('me', 'away')).result.current.sign!.mayPlay()).toBe(false)
  })

  it('while View as is on nothing is kept, and a card still shows it once only while it stays on the page', () => {
    localStorage.setItem(IMPERSONATION_ORIGINAL_STORAGE_KEY, JSON.stringify({ access_token: 'a', refresh_token: 'r' }))
    const { result } = renderHook(() => useSwipeSign('them', 'away'))
    expect(result.current.sign!.mayPlay()).toBe(true)
    act(() => result.current.sign!.played(true))
    expect(localStorage.getItem(SWIPE_SIGN_PREFIX + 'them')).toBeNull()
    expect(result.current.sign!.mayPlay()).toBe(false)
    act(() => result.current.learned())
    expect(localStorage.getItem(SWIPE_SIGN_PREFIX + 'them')).toBeNull()
  })
})
