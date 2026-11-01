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
import { markRefused, markSent, markTryFailed, markSending, newPress } from '../lib/offline/outbox'
import { createOutboxState } from '../lib/offline/outboxState'
import { formatDenverTimeOnly } from '../utils/dateUtils'
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
    expect(strip.textContent).toBe('The app is slow right now.It goes the moment a read lands. Nothing to press.')
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
    expect(screen.getByRole('status').textContent).toBe('Could not reach the app.Check your signal, then press Retry to open the page again.Retry')
    expect(screen.getByRole('status').getAttribute('data-tone')).toBe('red')
    fireEvent.click(button)
    expect(retry).toHaveBeenCalledTimes(1)
  })

  it('reads No signal in grey when the browser says offline', async () => {
    const store = createAppHealthStore({ online: false })
    renderWithProviders(<AppHealthStrip store={store} />)
    const strip = await screen.findByRole('status')
    expect(strip.textContent).toBe('No signal.Clock presses, notes and reports wait on the phone and go out when the signal is back.')
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
    expect((await screen.findByRole('status')).textContent).toBe('The app is slow right now.It goes the moment a read lands. Nothing to press.Run /db-freeze before anyone restarts.')
    unmount()

    mockRole = 'assistant'
    renderWithProviders(<AppHealthStrip store={store} />)
    expect((await screen.findByRole('status')).textContent).toBe('The app is slow right now.It goes the moment a read lands. Nothing to press.')
  })

  it('names the time the page on screen was read while a kept page shows, and drops the line when the page is live (#183 PR 2)', async () => {
    const store = createAppHealthStore()
    store.requestStarted(Date.now() - SLOW_AFTER_MS - 500)
    const kept = createKeptReadOnScreenStore()
    const readAt = Date.now() - 20 * 60_000
    kept.show('board', readAt)
    renderWithProviders(<AppHealthStrip store={store} keptStore={kept} />)
    const strip = await screen.findByRole('status')
    expect(strip.textContent).toBe(`The app is slow right now.The page you see was read at ${formatKeptReadTime(readAt)}.It goes the moment a read lands. Nothing to press.`)
    act(() => kept.hide('board'))
    expect(strip.textContent).toBe('The app is slow right now.It goes the moment a read lands. Nothing to press.')
  })

  it('goes when a read lands and the 3 s hold is over', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      const store = createAppHealthStore()
      const id = store.requestStarted(Date.now() - SLOW_AFTER_MS - 10_000)
      store.read(Date.now() - 10_000)
      const { container } = renderWithProviders(<AppHealthStrip store={store} />)
      expect(container.textContent).toBe('The app is slow right now.It goes the moment a read lands. Nothing to press.') // first paint
      store.requestLanded(id, { status: 200 }, Date.now())
      await vi.advanceTimersByTimeAsync(50)
      expect(container.textContent).toBe('')
    } finally {
      vi.useRealTimers()
    }
  })
})

/** The queue's face on the same strip (punch list #163 PR 2). The words are the kernel's (`src/lib/offline/outbox.test.ts`). */
describe('AppHealthStrip render smoke · the outbox bar', () => {
  const quietIo = { readAll: async () => [], write: async () => {}, del: async () => {}, clear: async () => {} }
  const clockIn = (pressedAt: number) =>
    newPress({ id: 'p-in', seq: 1, kind: 'clock-in', userId: 'u1', pressedAt, payload: { jobLedgerId: 'j1', bidId: null, notes: '', travel: null }, door: '/dashboard' })
  const note = (pressedAt: number) => newPress({ id: 'p-note', seq: 2, kind: 'job-note', userId: 'u1', pressedAt, payload: { jobId: 'j1', body: 'x' } })

  it('a press waiting reads amber with its countdown and Try now, and a tap on the words opens the list', async () => {
    const now = Date.now()
    const box = createOutboxState(quietIo)
    box.put(markTryFailed(markSending(clockIn(now - 60_000), now - 1_000), now - 1_000))
    const tryNow = vi.fn()
    renderWithProviders(<AppHealthStrip store={createAppHealthStore()} outboxStore={box} onTryNow={tryNow} />)
    const strip = await screen.findByRole('status')
    expect(strip.getAttribute('data-tone')).toBe('amber')
    expect(strip.textContent).toContain(`Clock in from ${formatDenverTimeOnly(now - 60_000)}`)
    expect(strip.textContent).toContain('waiting to send')
    expect(strip.textContent).toContain('trying again in')
    fireEvent.click(screen.getByRole('button', { name: 'Try now' }))
    expect(tryNow).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Open the list of presses waiting to send' }))
    expect(await screen.findByText('Waiting to send')).toBeTruthy()
  })

  it('a press that landed reads green until Got it, then the strip is gone', async () => {
    const now = Date.now()
    const box = createOutboxState(quietIo)
    box.put(markSent(clockIn(now - 60_000), { session_id: 's1' }, now))
    const { container } = renderWithProviders(<AppHealthStrip store={createAppHealthStore()} outboxStore={box} />)
    const strip = await screen.findByRole('status')
    expect(strip.getAttribute('data-tone')).toBe('green')
    expect(strip.textContent).toContain('sent ✓')
    fireEvent.click(screen.getByRole('button', { name: 'Got it' }))
    expect(box.presses()[0]?.seen).toBe(true)
    expect(container.querySelector('[role="status"]')).toBeNull()
  })

  it('a press the office refused reads red with its reason and Fix, while a landed one counts beside it', async () => {
    const now = Date.now()
    const box = createOutboxState(quietIo)
    box.put(markRefused(clockIn(now - 60_000), { message: 'The office closed that session at 8:05 AM.', code: 'P0001' }))
    box.put(markSent(note(now - 30_000), {}, now))
    renderWithProviders(<AppHealthStrip store={createAppHealthStore()} outboxStore={box} />)
    const strip = await screen.findByRole('status')
    expect(strip.getAttribute('data-tone')).toBe('red')
    expect(strip.textContent).toContain('could not be sent.')
    expect(strip.textContent).toContain('The office closed that session at 8:05 AM.')
    expect(strip.textContent).toContain('1 sent ✓')
    expect(screen.getByRole('button', { name: 'Fix' })).toBeTruthy()
  })

  it('while the app is slow the health words lead, then Nothing you pressed is lost and the count with its door', async () => {
    const now = Date.now()
    const store = createAppHealthStore()
    store.requestStarted(now - SLOW_AFTER_MS - 500)
    const box = createOutboxState(quietIo)
    box.put(clockIn(now - 60_000))
    box.put(note(now - 30_000))
    renderWithProviders(<AppHealthStrip store={store} outboxStore={box} />)
    const strip = await screen.findByRole('status')
    expect(strip.getAttribute('data-tone')).toBe('amber')
    expect(strip.textContent).toBe('The app is slow right now.It goes the moment a read lands. Nothing to press.Nothing you pressed is lost.2 waiting to send ›')
  })

  it('with no signal the strip reads No signal and the count, with no countdown and no Nothing lost line', async () => {
    const now = Date.now()
    const box = createOutboxState(quietIo)
    box.put(clockIn(now - 60_000))
    renderWithProviders(<AppHealthStrip store={createAppHealthStore({ online: false })} outboxStore={box} />)
    const strip = await screen.findByRole('status')
    expect(strip.getAttribute('data-tone')).toBe('grey')
    expect(strip.textContent).toBe('No signal.Clock presses, notes and reports wait on the phone and go out when the signal is back.1 waiting to send ›')
  })

  it('a press that needs a person is named beside the slow line, in the health tone', async () => {
    const now = Date.now()
    const store = createAppHealthStore()
    store.requestStarted(now - SLOW_AFTER_MS - 500)
    const box = createOutboxState(quietIo)
    box.put(markRefused(clockIn(now - 60_000), { message: 'No.', code: null }))
    renderWithProviders(<AppHealthStrip store={store} outboxStore={box} />)
    const strip = await screen.findByRole('status')
    expect(strip.textContent).toBe('The app is slow right now.It goes the moment a read lands. Nothing to press.1 press needs you ›')
  })
})
