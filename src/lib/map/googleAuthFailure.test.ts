// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { googleAuthFailureListenerCount, onGoogleAuthFailure } from './googleAuthFailure'

type AuthWindow = Window & { gm_authFailure?: () => void }
const w = window as AuthWindow
/** Google refuses the key: it calls the one global. */
const refuse = () => w.gm_authFailure?.()

const stops: Array<() => void> = []
const hear = (listener: () => void) => {
  const stop = onGoogleAuthFailure(listener)
  stops.push(stop)
  return stop
}

afterEach(() => {
  stops.splice(0).forEach((stop) => stop())
  delete w.gm_authFailure
})

describe('onGoogleAuthFailure', () => {
  it('tells one canvas that Google refused the key', () => {
    const a = vi.fn()
    hear(a)
    refuse()
    expect(a).toHaveBeenCalledTimes(1)
  })

  it('tells every canvas on the page, the one that came first too', () => {
    // A painted map's window over a page with a map of its own.
    const page = vi.fn()
    const windowOver = vi.fn()
    hear(page)
    hear(windowOver)
    refuse()
    expect(page).toHaveBeenCalledTimes(1)
    expect(windowOver).toHaveBeenCalledTimes(1)
  })

  it('keeps telling the others when a canvas leaves out of order', () => {
    const first = vi.fn()
    const second = vi.fn()
    const stopFirst = hear(first)
    hear(second)
    // The one that came first leaves first. Putting an old global back here used to cut the second off.
    stopFirst()
    refuse()
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledTimes(1)
  })

  it('stops telling a canvas that has left', () => {
    const a = vi.fn()
    const stop = hear(a)
    expect(googleAuthFailureListenerCount()).toBe(1)
    stop()
    expect(googleAuthFailureListenerCount()).toBe(0)
    refuse()
    expect(a).not.toHaveBeenCalled()
  })

  it('still tells a function that was on the global before it', () => {
    const older = vi.fn()
    w.gm_authFailure = older
    const a = vi.fn()
    hear(a)
    refuse()
    expect(a).toHaveBeenCalledTimes(1)
    expect(older).toHaveBeenCalledTimes(1)
  })

  it('takes the global back when something replaced it, and tells both once', () => {
    const a = vi.fn()
    hear(a)
    // A canvas that still sets the global by hand, calling the one it found as it should.
    const byHandHears = vi.fn()
    const found = w.gm_authFailure
    w.gm_authFailure = () => {
      found?.()
      byHandHears()
    }
    const b = vi.fn()
    hear(b)
    refuse()
    expect(a).toHaveBeenCalledTimes(1)
    expect(b).toHaveBeenCalledTimes(1)
    expect(byHandHears).toHaveBeenCalledTimes(1)
  })

  it('sets the global again after it was cleared', () => {
    const a = vi.fn()
    hear(a)
    delete w.gm_authFailure
    const b = vi.fn()
    hear(b)
    refuse()
    expect(a).toHaveBeenCalledTimes(1)
    expect(b).toHaveBeenCalledTimes(1)
  })
})
