// @vitest-environment jsdom
/**
 * Render smokes for the Crew Day section (v2.2600): role self-gate, payload →
 * person rows with hours/flags/report excerpts, and the day-scoped empty state.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { DashboardCrewDaySection } from './DashboardCrewDaySection'
import type { CrewDayPayload } from '../../lib/crewDay'
import { toLocalDateString } from '../../lib/dailyGoalsGate'

// The section always opens on today; the Day book fixture must sit on that day.
const TODAY = toLocalDateString(new Date())

const PAYLOAD: CrewDayPayload = {
  day: '2026-09-01',
  sessions: [
    { user_id: 'u1', job_id: 'j1', clocked_in_at: '2026-09-01T12:00:00Z', clocked_out_at: '2026-09-01T20:00:00Z' },
    { user_id: 'u5', job_id: 'j1', clocked_in_at: '2026-09-01T13:00:00Z', clocked_out_at: '2026-09-01T15:00:00Z' },
  ],
  blocks: [
    { user_id: 'u1', job_id: 'j1', bid_id: null, time_start: '07:00:00', time_end: '15:00:00', note: null },
    { user_id: 'u2', job_id: 'j1', bid_id: null, time_start: '07:00:00', time_end: '15:00:00', note: null },
  ],
  reports: [
    { id: 'r1', user_id: 'u1', job_id: 'j1', created_at: '2026-09-01T20:05:00Z', template_name: 'Field report', field_values: { t: 'Rough complete on 3–5' } },
  ],
  pct_notes: [],
  users: [
    { id: 'u1', name: 'Marcus V.', role: 'subcontractor' },
    { id: 'u2', name: 'DeShawn K.', role: 'helpers' },
    { id: 'u5', name: 'Taunya R.', role: 'assistant' },
  ],
  jobs: [
    { id: 'j1', hcp_number: '4821', click_number: null, job_name: 'Maple Ridge Ph 2', job_address: null, status: 'working', pct_complete: 60 },
  ],
}

const rpcMock = vi.fn()
const DAYBOOK = {
  from: TODAY,
  to: TODAY,
  viewer: { can_see_money: true, can_pick_person: true, user_id: 'u9' },
  users: [{ id: 'u5', name: 'Taunya R.', role: 'assistant' }],
  jobs: [],
  ref_people: [],
  sessions: [{ user_id: 'u5', work_date: TODAY, clocked_in_at: `${TODAY}T13:00:00Z`, clocked_out_at: `${TODAY}T15:00:00Z`, on_bid: false, note: '' }],
  events: [
    { actor_user_id: 'u5', at: `${TODAY}T14:00:00Z`, day: TODAY, kind: 'billed', ref_type: 'job', ref_id: 'j1', amount_usd: 500, detail: { invoice_id: 'a' } },
    { actor_user_id: 'u5', at: `${TODAY}T14:10:00Z`, day: TODAY, kind: 'deposit', ref_type: 'job', ref_id: 'j1', amount_usd: 100, detail: {} },
  ],
  system_counts: [],
}
vi.mock('../../lib/supabase', () => ({
  supabase: { rpc: (...args: unknown[]) => rpcMock(...args) },
}))
vi.mock('../../utils/errorHandling', () => ({
  withSupabaseRetry: async <T,>(op: () => PromiseLike<{ data: T; error: null }>) => (await op()).data,
}))

beforeEach(() => {
  localStorage.clear()
  rpcMock.mockReset()
})

describe('DashboardCrewDaySection', () => {
  it('renders nothing for field roles', () => {
    const { container } = render(<DashboardCrewDaySection authUserId="u-1" role="subcontractor" />)
    expect(container.innerHTML).toBe('')
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('loads the payload and renders people, hours, flags, and report excerpts', async () => {
    rpcMock.mockResolvedValue({ data: PAYLOAD, error: null })
    render(<DashboardCrewDaySection authUserId="u-1" role="superintendent" />)
    await waitFor(() => expect(screen.getByText('Marcus V.')).toBeTruthy())
    expect(screen.getByText('Crew Day')).toBeTruthy()
    expect(screen.queryByLabelText('Email Crew Day')).toBeNull() // office-only since v2.2615
    expect(screen.getAllByText('4821 · Maple Ridge Ph 2').length).toBe(2) // Marcus worked it, DeShawn was scheduled on it
    expect(screen.getByText(/Rough complete on 3–5/)).toBeTruthy()
    expect(screen.getByText('Scheduled — never clocked in')).toBeTruthy() // DeShawn
    expect(screen.getByText('Scoped to your assigned projects.')).toBeTruthy()
    expect(screen.getByText('2 people')).toBeTruthy() // Taunya (assistant) folded out of chips + list
    expect(screen.queryByText('Taunya R.')).toBeNull()
    expect(screen.getByText('+1 office hidden')).toBeTruthy()
    expect(screen.getByText('Today', { exact: false })).toBeTruthy() // restacked nav word (state defaults to today)
  })

  it('superintendent: Show office staff reveals folded people and persists per device', async () => {
    rpcMock.mockResolvedValue({ data: PAYLOAD, error: null })
    render(<DashboardCrewDaySection authUserId="u-1" role="superintendent" />)
    await waitFor(() => expect(screen.getByText('Show office staff')).toBeTruthy())
    fireEvent.click(screen.getByText('Show office staff'))
    expect(screen.getByText('Taunya R.')).toBeTruthy()
    expect(screen.getByText('3 people')).toBeTruthy()
    expect(screen.queryByText('+1 office hidden')).toBeNull()
    expect(screen.getByText('Hide office staff')).toBeTruthy()
    expect(localStorage.getItem('pipetooling_crew_day_show_office')).toBe('1')
  })

  it('office viewers see everyone with no fold', async () => {
    rpcMock.mockResolvedValue({ data: PAYLOAD, error: null })
    render(<DashboardCrewDaySection authUserId="u-1" role="dev" />)
    await waitFor(() => expect(screen.getByText('Taunya R.')).toBeTruthy())
    expect(screen.getByText('3 people')).toBeTruthy()
    expect(screen.queryByText('Show office staff')).toBeNull()
    expect(screen.queryByText('+1 office hidden')).toBeNull()
  })

  it('shows the empty state when the day has no rows', async () => {
    rpcMock.mockResolvedValue({ data: { ...PAYLOAD, sessions: [], blocks: [], reports: [], users: [], jobs: [] }, error: null })
    render(<DashboardCrewDaySection authUserId="u-1" role="dev" />)
    await waitFor(() => expect(screen.getByText('No crew activity for this day.')).toBeTruthy())
    expect(screen.queryByText('Scoped to your assigned projects.')).toBeNull()
    expect(screen.getByLabelText('Email Crew Day')).toBeTruthy() // office roles keep the ✉
  })

  it('an office person gets one line of outcomes and a Day book door (v2.3728); a field person does not', async () => {
    rpcMock.mockImplementation(async (name: string) => (name === 'get_day_book_payload' ? { data: DAYBOOK, error: null } : { data: PAYLOAD, error: null }))
    render(<DashboardCrewDaySection authUserId="u9" role="dev" />)
    await waitFor(() => expect(screen.getByText(/billed 1 · 1 deposit/)).toBeTruthy())
    const doors = screen.getAllByRole('link', { name: /Day book/ }) as HTMLAnchorElement[]
    expect(doors).toHaveLength(1)
    expect(doors[0]!.getAttribute('href')).toContain('tab=day_book')
    expect(doors[0]!.getAttribute('href')).toContain('dayb_person=u5')
  })

  it('a superintendent never asks the Day book', async () => {
    rpcMock.mockImplementation(async () => ({ data: PAYLOAD, error: null }))
    render(<DashboardCrewDaySection authUserId="u9" role="superintendent" />)
    await waitFor(() => expect(screen.getByText('Marcus V.')).toBeTruthy())
    expect(rpcMock.mock.calls.map((c) => c[0])).not.toContain('get_day_book_payload')
  })
})
