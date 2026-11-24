// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom'
import { UpdatePrompt } from './UpdatePrompt'
import { __forgetTypedTextForTests, noteTypedInto } from '../lib/typedText'
import { TYPED_SHOWN_ATTR, TYPED_TOUR_SETTLE_MS, TYPED_TOUR_SHOWN_MS } from '../lib/typedTextTour'
import { UPDATE_PILL_DOUBLE_PRESS_MS, UPDATE_PILL_WARNED_PRESS_MIN_HEIGHT, UPDATE_PILL_WARNED_TOP } from '../lib/updatePillWarn'
import { AUTO_RELOAD_KEY } from '../lib/autoReload'
import { __resetUnsavedWorkForTests, holdUnsavedWork, wrapFetchCountingWrites } from '../lib/unsavedWork'
import { markPhoneSheetOpen, resetPhoneSheetOpenForTests, UPDATE_PILL_BOTTOM, UPDATE_PILL_TOP } from '../lib/phoneSheetOpen'

type SWOpts = { onNeedRefresh?: () => void; onRegisteredSW?: (url: string, reg: unknown) => void }
const swOpts: { current: SWOpts | null } = { current: null }
const updateSW = vi.fn(async () => {})
vi.mock('virtual:pwa-register', () => ({
  registerSW: (opts: SWOpts) => {
    swOpts.current = opts
    return updateSW
  },
}))

// jsdom has no service worker: a bare event target stands in, so a test can say "the new
// worker took over" by dispatching `controllerchange`. `workboxReload` is the listener
// workbox-window adds after ours, the one vite-plugin-pwa reloads from.
const swContainer = new EventTarget()
Object.defineProperty(navigator, 'serviceWorker', { value: swContainer, configurable: true })
const workboxReload = vi.fn()
const workerTakesOver = () => swContainer.dispatchEvent(new Event('controllerchange'))

function Nav() {
  const navigate = useNavigate()
  return (
    <>
      <button type="button" onClick={() => navigate('/jobs')}>
        go
      </button>
      <button type="button" onClick={() => navigate('/people?tab=review')}>
        tab
      </button>
      <button type="button" onClick={() => navigate('/people?tab=hours&lens=pay')}>
        lens
      </button>
    </>
  )
}

function mount(at = '/dashboard') {
  return render(
    <MemoryRouter initialEntries={[at]}>
      <UpdatePrompt />
      <Routes>
        <Route path="*" element={<Nav />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('UpdatePrompt auto-reload (v2.3740)', () => {
  const reload = vi.fn()
  const originalLocation = window.location
  beforeEach(() => {
    vi.useFakeTimers()
    reload.mockReset()
    workboxReload.mockReset()
    updateSW.mockClear()
    sessionStorage.clear()
    __resetUnsavedWorkForTests()
    __forgetTypedTextForTests()
    Object.defineProperty(window, 'location', { value: { ...originalLocation, reload }, writable: true })
  })
  afterEach(() => {
    vi.useRealTimers()
    Object.defineProperty(window, 'location', { value: originalLocation, writable: true })
    document.body.innerHTML = ''
  })

  it('first paint, untouched: reloads itself and says so, no buttons', () => {
    mount()
    act(() => swOpts.current?.onNeedRefresh?.())
    expect(screen.getByText('Updating to the newest version…')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Reload' })).toBeNull()
    expect(updateSW).toHaveBeenCalledTimes(1)
    act(() => {
      vi.advanceTimersByTime(4000)
    })
    expect(reload).toHaveBeenCalled()
    // The loop guard's stamp lands with the reload itself.
    expect(sessionStorage.getItem(AUTO_RELOAD_KEY)).not.toBeNull()
  })

  it('after a touch, first paint is over: the pill shows and nothing reloads', () => {
    mount()
    fireEvent.pointerDown(window)
    act(() => swOpts.current?.onNeedRefresh?.())
    expect(screen.getByText('A new version is ready.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Reload' })).toBeTruthy()
    expect(updateSW).not.toHaveBeenCalled()
  })

  it('sits at the bottom of the screen, and moves to the top while a phone sheet is open (v2.8507)', () => {
    resetPhoneSheetOpenForTests()
    mount()
    fireEvent.pointerDown(window)
    act(() => swOpts.current?.onNeedRefresh?.())
    const pill = screen.getByRole('status')
    expect(pill.getAttribute('data-update-pill')).toBe('bottom')
    expect(pill.style.bottom).toBe(UPDATE_PILL_BOTTOM)
    expect(pill.style.top).toBe('')
    // A sheet opens: its last press is at the bottom of the screen, so the pill leaves it.
    let close = () => {}
    act(() => {
      close = markPhoneSheetOpen()
    })
    expect(pill.getAttribute('data-update-pill')).toBe('top')
    expect(pill.style.top).toBe(UPDATE_PILL_TOP)
    expect(pill.style.bottom).toBe('')
    // Both presses still answer from up there.
    expect(screen.getByRole('button', { name: 'Reload' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Dismiss update notice until the next deploy' })).toBeTruthy()
    act(() => close())
    expect(pill.getAttribute('data-update-pill')).toBe('bottom')
    expect(pill.style.bottom).toBe(UPDATE_PILL_BOTTOM)
    expect(pill.style.top).toBe('')
  })

  it('a route change with nothing open reloads; with a dialog open it only shows the pill', () => {
    mount()
    fireEvent.pointerDown(window)
    act(() => swOpts.current?.onNeedRefresh?.())
    // A dialog is open: navigating must not reload.
    const dialog = document.createElement('div')
    dialog.setAttribute('role', 'dialog')
    document.body.appendChild(dialog)
    fireEvent.click(screen.getByText('go'))
    expect(updateSW).not.toHaveBeenCalled()
    expect(screen.getByText('A new version is ready.')).toBeTruthy()
  })

  it('a route change with nothing open reloads', () => {
    mount()
    fireEvent.pointerDown(window)
    act(() => swOpts.current?.onNeedRefresh?.())
    expect(updateSW).not.toHaveBeenCalled()
    fireEvent.click(screen.getByText('go'))
    expect(updateSW).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Updating to the newest version…')).toBeTruthy()
  })

  it('v2.4214: switching tabs on the same page is a move — it reloads', () => {
    mount('/people?tab=hours')
    fireEvent.pointerDown(window)
    act(() => swOpts.current?.onNeedRefresh?.())
    expect(updateSW).not.toHaveBeenCalled()
    fireEvent.click(screen.getByText('tab'))
    expect(updateSW).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Updating to the newest version…')).toBeTruthy()
  })

  it('v2.4214: a query change that is not a tab (a lens) stays put — the pill only', () => {
    mount('/people?tab=hours')
    fireEvent.pointerDown(window)
    act(() => swOpts.current?.onNeedRefresh?.())
    fireEvent.click(screen.getByText('lens'))
    expect(updateSW).not.toHaveBeenCalled()
    expect(screen.getByText('A new version is ready.')).toBeTruthy()
  })

  it('"Not now" holds for ten minutes even across route changes', () => {
    mount()
    fireEvent.pointerDown(window)
    act(() => swOpts.current?.onNeedRefresh?.())
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss update notice until the next deploy' }))
    fireEvent.click(screen.getByText('go'))
    expect(updateSW).not.toHaveBeenCalled()
    expect(screen.queryByText('A new version is ready.')).toBeNull()
  })

  it('v2.3741: a held unsaved form or a write in flight blocks the route-change reload', async () => {
    mount()
    fireEvent.pointerDown(window)
    act(() => swOpts.current?.onNeedRefresh?.())
    const release = holdUnsavedWork('Legal firm settings')
    fireEvent.click(screen.getByText('go'))
    expect(updateSW).not.toHaveBeenCalled()
    release()
    let finish: (r: Response) => void = () => undefined
    const counting = wrapFetchCountingWrites(() => new Promise<Response>((r) => (finish = r)))
    const pending = counting('https://x/rpc/save', { method: 'POST' })
    fireEvent.click(screen.getByText('go'))
    expect(updateSW).not.toHaveBeenCalled()
    finish(new Response('{}'))
    await pending
  })

  it('v2.3741: a tab hidden five minutes reloads when it comes back; hidden one minute does not', () => {
    mount()
    fireEvent.pointerDown(window)
    act(() => swOpts.current?.onNeedRefresh?.())
    const setVisibility = (v: 'hidden' | 'visible') => {
      Object.defineProperty(document, 'visibilityState', { value: v, configurable: true })
      document.dispatchEvent(new Event('visibilitychange'))
    }
    act(() => setVisibility('hidden'))
    act(() => {
      vi.advanceTimersByTime(60_000)
    })
    act(() => setVisibility('visible'))
    expect(updateSW).not.toHaveBeenCalled()
    act(() => setVisibility('hidden'))
    act(() => {
      vi.advanceTimersByTime(6 * 60_000)
    })
    // The hidden timer fired at 5 min + 1 s while still hidden.
    expect(updateSW).toHaveBeenCalledTimes(1)
    act(() => setVisibility('visible'))
    expect(updateSW).toHaveBeenCalledTimes(1)
  })

  it('v2.3741: a visible tab untouched for half an hour reloads on the minute check', () => {
    mount()
    fireEvent.pointerDown(window)
    act(() => swOpts.current?.onNeedRefresh?.())
    act(() => {
      vi.advanceTimersByTime(29 * 60_000)
    })
    expect(updateSW).not.toHaveBeenCalled()
    act(() => {
      vi.advanceTimersByTime(2 * 60_000)
    })
    expect(updateSW).toHaveBeenCalledTimes(1)
  })

  describe('v2.8499: words someone typed hold the update reload', () => {
    const setVisibility = (v: 'hidden' | 'visible') => {
      Object.defineProperty(document, 'visibilityState', { value: v, configurable: true })
      document.dispatchEvent(new Event('visibilitychange'))
    }
    /** A message box on the page with words in it and the cursor somewhere else. */
    const leaveAMessage = (words = 'We can start Monday. Call me first.') => {
      const box = document.createElement('textarea')
      box.setAttribute('aria-label', 'Message to the customer')
      box.value = words
      document.body.appendChild(box)
      return box
    }
    afterEach(() => setVisibility('visible'))

    it('a message typed and left: an hour hidden reloads nothing, and the words are still there', () => {
      mount()
      fireEvent.pointerDown(window)
      act(() => swOpts.current?.onNeedRefresh?.())
      const box = leaveAMessage()
      expect(document.activeElement).not.toBe(box)
      act(() => setVisibility('hidden'))
      act(() => {
        vi.advanceTimersByTime(60 * 60_000)
      })
      act(() => setVisibility('visible'))
      expect(updateSW).not.toHaveBeenCalled()
      expect(reload).not.toHaveBeenCalled()
      expect(box.value).toBe('We can start Monday. Call me first.')
      // The pill is there for the person's own press.
      expect(screen.getByRole('button', { name: 'Reload' })).toBeTruthy()
    })

    it('a visible tab untouched for a day reloads nothing over the words, and reloads once they are cleared', () => {
      mount()
      fireEvent.pointerDown(window)
      act(() => swOpts.current?.onNeedRefresh?.())
      const box = leaveAMessage()
      act(() => {
        vi.advanceTimersByTime(24 * 60 * 60_000)
      })
      expect(updateSW).not.toHaveBeenCalled()
      // Sent: the box empties. The next minute check finds the tab idle and reloads.
      box.value = ''
      act(() => {
        vi.advanceTimersByTime(61_000)
      })
      expect(updateSW).toHaveBeenCalledTimes(1)
    })

    it('a move to another page with the words still on it reloads nothing', () => {
      mount()
      fireEvent.pointerDown(window)
      act(() => swOpts.current?.onNeedRefresh?.())
      const box = leaveAMessage()
      fireEvent.click(screen.getByText('go'))
      expect(updateSW).not.toHaveBeenCalled()
      // The box left with its page: the next move is a quiet moment again.
      box.remove()
      fireEvent.click(screen.getByText('tab'))
      expect(updateSW).toHaveBeenCalledTimes(1)
    })

    it('a one-line field holds once someone typed into it; a search box and a field the app filled do not', () => {
      mount()
      fireEvent.pointerDown(window)
      act(() => swOpts.current?.onNeedRefresh?.())
      const search = document.createElement('input')
      search.type = 'search'
      search.value = 'smith'
      const filled = document.createElement('input')
      filled.value = '1200.00'
      const subject = document.createElement('input')
      subject.value = 'Your estimate'
      document.body.append(search, filled, subject)
      noteTypedInto(search)
      noteTypedInto(subject)
      fireEvent.click(screen.getByText('go'))
      expect(updateSW).not.toHaveBeenCalled()
      subject.value = ''
      fireEvent.click(screen.getByText('tab'))
      expect(updateSW).toHaveBeenCalledTimes(1)
    })

    it('a draft the app brings back after the decision stands the reload down: the pill, no reload, no stamp', () => {
      mount()
      act(() => swOpts.current?.onNeedRefresh?.())
      expect(screen.getByText('Updating to the newest version…')).toBeTruthy()
      // Nothing is pressed: the draft lands by itself.
      const box = leaveAMessage('Draft: the stack is roughed in.')
      act(() => {
        workerTakesOver()
        vi.advanceTimersByTime(10 * 60_000)
      })
      expect(reload).not.toHaveBeenCalled()
      expect(sessionStorage.getItem(AUTO_RELOAD_KEY)).toBeNull()
      expect(screen.getByText('A new version is ready.')).toBeTruthy()
      expect(box.value).toBe('Draft: the stack is roughed in.')
    })

    describe('the pill’s own Reload over typed words warns first, and shows each place', () => {
      /** jsdom lays nothing out: each place is given its height down the page, and the page a scroll. */
      let scrolled = 0
      const place = (el: HTMLElement, top: number) => {
        el.getBoundingClientRect = () => ({ top: top - scrolled, bottom: top - scrolled + 60, left: 10, right: 310, width: 300, height: 60, x: 10, y: top - scrolled, toJSON: () => ({}) })
        el.scrollIntoView = () => {
          scrolled = Math.max(0, top - window.innerHeight / 2)
        }
      }
      const ringed = (el: Element) => el.hasAttribute(TYPED_SHOWN_ATTR)
      const pass = (ms: number) =>
        act(async () => {
          await vi.advanceTimersByTimeAsync(ms)
        })
      beforeEach(() => {
        scrolled = 0
      })
      const pillWaiting = () => {
        mount()
        fireEvent.pointerDown(window)
        act(() => swOpts.current?.onNeedRefresh?.())
      }

      it('Reload reloads nothing: the place is ringed, the pill says what goes, and Reload anyway is dead until it was shown', async () => {
        pillWaiting()
        const note = leaveAMessage()
        place(note, 200)
        fireEvent.click(screen.getByRole('button', { name: 'Reload' }))
        expect(updateSW).not.toHaveBeenCalled()
        expect(screen.getByText('Reloading clears what you typed.')).toBeTruthy()
        expect(screen.queryByText('A new version is ready.')).toBeNull()
        const press = screen.getByRole('button', { name: 'Reload anyway' })
        expect(press.getAttribute('aria-disabled')).toBe('true')
        expect(ringed(note)).toBe(true)
        // The double press: a second press lands on the same spot at once, and does nothing.
        fireEvent.click(press)
        fireEvent.click(press)
        expect(updateSW).not.toHaveBeenCalled()
        await pass(TYPED_TOUR_SHOWN_MS)
        expect(ringed(note)).toBe(false)
        expect(screen.getByRole('button', { name: 'Reload anyway' }).getAttribute('aria-disabled')).toBeNull()
        expect(reload).not.toHaveBeenCalled()
        expect(note.value).toBe('We can start Monday. Call me first.')
        // Not now is there the whole time, and both presses are a thumb tall.
        const notNow = screen.getByRole('button', { name: /Dismiss update notice/ })
        expect(notNow.style.minHeight).toBe(`${UPDATE_PILL_WARNED_PRESS_MIN_HEIGHT}px`)
        expect(screen.getByRole('button', { name: 'Reload anyway' }).style.minHeight).toBe(`${UPDATE_PILL_WARNED_PRESS_MIN_HEIGHT}px`)
      })

      it('Reload anyway, once the place was shown, reloads: the person saw what goes and said yes', async () => {
        pillWaiting()
        place(leaveAMessage(), 200)
        fireEvent.click(screen.getByRole('button', { name: 'Reload' }))
        await pass(TYPED_TOUR_SHOWN_MS)
        fireEvent.click(screen.getByRole('button', { name: 'Reload anyway' }))
        expect(updateSW).toHaveBeenCalledTimes(1)
        act(() => {
          workerTakesOver()
        })
        expect(reload).toHaveBeenCalledTimes(1)
        // A press is not an automatic reload: the loop guard keeps no stamp of it.
        expect(sessionStorage.getItem(AUTO_RELOAD_KEY)).toBeNull()
      })

      it('two places a screen apart: the page goes to each in turn, and the confirm waits for the last', async () => {
        pillWaiting()
        const note = leaveAMessage('Call before you come.')
        const message = leaveAMessage('We can start Monday.')
        place(note, 200)
        place(message, 4000)
        fireEvent.click(screen.getByRole('button', { name: 'Reload' }))
        expect([ringed(note), ringed(message)]).toEqual([true, false])
        await pass(TYPED_TOUR_SHOWN_MS)
        // The page moved to the second place and the ring went with it.
        expect([ringed(note), ringed(message)]).toEqual([false, true])
        expect(scrolled).toBeGreaterThan(3000)
        expect(screen.getByRole('button', { name: 'Reload anyway' }).getAttribute('aria-disabled')).toBe('true')
        await pass(TYPED_TOUR_SETTLE_MS + TYPED_TOUR_SHOWN_MS)
        expect([ringed(note), ringed(message)]).toEqual([false, false])
        expect(screen.getByRole('button', { name: 'Reload anyway' }).getAttribute('aria-disabled')).toBeNull()
        expect(updateSW).not.toHaveBeenCalled()
      })

      it('a message box at the foot of the page: the pill goes to the top while it is shown, and back when the warning ends', async () => {
        pillWaiting()
        const middle = leaveAMessage('Call before you come.')
        const foot = leaveAMessage('We can start Monday.')
        place(middle, 300)
        // The last thing on the page: brought as far as the page goes, it sits at the foot of the screen.
        foot.getBoundingClientRect = () => ({ top: window.innerHeight - 80, bottom: window.innerHeight - 20, left: 10, right: 310, width: 300, height: 60, x: 10, y: window.innerHeight - 80, toJSON: () => ({}) })
        const pill = () => screen.getByRole('status')
        fireEvent.click(screen.getByRole('button', { name: 'Reload' }))
        // Both are on the screen, so both are ringed in one stop, and one is under the pill's foot.
        expect([ringed(middle), ringed(foot)]).toEqual([true, true])
        expect(pill().style.top).toBe(UPDATE_PILL_WARNED_TOP)
        expect(pill().style.bottom).toBe('auto')
        await pass(TYPED_TOUR_SHOWN_MS)
        // Shown: the page has not moved, so the pill stays clear of the words.
        expect(pill().style.top).toBe(UPDATE_PILL_WARNED_TOP)
        fireEvent.pointerDown(foot)
        expect(pill().style.bottom).toBe('1rem')
        expect(pill().style.top).toBe('')
      })

      it('Not now keeps the words: the pill goes, the ring lifts, and nothing reloads', async () => {
        pillWaiting()
        const note = leaveAMessage()
        place(note, 200)
        fireEvent.click(screen.getByRole('button', { name: 'Reload' }))
        expect(ringed(note)).toBe(true)
        // A double press on Reload: the warned pill is laid out afresh and its second half can land here. Ignored.
        fireEvent.click(screen.getByRole('button', { name: /Dismiss update notice/ }))
        expect(screen.getByText('Reloading clears what you typed.')).toBeTruthy()
        expect(ringed(note)).toBe(true)
        await pass(UPDATE_PILL_DOUBLE_PRESS_MS)
        fireEvent.click(screen.getByRole('button', { name: /Dismiss update notice/ }))
        expect(ringed(note)).toBe(false)
        expect(screen.queryByRole('status')).toBeNull()
        await pass(60_000)
        expect(updateSW).not.toHaveBeenCalled()
        expect(note.value).toBe('We can start Monday. Call me first.')
      })

      it('a touch off the pill ends the warning: the person went back to their words, and the next Reload looks again', async () => {
        pillWaiting()
        const note = leaveAMessage()
        place(note, 200)
        fireEvent.click(screen.getByRole('button', { name: 'Reload' }))
        // Mid-walk: the ring lifts with the touch.
        fireEvent.pointerDown(note)
        expect(ringed(note)).toBe(false)
        expect(screen.getByText('A new version is ready.')).toBeTruthy()
        expect(screen.getByRole('button', { name: 'Reload' }).getAttribute('aria-disabled')).toBeNull()
        await pass(10_000)
        expect(screen.getByText('A new version is ready.')).toBeTruthy()
        // Still words: Reload warns again. Sent: Reload reloads.
        fireEvent.click(screen.getByRole('button', { name: 'Reload' }))
        expect(screen.getByRole('button', { name: 'Reload anyway' })).toBeTruthy()
        await pass(TYPED_TOUR_SHOWN_MS)
        fireEvent.pointerDown(note)
        note.value = ''
        fireEvent.click(screen.getByRole('button', { name: 'Reload' }))
        expect(updateSW).toHaveBeenCalledTimes(1)
      })

      it('a touch on the pill itself does not end the warning', async () => {
        pillWaiting()
        place(leaveAMessage(), 200)
        fireEvent.click(screen.getByRole('button', { name: 'Reload' }))
        await pass(TYPED_TOUR_SHOWN_MS)
        fireEvent.pointerDown(screen.getByRole('button', { name: 'Reload anyway' }))
        expect(screen.getByRole('button', { name: 'Reload anyway' })).toBeTruthy()
      })

      it('words in a place that cannot be shown: it still warns, and the confirm still waits a second', async () => {
        pillWaiting()
        // No box at all, as a field in a folded section has none.
        leaveAMessage()
        fireEvent.click(screen.getByRole('button', { name: 'Reload' }))
        expect(screen.getByText('Reloading clears what you typed.')).toBeTruthy()
        expect(screen.getByRole('button', { name: 'Reload anyway' }).getAttribute('aria-disabled')).toBe('true')
        await pass(TYPED_TOUR_SHOWN_MS)
        expect(screen.getByRole('button', { name: 'Reload anyway' }).getAttribute('aria-disabled')).toBeNull()
        expect(updateSW).not.toHaveBeenCalled()
      })

      it('the pill leaves the page mid-walk: no ring is left behind', () => {
        pillWaiting()
        const note = leaveAMessage()
        place(note, 200)
        const view = screen.getByRole('button', { name: 'Reload' })
        fireEvent.click(view)
        expect(ringed(note)).toBe(true)
        cleanup()
        expect(ringed(note)).toBe(false)
      })
    })
  })

  it('loop guard: a tab that auto-reloaded a moment ago shows the pill instead', () => {
    sessionStorage.setItem(AUTO_RELOAD_KEY, String(Date.now() - 5_000))
    mount()
    act(() => swOpts.current?.onNeedRefresh?.())
    expect(screen.getByText('A new version is ready.')).toBeTruthy()
    expect(updateSW).not.toHaveBeenCalled()
  })
  describe('the second look, when the reload would fire', () => {
    /** A write through the counted fetch that stays in flight until `finish` is called. */
    const startWrite = () => {
      let finish: (r: Response) => void = () => undefined
      const counting = wrapFetchCountingWrites(() => new Promise<Response>((r) => (finish = r)))
      const pending = counting('https://x/functions/v1/keep', { method: 'POST' })
      return {
        finish: async () => {
          finish(new Response('{}'))
          await pending
        },
      }
    }

    it('still quiet when the new worker takes over: it reloads then, not four seconds on', () => {
      mount()
      act(() => swOpts.current?.onNeedRefresh?.())
      expect(reload).not.toHaveBeenCalled()
      act(() => {
        vi.advanceTimersByTime(300)
        workerTakesOver()
      })
      expect(reload).toHaveBeenCalledTimes(1)
    })

    it('a write that begins after the decision is waited out, then the reload lands', async () => {
      mount()
      act(() => swOpts.current?.onNeedRefresh?.())
      expect(screen.getByText('Updating to the newest version…')).toBeTruthy()
      const write = startWrite()
      act(() => {
        workerTakesOver()
      })
      // The worker took over mid-write, and the old four seconds ran out: neither reloads.
      act(() => {
        vi.advanceTimersByTime(6_000)
      })
      expect(reload).not.toHaveBeenCalled()
      expect(sessionStorage.getItem(AUTO_RELOAD_KEY)).toBeNull()
      await act(async () => {
        await write.finish()
      })
      // Back, but the next write of a chain may follow: not yet.
      expect(reload).not.toHaveBeenCalled()
      act(() => {
        vi.advanceTimersByTime(1_500)
      })
      expect(reload).toHaveBeenCalledTimes(1)
    })

    it('a second write right behind the first holds it too', async () => {
      mount()
      act(() => swOpts.current?.onNeedRefresh?.())
      const first = startWrite()
      act(() => {
        workerTakesOver()
      })
      await act(async () => {
        await first.finish()
      })
      act(() => {
        vi.advanceTimersByTime(1_000)
      })
      const second = startWrite()
      act(() => {
        vi.advanceTimersByTime(5_000)
      })
      expect(reload).not.toHaveBeenCalled()
      await act(async () => {
        await second.finish()
      })
      act(() => {
        vi.advanceTimersByTime(1_500)
      })
      expect(reload).toHaveBeenCalledTimes(1)
    })

    it('a write that never comes back hands the update to the pill after half a minute', () => {
      mount()
      act(() => swOpts.current?.onNeedRefresh?.())
      startWrite()
      act(() => {
        workerTakesOver()
        vi.advanceTimersByTime(30_000)
      })
      expect(reload).not.toHaveBeenCalled()
      expect(screen.getByText('A new version is ready.')).toBeTruthy()
      expect(screen.getByRole('button', { name: 'Reload' })).toBeTruthy()
    })

    it('a touch after the decision stands a first-paint reload down: the pill, no reload, no stamp', () => {
      mount()
      act(() => swOpts.current?.onNeedRefresh?.())
      expect(screen.getByText('Updating to the newest version…')).toBeTruthy()
      fireEvent.pointerDown(window)
      expect(screen.getByText('A new version is ready.')).toBeTruthy()
      act(() => {
        workerTakesOver()
        vi.advanceTimersByTime(10_000)
      })
      expect(reload).not.toHaveBeenCalled()
      expect(sessionStorage.getItem(AUTO_RELOAD_KEY)).toBeNull()
    })

    it('a dialog that opened in the gap stands it down', () => {
      mount()
      act(() => swOpts.current?.onNeedRefresh?.())
      const dialog = document.createElement('div')
      dialog.setAttribute('role', 'dialog')
      document.body.appendChild(dialog)
      act(() => {
        workerTakesOver()
      })
      expect(reload).not.toHaveBeenCalled()
      expect(screen.getByText('A new version is ready.')).toBeTruthy()
    })

    it('stood down under the new worker: the next quiet moment reloads at once', () => {
      mount()
      act(() => swOpts.current?.onNeedRefresh?.())
      fireEvent.pointerDown(window)
      act(() => {
        workerTakesOver()
      })
      expect(reload).not.toHaveBeenCalled()
      fireEvent.click(screen.getByText('go'))
      expect(updateSW).toHaveBeenCalledTimes(2)
      expect(reload).toHaveBeenCalledTimes(1)
      expect(sessionStorage.getItem(AUTO_RELOAD_KEY)).not.toBeNull()
    })

    it('stood down under the new worker: the pill’s Reload does not wait four seconds', () => {
      mount()
      act(() => swOpts.current?.onNeedRefresh?.())
      fireEvent.pointerDown(window)
      act(() => {
        workerTakesOver()
      })
      fireEvent.click(screen.getByRole('button', { name: 'Reload' }))
      expect(reload).toHaveBeenCalledTimes(1)
    })

    it('the pill’s own Reload goes through a write in flight: the person asked', () => {
      mount()
      fireEvent.pointerDown(window)
      act(() => swOpts.current?.onNeedRefresh?.())
      startWrite()
      fireEvent.click(screen.getByRole('button', { name: 'Reload' }))
      expect(reload).not.toHaveBeenCalled()
      act(() => {
        workerTakesOver()
      })
      expect(reload).toHaveBeenCalledTimes(1)
      // A press is not an automatic reload: the loop guard keeps no stamp of it.
      expect(sessionStorage.getItem(AUTO_RELOAD_KEY)).toBeNull()
    })

    it('another tab takes the update: this one does not reload under the person, and workbox never hears it', () => {
      mount()
      fireEvent.pointerDown(window)
      act(() => swOpts.current?.onNeedRefresh?.())
      // workbox-window listens after this component, as it does once registerSW has run.
      swContainer.addEventListener('controllerchange', workboxReload)
      act(() => {
        workerTakesOver()
        vi.advanceTimersByTime(10_000)
      })
      swContainer.removeEventListener('controllerchange', workboxReload)
      expect(workboxReload).not.toHaveBeenCalled()
      expect(reload).not.toHaveBeenCalled()
      expect(screen.getByText('A new version is ready.')).toBeTruthy()
      // The next move finds the worker already switched and reloads with no gap.
      fireEvent.click(screen.getByText('go'))
      expect(reload).toHaveBeenCalledTimes(1)
    })

    it('with no update known here a worker change is left to workbox (a first install claiming the page)', () => {
      mount()
      swContainer.addEventListener('controllerchange', workboxReload)
      act(() => {
        workerTakesOver()
      })
      swContainer.removeEventListener('controllerchange', workboxReload)
      expect(workboxReload).toHaveBeenCalledTimes(1)
      expect(reload).not.toHaveBeenCalled()
    })
  })
})
