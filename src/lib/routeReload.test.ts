import { describe, expect, it } from 'vitest'
import { CHUNK_RELOAD_LAND_MAX_MS } from './chunkLoadRecovery'
import { WIPE_DEADLINE_MS } from './hardReload'
import { plainWordsFailures } from './plainWords'
import { PUBLIC_PAGE_CHECKING_WORDS } from './publicPageLoad'
import {
  ROUTE_RELOAD_CHECKING_WORDS,
  ROUTE_RELOAD_LAND_MAX_MS,
  ROUTE_RELOAD_NO_SIGNAL_WORDS,
  ROUTE_RELOAD_PRESS,
  ROUTE_RELOAD_PRESS_MIN_HEIGHT,
  ROUTE_RELOAD_STALLED_WORDS,
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

  it('punch list #406: gives the press back, with a line, when the reload was started and the page is still here', () => {
    expect(routeReloadView('stalled')).toEqual({ words: ROUTE_RELOAD_STALLED_WORDS, pressDead: false })
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

  it('the line for a reload that did not finish is plain words, names the press and is not the no-signal line', () => {
    expect(plainWordsFailures(ROUTE_RELOAD_STALLED_WORDS)).toEqual([])
    expect(ROUTE_RELOAD_STALLED_WORDS).toContain(ROUTE_RELOAD_PRESS)
    expect(ROUTE_RELOAD_STALLED_WORDS).not.toBe(ROUTE_RELOAD_NO_SIGNAL_WORDS)
  })

  it('the press comes back after the reload’s own three seconds and a page’s load, not before', () => {
    expect(ROUTE_RELOAD_LAND_MAX_MS).toBeGreaterThan(WIPE_DEADLINE_MS)
    expect(ROUTE_RELOAD_LAND_MAX_MS).toBe(CHUNK_RELOAD_LAND_MAX_MS)
  })

  it('says what a customer’s page says while it asks', () => {
    expect(ROUTE_RELOAD_CHECKING_WORDS).toBe(PUBLIC_PAGE_CHECKING_WORDS)
  })

  it('holds the press at a thumb’s height', () => {
    expect(ROUTE_RELOAD_PRESS_MIN_HEIGHT).toBeGreaterThanOrEqual(44)
  })
})
