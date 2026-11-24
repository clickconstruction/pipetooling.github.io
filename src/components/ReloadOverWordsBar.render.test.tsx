// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ReloadOverWordsBar } from './ReloadOverWordsBar'
import { __resetReloadAskForTests, askReloadOverWords, currentReloadAsk } from '../lib/reloadOverWords'
import { __forgetTypedTextForTests } from '../lib/typedText'
import { TYPED_SHOWN_ATTR, TYPED_TOUR_SETTLE_MS, TYPED_TOUR_SHOWN_MS } from '../lib/typedTextTour'
import { UPDATE_PILL_DOUBLE_PRESS_MS, UPDATE_PILL_WARNED_PRESS_MIN_HEIGHT, UPDATE_PILL_WARNED_TOP } from '../lib/updatePillWarn'

describe('ReloadOverWordsBar: Hard Reload and the could-not-load Reload, over typed words', () => {
  /** jsdom lays nothing out: each place is given its height down the page, and the page a scroll. */
  let scrolled = 0
  const place = (el: HTMLElement, top: number) => {
    el.getBoundingClientRect = () => ({ top: top - scrolled, bottom: top - scrolled + 60, left: 10, right: 310, width: 300, height: 60, x: 10, y: top - scrolled, toJSON: () => ({}) })
    el.scrollIntoView = () => {
      scrolled = Math.max(0, top - window.innerHeight / 2)
    }
  }
  const leaveAMessage = (words = 'We can start Monday. Call me first.', top: number | null = 200) => {
    const box = document.createElement('textarea')
    box.value = words
    document.body.appendChild(box)
    if (top != null) place(box, top)
    return box
  }
  const ringed = (el: Element) => el.hasAttribute(TYPED_SHOWN_ATTR)
  const pass = (ms: number) =>
    act(async () => {
      await vi.advanceTimersByTimeAsync(ms)
    })
  /** A reload press, as Hard Reload makes it. */
  const pressReload = (reload = vi.fn()) => {
    act(() => {
      askReloadOverWords(reload)
    })
    return reload
  }
  const anyway = () => screen.getByRole('button', { name: 'Reload anyway' })
  const notNow = () => screen.getByRole('button', { name: 'Not now' })

  beforeEach(() => {
    vi.useFakeTimers()
    scrolled = 0
    __resetReloadAskForTests()
    __forgetTypedTextForTests()
    document.body.innerHTML = ''
  })
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    document.body.innerHTML = ''
  })

  it('draws nothing until a press is asked about, and with nothing typed the press reloads at once', () => {
    render(<ReloadOverWordsBar />)
    expect(screen.queryByRole('status')).toBeNull()
    const reload = pressReload()
    expect(reload).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('over typed words nothing reloads: the place is ringed, the bar says what goes, and Reload anyway is dead until it was shown', async () => {
    render(<ReloadOverWordsBar />)
    const note = leaveAMessage()
    const reload = pressReload()
    expect(reload).not.toHaveBeenCalled()
    expect(screen.getByRole('status').textContent).toContain('Reloading clears what you typed.')
    expect(anyway().getAttribute('aria-disabled')).toBe('true')
    expect(ringed(note)).toBe(true)
    // The safe press has the focus, and both presses are a thumb tall.
    expect(document.activeElement).toBe(notNow())
    expect(anyway().style.minHeight).toBe(`${UPDATE_PILL_WARNED_PRESS_MIN_HEIGHT}px`)
    expect(notNow().style.minHeight).toBe(`${UPDATE_PILL_WARNED_PRESS_MIN_HEIGHT}px`)
    fireEvent.click(anyway())
    expect(reload).not.toHaveBeenCalled()
    await pass(TYPED_TOUR_SHOWN_MS)
    expect(ringed(note)).toBe(false)
    expect(anyway().getAttribute('aria-disabled')).toBeNull()
    expect(reload).not.toHaveBeenCalled()
    expect(note.value).toBe('We can start Monday. Call me first.')
  })

  it('Reload anyway, once the place was shown, runs the press’s reload once, and the bar goes', async () => {
    render(<ReloadOverWordsBar />)
    leaveAMessage()
    const reload = pressReload()
    await pass(TYPED_TOUR_SHOWN_MS)
    fireEvent.click(anyway())
    expect(reload).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('two places a screen apart: the page goes to each in turn, and the confirm waits for the last', async () => {
    render(<ReloadOverWordsBar />)
    const note = leaveAMessage('Call before you come.', 200)
    const message = leaveAMessage('We can start Monday.', 4000)
    const reload = pressReload()
    expect([ringed(note), ringed(message)]).toEqual([true, false])
    await pass(TYPED_TOUR_SHOWN_MS)
    expect([ringed(note), ringed(message)]).toEqual([false, true])
    expect(scrolled).toBeGreaterThan(3000)
    expect(anyway().getAttribute('aria-disabled')).toBe('true')
    await pass(TYPED_TOUR_SETTLE_MS + TYPED_TOUR_SHOWN_MS)
    expect(anyway().getAttribute('aria-disabled')).toBeNull()
    expect(reload).not.toHaveBeenCalled()
  })

  it('Not now keeps the words: the bar goes, the ring lifts, and nothing reloads', async () => {
    render(<ReloadOverWordsBar />)
    const note = leaveAMessage()
    const reload = pressReload()
    // The tail of the press that raised the bar can land here. Ignored.
    fireEvent.click(notNow())
    expect(screen.getByRole('status')).toBeTruthy()
    await pass(UPDATE_PILL_DOUBLE_PRESS_MS)
    fireEvent.click(notNow())
    expect(screen.queryByRole('status')).toBeNull()
    expect(ringed(note)).toBe(false)
    await pass(60_000)
    expect(reload).not.toHaveBeenCalled()
    expect(note.value).toBe('We can start Monday. Call me first.')
  })

  it('a touch off the bar forgets the ask, and a touch on it does not', async () => {
    render(<ReloadOverWordsBar />)
    const note = leaveAMessage()
    const reload = pressReload()
    // Right behind the press: its own tail. The bar stays.
    fireEvent.pointerDown(note)
    expect(screen.getByRole('status')).toBeTruthy()
    await pass(TYPED_TOUR_SHOWN_MS)
    fireEvent.pointerDown(anyway())
    expect(screen.getByRole('status')).toBeTruthy()
    fireEvent.pointerDown(note)
    expect(screen.queryByRole('status')).toBeNull()
    expect(currentReloadAsk()).toBeNull()
    expect(reload).not.toHaveBeenCalled()
  })

  it('a message box at the foot of the page: the bar goes to the top while it is shown', async () => {
    render(<ReloadOverWordsBar />)
    const foot = leaveAMessage('We can start Monday.', null)
    foot.getBoundingClientRect = () => ({ top: window.innerHeight - 80, bottom: window.innerHeight - 20, left: 10, right: 310, width: 300, height: 60, x: 10, y: window.innerHeight - 80, toJSON: () => ({}) })
    pressReload()
    expect(screen.getByRole('status').style.top).toBe(UPDATE_PILL_WARNED_TOP)
    expect(screen.getByRole('status').style.bottom).toBe('')
  })

  it('a press after Not now is walked afresh', async () => {
    render(<ReloadOverWordsBar />)
    const note = leaveAMessage()
    pressReload()
    await pass(TYPED_TOUR_SHOWN_MS)
    fireEvent.click(notNow())
    const reload = pressReload()
    expect(ringed(note)).toBe(true)
    expect(anyway().getAttribute('aria-disabled')).toBe('true')
    await pass(TYPED_TOUR_SHOWN_MS)
    fireEvent.click(anyway())
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('words in a place that cannot be shown: it still warns, and the confirm still waits a second', async () => {
    render(<ReloadOverWordsBar />)
    leaveAMessage('Folded away.', null)
    const reload = pressReload()
    expect(reload).not.toHaveBeenCalled()
    expect(anyway().getAttribute('aria-disabled')).toBe('true')
    await pass(TYPED_TOUR_SHOWN_MS)
    expect(anyway().getAttribute('aria-disabled')).toBeNull()
  })

  it('the bar leaving the page mid-walk leaves no ring, and a later press reloads at once', () => {
    const view = render(<ReloadOverWordsBar />)
    const note = leaveAMessage()
    const reload = pressReload()
    expect(ringed(note)).toBe(true)
    view.unmount()
    expect(ringed(note)).toBe(false)
    expect(reload).not.toHaveBeenCalled()
    pressReload(reload)
    expect(reload).toHaveBeenCalledTimes(1)
  })
})
