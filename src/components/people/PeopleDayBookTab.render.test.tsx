// @vitest-environment jsdom
/**
 * Render smoke for People → Day book (to-dos/day-book): the three viewer shapes
 * the RPC can answer with (payroll viewer with the person select and amounts;
 * a self-only viewer with neither), the deploy window before the migration is
 * pushed, and today's "left" figure riding on a line.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { APP_CALENDAR_TZ } from '../../utils/dateUtils'
import { dayBookMonthOf } from '../../lib/people/dayBookRhythm'

type RpcResult = { data: unknown; error: { message?: string } | null }
const H = vi.hoisted(() => ({ rpc: vi.fn(async (_fn?: unknown, _args?: unknown): Promise<RpcResult> => ({ data: null, error: null })) }))

vi.mock('../../lib/supabase', () => ({ supabase: { rpc: H.rpc } }))
vi.mock('../../hooks/usePendingHoursApprovalsNudge', () => ({
  usePendingHoursApprovalsNudge: () => ({ approvals: { sessions: 48, totalHours: 200, people: 9, oldestAgeDays: 3 }, refresh: () => {} }),
}))
vi.mock('../../hooks/useArBankUnallocatedCount', () => ({ useArBankUnallocatedCount: () => ({ count: 1, refetch: async () => {} }) }))
vi.mock('../../hooks/useJobContractsNudge', () => ({ useJobContractsNudge: () => ({ nudge: null }) }))

import PeopleDayBookTab from './PeopleDayBookTab'

const parts = new Intl.DateTimeFormat('en-US', { timeZone: APP_CALENDAR_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date())
const get = (k: string) => parts.find((x) => x.type === k)?.value ?? ''
const today = `${get('year')}-${get('month')}-${get('day')}`
const payload = (over: Record<string, unknown>) => ({
  from: '2026-09-14',
  to: '2026-09-20',
  viewer: { can_see_money: true, can_pick_person: true, user_id: 'u-robert' },
  users: [
    { id: 'u-taunya', name: 'Taunya', role: 'assistant' },
    { id: 'u-jordan', name: 'Jordan', role: 'assistant' },
  ],
  jobs: [
    { id: 'job-102', hcp_number: '102', click_number: null, job_name: 'Halvorsen' },
    { id: 'job-258', hcp_number: '258', click_number: null, job_name: 'Dudley Mason' },
  ],
  ref_people: [],
  sessions: [{ user_id: 'u-taunya', work_date: today, clocked_in_at: `${today}T12:52:00Z`, clocked_out_at: null, on_bid: false, note: 'bids and office' }],
  events: [
    { actor_user_id: 'u-taunya', at: `${today}T14:00:00Z`, day: today, kind: 'billed', ref_type: 'job', ref_id: 'job-102', amount_usd: 5355, detail: { invoice_id: 'a' } },
    { actor_user_id: 'u-taunya', at: `${today}T14:10:00Z`, day: today, kind: 'billed', ref_type: 'job', ref_id: 'job-258', amount_usd: 8845, detail: { invoice_id: 'b' } },
    { actor_user_id: 'u-taunya', at: `${today}T15:00:00Z`, day: today, kind: 'approval', ref_type: 'person', ref_id: 'p-1', amount_usd: null, detail: { hours: 8 } },
  ],
  system_counts: [{ day: today, kind: 'billed', n: 2 }],
  ...over,
})

beforeEach(() => {
  H.rpc.mockReset()
  H.rpc.mockImplementation(async () => ({ data: payload({}), error: null }))
})
afterEach(cleanup)

describe('PeopleDayBookTab', () => {
  it('a payroll viewer gets the person select, amounts, the system count and today’s left figure', async () => {
    renderWithProviders(<PeopleDayBookTab authUserId="u-robert" authRole="dev" canPickPerson />)
    await waitFor(() => expect(screen.getByText('Billed 2')).toBeTruthy())
    expect(screen.getByLabelText('Person')).toBeTruthy()
    expect(screen.getAllByText('$14,200')).toHaveLength(2) // the line and the range tile
    expect(screen.getByText(/and 2 more by the system/)).toBeTruthy()
    expect(screen.getByText(/48 still waiting/)).toBeTruthy()
    expect(screen.getByText(/Taunya’s note at clock-out/)).toBeTruthy()
    expect(screen.getByText(/on the clock/)).toBeTruthy()
  })

  it('a self-only viewer gets no person select and no amounts, whatever the prop says', async () => {
    H.rpc.mockImplementation(async () => ({
      data: payload({
        viewer: { can_see_money: false, can_pick_person: false, user_id: 'u-taunya' },
        events: [{ actor_user_id: 'u-taunya', at: `${today}T14:00:00Z`, day: today, kind: 'billed', ref_type: 'job', ref_id: 'job-102', amount_usd: null, detail: { invoice_id: 'a' } }],
      }),
      error: null,
    }))
    renderWithProviders(<PeopleDayBookTab authUserId="u-taunya" authRole="assistant" canPickPerson={false} />)
    await waitFor(() => expect(screen.getByText('Billed 1')).toBeTruthy())
    expect(screen.queryByLabelText('Person')).toBeNull()
    expect(screen.queryByText(/\$\d/)).toBeNull()
  })

  it('says so in the deploy window before the migration is pushed', async () => {
    H.rpc.mockImplementation(async () => ({ data: null, error: { message: 'Could not find the function public.get_day_book_payload(p_from, p_to) in the schema cache' } }))
    renderWithProviders(<PeopleDayBookTab authUserId="u-robert" authRole="dev" canPickPerson />)
    await waitFor(() => expect(screen.getByText(/not live in the database yet/)).toBeTruthy())
  })

  it('the Schedule chip is drawn disabled until the schedule keeps a ledger', async () => {
    renderWithProviders(<PeopleDayBookTab authUserId="u-robert" authRole="dev" canPickPerson />)
    await waitFor(() => expect(screen.getByText('Billed 2')).toBeTruthy())
    expect((screen.getByRole('button', { name: 'Schedule' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('a past day’s Approved line ends with what the RPC reconstructed as still waiting', async () => {
    const past = '2026-09-14'
    H.rpc.mockImplementation(async () => ({
      data: payload({
        sessions: [{ user_id: 'u-taunya', work_date: past, clocked_in_at: `${past}T12:52:00Z`, clocked_out_at: `${past}T21:00:00Z`, on_bid: false, note: '' }],
        events: [{ actor_user_id: 'u-taunya', at: `${past}T15:00:00Z`, day: past, kind: 'approval', ref_type: 'person', ref_id: 'p-1', amount_usd: null, detail: { hours: 8 } }],
        system_counts: [],
        queue: [{ day: past, kind: 'approvals', n: 12 }],
      }),
      error: null,
    }))
    renderWithProviders(<PeopleDayBookTab authUserId="u-robert" authRole="dev" canPickPerson />)
    await waitFor(() => expect(screen.getByText('Approved 1 clock session')).toBeTruthy())
    expect(screen.getByText(/12 still waiting/)).toBeTruthy()
    expect(screen.queryByText(/48 still waiting/)).toBeNull() // the live figure is today's only
  })

  it('Month draws the rhythm grid — kinds as rows, initials in the cells — and a cell opens its day', async () => {
    // The RPC echoes the range it was asked for; Month asks for the whole month.
    H.rpc.mockImplementation(async (_fn: unknown, args: unknown) => {
      const a = args as { p_from: string; p_to: string }
      return { data: payload({ from: a.p_from, to: a.p_to }), error: null }
    })
    renderWithProviders(<PeopleDayBookTab authUserId="u-robert" authRole="dev" canPickPerson />)
    await waitFor(() => expect(screen.getByText('Billed 2')).toBeTruthy())
    const month = screen.getByRole('button', { name: 'Month' }) as HTMLButtonElement
    expect(month.disabled).toBe(false)
    fireEvent.click(month)
    await waitFor(() => expect(screen.getByRole('table', { name: 'Month rhythm' })).toBeTruthy())
    expect(screen.getByRole('button', { name: 'This month' })).toBeTruthy()
    expect(screen.getAllByRole('rowheader').map((r) => r.firstChild?.textContent)).toEqual(['Billing', 'Deposits', 'Contracts', 'Approvals'])
    const doneCells = screen.getAllByRole('cell').filter((c) => c.getAttribute('data-state') === 'done')
    expect(doneCells.length).toBeGreaterThan(0)
    expect(doneCells[0]!.textContent).toBe('T')
    expect(screen.queryAllByRole('cell').filter((c) => c.getAttribute('data-state') === 'gap')).toHaveLength(0)
    fireEvent.click(doneCells[0]!)
    await waitFor(() => expect(screen.getByRole('button', { name: 'This week' })).toBeTruthy())
    expect(screen.getByText('Billed 2')).toBeTruthy()
    expect(dayBookMonthOf(today).from <= today).toBe(true)
  })
})
