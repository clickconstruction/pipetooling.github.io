// @vitest-environment jsdom
/**
 * Render smoke for the app-health strip (#183 PR 1, v2.6009) — the first row of the nav chrome
 * that says the app is slow. The states come from a store the test drives; the words and the
 * timing are the kernel's (`src/lib/appHealth.test.ts`).
 */
import { describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '../test/renderSmokeMocks'
import { createAppHealthStore, DEV_RUNBOOK_AFTER_MS, SLOW_AFTER_MS, UNREACHABLE_AFTER_MS } from '../lib/appHealth'
import { createKeptReadOnScreenStore, formatKeptReadTime } from '../lib/keptRead'
import { AppHealthStrip } from './AppHealthStrip'

let mockRole: string | null = 'assistant'
vi.mock('../hooks/useAuth', () => ({
  useOptionalAuth: () => ({ user: { id: 'u1' }, role: mockRole }),
}))

describe('AppHealthStrip render smoke', () => {
  it('renders nothing while the app is fine', () => {
    const store = createAppHealthStore()
    const { container } = renderWithProviders(<AppHealthStrip store={store} />)
    expect(container.textContent).toBe('') // first paint
  })

  it('reads the owner is line in amber once something has waited 4 s, with no Retry', async () => {
    const store = createAppHealthStore()
    store.requestStarted(Date.now() - SLOW_AFTER_MS - 500)
    renderWithProviders(<AppHealthStrip store={store} />)
    const strip = await screen.findByRole('status')
    expect(strip.textContent).toBe('The app is slow right now.')
    expect(strip.getAttribute('data-tone')).toBe('amber')
    expect(strip.getAttribute('data-app-health')).toBe('slow')
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull()
  })

  it('reads Could not reach the app in red with Retry when nothing answers', async () => {
    const store = createAppHealthStore()
    store.requestStarted(Date.now() - UNREACHABLE_AFTER_MS - 500)
    const retry = vi.fn()
    renderWithProviders(<AppHealthStrip store={store} retry={retry} />)
    const button = await screen.findByRole('button', { name: 'Retry' })
    expect(screen.getByRole('status').textContent).toBe('Could not reach the app.Retry')
    expect(screen.getByRole('status').getAttribute('data-tone')).toBe('red')
    fireEvent.click(button)
    expect(retry).toHaveBeenCalledTimes(1)
  })

  it('reads No signal in grey when the browser says offline', async () => {
    const store = createAppHealthStore({ online: false })
    renderWithProviders(<AppHealthStrip store={store} />)
    const strip = await screen.findByRole('status')
    expect(strip.textContent).toBe('No signal.')
    expect(strip.getAttribute('data-tone')).toBe('grey')
  })

  it('a dev sees the runbook line after a minute of trouble; an assistant never does', async () => {
    const now = Date.now()
    const store = createAppHealthStore()
    // a pileup: the oldest read still waiting, statement timeouts answering along the way
    store.requestStarted(now - DEV_RUNBOOK_AFTER_MS - 10_000)
    store.read(now - DEV_RUNBOOK_AFTER_MS - 5_000)
    for (const ago of [40_000, 25_000, 10_000]) {
      store.requestLanded(store.requestStarted(now - ago - 8_000), { status: 500, code: '57014' }, now - ago)
    }
    mockRole = 'dev'
    const { unmount } = renderWithProviders(<AppHealthStrip store={store} />)
    expect((await screen.findByRole('status')).textContent).toBe('The app is slow right now.Run /db-freeze before anyone restarts.')
    unmount()

    mockRole = 'assistant'
    renderWithProviders(<AppHealthStrip store={store} />)
    expect((await screen.findByRole('status')).textContent).toBe('The app is slow right now.')
  })

  it('names the time the page on screen was read while a kept page shows, and drops the line when the page is live (#183 PR 2)', async () => {
    const store = createAppHealthStore()
    store.requestStarted(Date.now() - SLOW_AFTER_MS - 500)
    const kept = createKeptReadOnScreenStore()
    const readAt = Date.now() - 20 * 60_000
    kept.show('board', readAt)
    renderWithProviders(<AppHealthStrip store={store} keptStore={kept} />)
    const strip = await screen.findByRole('status')
    expect(strip.textContent).toBe(`The app is slow right now.The page you see was read at ${formatKeptReadTime(readAt)}.`)
    act(() => kept.hide('board'))
    expect(strip.textContent).toBe('The app is slow right now.')
  })

  it('goes when a read lands and the 3 s hold is over', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      const store = createAppHealthStore()
      const id = store.requestStarted(Date.now() - SLOW_AFTER_MS - 10_000)
      store.read(Date.now() - 10_000)
      const { container } = renderWithProviders(<AppHealthStrip store={store} />)
      expect(container.textContent).toBe('The app is slow right now.') // first paint
      store.requestLanded(id, { status: 200 }, Date.now())
      await vi.advanceTimersByTimeAsync(50)
      expect(container.textContent).toBe('')
    } finally {
      vi.useRealTimers()
    }
  })
})
