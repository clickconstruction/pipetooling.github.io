// @vitest-environment jsdom
/**
 * Render smoke for `WindowLoadBoundary` (punch list #85): a window whose code does not come gives up
 * alone. Each test forces a rejected lazy import through `lazyWindow`, as a lost chunk rejects it.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Component, Suspense, useState, type ReactNode } from 'react'
import { ToastProvider } from '../contexts/ToastContext'
import { forgetChunkRecoveryReload, startChunkRecoveryReload } from '../lib/chunkLoadRecovery'
import { FAILED_LOAD_HELD_MS, lazyWindow } from '../lib/lazyWindow'
import { __resetUnsavedWorkForTests } from '../lib/unsavedWork'
import { OnDemandWindow } from './OnDemandWindow'
import { WindowLoadBoundary } from './WindowLoadBoundary'
import { WindowOpening } from './WindowOpening'

const lostChunk = () => new TypeError('Failed to fetch dynamically imported module: https://x/assets/JobWindowModal-abc123.js')
const LINE = 'The job could not open. Check your signal, then press it again.'

function JobWindow({ onClose }: { onClose: () => void }) {
  return (
    <div role="dialog">
      J1001 · ZZ Test Kitchen
      <button type="button" onClick={onClose}>
        Close
      </button>
    </div>
  )
}

/** What stands above the window's boundary in the app: the routes' boundary, which replaces everything. */
class RoutesBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  render() {
    return this.state.error ? <p>This page could not load</p> : this.props.children
  }
}

/** A page with a list and a host that opens one window over it, as the Jobs page and its provider do. */
function JobsPage({ Window, onGaveUp }: { Window: ReturnType<typeof lazyWindow<{ onClose: () => void }>>; onGaveUp?: () => void }) {
  const [open, setOpen] = useState<number | null>(null)
  const [opens, setOpens] = useState(0)
  const close = () => setOpen(null)
  return (
    <ToastProvider>
      <RoutesBoundary>
        <h1>Jobs</h1>
        <button
          type="button"
          onClick={() => {
            setOpens(opens + 1)
            setOpen(opens + 1)
          }}
        >
          J1001 · ZZ Test Kitchen row
        </button>
        {open != null ? (
          <WindowLoadBoundary
            what="The job"
            resetKey={open}
            onGaveUp={() => {
              onGaveUp?.()
              close()
            }}
          >
            <Suspense fallback={<WindowOpening words="Opening the job…" />}>
              <Window onClose={close} />
            </Suspense>
          </WindowLoadBoundary>
        ) : null}
      </RoutesBoundary>
    </ToastProvider>
  )
}

describe('WindowLoadBoundary', () => {
  beforeEach(() => {
    forgetChunkRecoveryReload()
    __resetUnsavedWorkForTests()
    sessionStorage.clear()
    // React logs every caught render error, and the boundary logs what it caught.
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('draws its window while nothing throws', async () => {
    const Window = lazyWindow(async () => ({ default: JobWindow }))
    render(<JobsPage Window={Window} />)
    fireEvent.click(screen.getByRole('button', { name: 'J1001 · ZZ Test Kitchen row' }))
    expect(await screen.findByRole('dialog')).toBeTruthy()
    expect(screen.queryByText(LINE)).toBeNull()
  })

  it('a window whose code does not come gives up alone: one line, and the page behind stays', async () => {
    const load = vi.fn(async (): Promise<{ default: typeof JobWindow }> => {
      throw lostChunk()
    })
    const gaveUp = vi.fn()
    render(<JobsPage Window={lazyWindow(load)} onGaveUp={gaveUp} />)
    fireEvent.click(screen.getByRole('button', { name: 'J1001 · ZZ Test Kitchen row' }))
    expect(screen.getByText('Opening the job…')).toBeTruthy()

    expect(await screen.findByText(LINE)).toBeTruthy()
    expect(gaveUp).toHaveBeenCalledTimes(1)
    expect(load).toHaveBeenCalledTimes(1)
    // The page behind is as it was: its heading, its row, and no word from the routes' boundary.
    expect(screen.getByRole('heading', { name: 'Jobs' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'J1001 · ZZ Test Kitchen row' })).toBeTruthy()
    expect(screen.queryByText('This page could not load')).toBeNull()
    expect(screen.queryByText('Opening the job…')).toBeNull()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('over words someone typed it says what frees the window, and the words stay', async () => {
    const load = vi.fn(async (): Promise<{ default: typeof JobWindow }> => {
      throw lostChunk()
    })
    render(
      <>
        <textarea aria-label="Message to the customer" defaultValue="We can start Monday." />
        <JobsPage Window={lazyWindow(load)} />
      </>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'J1001 · ZZ Test Kitchen row' }))
    expect(
      await screen.findByText('The job could not open. The app must reload first, and it will not reload over what you typed. Send or clear it, then press again.'),
    ).toBeTruthy()
    expect(screen.queryByText(LINE)).toBeNull()
    expect((screen.getByLabelText('Message to the customer') as HTMLTextAreaElement).value).toBe('We can start Monday.')
    expect(screen.getByRole('heading', { name: 'Jobs' })).toBeTruthy()
  })

  it('offline it says the signal line even over typed words: the signal is the first thing to mend', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    const load = vi.fn(async (): Promise<{ default: typeof JobWindow }> => {
      throw lostChunk()
    })
    render(
      <>
        <textarea aria-label="Message to the customer" defaultValue="We can start Monday." />
        <JobsPage Window={lazyWindow(load)} />
      </>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'J1001 · ZZ Test Kitchen row' }))
    expect(await screen.findByText(LINE)).toBeTruthy()
  })

  it('the next press asks again, and the window opens once its code is back', async () => {
    let fail = true
    const load = vi.fn(async () => {
      if (fail) throw lostChunk()
      return { default: JobWindow }
    })
    const heldUntil = Date.now() + FAILED_LOAD_HELD_MS + 50
    render(<JobsPage Window={lazyWindow(load)} />)
    fireEvent.click(screen.getByRole('button', { name: 'J1001 · ZZ Test Kitchen row' }))
    expect(await screen.findByText(LINE)).toBeTruthy()

    fail = false
    // `lazyWindow` keeps a failure for two seconds, then the next open asks afresh.
    vi.spyOn(Date, 'now').mockReturnValue(heldUntil)
    fireEvent.click(screen.getByRole('button', { name: 'J1001 · ZZ Test Kitchen row' }))
    expect(await screen.findByRole('dialog')).toBeTruthy()
    expect(load).toHaveBeenCalledTimes(2)
    expect(screen.getByRole('heading', { name: 'Jobs' })).toBeTruthy()
  })

  it('while a recovery reload is on its way it draws the note, keeps the page and closes nothing', async () => {
    const reload = vi.fn()
    expect(startChunkRecoveryReload(Date.now(), sessionStorage, reload, undefined, false)).toBe(true)
    const gaveUp = vi.fn()
    // What the preload handler leaves behind when it cancels Vite's throw: the import resolves to nothing.
    const Window = lazyWindow(async () => undefined as unknown as { default: typeof JobWindow })
    render(<JobsPage Window={Window} onGaveUp={gaveUp} />)
    fireEvent.click(screen.getByRole('button', { name: 'J1001 · ZZ Test Kitchen row' }))
    expect(await screen.findByText('Updating app…')).toBeTruthy()
    expect(gaveUp).not.toHaveBeenCalled()
    expect(screen.queryByText(LINE)).toBeNull()
    expect(screen.getByRole('heading', { name: 'Jobs' })).toBeTruthy()
  })

  it('an ordinary crash in a window is not caught here: it goes to the boundary above, as before', async () => {
    const Crashes = (): never => {
      throw new Error('boom')
    }
    const gaveUp = vi.fn()
    const Window = lazyWindow<{ onClose: () => void }>(async () => ({ default: Crashes }))
    render(<JobsPage Window={Window} onGaveUp={gaveUp} />)
    fireEvent.click(screen.getByRole('button', { name: 'J1001 · ZZ Test Kitchen row' }))
    expect(await screen.findByText('This page could not load')).toBeTruthy()
    expect(gaveUp).not.toHaveBeenCalled()
  })

  it('closes its window with no line where no toasts are mounted', async () => {
    const gaveUp = vi.fn()
    const Window = lazyWindow(async (): Promise<{ default: typeof JobWindow }> => {
      throw lostChunk()
    })
    render(
      <WindowLoadBoundary what="The job" onGaveUp={gaveUp}>
        <Suspense fallback={<p>Opening…</p>}>
          <Window onClose={() => {}} />
        </Suspense>
      </WindowLoadBoundary>,
    )
    await waitFor(() => expect(gaveUp).toHaveBeenCalledTimes(1))
    expect(screen.queryByText('Opening…')).toBeNull()
  })
})

describe('OnDemandWindow', () => {
  beforeEach(() => {
    forgetChunkRecoveryReload()
    sessionStorage.clear()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  function Host({ Window, closes = true }: { Window: ReturnType<typeof lazyWindow<{ onClose: () => void }>>; closes?: boolean }) {
    const [open, setOpen] = useState(false)
    return (
      <ToastProvider>
        <RoutesBoundary>
          <h1>People</h1>
          <button type="button" onClick={() => setOpen(true)}>
            open
          </button>
          <button type="button" onClick={() => setOpen(false)}>
            shut
          </button>
          <OnDemandWindow open={open} what="The review" onGaveUp={() => (closes ? setOpen(false) : undefined)}>
            <Window onClose={() => setOpen(false)} />
          </OnDemandWindow>
        </RoutesBoundary>
      </ToastProvider>
    )
  }

  it('a window whose code does not come gives up, and the next open asks again', async () => {
    let fail = true
    const load = vi.fn(async () => {
      if (fail) throw lostChunk()
      return { default: JobWindow }
    })
    const heldUntil = Date.now() + FAILED_LOAD_HELD_MS + 50
    render(<Host Window={lazyWindow(load)} />)
    fireEvent.click(screen.getByRole('button', { name: 'open' }))
    expect(await screen.findByText('The review could not open. Check your signal, then press it again.')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'People' })).toBeTruthy()
    expect(screen.queryByText('This page could not load')).toBeNull()

    fail = false
    vi.spyOn(Date, 'now').mockReturnValue(heldUntil)
    fireEvent.click(screen.getByRole('button', { name: 'open' }))
    expect(await screen.findByRole('dialog')).toBeTruthy()
    expect(load).toHaveBeenCalledTimes(2)
  })

  it('a host that did not close is not asked again by a render alone', async () => {
    const load = vi.fn(async (): Promise<{ default: typeof JobWindow }> => {
      throw lostChunk()
    })
    render(<Host Window={lazyWindow(load)} closes={false} />)
    fireEvent.click(screen.getByRole('button', { name: 'open' }))
    expect(await screen.findByText('The review could not open. Check your signal, then press it again.')).toBeTruthy()
    // Still open by its host's word, and past the hold: nothing mounts and nothing is asked for.
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + FAILED_LOAD_HELD_MS + 50)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'open' }))
    })
    expect(load).toHaveBeenCalledTimes(1)
    expect(screen.getAllByText('The review could not open. Check your signal, then press it again.')).toHaveLength(1)
    // Shut, then opened: that is a new ask.
    fireEvent.click(screen.getByRole('button', { name: 'shut' }))
    fireEvent.click(screen.getByRole('button', { name: 'open' }))
    await waitFor(() => expect(load).toHaveBeenCalledTimes(2))
  })
})
