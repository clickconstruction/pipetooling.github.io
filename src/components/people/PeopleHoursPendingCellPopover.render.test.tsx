// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderWithProviders, settle } from '../../test/renderSmokeMocks'
import type { TypedStamp } from '../../lib/clock/typedHours'
import type { PeopleHoursPendingCellEntry } from '../../lib/peopleHoursPendingByCell'
import type { ClockSessionRow } from '../../types/clockSessions'

// The day the owner asked about (2026-09-30): one real punch and one session the office typed.
const stampsBox: { current: Map<string, TypedStamp> } = { current: new Map() }
const approveMock = vi.fn()

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock({ role: 'assistant' })
})
vi.mock('../../hooks/useTypedStamps', () => ({
  useTypedStamps: () => ({ stamps: stampsBox.current, reload: () => {} }),
}))
vi.mock('../../lib/approveClockSessions', async (orig) => {
  const actual = await orig<typeof import('../../lib/approveClockSessions')>()
  return { ...actual, approveClockSessions: (ids: string[]) => approveMock(ids) }
})

import { PeopleHoursPendingCellPopover } from './PeopleHoursPendingCellPopover'

function session(id: string, inIso: string, outIso: string, notes: string): ClockSessionRow {
  return {
    id,
    user_id: 'michael',
    clocked_in_at: inIso,
    clocked_out_at: outIso,
    work_date: '2026-09-25',
    notes,
    job_ledger_id: null,
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

const punch = session('punch', '2026-09-25T12:02:00Z', '2026-09-25T14:48:00Z', '')
const typed = session('typed', '2026-09-25T15:00:00Z', '2026-09-26T02:00:00Z', 'App would not clock him in')
const entry: PeopleHoursPendingCellEntry = {
  personName: 'Michael A',
  workDate: '2026-09-25',
  userId: 'michael',
  count: 2,
  pendingHours: 13.77,
  peopleHoursValue: 0,
  diffHours: 13.77,
  sessionIds: ['punch', 'typed'],
  sessions: [punch, typed],
}

function typedStamp(hold: TypedStamp['hold']): TypedStamp {
  return {
    hold,
    entries: [
      {
        id: 'e1', kind: 'added', typedBy: 'taunya', typedByName: 'Taunya', typedAt: new Date().toISOString(),
        seconds: 39600, daySecondsBefore: 9960, daySecondsAfter: 49560, self: false, confirmedByName: null, confirmedAt: null,
      },
    ],
  }
}

function mount(onClose = vi.fn(), onShowToast = vi.fn()) {
  const anchor = document.createElement('button')
  document.body.appendChild(anchor)
  renderWithProviders(
    <PeopleHoursPendingCellPopover
      entry={entry}
      anchorEl={anchor}
      authUserId="viewer"
      canApprove
      canReject
      onClose={onClose}
      onChanged={() => {}}
      onError={() => {}}
      onShowToast={onShowToast}
      onOpenInMyTime={() => {}}
    />,
  )
  return { onClose, onShowToast }
}

describe('PeopleHoursPendingCellPopover — a typed line is never swept in with the punches', () => {
  beforeEach(() => {
    approveMock.mockReset()
    approveMock.mockResolvedValue({ data: [{ approved_count: 1, error_message: null, held_own: 0, held_typed: 0 }], error: null })
    stampsBox.current = new Map()
  })

  it('with no typed hours it is the window it always was', async () => {
    mount()
    await settle()
    expect(screen.getByRole('button', { name: 'Approve all (2)' })).toBeTruthy()
    expect(screen.queryByTestId('typed-hours-stamp')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Approve all (2)' }))
    await waitFor(() => expect(approveMock).toHaveBeenCalledWith(['punch', 'typed']))
  })

  it('someone else typed a line: it wears the stamp and its own Approve; the day button takes the punch', async () => {
    stampsBox.current = new Map([['typed', typedStamp(null)]])
    const { onClose } = mount()
    await settle()
    const stamp = screen.getByTestId('typed-hours-stamp')
    expect(stamp.textContent).toContain('typed by Taunya')
    expect(stamp.textContent).toContain('2.8h → 13.8h')
    const line = stamp.closest('li') as HTMLElement
    expect(within(line).getByText('“App would not clock him in”')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Approve 1 punch' }))
    await waitFor(() => expect(approveMock).toHaveBeenCalledWith(['punch']))
    // the typed line is still waiting, so the window stays open
    await settle()
    expect(onClose).not.toHaveBeenCalled()

    fireEvent.click(within(line).getByRole('button', { name: 'Approve 11.00h' }))
    await waitFor(() => expect(approveMock).toHaveBeenCalledWith(['typed']))
  })

  it('the viewer typed the line: no Approve on it, and the reason instead', async () => {
    stampsBox.current = new Map([['typed', typedStamp('typed')]])
    mount()
    await settle()
    const line = screen.getByTestId('typed-hours-stamp').closest('li') as HTMLElement
    expect(within(line).getByTestId('typed-hours-hold').textContent).toBe('You typed these — waiting on a second person')
    expect(within(line).queryByRole('button', { name: /^Approve/ })).toBeNull()
    expect(screen.getByRole('button', { name: 'Approve 1 punch' })).toBeTruthy()
  })

  it('says what an approve left for someone else', async () => {
    approveMock.mockResolvedValue({ data: [{ approved_count: 1, error_message: null, held_own: 0, held_typed: 1 }], error: null })
    const { onShowToast, onClose } = mount()
    await settle()
    fireEvent.click(screen.getByRole('button', { name: 'Approve all (2)' }))
    await waitFor(() =>
      expect(onShowToast).toHaveBeenCalledWith('Approved 1 session(s) — added to payroll. 1 left for someone else: you typed it.', 'warning'),
    )
    expect(onClose).not.toHaveBeenCalled()
  })
})
