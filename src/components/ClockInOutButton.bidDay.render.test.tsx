// @vitest-environment jsdom
/**
 * The bids of the day in the Clock out sheet (punch list #445). For an estimator with a session open, the sheet
 * reads the day and lists the bid they changed and the bid they only opened. With a bid on the list the note is
 * extra, the press is live at once and says its count. A tick takes the bid off, and with no bid left the sheet asks
 * for the note as it always has. A tick on the opened bid adds it. For a helper with no bid in the day the sheet
 * shows no list at all.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { todayYmdInAppTz } from '../utils/dateUtils'

const h = vi.hoisted(() => ({ role: 'estimator', day: null as unknown }))

const B412 = '0b1d0000-0000-4000-8000-00000000b412'
const B431 = '0b1d0000-0000-4000-8000-00000000b431'
const clockIn = new Date(Date.now() - 3 * 60 * 60 * 1000)
const at = (minutesAfterClockIn: number) => new Date(Math.floor((clockIn.getTime() + minutesAfterClockIn * 60_000) / 300_000) * 300_000).toISOString()
const session = { id: 's1', user_id: 'smoke', clocked_in_at: clockIn.toISOString(), clocked_out_at: null, work_date: todayYmdInAppTz(), notes: '', job_ledger_id: null, bid_id: null, origin: 'user_punch' }
const dayWithBids = {
  day: todayYmdInAppTz(),
  from: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
  to: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
  now: new Date().toISOString(),
  changes: [{ bid_id: B412, at: at(30), own: 4, app: 0, tables: ['bid_pricing_assignments'] }],
  beats: [
    { bid_id: B412, tab: 'pricing', at: at(30), seconds: 300 },
    { bid_id: B431, tab: 'counts', at: at(90), seconds: 300 },
  ],
  kept: [],
  sessions: [{ in: clockIn.toISOString(), out: null }],
  bids: [
    { id: B412, bid_number: '412', project_name: 'ZZ Test Ridgeway Clinic', service_type_id: null },
    { id: B431, bid_number: '431', project_name: 'ZZ Test Orchard School', service_type_id: null },
  ],
}
const emptyDay = { ...dayWithBids, changes: [], beats: [], bids: [] }

function table(rows: unknown[]) {
  const make = (single: boolean): Record<string, unknown> => {
    const b: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'neq', 'is', 'in', 'gte', 'lte', 'lt', 'gt', 'or', 'not', 'order', 'limit', 'update', 'insert', 'delete']) b[m] = () => b
    b.single = () => make(true)
    b.maybeSingle = () => make(true)
    const result = () => Promise.resolve(single ? { data: rows[0] ?? null, error: null } : { data: rows, error: null })
    b.then = (ok?: (v: unknown) => unknown, bad?: (e: unknown) => unknown) => result().then(ok, bad)
    return b
  }
  return make(false)
}

vi.mock('../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../test/renderSmokeMocks')
  const stub = makeSupabaseStub() as Record<string, unknown> & { from: (t: string) => unknown; rpc: (fn: string, args?: unknown) => unknown }
  const originalFrom = stub.from.bind(stub)
  const originalRpc = stub.rpc.bind(stub)
  return {
    supabase: {
      ...stub,
      from: (t: string) => (t === 'clock_sessions' ? table([session]) : originalFrom(t)),
      rpc: (fn: string, args?: unknown) => (fn === 'get_my_bid_day' ? Promise.resolve({ data: h.day, error: null }) : originalRpc(fn, args)),
    },
  }
})
vi.mock('../hooks/useAuth', async () => {
  const { makeUseAuthValue } = await import('../test/renderSmokeMocks')
  const useAuth = () => makeUseAuthValue({ role: h.role })
  return { useAuth, useOptionalAuth: useAuth, AuthProvider: ({ children }: { children: unknown }) => children }
})
vi.mock('../contexts/DailyGoalsGateContext', () => ({ useDailyGoalsGate: () => ({ notifyFirstClockInOfDay: vi.fn() }) }))
vi.mock('../contexts/UpdateFocusOpenerBridgeContext', () => ({
  useUpdateFocusOpenerBridge: () => ({ registerUpdateFocusOpener: () => () => {}, registerUpdateFocusApplyDirect: () => () => {}, registerClockOutOpener: () => () => {}, notifySessionChanged: () => {} }),
}))
vi.mock('../contexts/LedgerDisplayPrefixContext', () => ({ useLedgerDisplayPrefixes: () => ({ prefixMap: new Map() }) }))
vi.mock('../lib/navClickTelemetry', () => ({ recordNavClick: () => {} }))

import ClockInOutButton from './ClockInOutButton'
import { SMOKE_AUTH_USER_ID, renderWithProviders } from '../test/renderSmokeMocks'

async function openSheet() {
  renderWithProviders(<ClockInOutButton userId={SMOKE_AUTH_USER_ID} userName="ZZ Test Estimator" />)
  fireEvent.click(await screen.findByRole('button', { name: /Clock Out/i }))
  await screen.findByRole('heading', { name: 'Clock out' })
}
const press = () => screen.getByRole('button', { name: /^Complete clock out/ }) as HTMLButtonElement

describe('ClockInOutButton, the bids of the day', () => {
  beforeEach(() => {
    h.role = 'estimator'
    h.day = dayWithBids
  })

  it('lists the day with nothing to type, and a tick takes a bid off or adds one', async () => {
    await openSheet()
    await screen.findByText('Bids you worked on today')
    expect(screen.getByText('B412 · ZZ Test Ridgeway Clinic')).toBeTruthy()
    expect(screen.getAllByText('5 minutes')).toHaveLength(2)
    expect(screen.getByText('Opened, nothing changed')).toBeTruthy()
    expect(screen.getByText('Grey is time the app did not see.')).toBeTruthy()
    // With a bid on the list the note is extra and the press is live at once.
    expect(screen.getByText('Anything else?')).toBeTruthy()
    expect(press().disabled).toBe(false)
    expect(press().textContent).toBe('Complete clock out · 1 bid')

    // Taken off: the row stays, struck through, and the sheet asks for the note as it always has.
    fireEvent.click(screen.getByRole('checkbox', { name: 'Take off B412 · ZZ Test Ridgeway Clinic' }))
    expect(screen.getByText('Taken off')).toBeTruthy()
    expect(screen.getByText('What did you work on?')).toBeTruthy()
    expect(press().disabled).toBe(true)
    expect(press().textContent).toBe('Complete clock out')

    // One more press puts it back, and a tick on the opened bid adds it.
    fireEvent.click(screen.getByRole('checkbox', { name: 'Put back B412 · ZZ Test Ridgeway Clinic' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Add B431 · ZZ Test Orchard School' }))
    expect(screen.queryByText('Opened, nothing changed')).toBeNull()
    expect(press().textContent).toBe('Complete clock out · 2 bids')
  })

  it('with a bid on the list the box may stay empty and says so only while it is empty; opened on the plan, it names the plan (punch list #445)', async () => {
    await openSheet()
    await screen.findByText('Bids you worked on today')
    expect(screen.getByText('You can leave this empty.')).toBeTruthy()
    fireEvent.change(screen.getByLabelText(/Anything else\?/), { target: { value: 'A site walk' } })
    expect(screen.queryByText('You can leave this empty.')).toBeNull()
    cleanup()

    session.notes = 'Price the ZZ Test clinic'
    try {
      await openSheet()
      await screen.findByText('Bids you worked on today')
      expect((screen.getByLabelText(/Anything else\?/) as HTMLTextAreaElement).value).toBe('Price the ZZ Test clinic')
      expect(screen.getByText('From your plan at clock in. Change it or leave it.')).toBeTruthy()
      expect(screen.queryByText('You can leave this empty.')).toBeNull()
      expect(press().textContent).toBe('Complete clock out · 1 bid')
    } finally {
      session.notes = ''
    }
  })

  it('says so on a day the app saw nothing, and asks an estimator for the note', async () => {
    h.day = emptyDay
    await openSheet()
    await screen.findByText('The app saw no bid today.')
    expect(screen.getByText('What did you work on?')).toBeTruthy()
    expect(press().disabled).toBe(true)
  })

  it('shows no list to a helper whose day holds no bid', async () => {
    h.role = 'helpers'
    h.day = emptyDay
    await openSheet()
    await waitFor(() => expect(screen.getByPlaceholderText('e.g. Trim set at 456 Oak Ave')).toBeTruthy())
    expect(screen.queryByText('Bids you worked on today')).toBeNull()
    expect(screen.queryByText('The app saw no bid today.')).toBeNull()
  })
})
