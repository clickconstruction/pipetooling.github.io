// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderSettled, settle } from '../../test/renderSmokeMocks'
import type { TypedStamp, TypedWaitingRow } from '../../lib/clock/typedHours'
import type { ClockSessionRow } from '../../types/clockSessions'

// Three pending sessions for one person: a punch, a session the office typed for them (someone
// else's typing, waiting on the viewer's look) and one the viewer typed (held).
const stampsBox: { current: Map<string, TypedStamp> } = { current: new Map() }
const rowsBox: { current: ClockSessionRow[] } = { current: [] }
const approveMock = vi.fn()

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock({ role: 'controller' })
})
vi.mock('../../hooks/useTypedStamps', () => ({
  useTypedStamps: () => ({ stamps: stampsBox.current, reload: () => {} }),
}))
vi.mock('../../lib/people/fetchAllPendingClockSessions', () => ({
  PENDING_APPROVALS_FETCH_CAP: 2000,
  fetchAllPendingClockSessions: async () => rowsBox.current,
}))
const waitingBox: { current: TypedWaitingRow[] } = { current: [] }
const confirmMock = vi.fn()
vi.mock('../../lib/clock/loadTypedHoursWaiting', () => ({
  loadTypedHoursWaiting: async () => waitingBox.current,
  confirmTypedEntry: (id: string) => confirmMock(id),
}))
vi.mock('../../lib/approveClockSessions', async (orig) => {
  const actual = await orig<typeof import('../../lib/approveClockSessions')>()
  return { ...actual, approveClockSessions: (ids: string[]) => approveMock(ids) }
})

import { PeopleHoursApprovalsQueueModal } from './PeopleHoursApprovalsQueueModal'

function session(id: string, inIso: string, outIso: string, notes: string): ClockSessionRow {
  return {
    id,
    user_id: 'michael',
    clocked_in_at: inIso,
    clocked_out_at: outIso,
    work_date: inIso.slice(0, 10),
    notes,
    job_ledger_id: 'job-1',
    bid_id: null,
    clock_in_lat: null,
    clock_in_lng: null,
    clock_out_lat: null,
    clock_out_lng: null,
    clock_in_location_source: null,
    clock_out_location_source: null,
    approved_at: null,
    approved_by: null,
    rejected_at: null,
    rejected_by: null,
    revoked_at: null,
    revoked_by: null,
    users: { name: 'Michael A' },
    approved_by_user: null,
    rejected_by_user: null,
    revoked_by_user: null,
  } as ClockSessionRow
}

function typed(name: string, hold: TypedStamp['hold']): TypedStamp {
  return {
    hold,
    entries: [
      {
        id: `e-${name}`, kind: 'added', typedBy: name, typedByName: name, typedAt: new Date().toISOString(),
        seconds: 14400, daySecondsBefore: 0, daySecondsAfter: 14400, self: false, confirmedByName: null, confirmedAt: null,
      },
    ],
  }
}

async function mount() {
  await renderSettled(
    <PeopleHoursApprovalsQueueModal onClose={() => {}} onChanged={() => {}} onEditSession={() => {}} authUserId="viewer" reloadKey={0} />,
    { loaded: () => screen.findByText('Michael A') },
  )
}

describe('PeopleHoursApprovalsQueueModal — typed hours', () => {
  beforeEach(() => {
    waitingBox.current = []
    confirmMock.mockReset()
    confirmMock.mockResolvedValue(null)
    approveMock.mockReset()
    approveMock.mockResolvedValue({ data: [{ approved_count: 1, error_message: null, held_own: 0, held_typed: 0 }], error: null })
    // Monday to Wednesday of one week, 8:00 AM to noon Central.
    rowsBox.current = [
      session('punch', '2026-09-28T13:00:00Z', '2026-09-28T17:00:00Z', 'Rough in'),
      session('typed-by-taunya', '2026-09-29T13:00:00Z', '2026-09-29T17:00:00Z', 'App would not clock him in'),
      session('typed-by-me', '2026-09-30T13:00:00Z', '2026-09-30T17:00:00Z', 'His text'),
    ]
    stampsBox.current = new Map([
      ['typed-by-taunya', typed('Taunya', null)],
      ['typed-by-me', typed('Viewer', 'typed')],
    ])
  })

  it('a batch button takes the punches only, and says how many it left', async () => {
    await mount()
    expect(screen.getByRole('button', { name: /Approve 1 of 3 · 4h/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Approve the punches · 1 · 4h/ })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Approve 1 of 3 · 4h/ }))
    const confirm = await screen.findByRole('button', { name: 'Approve 1' })
    expect(screen.getByText(/2 typed by hand or held are left out/)).toBeTruthy()
    fireEvent.click(confirm)
    await waitFor(() => expect(approveMock).toHaveBeenCalledWith(['punch']))
  })

  it('the Typed by hand filter opens those rows: the stamp, an Approve for someone else’s typing, the reason on the viewer’s own', async () => {
    await mount()
    fireEvent.click(screen.getByLabelText(/Typed by hand · 2/))
    await settle()
    const stamps = await screen.findAllByTestId('typed-hours-stamp')
    expect(stamps).toHaveLength(2)
    expect(screen.queryByText('“Rough in”')).toBeNull()

    const theirs = screen.getByText('“App would not clock him in”').closest('div[style*="grid"]') as HTMLElement
    expect(within(theirs).getByTestId('typed-hours-stamp').textContent).toContain('typed by Taunya')
    fireEvent.click(within(theirs).getByRole('button', { name: 'Approve' }))
    await waitFor(() => expect(approveMock).toHaveBeenCalledWith(['typed-by-taunya']))

    const mine = screen.getByText('“His text”').closest('div[style*="grid"]') as HTMLElement
    expect(within(mine).getByTestId('typed-hours-hold').textContent).toBe('You typed these — waiting on a second person')
    expect(within(mine).queryByRole('button', { name: 'Approve' })).toBeNull()
  })

  it('an approve the database held is a warning, not a "zero-length skipped"', async () => {
    approveMock.mockResolvedValue({ data: [{ approved_count: 2, error_message: null, held_own: 0, held_typed: 1 }], error: null })
    stampsBox.current = new Map()
    await mount()
    fireEvent.click(screen.getByRole('button', { name: /Approve all 3/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'Approve 3' }))
    expect(await screen.findByText('Approved 2 sessions — added to payroll. 1 left for someone else: you typed it.')).toBeTruthy()
    expect(screen.queryByText(/zero-length/)).toBeNull()
  })

  it('hours typed onto approved time get a Looks right — from someone who did not type them', async () => {
    const base: TypedWaitingRow = {
      entryId: 'w1', userId: 'paige', personName: 'Paige', workDate: '2026-09-24', typedBy: 'taunya', typedByName: 'Taunya',
      typedAt: new Date().toISOString(), seconds: 9000, daySecondsBefore: 23400, daySecondsAfter: 32400, selfTyped: false,
      state: 'approved', sessionIds: ['x'], canAct: true,
    }
    waitingBox.current = [base, { ...base, entryId: 'w2', personName: 'Isiah', userId: 'isiah', typedBy: 'viewer', typedByName: 'Viewer', canAct: false }]
    await mount()
    const section = await screen.findByTestId('typed-onto-approved')
    expect(within(section).getByText('Typed onto hours already approved · 2')).toBeTruthy()
    expect(within(section).getAllByTestId('typed-hours-stamp')[0]?.textContent).toContain('6.5h → 9.0h')
    // the viewer typed the second one: the reason, no button
    expect(within(section).getByTestId('typed-hours-hold').textContent).toBe('You typed these — waiting on a second person')
    expect(within(section).getAllByRole('button', { name: 'Looks right' })).toHaveLength(1)

    fireEvent.click(within(section).getByRole('button', { name: 'Looks right' }))
    await waitFor(() => expect(confirmMock).toHaveBeenCalledWith('w1'))
    await waitFor(() => expect(within(screen.getByTestId('typed-onto-approved')).getByText('Typed onto hours already approved · 1')).toBeTruthy())
  })

  it('opens on the Typed by hand filter when asked to', async () => {
    await renderSettled(
      <PeopleHoursApprovalsQueueModal onClose={() => {}} onChanged={() => {}} onEditSession={() => {}} authUserId="viewer" reloadKey={0} startTypedOnly />,
      { loaded: () => screen.findAllByTestId('typed-hours-stamp') },
    )
    expect((screen.getByLabelText(/Typed by hand · 2/) as HTMLInputElement).checked).toBe(true)
    expect(screen.queryByText('“Rough in”')).toBeNull()
  })
})
