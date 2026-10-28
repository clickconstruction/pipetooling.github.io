// @vitest-environment jsdom
/**
 * The Job Mode press bar (punch list #189, PR 2, v2.5905): on a phone the day's press leaves the
 * card for a bar pinned above the tab bar. A routed supabase stub feeds today's blocks, the open
 * session and the visited jobs, as in the day-rail smoke; the viewport hook is mocked per case.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'

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
      if (table === 'jobs_ledger' && single) return Promise.resolve({ data: { pct_complete: 40, status: 'working' }, error: null, count: 0 })
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
import { JOB_MODE_PRESS_BAR_HEIGHT_PX } from './JobModePressBar'
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

/** A 375 px phone: the viewport hook answers narrow and the window is a phone's width. */
function phone(width = 375) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: width })
  scenario.phone = width <= 640
}

const minHeightPx = (el: HTMLElement) => Number.parseFloat(el.style.minHeight || '0')

afterEach(() => {
  cleanup()
  onLeaveReport.mockReset()
  onTurnaway.mockReset()
  document.documentElement.style.removeProperty('--job-mode-press-bar')
})

describe('DashboardJobModeCard — the press bar on a phone', { timeout: 15_000 }, () => {
  it('a helper clocked in mid-day: the bar holds its five buttons at 44 px or more, and the day’s press is drawn once', async () => {
    phone()
    Object.assign(scenario, { blocks: makeBlocks(), openSession: { id: 'sess-1', job_ledger_id: JOB_B, bid_id: null }, visited: [{ job_ledger_id: JOB_A }], role: 'helpers' })
    renderCard()
    await screen.findByText(/Today · 1 of 3 done/)
    const bar = await screen.findByTestId('job-mode-press-bar')
    expect(bar.style.position).toBe('fixed')
    expect(bar.style.bottom).toBe('var(--app-bottom-chrome, 0px)')
    expect(Number(bar.style.zIndex)).toBeGreaterThan(700)

    const turnaway = screen.getByTestId('job-mode-press-turnaway')
    const pct = screen.getByTestId('job-mode-press-pct-done')
    const clockOut = screen.getByTestId('job-mode-press-clock-out')
    const leave = screen.getByTestId('job-mode-press-leave-report')
    const day = screen.getByTestId('job-mode-press-day-press')
    expect(turnaway.textContent).toBe('Turnaway')
    expect(pct.textContent).toBe('% done')
    expect(clockOut.textContent).toBe('Clock out')
    expect(leave.textContent).toBe('Leave report')
    expect(day.textContent).toBe('On my way')
    for (const el of [turnaway, pct, clockOut]) expect(minHeightPx(el)).toBeGreaterThanOrEqual(44)
    for (const el of [leave, day]) expect(minHeightPx(el)).toBeGreaterThanOrEqual(56)
    expect(day.style.fontSize).toBe('16px')
    expect([turnaway, pct, clockOut, leave, day].every((el) => !(el as HTMLButtonElement).disabled)).toBe(true)

    // The day's press, Leave report and Clock out are not drawn twice: the card's grid and quiet link are gone.
    expect(screen.getAllByText(/On my\s*way/)).toHaveLength(1)
    expect(screen.getAllByText('Clock out')).toHaveLength(1)
    expect(screen.queryByText(/Leave\s*Report/)).toBeNull()
    expect(screen.queryByText(/Turnaway — not ready/)).toBeNull()

    // Layout reads the bar's height from the root while it is mounted.
    expect(document.documentElement.style.getPropertyValue('--job-mode-press-bar')).toBe(`${JOB_MODE_PRESS_BAR_HEIGHT_PX}px`)

    // The handlers are the card's own: Leave report and Turnaway hand the clocked-in job to the Dashboard's windows.
    fireEvent.click(leave)
    expect(onLeaveReport).toHaveBeenCalledWith(expect.objectContaining({ id: JOB_B, jobName: 'Smoke Job 2' }))
    fireEvent.click(turnaway)
    expect(onTurnaway).toHaveBeenCalledWith(expect.objectContaining({ id: JOB_B }))
  })

  it('a wrapped label grows the bar: the page pads by the bar’s measured height, not the designed one', async () => {
    phone(320)
    const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight')
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
      configurable: true,
      get(this: HTMLElement) {
        return this.dataset.testid === 'job-mode-press-bar' ? 171 : 0
      },
    })
    try {
      Object.assign(scenario, { blocks: makeBlocks(), openSession: { id: 'sess-1', job_ledger_id: JOB_B, bid_id: null }, visited: [], role: 'helpers' })
      renderCard()
      await screen.findByText(/Today · 0 of 3 done/)
      expect(screen.getByTestId('job-mode-press-bar').style.height).toBe('')
      expect(document.documentElement.style.getPropertyValue('--job-mode-press-bar')).toBe('171px')
    } finally {
      if (original) Object.defineProperty(HTMLElement.prototype, 'offsetHeight', original)
    }
  })

  it('% done opens the My Schedule stepper on the clocked-in job', async () => {
    phone()
    Object.assign(scenario, { blocks: makeBlocks(), openSession: { id: 'sess-1', job_ledger_id: JOB_B, bid_id: null }, visited: [], role: 'subcontractor' })
    renderCard()
    await screen.findByText(/Today · 0 of 3 done/)
    fireEvent.click(await screen.findByTestId('job-mode-press-pct-done'))
    const dialog = await screen.findByRole('dialog', { name: /Update % done for/ })
    expect(dialog.getAttribute('aria-label')).toContain('Smoke Job 2')
  })

  it('a master: % done is hidden, not dead; salaried: no Clock out; the last job: Wrap Up Day takes Clock out’s place', async () => {
    phone()
    Object.assign(scenario, { blocks: makeBlocks(), openSession: { id: 'sess-1', job_ledger_id: JOB_B, bid_id: null }, visited: [], role: 'master_technician' })
    renderCard()
    await screen.findByTestId('job-mode-press-clock-out')
    expect(screen.queryByTestId('job-mode-press-pct-done')).toBeNull()
    cleanup()

    Object.assign(scenario, { role: 'helpers' })
    renderCard(false)
    await screen.findByTestId('job-mode-press-pct-done')
    expect(screen.queryByTestId('job-mode-press-clock-out')).toBeNull()
    cleanup()

    Object.assign(scenario, { openSession: { id: 'sess-1', job_ledger_id: JOB_C, bid_id: null }, visited: [{ job_ledger_id: JOB_A }, { job_ledger_id: JOB_B }], role: 'helpers' })
    renderCard(true)
    await waitFor(() => expect(screen.getByTestId('job-mode-press-day-press').textContent).toBe('Wrap Up Day'))
    expect(screen.queryByTestId('job-mode-press-clock-out')).toBeNull()
    expect(screen.queryByText('Clock out')).toBeNull()
  })

  it('a job numbered in click_number (#197): Leave report and Turnaway carry that number, and a job with neither reads a dash', async () => {
    phone()
    const blocks = makeBlocks()
    blocks[1] = { ...blocks[1], jobs_ledger: { ...ledgerJoin(2), hcp_number: null, click_number: 'C-7042' } }
    blocks[2] = { ...blocks[2], jobs_ledger: { ...ledgerJoin(3), hcp_number: '  ', click_number: null } }
    Object.assign(scenario, { blocks, openSession: { id: 'sess-1', job_ledger_id: JOB_B, bid_id: null }, visited: [{ job_ledger_id: JOB_A }], role: 'helpers' })
    renderCard()
    await screen.findByText(/Today · 1 of 3 done/)
    fireEvent.click(screen.getByTestId('job-mode-press-leave-report'))
    expect(onLeaveReport).toHaveBeenCalledWith({ id: JOB_B, hcpNumber: 'C-7042', jobName: 'Smoke Job 2', jobAddress: '2 Test St' })
    fireEvent.click(screen.getByTestId('job-mode-press-turnaway'))
    expect(onTurnaway).toHaveBeenCalledWith(expect.objectContaining({ id: JOB_B, hcpNumber: 'C-7042' }))
    cleanup()
    onLeaveReport.mockReset()
    Object.assign(scenario, { blocks, openSession: { id: 'sess-2', job_ledger_id: JOB_C, bid_id: null }, visited: [{ job_ledger_id: JOB_A }, { job_ledger_id: JOB_B }], role: 'helpers' })
    renderCard()
    await screen.findByText(/Today · 2 of 3 done/)
    fireEvent.click(screen.getByTestId('job-mode-press-leave-report'))
    expect(onLeaveReport).toHaveBeenCalledWith(expect.objectContaining({ id: JOB_C, hcpNumber: '—' }))
  })

  it('not clocked in: Turnaway and Leave report are dead, % done and Clock out hidden, On my way stands', async () => {
    phone()
    Object.assign(scenario, { blocks: makeBlocks(), openSession: null, visited: [], role: 'helpers' })
    renderCard()
    await screen.findByText('Ready to start')
    const turnaway = screen.getByTestId('job-mode-press-turnaway') as HTMLButtonElement
    const leave = screen.getByTestId('job-mode-press-leave-report') as HTMLButtonElement
    expect(turnaway.disabled).toBe(true)
    expect(leave.disabled).toBe(true)
    expect(leave.title).toBe('Start a job first.')
    expect(screen.queryByTestId('job-mode-press-pct-done')).toBeNull()
    expect(screen.queryByTestId('job-mode-press-clock-out')).toBeNull()
    expect(screen.getByTestId('job-mode-press-day-press').textContent).toBe('On my way')
  })

  it('a wider screen keeps the card as it was: the grid in the card, the quiet Clock out, no bar', async () => {
    phone(1024)
    Object.assign(scenario, { blocks: makeBlocks(), openSession: { id: 'sess-1', job_ledger_id: JOB_B, bid_id: null }, visited: [], role: 'helpers' })
    renderCard()
    await screen.findByText(/Today · 0 of 3 done/)
    expect(screen.queryByTestId('job-mode-press-bar')).toBeNull()
    expect(screen.getByRole('button', { name: 'Leave Report' }).textContent).toMatch(/Leave\s*Report/)
    expect(screen.getByRole('button', { name: 'Turnaway — client not home or site not ready' }).textContent).toBe('Turnaway — not ready / not home')
    expect(screen.getAllByText(/On my\s*way/)).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Clock out' }).style.minHeight).toBe('')
    expect(document.documentElement.style.getPropertyValue('--job-mode-press-bar')).toBe('')
  })
})
