// @vitest-environment jsdom
/**
 * Render smoke for `RoutePageBoundary` (punch list #85): a lazy page inside a route's own boundary, with the
 * Layout's chunk boundary above it, as fifteen routes in `App.tsx` stand. Each test forces a rejected lazy import.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { lazy, Suspense, type ComponentType } from 'react'
import { CHUNK_RECOVERY_KEY, forgetChunkRecoveryReload } from '../lib/chunkLoadRecovery'
import { __resetUnsavedWorkForTests } from '../lib/unsavedWork'
import { ErrorBoundary } from './ErrorBoundary'
import { RouteChunkBoundary } from './RouteChunkBoundary'
import { RoutePageBoundary } from './RoutePageBoundary'

const hardReloadFromRoot = vi.hoisted(() => vi.fn())
vi.mock('../lib/hardReload', () => ({ hardReloadFromRoot }))

const lostChunk = () => new TypeError('Failed to fetch dynamically imported module: https://x/assets/Messages-abc123.js')
const lostPage = () => lazy(async (): Promise<{ default: ComponentType }> => Promise.reject(lostChunk()))
const RED_WORDS = 'Something went wrong. Please refresh the page or try again later.'

/** The Layout's outlet: its chunk boundary, its Suspense, then the route's element. */
function Outlet({ children }: { children: React.ReactNode }) {
  return (
    <RouteChunkBoundary>
      <Suspense fallback={<p>Loading…</p>}>{children}</Suspense>
    </RouteChunkBoundary>
  )
}

describe('RoutePageBoundary', () => {
  beforeEach(() => {
    forgetChunkRecoveryReload()
    __resetUnsavedWorkForTests()
    sessionStorage.clear()
    hardReloadFromRoot.mockClear()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('draws its page while nothing throws', () => {
    render(
      <Outlet>
        <RoutePageBoundary>
          <p>Messages</p>
        </RoutePageBoundary>
      </Outlet>,
    )
    expect(screen.getByText('Messages')).toBeTruthy()
  })

  it('the fault it mends: the plain boundary draws red words and no press when the page’s code does not come', async () => {
    sessionStorage.setItem(CHUNK_RECOVERY_KEY, String(Date.now()))
    const Page = lostPage()
    render(
      <Outlet>
        <ErrorBoundary>
          <Page />
        </ErrorBoundary>
      </Outlet>,
    )
    expect(await screen.findByText(RED_WORDS)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Reload' })).toBeNull()
  })

  it('a page whose code does not come, inside a minute of a recovery reload: the same words and Reload press every other page has', async () => {
    sessionStorage.setItem(CHUNK_RECOVERY_KEY, String(Date.now()))
    const Page = lostPage()
    render(
      <Outlet>
        <RoutePageBoundary>
          <Page />
        </RoutePageBoundary>
      </Outlet>,
    )
    expect(await screen.findByText(/This page could not load/)).toBeTruthy()
    expect(screen.queryByText(RED_WORDS)).toBeNull()
    expect(hardReloadFromRoot).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Reload' }))
    expect(hardReloadFromRoot).toHaveBeenCalledTimes(1)
  })

  it('offline: no reload by itself, the words and the Reload press', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    const Page = lostPage()
    render(
      <Outlet>
        <RoutePageBoundary>
          <Page />
        </RoutePageBoundary>
      </Outlet>,
    )
    expect(await screen.findByText(/This page could not load/)).toBeTruthy()
    expect(hardReloadFromRoot).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Reload' })).toBeTruthy()
  })

  it('a first lost chunk gets the one guarded reload, where the plain boundary swallowed it', async () => {
    const Page = lostPage()
    render(
      <Outlet>
        <RoutePageBoundary>
          <Page />
        </RoutePageBoundary>
      </Outlet>,
    )
    expect(await screen.findByText('Updating app…')).toBeTruthy()
    expect(hardReloadFromRoot).toHaveBeenCalledTimes(1)
  })

  it('an ordinary crash is still caught here, with the words it had', async () => {
    const Crashes = lazy(async (): Promise<{ default: ComponentType }> => ({
      default: () => {
        throw new Error('boom')
      },
    }))
    render(
      <Outlet>
        <RoutePageBoundary>
          <Crashes />
        </RoutePageBoundary>
      </Outlet>,
    )
    expect(await screen.findByText(RED_WORDS)).toBeTruthy()
    expect(screen.queryByText(/This page could not load/)).toBeNull()
    expect(screen.queryByRole('button', { name: 'Reload' })).toBeNull()
    expect(hardReloadFromRoot).not.toHaveBeenCalled()
  })
})
