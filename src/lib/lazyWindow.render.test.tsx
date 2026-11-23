// @vitest-environment jsdom
/**
 * Render smoke for `lazyWindow`: a window not yet loaded shows the boundary's fallback and then itself,
 * a warmed window is drawn in the same pass with no fallback, a mounted window keeps its state when its
 * code lands, a failed load is asked for again on the next mount, a load that keeps failing reaches its
 * boundary instead of being asked for without end, and a load that resolves to nothing is a failure too.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Component, Suspense, useState, type ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FAILED_LOAD_HELD_MS, lazyWindow } from './lazyWindow'

afterEach(cleanup)

class Caught extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  render() {
    return this.state.error ? <p>caught: {this.state.error.message}</p> : this.props.children
  }
}

function Counter({ label }: { label: string }) {
  const [n, setN] = useState(0)
  return (
    <button type="button" onClick={() => setN(n + 1)}>
      {label} {n}
    </button>
  )
}

describe('lazyWindow', () => {
  it('shows the fallback while the code loads, then the window', async () => {
    const Window = lazyWindow(async () => ({ default: Counter }))
    render(
      <Suspense fallback={<p>Opening…</p>}>
        <Window label="job" />
      </Suspense>,
    )
    expect(screen.getByText('Opening…')).toBeTruthy()
    expect(await screen.findByRole('button', { name: 'job 0' })).toBeTruthy()
    expect(screen.queryByText('Opening…')).toBeNull()
  })

  it('draws a warmed window at once, with no fallback in between', async () => {
    const Window = lazyWindow(async () => ({ default: Counter }))
    await Window.preload()
    render(
      <Suspense fallback={<p>Opening…</p>}>
        <Window label="job" />
      </Suspense>,
    )
    expect(screen.queryByText('Opening…')).toBeNull()
    expect(screen.getByRole('button', { name: 'job 0' })).toBeTruthy()
  })

  it('keeps a mounted window’s state when it draws again after its code has landed', async () => {
    const Window = lazyWindow(async () => ({ default: Counter }))
    const view = render(
      <Suspense fallback={<p>Opening…</p>}>
        <Window label="a" />
      </Suspense>,
    )
    fireEvent.click(await screen.findByRole('button', { name: 'a 0' }))
    expect(screen.getByRole('button', { name: 'a 1' })).toBeTruthy()
    // New props to the same mount: it must not swap the lazy component for the loaded one and start over.
    view.rerender(
      <Suspense fallback={<p>Opening…</p>}>
        <Window label="b" />
      </Suspense>,
    )
    expect(screen.getByRole('button', { name: 'b 1' })).toBeTruthy()
  })

  it('a load that failed is asked for again on the next mount', async () => {
    let calls = 0
    const load = vi.fn(async () => {
      calls += 1
      if (calls === 1) throw new Error('Failed to fetch dynamically imported module')
      return { default: Counter }
    })
    const Window = lazyWindow(load)
    await Window.preload().catch(() => {})
    render(
      <Suspense fallback={<p>Opening…</p>}>
        <Window label="again" />
      </Suspense>,
    )
    expect(await screen.findByRole('button', { name: 'again 0' })).toBeTruthy()
    expect(load).toHaveBeenCalledTimes(2)
  })

  it('a load that fails reaches the boundary, and is not asked for again until someone opens the window later', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    let gone = true
    const load = vi.fn(async () => {
      if (gone) throw new Error('Failed to fetch dynamically imported module')
      return { default: Counter }
    })
    const Window = lazyWindow(load)
    const view = render(
      <Caught>
        <Suspense fallback={<p>Opening…</p>}>
          <Window label="lost" />
        </Suspense>
      </Caught>,
    )
    expect(await screen.findByText('caught: Failed to fetch dynamically imported module')).toBeTruthy()
    // Once. Before v2.8327 the waiting render asked again at once, without end, and nothing was ever caught.
    expect(load).toHaveBeenCalledTimes(1)
    view.unmount()

    // A second open a moment later still finds the failure, and asks for nothing.
    const soon = render(
      <Caught>
        <Suspense fallback={<p>Opening…</p>}>
          <Window label="lost" />
        </Suspense>
      </Caught>,
    )
    expect(await screen.findByText('caught: Failed to fetch dynamically imported module')).toBeTruthy()
    expect(load).toHaveBeenCalledTimes(1)
    soon.unmount()

    // Later the file is back: the next open asks again and draws the window.
    gone = false
    const now = Date.now()
    vi.spyOn(Date, 'now').mockReturnValue(now + FAILED_LOAD_HELD_MS)
    render(
      <Caught>
        <Suspense fallback={<p>Opening…</p>}>
          <Window label="back" />
        </Suspense>
      </Caught>,
    )
    expect(await screen.findByRole('button', { name: 'back 0' })).toBeTruthy()
    expect(load).toHaveBeenCalledTimes(2)
    vi.restoreAllMocks()
  })

  it('a load that resolves to nothing is a failure like any other, and the window can still load later', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    // What a lost chunk leaves when main.tsx cancels Vite's throw: the import resolves, to nothing.
    let nothing = true
    const load = vi.fn(async () => (nothing ? (undefined as unknown as { default: typeof Counter }) : { default: Counter }))
    const Window = lazyWindow(load)
    const view = render(
      <Caught>
        <Suspense fallback={<p>Opening…</p>}>
          <Window label="empty" />
        </Suspense>
      </Caught>,
    )
    expect(await screen.findByText(/^caught: /)).toBeTruthy()
    expect(load).toHaveBeenCalledTimes(1)
    view.unmount()

    // The file is back. A warm-up asks afresh, where the nothing used to be kept for good.
    nothing = false
    await Window.preload()
    expect(load).toHaveBeenCalledTimes(2)
    render(
      <Suspense fallback={<p>Opening…</p>}>
        <Window label="back" />
      </Suspense>,
    )
    expect(screen.getByRole('button', { name: 'back 0' })).toBeTruthy()
    vi.restoreAllMocks()
  })
})
