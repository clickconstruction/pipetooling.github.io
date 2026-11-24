// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { CHUNK_RECOVERY_KEY, forgetChunkRecoveryReload, startChunkRecoveryReload } from '../lib/chunkLoadRecovery'
import { lazyWindow } from '../lib/lazyWindow'
import {
  PUBLIC_PAGE_CHECKING_SHOWN_MS,
  PUBLIC_PAGE_CHECKING_WORDS,
  PUBLIC_PAGE_LOST_WORDS,
  PUBLIC_PAGE_OFFLINE_WORDS,
  PUBLIC_PAGE_PROBE_TIMEOUT_MS,
  PUBLIC_PAGE_SLOW_AFTER_MS,
  PUBLIC_PAGE_SLOW_WORDS,
  PUBLIC_PAGE_STILL_OFFLINE_WORDS,
} from '../lib/publicPageLoad'
import { __resetUnsavedWorkForTests } from '../lib/unsavedWork'
import { RouteChunkBoundary } from './RouteChunkBoundary'
import { PublicPage, PublicPageLoading } from './PublicPage'

const hardReloadFromRoot = vi.hoisted(() => vi.fn())
vi.mock('../lib/hardReload', () => ({ hardReloadFromRoot }))

const lostChunk = () => new TypeError('Failed to fetch dynamically imported module: https://x/assets/PayLink-abc123.js')
/** What React reports when main.tsx's preload handler cancelled Vite's throw: the lazy page resolved to nothing. */
const emptyLazy = () => new TypeError("Cannot read properties of undefined (reading 'default')")

function Throws({ error }: { error: Error }): never {
  throw error
}

function setOnline(online: boolean) {
  Object.defineProperty(window.navigator, 'onLine', { configurable: true, get: () => online })
}

const page = (children: React.ReactNode, tone?: 'landing' | 'paper' | 'plain') => (
  <MemoryRouter initialEntries={['/pay/sample']}>
    <RouteChunkBoundary>
      <PublicPage tone={tone}>{children}</PublicPage>
    </RouteChunkBoundary>
  </MemoryRouter>
)

describe('PublicPage', () => {
  beforeEach(() => {
    forgetChunkRecoveryReload()
    __resetUnsavedWorkForTests()
    sessionStorage.clear()
    hardReloadFromRoot.mockClear()
    setOnline(true)
    // React logs every caught render error, and the boundary logs what it caught.
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    setOnline(true)
  })

  it('draws the loading look on the page’s own paper, then the page once its code lands', async () => {
    let land: (m: { default: () => JSX.Element }) => void = () => undefined
    const Pay = lazyWindow(() => new Promise<{ default: () => JSX.Element }>((r) => (land = r)))
    const { container } = render(page(<Pay />))
    // The paper first, bare: the word waits a quarter second.
    expect(screen.queryByText('Loading…')).toBeNull()
    expect(await screen.findByText('Loading…')).toBeTruthy()
    const frame = container.querySelector('[data-public-page-frame="paper"]') as HTMLElement
    expect(frame.getAttribute('data-theme')).toBe('light')
    expect(container.querySelector('[data-public-page="loading"]')).not.toBeNull()
    await act(async () => {
      land({ default: () => <p>Pay your bill</p> })
    })
    expect(screen.getByText('Pay your bill')).toBeTruthy()
    expect(screen.queryByText('Loading…')).toBeNull()
  })

  it('a page whose code is already here draws at once, with no loading look', async () => {
    const Pay = lazyWindow(async () => ({ default: () => <p>Pay your bill</p> }))
    await Pay.preload()
    render(page(<Pay />))
    expect(screen.getByText('Pay your bill')).toBeTruthy()
    expect(screen.queryByText('Loading…')).toBeNull()
  })

  it('on the landing the wait is the estimate’s own loading look: the photo, the title and the box', () => {
    const Estimate = lazyWindow(() => new Promise<{ default: () => JSX.Element }>(() => undefined))
    const { container } = render(page(<Estimate />, 'landing'))
    expect(container.querySelector('.auth-public-landing[data-theme="light"]')).not.toBeNull()
    const box = container.querySelector('.auth-public-landing__signin-box') as HTMLElement
    expect(box.textContent).toBe('Loading…')
  })

  it('a wait past ten seconds says so and offers Try again, which reloads', () => {
    vi.useFakeTimers()
    const reload = vi.fn()
    const original = window.location
    Object.defineProperty(window, 'location', { configurable: true, value: { ...original, reload } })
    try {
      render(
        <MemoryRouter>
          <PublicPageLoading />
        </MemoryRouter>,
      )
      act(() => {
        vi.advanceTimersByTime(PUBLIC_PAGE_SLOW_AFTER_MS - 1)
      })
      expect(screen.queryByText(PUBLIC_PAGE_SLOW_WORDS)).toBeNull()
      act(() => {
        vi.advanceTimersByTime(1)
      })
      expect(screen.getByText(PUBLIC_PAGE_SLOW_WORDS)).toBeTruthy()
      fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
      expect(reload).toHaveBeenCalledTimes(1)
    } finally {
      Object.defineProperty(window, 'location', { configurable: true, value: original })
      vi.useRealTimers()
    }
  })

  it('a lost chunk gets the one guarded reload, as every lazy page does, and keeps the loading look meanwhile', () => {
    const { container } = render(page(<Throws error={lostChunk()} />))
    expect(hardReloadFromRoot).toHaveBeenCalledTimes(1)
    expect(sessionStorage.getItem(CHUNK_RECOVERY_KEY)).not.toBeNull()
    expect(container.querySelector('[data-public-page="loading"]')).not.toBeNull()
    expect(screen.queryByText('Updating app…')).toBeNull()
  })

  it('keeps the loading look for what a cancelled preload leaves behind, while that reload is on its way', () => {
    expect(startChunkRecoveryReload(Date.now(), sessionStorage, hardReloadFromRoot)).toBe(true)
    const { container } = render(page(<Throws error={emptyLazy()} />))
    expect(container.querySelector('[data-public-page="loading"]')).not.toBeNull()
    expect(hardReloadFromRoot).toHaveBeenCalledTimes(1)
  })

  it('when the reload is spent it says the page did not load, and Try again reloads', () => {
    sessionStorage.setItem(CHUNK_RECOVERY_KEY, String(Date.now()))
    const { container } = render(page(<Throws error={lostChunk()} />))
    expect(screen.getByText(PUBLIC_PAGE_LOST_WORDS)).toBeTruthy()
    expect(container.querySelector('[data-public-page-frame="paper"]')).not.toBeNull()
    // A customer's page: no staff words and no repair link.
    expect(screen.queryByText(/app may have just been updated/)).toBeNull()
    expect(screen.queryByRole('link', { name: /Fix/ })).toBeNull()
    expect(hardReloadFromRoot).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(hardReloadFromRoot).toHaveBeenCalledTimes(1)
  })

  it('a page whose file is gone is asked for once, then says so: never a wait without end', async () => {
    sessionStorage.setItem(CHUNK_RECOVERY_KEY, String(Date.now()))
    const load = vi.fn(async (): Promise<{ default: () => JSX.Element }> => {
      throw lostChunk()
    })
    const Pay = lazyWindow(load)
    render(page(<Pay />))
    expect(await screen.findByText(PUBLIC_PAGE_LOST_WORDS)).toBeTruthy()
    expect(load).toHaveBeenCalledTimes(1)
  })

  it('offline it never reloads by itself: it says so, asks nothing until a press, and loads itself when the signal is back', async () => {
    setOnline(false)
    vi.useFakeTimers()
    try {
      const fetcher = vi.fn(async () => {
        throw new TypeError('Failed to fetch')
      })
      vi.stubGlobal('fetch', fetcher)
      const { container } = render(page(<Throws error={lostChunk()} />))
      expect(screen.getByText(PUBLIC_PAGE_OFFLINE_WORDS)).toBeTruthy()
      expect(container.querySelector('[data-public-page="offline"]')).not.toBeNull()
      expect(hardReloadFromRoot).not.toHaveBeenCalled()
      expect(sessionStorage.getItem(CHUNK_RECOVERY_KEY)).toBeNull()
      // Nothing is asked until someone presses.
      expect(fetcher).not.toHaveBeenCalled()
      fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
      await act(async () => {
        await vi.advanceTimersByTimeAsync(PUBLIC_PAGE_CHECKING_SHOWN_MS)
      })
      expect(screen.getByText(PUBLIC_PAGE_STILL_OFFLINE_WORDS)).toBeTruthy()
      expect(fetcher).toHaveBeenCalledTimes(1)
      expect(hardReloadFromRoot).not.toHaveBeenCalled()
      setOnline(true)
      act(() => {
        window.dispatchEvent(new Event('online'))
      })
      expect(hardReloadFromRoot).toHaveBeenCalledTimes(1)
      expect(container.querySelector('[data-public-page="loading"]')).not.toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  describe('Try again on a phone that says it is offline', () => {
    const icon = () => ({ ok: true, headers: { get: () => 'image/svg+xml' } })
    const noNetwork = () =>
      vi.fn(async () => {
        throw new TypeError('Failed to fetch')
      })
    /** Lets what is pending settle and the clock move, with the page drawing what follows. */
    const pass = (ms: number) =>
      act(async () => {
        await vi.advanceTimersByTimeAsync(ms)
      })
    const tryAgain = () => screen.getByRole('button', { name: 'Try again' }) as HTMLButtonElement

    beforeEach(() => {
      vi.useFakeTimers()
    })
    afterEach(() => {
      vi.useRealTimers()
    })

    it('the phone was wrong: the first press asks the network once, hears back and reloads at once', async () => {
      setOnline(false)
      let answer: (r: unknown) => void = () => undefined
      const fetcher = vi.fn(() => new Promise((r) => (answer = r)))
      vi.stubGlobal('fetch', fetcher)
      const { container } = render(page(<Throws error={lostChunk()} />))
      expect(screen.getByText(PUBLIC_PAGE_OFFLINE_WORDS)).toBeTruthy()

      // The first press asks. Until the answer the page says so and the press is dead.
      fireEvent.click(tryAgain())
      expect(screen.getByText(PUBLIC_PAGE_CHECKING_WORDS)).toBeTruthy()
      expect(screen.queryByText(PUBLIC_PAGE_OFFLINE_WORDS)).toBeNull()
      expect(container.querySelector('[data-public-page="checking"]')).not.toBeNull()
      expect(tryAgain().disabled).toBe(true)
      expect(fetcher).toHaveBeenCalledTimes(1)
      const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit]
      expect(url).toMatch(/^\/favicon\.svg\?signal=\d+$/)
      expect(init.cache).toBe('no-store')
      expect(hardReloadFromRoot).not.toHaveBeenCalled()

      // A second press while the ask is out cannot start a second ask.
      fireEvent.click(tryAgain())
      fireEvent.click(tryAgain())
      expect(fetcher).toHaveBeenCalledTimes(1)
      expect(hardReloadFromRoot).not.toHaveBeenCalled()

      // A yes is never held: the reload starts with the answer, with no time passed.
      await act(async () => {
        answer(icon())
      })
      expect(hardReloadFromRoot).toHaveBeenCalledTimes(1)
      expect(container.querySelector('[data-public-page="loading"]')).not.toBeNull()
    })

    it('the phone was right: the no comes at once, the checking look stays half a second, then the page answers with its press live', async () => {
      setOnline(false)
      const fetcher = noNetwork()
      vi.stubGlobal('fetch', fetcher)
      const { container } = render(page(<Throws error={lostChunk()} />))
      fireEvent.click(tryAgain())
      // The ask has failed already. The look is held, and a press on the held press asks nothing.
      await pass(0)
      expect(fetcher).toHaveBeenCalledTimes(1)
      expect(screen.getByText(PUBLIC_PAGE_CHECKING_WORDS)).toBeTruthy()
      expect(tryAgain().disabled).toBe(true)
      fireEvent.click(tryAgain())
      await pass(PUBLIC_PAGE_CHECKING_SHOWN_MS - 1)
      expect(screen.getByText(PUBLIC_PAGE_CHECKING_WORDS)).toBeTruthy()
      expect(tryAgain().disabled).toBe(true)
      await pass(1)
      expect(screen.getByText(PUBLIC_PAGE_STILL_OFFLINE_WORDS)).toBeTruthy()
      expect(fetcher).toHaveBeenCalledTimes(1)
      expect(hardReloadFromRoot).not.toHaveBeenCalled()
      expect(container.querySelector('[data-public-page="offline"]')).not.toBeNull()
      expect(tryAgain().disabled).toBe(false)

      // Every later press asks again, once each, and each one shows the checking look before it answers:
      // a press never goes from *Still offline…* to *Still offline…* with nothing between.
      for (let press = 0; press < 3; press++) {
        fireEvent.click(tryAgain())
        await pass(0)
        expect(screen.getByText(PUBLIC_PAGE_CHECKING_WORDS)).toBeTruthy()
        expect(screen.queryByText(PUBLIC_PAGE_STILL_OFFLINE_WORDS)).toBeNull()
        await pass(PUBLIC_PAGE_CHECKING_SHOWN_MS)
        expect(screen.getByText(PUBLIC_PAGE_STILL_OFFLINE_WORDS)).toBeTruthy()
      }
      expect(fetcher).toHaveBeenCalledTimes(4)
      expect(hardReloadFromRoot).not.toHaveBeenCalled()
    })

    it('a first press whose ask hangs is given up at five seconds, and is not held any longer than that', async () => {
      setOnline(false)
      const fetcher = vi.fn(
        (_url: string, init: { signal: AbortSignal }) =>
          new Promise((_, reject) => {
            init.signal.addEventListener('abort', () => reject(new DOMException('The operation was aborted.', 'AbortError')))
          }),
      )
      vi.stubGlobal('fetch', fetcher)
      render(page(<Throws error={lostChunk()} />))
      fireEvent.click(tryAgain())
      await pass(PUBLIC_PAGE_PROBE_TIMEOUT_MS - 1)
      expect(screen.getByText(PUBLIC_PAGE_CHECKING_WORDS)).toBeTruthy()
      expect(tryAgain().disabled).toBe(true)
      await pass(1)
      expect(screen.getByText(PUBLIC_PAGE_STILL_OFFLINE_WORDS)).toBeTruthy()
      expect(tryAgain().disabled).toBe(false)
      expect(fetcher).toHaveBeenCalledTimes(1)
      expect(hardReloadFromRoot).not.toHaveBeenCalled()
    })

    it('a sign-in wall that answers every address is not the network: nothing reloads', async () => {
      setOnline(false)
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => ({ ok: true, headers: { get: () => 'text/html; charset=utf-8' } })),
      )
      render(page(<Throws error={lostChunk()} />))
      fireEvent.click(tryAgain())
      await pass(PUBLIC_PAGE_CHECKING_SHOWN_MS)
      expect(screen.getByText(PUBLIC_PAGE_STILL_OFFLINE_WORDS)).toBeTruthy()
      expect(hardReloadFromRoot).not.toHaveBeenCalled()
    })

    it('a phone that comes back online before the press: the press reloads and asks nothing', () => {
      setOnline(false)
      const fetcher = vi.fn()
      vi.stubGlobal('fetch', fetcher)
      render(page(<Throws error={lostChunk()} />))
      // The browser's word changed with no `online` event heard. The press reads the word as it is now.
      setOnline(true)
      fireEvent.click(tryAgain())
      expect(fetcher).not.toHaveBeenCalled()
      expect(hardReloadFromRoot).toHaveBeenCalledTimes(1)
    })

    it('the signal comes back while the checking look is held: the page reloads by itself', async () => {
      setOnline(false)
      vi.stubGlobal('fetch', noNetwork())
      const { container } = render(page(<Throws error={lostChunk()} />))
      fireEvent.click(tryAgain())
      await pass(100)
      expect(screen.getByText(PUBLIC_PAGE_CHECKING_WORDS)).toBeTruthy()
      setOnline(true)
      act(() => {
        window.dispatchEvent(new Event('online'))
      })
      expect(hardReloadFromRoot).toHaveBeenCalledTimes(1)
      await pass(PUBLIC_PAGE_CHECKING_SHOWN_MS)
      expect(container.querySelector('[data-public-page="loading"]')).not.toBeNull()
      expect(hardReloadFromRoot).toHaveBeenCalledTimes(1)
    })

    it('an answer that comes after the page has gone does nothing', async () => {
      setOnline(false)
      let answer: (r: unknown) => void = () => undefined
      vi.stubGlobal(
        'fetch',
        vi.fn(() => new Promise((r) => (answer = r))),
      )
      const view = render(page(<Throws error={lostChunk()} />))
      fireEvent.click(tryAgain())
      view.unmount()
      await act(async () => {
        answer(icon())
      })
      expect(hardReloadFromRoot).not.toHaveBeenCalled()
    })

    it('a page that goes while the checking look is held leaves nothing behind', async () => {
      setOnline(false)
      vi.stubGlobal('fetch', noNetwork())
      const view = render(page(<Throws error={lostChunk()} />))
      fireEvent.click(tryAgain())
      await pass(0)
      expect(vi.getTimerCount()).toBe(1)
      view.unmount()
      expect(vi.getTimerCount()).toBe(0)
      expect(hardReloadFromRoot).not.toHaveBeenCalled()
    })

    it('the press goes dead and live in one step, with no fade between its two looks', () => {
      setOnline(false)
      vi.stubGlobal(
        'fetch',
        vi.fn(() => new Promise(() => undefined)),
      )
      render(page(<Throws error={lostChunk()} />))
      expect(tryAgain().style.transition).toMatch(/^none/)
      fireEvent.click(tryAgain())
      expect(tryAgain().disabled).toBe(true)
      expect(tryAgain().style.transition).toMatch(/^none/)
    })
  })

  it('a browser that blocks storage still gets the reload and the loading look, not an empty page', () => {
    const own = Object.getOwnPropertyDescriptor(window, 'sessionStorage')
    Object.defineProperty(window, 'sessionStorage', {
      configurable: true,
      get: () => {
        throw new DOMException('The operation is insecure.', 'SecurityError')
      },
    })
    try {
      const { container } = render(page(<Throws error={lostChunk()} />))
      expect(hardReloadFromRoot).toHaveBeenCalledTimes(1)
      expect(container.querySelector('[data-public-page="loading"]')).not.toBeNull()
    } finally {
      if (own) Object.defineProperty(window, 'sessionStorage', own)
      else delete (window as { sessionStorage?: Storage }).sessionStorage
    }
  })

  it('an error that is not a lost chunk is the routes’ boundary’s to say', () => {
    render(page(<Throws error={new Error('boom')} />))
    expect(screen.getByText('Something went wrong loading this page.')).toBeTruthy()
    expect(hardReloadFromRoot).not.toHaveBeenCalled()
  })
})
