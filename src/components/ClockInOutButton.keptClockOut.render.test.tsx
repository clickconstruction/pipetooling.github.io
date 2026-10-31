// @vitest-environment jsdom
/**
 * Punch list #163's live test (2026-10-30): after a clock-out kept on the phone the clock drew the amber *Clock out
 * pressed at 10:11 AM · waiting to send* and, under it, the red *No connection — the app couldn't reach the server,
 * so nothing was saved* with Try again: the write sentence, drawn for the clock's own read, which the new press had
 * set off and which failed with no signal. A crew member reading it would press again. Nothing may contradict a kept
 * press: the press reads nothing, a read that never reached the server says so in read words on the Retry panel and
 * reads again when the signal is back, and a read that lands while the clock-out still waits keeps the clock out. A
 * Dashboard opened with no signal draws a clock-in kept from before as the open session, as PR 2 promised.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { todayYmdInAppTz } from '../utils/dateUtils'

const net = { up: true, clockReads: 0 }
const clockedInAt = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
const session = { id: 's1', user_id: 'user-1', clocked_in_at: clockedInAt, clocked_out_at: null, work_date: todayYmdInAppTz(), notes: 'Rough-in at ZZ Test', job_ledger_id: 'job-1', bid_id: null, origin: 'user_punch' }

/** Every read answers while the signal is up and fails at the fetch layer, as supabase-js reports a rejected fetch, while it is down. */
function table(rows: unknown[], onRead?: () => void) {
  const make = (single: boolean): Record<string, unknown> => {
    const b: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'neq', 'is', 'in', 'gte', 'lte', 'lt', 'gt', 'or', 'not', 'order', 'limit', 'range', 'update', 'insert', 'upsert', 'delete']) b[m] = () => b
    b.single = () => make(true)
    b.maybeSingle = () => make(true)
    const result = () => {
      onRead?.()
      if (!net.up) return Promise.resolve({ data: null, error: { message: 'TypeError: Failed to fetch', details: '', hint: '', code: '' }, status: 0 })
      return Promise.resolve(single ? { data: rows[0] ?? null, error: null, status: 200 } : { data: rows, error: null, status: 200 })
    }
    b.then = (ok?: (v: unknown) => unknown, bad?: (e: unknown) => unknown) => result().then(ok, bad)
    return b
  }
  return make(false)
}

vi.mock('../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../test/renderSmokeMocks')
  const stub = makeSupabaseStub()
  return {
    supabase: {
      ...stub,
      from: (t: string) => (t === 'clock_sessions' ? table([session], () => (net.clockReads += 1)) : table([])),
      rpc: () => table([]),
    },
  }
})
// The real reader, once: a lost signal is classed as the app classes it, without the retry backoff's wait.
vi.mock('../utils/errorHandling', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../utils/errorHandling')>()
  return { ...actual, withSupabaseRetry: ((op: never, name: string) => actual.withSupabaseRetry(op, name, { maxRetries: 0, logRetries: false })) as typeof actual.withSupabaseRetry }
})
vi.mock('../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../test/renderSmokeMocks')
  return useAuthModuleMock({ role: 'helpers', user: { id: 'user-1', email: 'robert@example.com' }, profileName: 'Robert' })
})
vi.mock('../contexts/DailyGoalsGateContext', () => ({ useDailyGoalsGate: () => ({ notifyFirstClockInOfDay: vi.fn() }) }))
vi.mock('../contexts/UpdateFocusOpenerBridgeContext', () => ({
  useUpdateFocusOpenerBridge: () => ({ registerUpdateFocusOpener: () => () => {}, registerUpdateFocusApplyDirect: () => () => {}, registerClockOutOpener: () => () => {}, notifySessionChanged: () => {} }),
}))
vi.mock('../contexts/LedgerDisplayPrefixContext', () => ({ useLedgerDisplayPrefixes: () => ({ prefixMap: new Map() }) }))
vi.mock('../lib/navClickTelemetry', () => ({ recordNavClick: () => {} }))

import ClockInOutButton from './ClockInOutButton'
import { renderWithProviders } from '../test/renderSmokeMocks'
import { outbox } from '../lib/offline/outboxState'
import { newPress } from '../lib/offline/outbox'
import { CLOCK_READ_OFFLINE_WORDS } from '../lib/offline/pendingSession'

function signal(up: boolean) {
  net.up = up
  if (up) delete (window.navigator as { onLine?: boolean }).onLine
  else Object.defineProperty(window.navigator, 'onLine', { configurable: true, get: () => false })
  window.dispatchEvent(new Event(up ? 'online' : 'offline'))
}

afterEach(async () => {
  signal(true)
  await outbox.clear()
})

describe('ClockInOutButton with presses kept on the phone', () => {
  it('draws the amber line and nothing under it says the press failed', async () => {
    renderWithProviders(<ClockInOutButton userId="user-1" userName="Robert" />)
    fireEvent.click(await screen.findByRole('button', { name: /Clock Out/i }))
    await screen.findByRole('heading', { name: 'Clock out' })

    await act(async () => {
      signal(false)
    })
    const readsBefore = net.clockReads
    fireEvent.click(screen.getByRole('button', { name: 'Complete clock out' }))

    await screen.findByText('Kept on the phone. It goes out when the signal is back.')
    expect((await screen.findByTestId('clock-press-line')).textContent).toMatch(/^Clock out pressed at \d{1,2}:\d{2} [AP]M · waiting to send$/)
    await screen.findByRole('button', { name: 'Clock In' })
    // Let anything the press set off run its course before looking.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })
    expect(document.body.textContent).not.toMatch(/nothing was saved/i)
    expect(screen.queryByTestId('clock-load-error')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull()
    // The press drew itself, so it set off no read of the clock to fail under it.
    expect(net.clockReads).toBe(readsBefore)
  })

  it('a Dashboard opened with no signal draws a clock-in kept on the phone as the open session, with its timer and Clock Out', async () => {
    // Back from the job window, or the app opened again, before the signal returns: no read lands.
    outbox.put(newPress({ id: 'press-in', seq: 1, kind: 'clock-in', userId: 'user-1', pressedAt: Date.now() - 5 * 60 * 1000, payload: { jobLedgerId: 'job-1', bidId: null, notes: 'Rough-in at ZZ Test', travel: null } }))
    signal(false)
    renderWithProviders(<ClockInOutButton userId="user-1" userName="Robert" />)

    await waitFor(() => expect(document.body.textContent).toContain(CLOCK_READ_OFFLINE_WORDS))
    expect((await screen.findByRole('button', { name: /^\d{2}:\d{2}:\d{2} Clock Out$/ })).textContent).toMatch(/^00:0[45]:\d{2} Clock Out$/)
    expect(screen.queryByRole('button', { name: 'Clock In' })).toBeNull()
    expect(screen.getByTestId('clock-press-line').textContent).toMatch(/^Clock in pressed at \d{1,2}:\d{2} [AP]M · waiting to send$/)
  })

  it('a read with no signal says so in the clock’s read words and reads again when the signal is back; a clock-out still waiting keeps the clock out', async () => {
    // A clock-out on s1 already on the phone, and no signal when the Dashboard opens.
    outbox.put(newPress({ id: 'press-out', seq: 1, kind: 'clock-out', userId: 'user-1', pressedAt: Date.now() - 10 * 60 * 1000, payload: { sessionId: 's1', sessionPressId: null, jobLedgerId: 'job-1', bidId: null, notes: 'Rough-in at ZZ Test' } }))
    signal(false)
    renderWithProviders(<ClockInOutButton userId="user-1" userName="Robert" />)

    await waitFor(() => expect(document.body.textContent).toContain(CLOCK_READ_OFFLINE_WORDS))
    expect(document.body.textContent).not.toMatch(/nothing was saved/i)
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy()
    expect(screen.getByTestId('clock-press-line').textContent).toMatch(/· waiting to send$/)

    // The signal returns before the clock-out lands: the read lands with the session still open on the server,
    // and the clock stays out, as the kept press says.
    const readsBefore = net.clockReads
    await act(async () => {
      signal(true)
    })
    await waitFor(() => expect(net.clockReads).toBeGreaterThan(readsBefore))
    await waitFor(() => expect(document.body.textContent).not.toContain(CLOCK_READ_OFFLINE_WORDS))
    expect(screen.queryByRole('button', { name: /Clock Out/i })).toBeNull()
    expect(screen.getByRole('button', { name: 'Clock In' })).toBeTruthy()
  })
})
