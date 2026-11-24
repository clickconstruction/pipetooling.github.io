import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from './plainWords'
import { PUBLIC_PAGE_CHECKING_WORDS } from './publicPageLoad'
import {
  ROUTE_RELOAD_CHECKING_WORDS,
  ROUTE_RELOAD_NO_SIGNAL_WORDS,
  ROUTE_RELOAD_PRESS,
  ROUTE_RELOAD_PRESS_MIN_HEIGHT,
  routeReloadAfterAsk,
  routeReloadView,
} from './routeReload'

describe('routeReloadView', () => {
  it('says nothing and keeps the press live before any press', () => {
    expect(routeReloadView('ready')).toEqual({ words: null, pressDead: false })
  })

  it('kills the press while the ask is out, so a second press cannot send a second ask', () => {
    expect(routeReloadView('checking')).toEqual({ words: ROUTE_RELOAD_CHECKING_WORDS, pressDead: true })
  })

  it('says there is no signal and gives the press back after an ask nothing answered', () => {
    expect(routeReloadView('no-signal')).toEqual({ words: ROUTE_RELOAD_NO_SIGNAL_WORDS, pressDead: false })
  })
})

describe('routeReloadAfterAsk', () => {
  it('reloads only on an answer', () => {
    expect(routeReloadAfterAsk(true)).toBe('reload')
    expect(routeReloadAfterAsk(false)).toBe('no-signal')
  })
})

describe('the words', () => {
  it('are plain words, and the no-signal line names the press', () => {
    expect(plainWordsFailures(ROUTE_RELOAD_NO_SIGNAL_WORDS)).toEqual([])
    expect(plainWordsFailures(ROUTE_RELOAD_CHECKING_WORDS)).toEqual([])
    expect(ROUTE_RELOAD_NO_SIGNAL_WORDS).toContain(ROUTE_RELOAD_PRESS)
  })

  it('says what a customer’s page says while it asks', () => {
    expect(ROUTE_RELOAD_CHECKING_WORDS).toBe(PUBLIC_PAGE_CHECKING_WORDS)
  })

  it('holds the press at a thumb’s height', () => {
    expect(ROUTE_RELOAD_PRESS_MIN_HEIGHT).toBeGreaterThanOrEqual(44)
  })
})
