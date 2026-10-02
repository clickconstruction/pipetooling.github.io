// @vitest-environment jsdom
/**
 * v2.4350 · the clock button when its first load fails (Grace, 2026-10-01: "Failed to clock
 * sessions open for user: AbortError: Lock was stolen by another request"). The two reads say
 * it once, a Try again loads again, and the app coming back on screen loads again by itself.
 * The stolen-lock retry itself is a kernel rule (`isAuthLockStolenError`, errorHandling.test.ts).
 */
import { describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../test/renderSmokeMocks'
import ClockInOutButton from './ClockInOutButton'

const state = { fail: true, clockReads: 0 }

vi.mock('../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../test/renderSmokeMocks')
  const stub = makeSupabaseStub()
  const failing = () => {
    const b: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'is', 'order', 'limit', 'in', 'gte', 'lte']) b[m] = () => b
    const result = () => {
      state.clockReads += 1
      // A refusal, so the retry helper does not wait between tries.
      return Promise.resolve(state.fail ? { data: null, error: { message: 'permission denied for table clock_sessions', code: '42501', details: '', hint: '' }, status: 403 } : { data: null, error: null, status: 200 })
    }
    b.maybeSingle = () => ({ then: (f: (v: unknown) => unknown, r?: (e: unknown) => unknown) => result().then(f, r) })
    b.then = (f: (v: unknown) => unknown, r?: (e: unknown) => unknown) => result().then((v) => f({ ...(v as object), data: (v as { data: unknown }).data ?? (state.fail ? null : []) }), r)
    return b
  }
  return { supabase: { ...stub, from: (table: string) => (table === 'clock_sessions' ? failing() : stub.from()) } }
})
vi.mock('../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../test/renderSmokeMocks')
  return useAuthModuleMock({ role: 'primary' })
})
vi.mock('../contexts/DailyGoalsGateContext', () => ({ useDailyGoalsGate: () => ({ notifyFirstClockInOfDay: vi.fn() }) }))
vi.mock('../contexts/UpdateFocusOpenerBridgeContext', () => ({
  useUpdateFocusOpenerBridge: () => ({ registerUpdateFocusOpener: () => () => {}, registerUpdateFocusApplyDirect: () => () => {}, registerClockOutOpener: () => () => {} }),
}))
vi.mock('../contexts/LedgerDisplayPrefixContext', () => ({ useLedgerDisplayPrefixes: () => ({ prefixMap: new Map() }) }))

describe('ClockInOutButton when the first load fails', () => {
  it('says it once with Try again; Try again and the app coming back on screen load again', async () => {
    state.fail = true
    state.clockReads = 0
    renderWithProviders(<ClockInOutButton userId="user-1" userName="Pat" />)
    const line = await screen.findByTestId('clock-load-error')
    // Both reads failed; each names its own read, and neither is the raw library text.
    expect(line.textContent).not.toMatch(/AbortError|Lock was stolen/)
    const retry = await screen.findByTestId('clock-load-retry')
    expect(retry.textContent).toBe('Try again')

    // Still failing: Try again reads again and keeps the door.
    const before = state.clockReads
    fireEvent.click(retry)
    await waitFor(() => expect(state.clockReads).toBeGreaterThan(before))
    expect(await screen.findByTestId('clock-load-retry')).toBeTruthy()

    // The app comes back on screen and the read now works: the line goes away by itself.
    state.fail = false
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await waitFor(() => expect(screen.queryByTestId('clock-load-error')).toBeNull())
  })
})
