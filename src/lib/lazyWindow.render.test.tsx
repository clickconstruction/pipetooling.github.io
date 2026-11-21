// @vitest-environment jsdom
/**
 * Render smoke for `lazyWindow`: a window not yet loaded shows the boundary's fallback and then itself,
 * a warmed window is drawn in the same pass with no fallback, a mounted window keeps its state when its
 * code lands, and a failed load is asked for again on the next mount.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Suspense, useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { lazyWindow } from './lazyWindow'

afterEach(cleanup)

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
})
