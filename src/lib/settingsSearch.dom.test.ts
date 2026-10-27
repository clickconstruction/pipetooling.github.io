// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { pollScrollToSettingsAnchor, SETTINGS_ANCHOR_HOLD_MS } from './settingsSearch'

/**
 * The anchor's top on screen, as the stubs report it: `scrollIntoView` puts it at 0, and a card above that loads
 * pushes it down by its height. jsdom lays nothing out, so the test plays the page.
 */
function anchor(id: string) {
  const state = { top: 1933 }
  const el = document.createElement('div')
  el.id = id
  el.getBoundingClientRect = () => ({ top: state.top, bottom: state.top + 100, left: 0, right: 0, width: 0, height: 100, x: 0, y: state.top, toJSON: () => ({}) }) as DOMRect
  const scroll = vi.fn(() => {
    state.top = 0
  })
  el.scrollIntoView = scroll as unknown as typeof el.scrollIntoView
  return { el, state, scroll }
}

beforeEach(() => {
  vi.useFakeTimers()
  document.body.innerHTML = ''
})
afterEach(() => {
  vi.useRealTimers()
})

describe('pollScrollToSettingsAnchor — find the card, then hold it in view while the page settles', () => {
  it('scrolls once the anchor appears, and re-aligns it each time a card above pushes it down', () => {
    const a = anchor('settings-phone-texts-hours')
    pollScrollToSettingsAnchor('settings-phone-texts-hours')
    vi.advanceTimersByTime(500)
    expect(a.scroll).not.toHaveBeenCalled()
    document.body.appendChild(a.el)
    vi.advanceTimersByTime(200)
    expect(a.scroll).toHaveBeenCalledTimes(1)
    expect(a.state.top).toBe(0)
    // A card above finishes loading: the anchor slides 875 px down, and the next tick puts it back.
    a.state.top = 875
    vi.advanceTimersByTime(250)
    expect(a.scroll).toHaveBeenCalledTimes(2)
    expect(a.state.top).toBe(0)
    // A drift of a few pixels is the anchor where it was put: no scroll for it.
    a.state.top = 5
    vi.advanceTimersByTime(250)
    expect(a.scroll).toHaveBeenCalledTimes(2)
  })

  it('lets go when the hold ends, so a later change is the page\'s own', () => {
    const a = anchor('settings-page-pins')
    document.body.appendChild(a.el)
    pollScrollToSettingsAnchor('settings-page-pins')
    vi.advanceTimersByTime(200)
    expect(a.scroll).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(SETTINGS_ANCHOR_HOLD_MS + 500)
    a.state.top = 600
    vi.advanceTimersByTime(1000)
    expect(a.scroll).toHaveBeenCalledTimes(1)
  })

  it('stops the moment the person scrolls or presses anything', () => {
    const a = anchor('settings-legal-firm')
    document.body.appendChild(a.el)
    pollScrollToSettingsAnchor('settings-legal-firm')
    vi.advanceTimersByTime(200)
    expect(a.scroll).toHaveBeenCalledTimes(1)
    window.dispatchEvent(new Event('wheel'))
    a.state.top = 875
    vi.advanceTimersByTime(1000)
    expect(a.scroll).toHaveBeenCalledTimes(1)
  })

  it('gives up quietly when the anchor never appears, and the stop function ends a hold early', () => {
    const missing = anchor('settings-nowhere')
    pollScrollToSettingsAnchor('settings-nowhere', { findMs: 1000 })
    vi.advanceTimersByTime(3000)
    document.body.appendChild(missing.el)
    vi.advanceTimersByTime(1000)
    expect(missing.scroll).not.toHaveBeenCalled()

    const a = anchor('settings-clause-x')
    document.body.appendChild(a.el)
    const stop = pollScrollToSettingsAnchor('settings-clause-x')
    vi.advanceTimersByTime(200)
    stop()
    a.state.top = 400
    vi.advanceTimersByTime(1000)
    expect(a.scroll).toHaveBeenCalledTimes(1)
  })
})
