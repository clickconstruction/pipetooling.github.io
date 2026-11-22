// @vitest-environment jsdom
/**
 * The Job Mode card under the new phone layout (`lib/phoneLayout`): one tick per device, off until someone
 * ticks it, and only ever on at a phone's width. A routed supabase stub feeds today's blocks, the open session
 * and the visited jobs, as in the press bar smoke; the viewport hook is mocked per case and the tick is the
 * device's stored one.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'

const JOB_A = '00000000-0000-0000-0000-00000000aaaa'
const JOB_B = '00000000-0000-0000-0000-00000000bbbb'
const JOB_C = '00000000-0000-0000-0000-00000000cccc'

const scenario: {
  blocks: Array<Record<string, unknown>>
  openSession: Record<string, unknown> | null
  visited: Array<{ job_ledger_id: string }>
  role: string
  phone: boolean
} = { blocks: [], openSession: null, visited: [], role: 'helpers', phone: true }

function ledgerJoin(n: number) {
  return { hcp_number: `${500 + n}`, click_number: null, job_name: `Smoke Job ${n}`, job_address: `${n} Test St`, service_type_id: null }
}

function makeBlocks(): Array<Record<string, unknown>> {
  return [
    { id: 'blk-1', job_id: JOB_A, time_start: '08:00', time_end: '10:00', jobs_ledger: ledgerJoin(1) },
    { id: 'blk-2', job_id: JOB_B, time_start: '10:30', time_end: '13:00', jobs_ledger: ledgerJoin(2) },
    { id: 'blk-3', job_id: JOB_C, time_start: '14:00', time_end: '17:00', jobs_ledger: ledgerJoin(3) },
  ]
}

vi.mock('../../lib/supabase', () => {
  function makeBuilder(table: string) {
    let single = false
    const builder: Record<string, unknown> = {}
    for (const m of ['select', 'insert', 'update', 'eq', 'neq', 'is', 'in', 'or', 'not', 'order', 'range', 'limit', 'abortSignal', 'filter']) builder[m] = () => builder
    builder.single = () => { single = true; return builder }
    builder.maybeSingle = () => { single = true; return builder }
    const result = () => {
      if (table === 'job_schedule_blocks') return Promise.resolve({ data: scenario.blocks, error: null, count: 0 })
      if (table === 'clock_sessions') {
        return single
          ? Promise.resolve({ data: scenario.openSession, error: null, count: 0 })
          : Promise.resolve({ data: scenario.visited, error: null, count: 0 })
      }
      return Promise.resolve({ data: single ? null : [], error: null, count: 0 })
    }
    builder.then = (f?: (v: unknown) => unknown, r?: (e: unknown) => unknown) => result().then(f, r)
    builder.catch = (r?: (e: unknown) => unknown) => result().catch(r)
    builder.finally = (f?: () => void) => result().finally(f)
    return builder
  }
  const channel = () => {
    const ch: Record<string, unknown> = {}
    ch.on = () => ch
    ch.subscribe = () => ch
    ch.unsubscribe = () => Promise.resolve('ok')
    return ch
  }
  return {
    supabase: {
      from: (table: string) => makeBuilder(table),
      rpc: () => makeBuilder('__rpc__'),
      channel,
      removeChannel: () => {},
      functions: { invoke: () => Promise.resolve({ data: null, error: null }) },
      auth: {
        getSession: () => Promise.resolve({ data: { session: null }, error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      },
    },
  }
})

vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' }, role: scenario.role, profileName: 'Luis Ortega' }) }))
vi.mock('../../hooks/useNarrowViewport640', () => ({ useNarrowViewport640: () => scenario.phone }))

import { renderWithProviders } from '../../test/renderSmokeMocks'
import { UpdateFocusOpenerBridgeProvider } from '../../contexts/UpdateFocusOpenerBridgeContext'
import { LedgerDisplayPrefixProvider } from '../../contexts/LedgerDisplayPrefixContext'
import { NEW_PHONE_LAYOUT_STORAGE_KEY } from '../../lib/phoneLayout/newPhoneLayout'
import DashboardJobModeCard from './DashboardJobModeCard'

const onLeaveReport = vi.fn()
const onTurnaway = vi.fn()

function renderCard(canClockOut = true) {
  return renderWithProviders(
    <UpdateFocusOpenerBridgeProvider>
      <LedgerDisplayPrefixProvider authUserId="u1">
        <DashboardJobModeCard userId="u1" onLeaveReport={onLeaveReport} onTurnaway={onTurnaway} canClockOut={canClockOut} />
      </LedgerDisplayPrefixProvider>
    </UpdateFocusOpenerBridgeProvider>,
  )
}

/** The device's tick and the screen's width: the two halves of the one rule. */
function device(opts: { switchOn: boolean; phone: boolean }) {
  scenario.phone = opts.phone
  if (opts.switchOn) localStorage.setItem(NEW_PHONE_LAYOUT_STORAGE_KEY, '1')
  else localStorage.removeItem(NEW_PHONE_LAYOUT_STORAGE_KEY)
}

const clockedInMidDay = () => Object.assign(scenario, { blocks: makeBlocks(), openSession: { id: 'sess-1', job_ledger_id: JOB_B, bid_id: null }, visited: [{ job_ledger_id: JOB_A }], role: 'helpers' })

beforeEach(() => localStorage.clear())
afterEach(() => {
  cleanup()
  localStorage.clear()
  onLeaveReport.mockReset()
  onTurnaway.mockReset()
  document.documentElement.style.removeProperty('--job-mode-press-bar')
})

describe('DashboardJobModeCard: the press bar under the new phone layout', { timeout: 15_000 }, () => {
  it('switch on, on a phone: the five buttons share one row and run the card’s own presses', async () => {
    device({ switchOn: true, phone: true })
    clockedInMidDay()
    renderCard()
    await screen.findByText(/Today · 1 of 3 done/)
    const bar = await screen.findByTestId('job-mode-press-bar')
    expect(bar.getAttribute('data-one-row')).toBe('true')
    const ids = Array.from(bar.children).map((el) => (el as HTMLElement).dataset.testid)
    expect(ids).toEqual(['job-mode-press-turnaway', 'job-mode-press-pct-done', 'job-mode-press-clock-out', 'job-mode-press-leave-report', 'job-mode-press-day-press'])
    expect(screen.getByTestId('job-mode-press-day-press').textContent).toBe('On my way')

    fireEvent.click(screen.getByTestId('job-mode-press-leave-report'))
    expect(onLeaveReport).toHaveBeenCalledWith(expect.objectContaining({ id: JOB_B, jobName: 'Smoke Job 2' }))
    fireEvent.click(screen.getByTestId('job-mode-press-turnaway'))
    expect(onTurnaway).toHaveBeenCalledWith(expect.objectContaining({ id: JOB_B }))
  })

  it('switch off, on a phone: the bar is its two rows, as it was', async () => {
    device({ switchOn: false, phone: true })
    clockedInMidDay()
    renderCard()
    await screen.findByText(/Today · 1 of 3 done/)
    const bar = await screen.findByTestId('job-mode-press-bar')
    expect(bar.hasAttribute('data-one-row')).toBe(false)
    expect(bar.children).toHaveLength(2)
    expect(bar.children[0]!.children).toHaveLength(3)
    expect(bar.children[1]!.children).toHaveLength(2)
  })

  it('switch on, at a desk: no bar, and the card’s own grid of presses, as it was', async () => {
    device({ switchOn: true, phone: false })
    clockedInMidDay()
    renderCard()
    await screen.findByText(/Today · 1 of 3 done/)
    expect(screen.queryByTestId('job-mode-press-bar')).toBeNull()
    expect(screen.getByRole('button', { name: 'Leave Report' }).textContent).toMatch(/Leave\s*Report/)
    expect(screen.getByRole('button', { name: 'Turnaway — client not home or site not ready' })).toBeTruthy()
  })

  it('at a desk the card is the same markup whether or not the device has the tick', async () => {
    const draw = async (switchOn: boolean) => {
      device({ switchOn, phone: false })
      clockedInMidDay()
      const { container } = renderCard()
      await screen.findByText(/Today · 1 of 3 done/)
      await screen.findByRole('button', { name: 'Leave Report' })
      const html = container.innerHTML.replace(/:r[0-9a-z]+:/g, ':id:')
      cleanup()
      return html
    }
    expect(await draw(true)).toBe(await draw(false))
  })
})
