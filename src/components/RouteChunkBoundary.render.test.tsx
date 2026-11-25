// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { CHUNK_RECOVERY_KEY, CHUNK_RELOAD_LAND_MAX_MS, forgetChunkRecoveryReload, startChunkRecoveryReload } from '../lib/chunkLoadRecovery'
import { ROUTE_RELOAD_CHECKING_WORDS, ROUTE_RELOAD_LAND_MAX_MS, ROUTE_RELOAD_NO_SIGNAL_WORDS, ROUTE_RELOAD_STALLED_WORDS } from '../lib/routeReload'
import { __resetReloadAskForTests } from '../lib/reloadOverWords'
import { __forgetTypedTextForTests } from '../lib/typedText'
import { ReloadOverWordsBar } from './ReloadOverWordsBar'
import { __resetUnsavedWorkForTests, wrapFetchCountingWrites } from '../lib/unsavedWork'
import { RouteChunkBoundary } from './RouteChunkBoundary'

const hardReloadFromRoot = vi.hoisted(() => vi.fn())
vi.mock('../lib/hardReload', () => ({ hardReloadFromRoot }))

const lostChunk = () => new TypeError('Failed to fetch dynamically imported module: https://x/assets/BoxCode-abc123.js')
/** What React reports when main.tsx's preload handler cancelled Vite's throw: the lazy page resolved to nothing. */
const emptyLazy = () => new TypeError("Cannot read properties of undefined (reading 'default')")

function Throws({ error }: { error: Error }): never {
  throw error
}

describe('RouteChunkBoundary', () => {
  beforeEach(() => {
    forgetChunkRecoveryReload()
    __resetUnsavedWorkForTests()
    sessionStorage.clear()
    hardReloadFromRoot.mockClear()
    // React logs every caught render error, and the boundary logs what it caught.
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('draws its page while nothing throws', () => {
    render(
      <RouteChunkBoundary>
        <p>Finding box B365-B514…</p>
      </RouteChunkBoundary>,
    )
    expect(screen.getByText('Finding box B365-B514…')).toBeTruthy()
  })

  it('reloads once for a lost chunk and says the app is updating', () => {
    render(
      <RouteChunkBoundary>
        <Throws error={lostChunk()} />
      </RouteChunkBoundary>,
    )
    expect(screen.getByText('Updating app…')).toBeTruthy()
    expect(hardReloadFromRoot).toHaveBeenCalledTimes(1)
    expect(sessionStorage.getItem(CHUNK_RECOVERY_KEY)).not.toBeNull()
  })

  it('a save still on its way out is let finish: Updating app… draws at once, the reload comes after it', async () => {
    vi.useFakeTimers()
    try {
      let answer: (r: Response) => void = () => undefined
      const counting = wrapFetchCountingWrites(() => new Promise<Response>((r) => (answer = r)))
      const save = counting('https://x/rest/v1/clock_sessions', { method: 'POST' })
      render(
        <RouteChunkBoundary>
          <Throws error={lostChunk()} />
        </RouteChunkBoundary>,
      )
      expect(screen.getByText('Updating app…')).toBeTruthy()
      act(() => {
        vi.advanceTimersByTime(5_000)
      })
      expect(hardReloadFromRoot).not.toHaveBeenCalled()
      await act(async () => {
        answer(new Response('{}'))
        await save
      })
      expect(hardReloadFromRoot).not.toHaveBeenCalled()
      act(() => {
        vi.advanceTimersByTime(1_500)
      })
      expect(hardReloadFromRoot).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('offers Reload, and does not reload again, when a recovery already ran inside the last minute', () => {
    sessionStorage.setItem(CHUNK_RECOVERY_KEY, String(Date.now()))
    render(
      <RouteChunkBoundary>
        <Throws error={lostChunk()} />
      </RouteChunkBoundary>,
    )
    expect(screen.getByText(/This page could not load/)).toBeTruthy()
    expect(hardReloadFromRoot).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Reload' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Fix app' }).getAttribute('href')).toBe('/fix-cache.html')
  })

  /** The fallback, drawn: a lost chunk inside a minute of a recovery reload. */
  const drawFallback = () => {
    sessionStorage.setItem(CHUNK_RECOVERY_KEY, String(Date.now()))
    render(
      <RouteChunkBoundary>
        <Throws error={lostChunk()} />
      </RouteChunkBoundary>,
    )
    return screen.getByRole('button', { name: 'Reload' }) as HTMLButtonElement
  }
  const icon = () => new Response('<svg/>', { headers: { 'content-type': 'image/svg+xml' } })

  it('Reload asks the network first, past every cache, and reloads on its answer', async () => {
    let answer: (r: Response) => void = () => undefined
    const fetcher = vi.fn(() => new Promise<Response>((r) => (answer = r)))
    vi.stubGlobal('fetch', fetcher)
    const press = drawFallback()
    expect(press.style.minHeight).toBe('44px')
    fireEvent.click(press)
    expect(hardReloadFromRoot).not.toHaveBeenCalled()
    expect(screen.getByRole('status').textContent).toBe(ROUTE_RELOAD_CHECKING_WORDS)
    expect(press.disabled).toBe(true)
    // A press on the dead press sends no second ask.
    fireEvent.click(press)
    expect(fetcher).toHaveBeenCalledTimes(1)
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toMatch(/^\/favicon\.svg\?signal=\d+$/)
    expect(init.cache).toBe('no-store')
    await act(async () => {
      answer(icon())
    })
    await waitFor(() => expect(hardReloadFromRoot).toHaveBeenCalledTimes(1))
    // The press stays dead while the page leaves.
    expect(press.disabled).toBe(true)
  })

  it('v2.8513: over typed words Reload is asked first, and asks the network only after Reload anyway', async () => {
    const fetcher = vi.fn(async () => icon())
    vi.stubGlobal('fetch', fetcher)
    __resetReloadAskForTests()
    __forgetTypedTextForTests()
    const note = document.createElement('textarea')
    note.value = 'We can start Monday.'
    document.body.appendChild(note)
    try {
      render(<ReloadOverWordsBar />)
      // Typed words also hold the recovery reload, so the fallback is what draws.
      render(
        <RouteChunkBoundary>
          <Throws error={lostChunk()} />
        </RouteChunkBoundary>,
      )
      const press = screen.getByRole('button', { name: 'Reload' })
      fireEvent.click(press)
      expect(fetcher).not.toHaveBeenCalled()
      expect(screen.getByText('Reloading clears what you typed.')).toBeTruthy()
      const anyway = screen.getByRole('button', { name: 'Reload anyway' })
      expect(anyway.getAttribute('aria-disabled')).toBe('true')
      await waitFor(() => expect(anyway.getAttribute('aria-disabled')).toBeNull(), { timeout: 3000 })
      expect(fetcher).not.toHaveBeenCalled()
      expect(hardReloadFromRoot).not.toHaveBeenCalled()
      fireEvent.click(anyway)
      expect(fetcher).toHaveBeenCalledTimes(1)
      await waitFor(() => expect(hardReloadFromRoot).toHaveBeenCalledTimes(1))
      expect(note.value).toBe('We can start Monday.')
    } finally {
      note.remove()
      __resetReloadAskForTests()
    }
  })

  it('Reload with no network reloads nothing, says so, and gives the press back', async () => {
    const fetcher = vi.fn(async (): Promise<Response> => {
      throw new TypeError('Failed to fetch')
    })
    vi.stubGlobal('fetch', fetcher)
    const press = drawFallback()
    fireEvent.click(press)
    expect(await screen.findByText(ROUTE_RELOAD_NO_SIGNAL_WORDS)).toBeTruthy()
    expect(press.disabled).toBe(false)
    expect(hardReloadFromRoot).not.toHaveBeenCalled()
    // Three more presses ask three more times and still reload nothing.
    for (let n = 2; n <= 4; n++) {
      fireEvent.click(press)
      await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(n))
      await waitFor(() => expect(press.disabled).toBe(false))
    }
    expect(hardReloadFromRoot).not.toHaveBeenCalled()
    expect(screen.getByText(/This page could not load/)).toBeTruthy()
  })

  it('a sign-in wall that answers every address with its own page reloads nothing', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>Sign in to the Wi-Fi</html>', { headers: { 'content-type': 'text/html' } })))
    const press = drawFallback()
    fireEvent.click(press)
    expect(await screen.findByText(ROUTE_RELOAD_NO_SIGNAL_WORDS)).toBeTruthy()
    expect(hardReloadFromRoot).not.toHaveBeenCalled()
  })

  it('an answer that comes after the route has changed does nothing', async () => {
    let answer: (r: Response) => void = () => undefined
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((r) => (answer = r))))
    sessionStorage.setItem(CHUNK_RECOVERY_KEY, String(Date.now()))
    const { rerender } = render(
      <RouteChunkBoundary resetKey="/bills-sent">
        <Throws error={lostChunk()} />
      </RouteChunkBoundary>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Reload' }))
    rerender(
      <RouteChunkBoundary resetKey="/jobs">
        <p>Jobs</p>
      </RouteChunkBoundary>,
    )
    expect(screen.getByText('Jobs')).toBeTruthy()
    await act(async () => {
      answer(icon())
    })
    expect(hardReloadFromRoot).not.toHaveBeenCalled()
  })

  it('the Reload on an error that is not a lost chunk asks first too', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => icon()))
    render(
      <RouteChunkBoundary>
        <Throws error={new Error('boom')} />
      </RouteChunkBoundary>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Reload' }))
    await waitFor(() => expect(hardReloadFromRoot).toHaveBeenCalledTimes(1))
  })

  it('offers Reload for an error that is not a lost chunk, and never reloads by itself', () => {
    render(
      <RouteChunkBoundary>
        <Throws error={new Error('boom')} />
      </RouteChunkBoundary>,
    )
    expect(screen.getByText('Something went wrong loading this page.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Reload' })).toBeTruthy()
    expect(hardReloadFromRoot).not.toHaveBeenCalled()
  })

  it('says the app is updating for what a cancelled preload leaves behind, while that reload is on its way', () => {
    // main.tsx's vite:preloadError handler started the reload; the lazy page then resolved to nothing.
    expect(startChunkRecoveryReload(Date.now(), sessionStorage, hardReloadFromRoot)).toBe(true)
    render(
      <RouteChunkBoundary>
        <Throws error={emptyLazy()} />
      </RouteChunkBoundary>,
    )
    expect(screen.getByText('Updating app…')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Reload' })).toBeNull()
    expect(hardReloadFromRoot).toHaveBeenCalledTimes(1)
  })

  describe('a reload that never lands (punch list #406)', () => {
    beforeEach(() => vi.useFakeTimers())
    afterEach(() => vi.useRealTimers())

    it('Reload: the press comes back with a line, and a second press asks and reloads again', async () => {
      const fetcher = vi.fn(async () => icon())
      vi.stubGlobal('fetch', fetcher)
      const press = drawFallback()
      fireEvent.click(press)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0)
      })
      expect(hardReloadFromRoot).toHaveBeenCalledTimes(1)
      // The page is leaving: dead for as long as a reload may take.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(ROUTE_RELOAD_LAND_MAX_MS - 1)
      })
      expect(press.disabled).toBe(true)
      expect(screen.getByRole('status').textContent).toBe(ROUTE_RELOAD_CHECKING_WORDS)
      // It never left.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1)
      })
      expect(press.disabled).toBe(false)
      expect(screen.getByRole('status').textContent).toBe(ROUTE_RELOAD_STALLED_WORDS)
      expect(screen.getByRole('link', { name: 'Fix app' })).toBeTruthy()
      fireEvent.click(press)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0)
      })
      expect(fetcher).toHaveBeenCalledTimes(2)
      expect(hardReloadFromRoot).toHaveBeenCalledTimes(2)
      expect(press.disabled).toBe(true)
    })

    it('Reload: a page that left before the limit leaves no timer to fire', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => icon()))
      const press = drawFallback()
      fireEvent.click(press)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0)
      })
      expect(hardReloadFromRoot).toHaveBeenCalledTimes(1)
      cleanup()
      expect(vi.getTimerCount()).toBe(0)
    })

    it('Updating app… gives way to the fallback and its press once the reload has fired and not landed', () => {
      render(
        <RouteChunkBoundary>
          <Throws error={lostChunk()} />
        </RouteChunkBoundary>,
      )
      expect(hardReloadFromRoot).toHaveBeenCalledTimes(1)
      act(() => {
        vi.advanceTimersByTime(CHUNK_RELOAD_LAND_MAX_MS - 1_000)
      })
      expect(screen.getByText('Updating app…')).toBeTruthy()
      expect(screen.queryByRole('button', { name: 'Reload' })).toBeNull()
      act(() => {
        vi.advanceTimersByTime(1_000)
      })
      expect(screen.queryByText('Updating app…')).toBeNull()
      expect(screen.getByText(/This page could not load/)).toBeTruthy()
      expect(screen.getByRole('button', { name: 'Reload' })).toBeTruthy()
      expect(screen.getByRole('link', { name: 'Fix app' }).getAttribute('href')).toBe('/fix-cache.html')
      // It reloaded once by itself. The next one is the person's press.
      expect(hardReloadFromRoot).toHaveBeenCalledTimes(1)
    })

    it('what a cancelled preload leaves behind gives way to the same fallback, in a lost page’s words', () => {
      expect(startChunkRecoveryReload(Date.now(), sessionStorage, hardReloadFromRoot)).toBe(true)
      render(
        <RouteChunkBoundary>
          <Throws error={emptyLazy()} />
        </RouteChunkBoundary>,
      )
      expect(screen.getByText('Updating app…')).toBeTruthy()
      act(() => {
        vi.advanceTimersByTime(CHUNK_RELOAD_LAND_MAX_MS)
      })
      expect(screen.getByText(/This page could not load/)).toBeTruthy()
      expect(screen.getByRole('button', { name: 'Reload' })).toBeTruthy()
    })

    it('Updating app… stays while a save holds the reload, however long past the limit', () => {
      const counting = wrapFetchCountingWrites(() => new Promise<Response>(() => undefined))
      void counting('https://x/rest/v1/clock_sessions', { method: 'POST' })
      render(
        <RouteChunkBoundary>
          <Throws error={lostChunk()} />
        </RouteChunkBoundary>,
      )
      act(() => {
        vi.advanceTimersByTime(CHUNK_RELOAD_LAND_MAX_MS * 2)
      })
      // The reload has not fired, so nothing has stalled.
      expect(hardReloadFromRoot).not.toHaveBeenCalled()
      expect(screen.getByText('Updating app…')).toBeTruthy()
    })
  })

  it('clears a caught error when the route changes, so the next page draws', () => {
    const { rerender } = render(
      <RouteChunkBoundary resetKey="/b/abc">
        <Throws error={new Error('boom')} />
      </RouteChunkBoundary>,
    )
    expect(screen.getByText('Something went wrong loading this page.')).toBeTruthy()
    rerender(
      <RouteChunkBoundary resetKey="/tally">
        <p>On site</p>
      </RouteChunkBoundary>,
    )
    expect(screen.getByText('On site')).toBeTruthy()
  })
})
