// @vitest-environment jsdom
/**
 * Punch list #228 (v2.6198's live check on clicktooling.com, 2026-10-31): a clock-out pressed with no signal was kept
 * and landed, but the session it closed lost its job and its hours read *No Job or Bid*. The clock-out window opens
 * with an empty pick and reads the session's job from the server; with no signal that read fails, the kept press
 * carried `jobLedgerId: null`, and the server wrote it over the job. The window's Clear removes the job on purpose,
 * so the rule is: the press carries the person's pick when they picked a job or bid or pressed Clear, else the
 * session's own job and bid (`lib/clock/clockOutJob.ts`). These smokes cut the signal, press Complete clock out and
 * read the press kept on the phone.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, screen } from '@testing-library/react'
import { todayYmdInAppTz } from '../utils/dateUtils'

const net = { up: true }
const clockedInAt = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
/** The open session, mutated between cases: on a job, or on a bid. */
const session = { id: 's1', user_id: 'user-1', clocked_in_at: clockedInAt, clocked_out_at: null, work_date: todayYmdInAppTz(), notes: 'Rough-in at ZZ Test', job_ledger_id: 'job-1' as string | null, bid_id: null as string | null, origin: 'user_punch' }
const otherJob = { id: 'job-2', hcp_number: '2002', click_number: null, job_name: 'ZZ Test Two', job_address: '2 Test Lane', service_type_id: null, service_type_name: null }

/** Every read answers while the signal is up and fails at the fetch layer while it is down, as supabase-js reports a rejected fetch. */
function table(rows: () => unknown[]) {
  const make = (single: boolean): Record<string, unknown> => {
    const b: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'neq', 'is', 'in', 'gte', 'lte', 'lt', 'gt', 'or', 'not', 'order', 'limit', 'range', 'update', 'insert', 'upsert', 'delete']) b[m] = () => b
    b.single = () => make(true)
    b.maybeSingle = () => make(true)
    const result = () => {
      if (!net.up) return Promise.resolve({ data: null, error: { message: 'TypeError: Failed to fetch', details: '', hint: '', code: '' }, status: 0 })
      const list = rows()
      return Promise.resolve(single ? { data: list[0] ?? null, error: null, status: 200 } : { data: list, error: null, status: 200 })
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
      from: (t: string) => (t === 'clock_sessions' ? table(() => [session]) : table(() => [])),
      // The window's search: one other ZZ job answers any words.
      rpc: (name: string) => (name === 'search_jobs_ledger' ? table(() => [otherJob]) : table(() => [])),
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
import type { ClockOutPayload } from '../lib/offline/outbox'

function signal(up: boolean) {
  net.up = up
  if (up) delete (window.navigator as { onLine?: boolean }).onLine
  else Object.defineProperty(window.navigator, 'onLine', { configurable: true, get: () => false })
  window.dispatchEvent(new Event(up ? 'online' : 'offline'))
}

/** The one clock-out press kept on the phone, with what it carries. */
function keptClockOut(): ClockOutPayload {
  const presses = outbox.presses().filter((p) => p.kind === 'clock-out')
  expect(presses).toHaveLength(1)
  return presses[0]!.payload as ClockOutPayload
}

/** Open the clock-out window on the open session; with the signal down its reads fail and it opens with an empty pick. */
async function openClockOut() {
  renderWithProviders(<ClockInOutButton userId="user-1" userName="Robert" />)
  const out = await screen.findByRole('button', { name: /Clock Out/i })
  await act(async () => {
    fireEvent.click(out)
  })
  await screen.findByRole('heading', { name: 'Clock out' })
  // Let the window's own reads settle (the job it tries to read back, the day's reports).
  await act(async () => {
    await new Promise((r) => setTimeout(r, 50))
  })
}

async function complete() {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Complete clock out' }))
  })
  await screen.findByText('Kept on the phone. It goes out when the signal is back.')
}

beforeEach(() => {
  session.job_ledger_id = 'job-1'
  session.bid_id = null
  // A pick an earlier case completed with would come back as the window's Use last press.
  localStorage.clear()
})

afterEach(async () => {
  cleanup()
  signal(true)
  await outbox.clear()
})

describe('a clock-out kept with no signal keeps the session’s job (punch list #228)', () => {
  it('opened with no signal, so its job never loaded: the kept press carries the session’s job', async () => {
    renderWithProviders(<ClockInOutButton userId="user-1" userName="Robert" />)
    await screen.findByRole('button', { name: /Clock Out/i })
    await act(async () => {
      signal(false)
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Clock Out/i }))
    })
    await screen.findByRole('heading', { name: 'Clock out' })
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })
    await complete()
    // Before the fix the press carried jobLedgerId: null and the server wrote it over the session's job.
    expect(keptClockOut()).toMatchObject({ sessionId: 's1', jobLedgerId: 'job-1', bidId: null, notes: 'Rough-in at ZZ Test' })
  })

  it('on a bid the same way: the kept press carries the session’s bid', async () => {
    session.job_ledger_id = null
    session.bid_id = 'bid-1'
    renderWithProviders(<ClockInOutButton userId="user-1" userName="Robert" />)
    await screen.findByRole('button', { name: /Clock Out/i })
    await act(async () => {
      signal(false)
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Clock Out/i }))
    })
    await screen.findByRole('heading', { name: 'Clock out' })
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })
    await complete()
    expect(keptClockOut()).toMatchObject({ sessionId: 's1', jobLedgerId: null, bidId: 'bid-1' })
  })

  it('the person picked another job before the signal went: the kept press carries that job', async () => {
    await openClockOut()
    fireEvent.change(screen.getByPlaceholderText('Search to choose other job or bid'), { target: { value: 'ZZ' } })
    fireEvent.click(await screen.findByRole('button', { name: 'J2002 · ZZ Test Two - 2 Test Lane' }))
    await act(async () => {
      signal(false)
    })
    await complete()
    expect(keptClockOut()).toMatchObject({ sessionId: 's1', jobLedgerId: 'job-2', bidId: null })
  })

  it('the person pressed Clear: the kept press carries no job, since Clear removes it on purpose', async () => {
    await openClockOut()
    fireEvent.change(screen.getByPlaceholderText('Search to choose other job or bid'), { target: { value: 'ZZ' } })
    fireEvent.click(await screen.findByRole('button', { name: 'J2002 · ZZ Test Two - 2 Test Lane' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Clear' }))
    await act(async () => {
      signal(false)
    })
    await complete()
    expect(keptClockOut()).toMatchObject({ sessionId: 's1', jobLedgerId: null, bidId: null })
  })
})
