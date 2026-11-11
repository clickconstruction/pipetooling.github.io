// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { CHUNK_RECOVERY_KEY, forgetChunkRecoveryReload, startChunkRecoveryReload } from '../lib/chunkLoadRecovery'
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
    sessionStorage.clear()
    hardReloadFromRoot.mockClear()
    // React logs every caught render error, and the boundary logs what it caught.
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
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

  it('offers Reload, and does not reload again, when a recovery already ran inside the last minute', () => {
    sessionStorage.setItem(CHUNK_RECOVERY_KEY, String(Date.now()))
    render(
      <RouteChunkBoundary>
        <Throws error={lostChunk()} />
      </RouteChunkBoundary>,
    )
    expect(screen.getByText(/This page could not load/)).toBeTruthy()
    expect(hardReloadFromRoot).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Reload' }))
    expect(hardReloadFromRoot).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('link', { name: 'Fix app' }).getAttribute('href')).toBe('/fix-cache.html')
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
