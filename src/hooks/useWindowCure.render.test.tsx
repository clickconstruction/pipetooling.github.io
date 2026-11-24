// @vitest-environment jsdom
/**
 * Render smoke for `useWindowCure` (punch list #85): a page that lost a window's code asks for it again once
 * the signal is back, and never while words someone typed are on the page. Each test loses a real
 * `lazyWindow`, so the hook hears of it the way it does in the app.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render } from '@testing-library/react'
import { __forgetLostWindowsForTests, lazyWindow, lostWindowCount } from '../lib/lazyWindow'
import { WINDOW_CURE_LOOK_AGAIN_MS, WINDOW_CURE_NO_ANSWER_MS, type WindowCureSnapshot } from '../lib/windowCure'
import { useWindowCure, type WindowCureDeps } from './useWindowCure'

const lostChunk = () => new TypeError('Failed to fetch dynamically imported module: https://x/assets/JobWindowModal-abc123.js')

function Watch({ on, deps }: { on: boolean; deps: WindowCureDeps }) {
  useWindowCure(on, deps)
  return <p>Jobs</p>
}

/** The page as a test moves it. `lostWindows` is read live from `lazyWindow`. */
function page(start: Partial<WindowCureSnapshot> = {}) {
  const state: Omit<WindowCureSnapshot, 'lostWindows'> = {
    browserOffline: false,
    framed: false,
    msSinceLastCure: null,
    msSinceLastRecovery: null,
    typedText: false,
    editableFocused: false,
    dialogOpen: false,
    unsavedHolds: 0,
    inFlightWrites: 0,
    ...start,
  }
  let answer: (answered: boolean) => void = () => undefined
  const ask = vi.fn(() => new Promise<boolean>((r) => (answer = r)))
  const cure = vi.fn()
  const deps: WindowCureDeps = { snapshot: () => ({ ...state, lostWindows: lostWindowCount() }), ask, cure }
  return { state, deps, ask, cure, answer: (answered: boolean) => act(async () => answer(answered)) }
}

/** Loses one window, as a press on a lost chunk does. */
async function loseAWindow() {
  const lost = lazyWindow(async (): Promise<{ default: () => null }> => {
    throw lostChunk()
  })
  await act(async () => {
    await lost.preload().catch(() => undefined)
  })
}

describe('useWindowCure', () => {
  beforeEach(() => {
    __forgetLostWindowsForTests()
    vi.useFakeTimers()
  })
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('does nothing while no window is lost', () => {
    const p = page()
    render(<Watch on deps={p.deps} />)
    act(() => {
      vi.advanceTimersByTime(10 * 60_000)
    })
    expect(p.ask).not.toHaveBeenCalled()
  })

  it('a window is lost on a quiet page with the network there: it asks, then cures on the answer', async () => {
    const p = page()
    render(<Watch on deps={p.deps} />)
    await loseAWindow()
    expect(p.ask).toHaveBeenCalledTimes(1)
    expect(p.cure).not.toHaveBeenCalled()
    await p.answer(true)
    expect(p.cure).toHaveBeenCalledTimes(1)
  })

  it('lost offline, it waits for the browser to say the signal is back', async () => {
    const p = page({ browserOffline: true })
    render(<Watch on deps={p.deps} />)
    await loseAWindow()
    act(() => {
      vi.advanceTimersByTime(5 * 60_000)
    })
    expect(p.ask).not.toHaveBeenCalled()
    p.state.browserOffline = false
    act(() => {
      window.dispatchEvent(new Event('online'))
    })
    expect(p.ask).toHaveBeenCalledTimes(1)
    await p.answer(true)
    expect(p.cure).toHaveBeenCalledTimes(1)
  })

  it('never cures over words someone typed: an hour of looks, and nothing is asked', async () => {
    const p = page({ typedText: true })
    render(<Watch on deps={p.deps} />)
    await loseAWindow()
    act(() => {
      window.dispatchEvent(new Event('online'))
      vi.advanceTimersByTime(60 * 60_000)
    })
    expect(p.ask).not.toHaveBeenCalled()
    expect(p.cure).not.toHaveBeenCalled()
    // The message is sent. The next look asks.
    p.state.typedText = false
    act(() => {
      vi.advanceTimersByTime(WINDOW_CURE_LOOK_AGAIN_MS)
    })
    expect(p.ask).toHaveBeenCalledTimes(1)
    await p.answer(true)
    expect(p.cure).toHaveBeenCalledTimes(1)
  })

  it('words typed while the ask was out hold the cure: the second look', async () => {
    const p = page()
    render(<Watch on deps={p.deps} />)
    await loseAWindow()
    expect(p.ask).toHaveBeenCalledTimes(1)
    p.state.typedText = true
    await p.answer(true)
    expect(p.cure).not.toHaveBeenCalled()
    // Cleared again: it asks afresh before it cures.
    p.state.typedText = false
    act(() => {
      vi.advanceTimersByTime(WINDOW_CURE_LOOK_AGAIN_MS)
    })
    expect(p.ask).toHaveBeenCalledTimes(2)
    await p.answer(true)
    expect(p.cure).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['a focused field', { editableFocused: true }],
    ['an open window', { dialogOpen: true }],
    ['unsaved work', { unsavedHolds: 1 }],
    ['a write in flight', { inFlightWrites: 1 }],
  ])('holds for %s', async (_name, held) => {
    const p = page(held)
    render(<Watch on deps={p.deps} />)
    await loseAWindow()
    act(() => {
      vi.advanceTimersByTime(5 * 60_000)
    })
    expect(p.ask).not.toHaveBeenCalled()
  })

  it('an ask nothing answered cures nothing, and asks again a minute later', async () => {
    const p = page()
    render(<Watch on deps={p.deps} />)
    await loseAWindow()
    await p.answer(false)
    expect(p.cure).not.toHaveBeenCalled()
    act(() => {
      vi.advanceTimersByTime(WINDOW_CURE_NO_ANSWER_MS - 1)
    })
    expect(p.ask).toHaveBeenCalledTimes(1)
    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(p.ask).toHaveBeenCalledTimes(2)
  })

  it('one ask at a time: looks that come while it is out send no second ask', async () => {
    const p = page()
    render(<Watch on deps={p.deps} />)
    await loseAWindow()
    act(() => {
      window.dispatchEvent(new Event('online'))
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(p.ask).toHaveBeenCalledTimes(1)
  })

  it('a cure tried inside the last ten minutes is not tried again', async () => {
    const p = page({ msSinceLastCure: 90_000 })
    render(<Watch on deps={p.deps} />)
    await loseAWindow()
    act(() => {
      window.dispatchEvent(new Event('online'))
      vi.advanceTimersByTime(5 * 60_000)
    })
    expect(p.ask).not.toHaveBeenCalled()
  })

  it('looks again when the tab is looked at', async () => {
    const p = page({ dialogOpen: true })
    render(<Watch on deps={p.deps} />)
    await loseAWindow()
    p.state.dialogOpen = false
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(p.ask).toHaveBeenCalledTimes(1)
  })

  it('off, with nobody signed in, it watches nothing', async () => {
    const p = page()
    render(<Watch on={false} deps={p.deps} />)
    await loseAWindow()
    act(() => {
      window.dispatchEvent(new Event('online'))
      vi.advanceTimersByTime(60_000)
    })
    expect(p.ask).not.toHaveBeenCalled()
  })

  it('an answer that comes after the page has gone does nothing', async () => {
    const p = page()
    const { unmount } = render(<Watch on deps={p.deps} />)
    await loseAWindow()
    unmount()
    await p.answer(true)
    expect(p.cure).not.toHaveBeenCalled()
  })
})
