// @vitest-environment jsdom
/**
 * The clock button's salary sync while View as is on. For a salaried person with a workday the
 * button syncs their clock rows on mount and every 90 seconds, with no press. A dev looking as
 * that person is signed in as them, so the sync would write their rows from the dev's browser.
 * It is held on mount and on each tick, and the clock is still read.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../test/renderSmokeMocks'
import { IMPERSONATION_ORIGINAL_STORAGE_KEY } from '../lib/impersonationSession'
import ClockInOutButton from './ClockInOutButton'

const h = vi.hoisted(() => ({ rpcs: [] as string[], clockReads: 0, probes: 0 }))

vi.mock('../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../test/renderSmokeMocks')
  const stub = makeSupabaseStub()
  return {
    supabase: {
      ...stub,
      from: (table: string) => {
        if (table === 'clock_sessions') h.clockReads += 1
        return stub.from()
      },
      rpc: (fn: string) => {
        h.rpcs.push(fn)
        return stub.rpc()
      },
    },
  }
})
vi.mock('../lib/selfSalaryClockState', () => ({
  fetchSelfSalaryClockState: async () => {
    h.probes += 1
    return { isSalary: true, hasTemplate: true, week: [0, 8, 8, 8, 8, 8, 0] }
  },
}))
vi.mock('../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../test/renderSmokeMocks')
  return useAuthModuleMock({ role: 'superintendent' })
})
vi.mock('../contexts/DailyGoalsGateContext', () => ({ useDailyGoalsGate: () => ({ notifyFirstClockInOfDay: vi.fn() }) }))
vi.mock('../contexts/UpdateFocusOpenerBridgeContext', () => ({
  useUpdateFocusOpenerBridge: () => ({ registerUpdateFocusOpener: () => () => {}, registerUpdateFocusApplyDirect: () => () => {}, registerClockOutOpener: () => () => {}, notifySessionChanged: () => {} }),
}))
vi.mock('../contexts/LedgerDisplayPrefixContext', () => ({ useLedgerDisplayPrefixes: () => ({ prefixMap: new Map() }) }))

const SYNC = 'sync_salary_clock_sessions_for_user_day'
const syncs = () => h.rpcs.filter((fn) => fn === SYNC).length
/** A full CI run can starve a worker for seconds, so a wait on the mount gets the long limit. */
const MOUNT_WAIT = { timeout: 15_000 }

/** Let the salary probe answer and the effects it sets off run. */
async function settleEffects() {
  for (let i = 0; i < 5; i += 1) {
    await act(async () => {
      await Promise.resolve()
    })
  }
}

async function tick90() {
  await act(async () => {
    vi.advanceTimersByTime(90_000)
  })
  await settleEffects()
}

describe('ClockInOutButton: the salary sync and View as', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
    h.rpcs.length = 0
    h.clockReads = 0
    h.probes = 0
    localStorage.clear()
  })
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    localStorage.clear()
  })

  it('as yourself syncs on mount and again every 90 seconds', async () => {
    renderWithProviders(<ClockInOutButton userId="user-1" userName="Pat" />)
    await waitFor(() => expect(syncs()).toBe(1), MOUNT_WAIT)
    await tick90()
    expect(syncs()).toBe(2)
  })

  it('while View as is on never syncs, on mount or on a tick, and still reads the clock', async () => {
    localStorage.setItem(IMPERSONATION_ORIGINAL_STORAGE_KEY, JSON.stringify({ access_token: 'a', refresh_token: 'r' }))
    renderWithProviders(<ClockInOutButton userId="user-1" userName="Pat" />)
    // The salary probe has answered, so the effect that would sync has had its turn.
    await waitFor(() => expect(h.probes).toBeGreaterThan(0), MOUNT_WAIT)
    await settleEffects()
    const readsAfterMount = h.clockReads
    expect(readsAfterMount).toBeGreaterThan(0)
    expect(syncs()).toBe(0)

    await tick90()
    await tick90()
    expect(syncs()).toBe(0)
    // The tick ran (so the salaried effect was live) and its read went out without the sync.
    expect(h.clockReads).toBeGreaterThan(readsAfterMount)
  })

  it('holds a tick scheduled before the imitation began', async () => {
    renderWithProviders(<ClockInOutButton userId="user-1" userName="Pat" />)
    await waitFor(() => expect(syncs()).toBe(1), MOUNT_WAIT)

    localStorage.setItem(IMPERSONATION_ORIGINAL_STORAGE_KEY, JSON.stringify({ access_token: 'a', refresh_token: 'r' }))
    await tick90()
    expect(syncs()).toBe(1)

    localStorage.removeItem(IMPERSONATION_ORIGINAL_STORAGE_KEY)
    await tick90()
    expect(syncs()).toBe(2)
  })
})
