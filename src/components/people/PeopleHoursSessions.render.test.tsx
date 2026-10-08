// @vitest-environment jsdom
/**
 * The Hours tab's sessions section (row 6, v2.4965): its search filters the four lists in place —
 * active, awaiting approval, approved, rejected. The filtered lists moved here from
 * `usePeopleHoursData`; the search text stays with the page, because the section unmounts while
 * the tab loads (every week change) and the text survives that.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import type { ClockSessionRow } from '../../types/clockSessions'
import { PeopleHoursSessions, type PeopleHoursSessionsProps } from './PeopleHoursSessions'

vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock()
})

vi.mock('../../lib/supabase', () => {
  function builder(): Record<string, unknown> {
    const b: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'in', 'is', 'or', 'order', 'limit', 'gte', 'lte', 'maybeSingle', 'single']) b[m] = () => b
    b.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) =>
      Promise.resolve({ data: [], error: null }).then(res, rej)
    return b
  }
  return { supabase: { from: () => builder(), rpc: () => Promise.resolve({ data: [], error: null }) } }
})

const DAY = '2026-10-06'

function row(id: string, name: string, notes: string, extra: Partial<ClockSessionRow> = {}): ClockSessionRow {
  return {
    id,
    user_id: `u-${name}`,
    clocked_in_at: `${DAY}T14:00:00Z`,
    clocked_out_at: `${DAY}T16:00:00Z`,
    work_date: DAY,
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
    users: { name },
    approved_by_user: null,
    rejected_by_user: null,
    ...extra,
  } as ClockSessionRow
}

const ACTIVE = [row('a1', 'Ana Worker', 'framing', { clocked_out_at: null })]
const PENDING = [row('p1', 'Ana Worker', 'trim'), row('p2', 'Ben Other', 'cleanup')]
const APPROVED = [row('ok1', 'Ben Other', 'rough-in', { approved_at: `${DAY}T20:00:00Z` })]
const REJECTED = [row('r1', 'Ana Worker', 'duplicate', { rejected_at: `${DAY}T20:00:00Z` })]

function baseProps(): Omit<PeopleHoursSessionsProps, 'hoursClockSessionsSearch' | 'setHoursClockSessionsSearch'> {
  return {
    open: true,
    onToggle: vi.fn(),
    canAccessPay: true,
    authUserId: 'u-lead',
    activeClockSessions: ACTIVE,
    pendingApprovalClockSessions: PENDING,
    approvedClockSessions: APPROVED,
    rejectedClockSessions: REJECTED,
    showSalariedWorkdaysHoursButton: false,
    onOpenSalariedWorkdays: vi.fn(),
    prefixMap: {} as PeopleHoursSessionsProps['prefixMap'],
    openHoursMyTimeFromSession: vi.fn(),
    setEditClockSession: vi.fn(),
    setError: vi.fn(),
    reloadSessions: vi.fn(),
    reloadHours: vi.fn(),
    rejectedSectionOpen: true,
    onToggleRejected: vi.fn(),
  }
}

/** The page's side of it: the text lives above the section, as `usePeopleHoursData` holds it. */
function Page({ initial = '', mounted = true }: { initial?: string; mounted?: boolean }) {
  const [search, setSearch] = useState(initial)
  return mounted ? (
    <PeopleHoursSessions {...baseProps()} hoursClockSessionsSearch={search} setHoursClockSessionsSearch={setSearch} />
  ) : (
    <p>Loading…</p>
  )
}

const searchBox = () => screen.getByRole('searchbox', { name: 'Search clock sessions' }) as HTMLInputElement

afterEach(cleanup)

describe('PeopleHoursSessions — the search and its four filtered lists', () => {
  it('shows every list in full until something is typed', () => {
    renderWithProviders(<Page />)
    expect(screen.getByText('Active clock sessions (1)')).toBeTruthy()
    expect(screen.queryByText(/matching/)).toBeNull()
    expect(screen.queryByText('No sessions match this search.')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Clear' })).toBeNull()
  })

  it('filters all four lists by name, and says how many of each match', () => {
    renderWithProviders(<Page />)
    fireEvent.change(searchBox(), { target: { value: 'ana' } })
    expect(screen.getByText('Active clock sessions (1 of 1 matching)')).toBeTruthy()
    expect(screen.getByText('Pending sessions (1 of 2 matching)')).toBeTruthy()
    expect(screen.getByText('Approved Sessions (0 of 1 matching)')).toBeTruthy()
    expect(screen.getByText('Rejected Sessions (1 of 1 matching)')).toBeTruthy()
    expect(screen.queryByText('No sessions match this search.')).toBeNull()
  })

  it('every word must match somewhere — name, notes or date', () => {
    renderWithProviders(<Page />)
    fireEvent.change(searchBox(), { target: { value: 'ben rough' } })
    expect(screen.getByText('Active clock sessions (0 of 1 matching)')).toBeTruthy()
    expect(screen.getByText('Pending sessions (0 of 2 matching)')).toBeTruthy()
    expect(screen.getByText('Approved Sessions (1 of 1 matching)')).toBeTruthy()
    expect(screen.getByText('Rejected Sessions (0 of 1 matching)')).toBeTruthy()
  })

  it('says when nothing matches, and Clear brings every list back', () => {
    renderWithProviders(<Page />)
    fireEvent.change(searchBox(), { target: { value: 'nobody' } })
    expect(screen.getByText('No sessions match this search.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }))
    expect(searchBox().value).toBe('')
    expect(screen.getByText('Active clock sessions (1)')).toBeTruthy()
    expect(screen.queryByText('No sessions match this search.')).toBeNull()
  })

  it('a search held by the page survives the section unmounting while the tab loads', () => {
    const { rerender } = renderWithProviders(<Page initial="ana" />)
    expect(screen.getByText('Active clock sessions (1 of 1 matching)')).toBeTruthy()
    rerender(<Page initial="ana" mounted={false} />)
    expect(screen.queryByRole('searchbox')).toBeNull()
    rerender(<Page initial="ana" />)
    expect(searchBox().value).toBe('ana')
    expect(screen.getByText('Pending sessions (1 of 2 matching)')).toBeTruthy()
  })
})
