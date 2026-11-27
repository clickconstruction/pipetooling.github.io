// @vitest-environment jsdom
/**
 * The clock's two note boxes and the presses under them (punch list #446, v2.8624): Complete Clock In is dead while
 * the plan box is empty, drawn with the dead press's pair, with a line under the box that says what brings it alive,
 * and comes alive as the person types; the clock-out review's press the same with its own line. Before, the clock-in
 * press stood live and refused by a toast, and the clock-out press was dead with no word of why.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { todayYmdInAppTz } from '../utils/dateUtils'

const state = { session: null as null | Record<string, unknown> }
const openSession = { id: 's1', user_id: 'user-1', clocked_in_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(), clocked_out_at: null, work_date: todayYmdInAppTz(), notes: '', job_ledger_id: 'job-1', bid_id: null, origin: 'user_punch', approved_at: null, rejected_at: null }

function table(rows: () => unknown[]) {
  const make = (single: boolean): Record<string, unknown> => {
    const b: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'neq', 'is', 'in', 'gte', 'lte', 'lt', 'gt', 'or', 'not', 'order', 'limit', 'range', 'update', 'insert', 'upsert', 'delete']) b[m] = () => b
    b.single = () => make(true)
    b.maybeSingle = () => make(true)
    b.then = (ok?: (v: unknown) => unknown, bad?: (e: unknown) => unknown) => {
      const r = rows()
      return Promise.resolve(single ? { data: r[0] ?? null, error: null, status: 200 } : { data: r, error: null, status: 200 }).then(ok, bad)
    }
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
      from: (t: string) => (t === 'clock_sessions' ? table(() => (state.session ? [state.session] : [])) : table(() => [])),
      rpc: () => table(() => []),
    },
  }
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
import { DEAD_PRESS_FILL } from '../lib/deadPress'

afterEach(() => {
  cleanup()
  state.session = null
})

describe('ClockInOutButton · the note boxes and their presses', () => {
  it('Complete Clock In is dead with the plan box empty, says what fills it, and comes alive as the person types', async () => {
    renderWithProviders(<ClockInOutButton userId="user-1" userName="Robert" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Clock In' }))
    await screen.findByRole('heading', { name: 'Ready to clock in?' })
    const press = screen.getByRole('button', { name: 'Complete Clock In' }) as HTMLButtonElement
    expect(press.disabled).toBe(true)
    expect(press.style.background).toBe(DEAD_PRESS_FILL)
    expect(press.style.cursor).toBe('not-allowed')
    expect(screen.getByText('Say what you mean to get done today, then Complete Clock In.')).toBeTruthy()
    // The sheet asks which job or bid the time is charged to. It read *change* (finding 296).
    expect(screen.getByText('What job or bid should we charge for your time?')).toBeTruthy()
    expect(screen.queryByText(/should we change for your time/)).toBeNull()
    const box = screen.getByLabelText(/What do you plan to accomplish\?/) as HTMLTextAreaElement
    fireEvent.change(box, { target: { value: '   ' } })
    expect(press.disabled).toBe(true)
    fireEvent.change(box, { target: { value: 'Rough-in at the ZZ Test job' } })
    expect(press.disabled).toBe(false)
    expect(press.style.background).not.toBe(DEAD_PRESS_FILL)
    expect(screen.queryByText('Say what you mean to get done today, then Complete Clock In.')).toBeNull()
    // Emptied again: dead again, with the line back.
    fireEvent.change(box, { target: { value: '' } })
    expect(press.disabled).toBe(true)
    expect(screen.getByText('Say what you mean to get done today, then Complete Clock In.')).toBeTruthy()
  })

  it('the clock-out review’s press is dead with its box empty, says what fills it, and comes alive with a word', async () => {
    state.session = openSession
    renderWithProviders(<ClockInOutButton userId="user-1" userName="Robert" />)
    fireEvent.click(await screen.findByRole('button', { name: /Clock Out/i }))
    await screen.findByRole('heading', { name: 'Clock out' })
    const press = screen.getByRole('button', { name: 'Complete clock out' }) as HTMLButtonElement
    expect(press.disabled).toBe(true)
    expect(press.style.background).toBe(DEAD_PRESS_FILL)
    expect(screen.getByText('Say what you worked on today, then Complete clock out.')).toBeTruthy()
    fireEvent.change(screen.getByLabelText(/What did you work on\?/), { target: { value: 'Trim set' } })
    expect(press.disabled).toBe(false)
    expect(press.style.background).not.toBe(DEAD_PRESS_FILL)
    expect(screen.queryByText('Say what you worked on today, then Complete clock out.')).toBeNull()
  })

  it('a review that opens on the plan typed at clock in says so, until the person changes a letter (punch list #445)', async () => {
    state.session = { ...openSession, notes: 'Rough-in at the ZZ Test job' }
    renderWithProviders(<ClockInOutButton userId="user-1" userName="Robert" />)
    fireEvent.click(await screen.findByRole('button', { name: /Clock Out/i }))
    await screen.findByRole('heading', { name: 'Clock out' })
    const box = screen.getByLabelText(/What did you work on\?/) as HTMLTextAreaElement
    expect(box.value).toBe('Rough-in at the ZZ Test job')
    expect(screen.getByText('From your plan at clock in. Change it or leave it.')).toBeTruthy()
    // One press still clocks out: the plan in the box is the note.
    expect((screen.getByRole('button', { name: 'Complete clock out' }) as HTMLButtonElement).disabled).toBe(false)
    expect(screen.queryByText('Say what you worked on today, then Complete clock out.')).toBeNull()
    fireEvent.change(box, { target: { value: 'Rough-in at the ZZ Test job, and the trim' } })
    expect(screen.queryByText('From your plan at clock in. Change it or leave it.')).toBeNull()
    // Typed back to the plan, letter for letter, the box holds the plan again.
    fireEvent.change(box, { target: { value: 'Rough-in at the ZZ Test job' } })
    expect(screen.getByText('From your plan at clock in. Change it or leave it.')).toBeTruthy()
  })

  it('a review that opens on the note a Job Mode start wrote names no plan', async () => {
    state.session = { ...openSession, notes: 'On my way to J1007 · ZZ Test Clinic, about 12 min' }
    renderWithProviders(<ClockInOutButton userId="user-1" userName="Robert" />)
    fireEvent.click(await screen.findByRole('button', { name: /Clock Out/i }))
    await screen.findByRole('heading', { name: 'Clock out' })
    expect((screen.getByLabelText(/What did you work on\?/) as HTMLTextAreaElement).value).toBe('On my way to J1007 · ZZ Test Clinic, about 12 min')
    expect(screen.queryByText('From your plan at clock in. Change it or leave it.')).toBeNull()
    expect((screen.getByRole('button', { name: 'Complete clock out' }) as HTMLButtonElement).disabled).toBe(false)
  })
})
