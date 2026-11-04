// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ canAccessLicenses: true, tables: {} as Record<string, unknown>, rpc: [] as unknown[] }))

vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'viewer' } }) }))
vi.mock('../hooks/usePeopleAccess', () => ({ usePeopleAccess: () => ({ canAccessLicenses: state.canAccessLicenses, accessResolved: true }) }))
vi.mock('../lib/supabase', () => {
  function builder(table: string) {
    const single = { value: false }
    const b: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'order']) b[m] = () => b
    b.maybeSingle = () => {
      single.value = true
      return b
    }
    b.then = (ok: (v: unknown) => unknown) => {
      const data = state.tables[table]
      return Promise.resolve({ data: single.value ? (Array.isArray(data) ? data[0] ?? null : data ?? null) : data ?? [], error: null }).then(ok)
    }
    return b
  }
  return {
    supabase: {
      from: (t: string) => builder(t),
      rpc: () => ({ then: (ok: (v: unknown) => unknown) => Promise.resolve({ data: state.rpc, error: null }).then(ok) }),
    },
  }
})

import Logbook from './Logbook'

function hours(work_date: string, hrs: number, service_type_name: string, job: string | null = 'j1') {
  return { session_id: work_date + job, work_date, clocked_in_at: '', clocked_out_at: '', hours: hrs, job_ledger_id: job, job_number: '1184', job_name: 'Whitfield water heater', job_address: '1208 Mesquite Ln', service_type_name, bid_id: null, notes: '' }
}

function mount() {
  return render(
    <MemoryRouter initialEntries={['/logbook/u1']}>
      <Routes>
        <Route path="/logbook/:userId" element={<Logbook />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  state.canAccessLicenses = true
  state.tables = {
    users: [{ id: 'u1', name: 'Jordan Price', archived_at: null }],
    people: [{ name: 'Gone Master', archived_at: '2026-01-01' }],
    person_licenses: [
      { person_name: 'Jordan Price', license_type: 'Plumber Apprentice #191717', date_of_expiry: '2099-08-31' },
      { person_name: 'Ana Ruiz', license_type: 'Master Plumber #41130', date_of_expiry: '2099-05-31' },
      { person_name: 'Gone Master', license_type: 'Master Plumber #1', date_of_expiry: '2099-05-31' },
    ],
    app_settings: null,
  }
  state.rpc = [hours('2026-10-27', 40, 'Plumbing'), hours('2026-10-28', 6, 'Electrical', 'j2'), hours('2026-10-29', 2, 'Plumbing', null)]
})

describe('Logbook page', () => {
  it('shows the goal with its current signer, the hours with no license, and the log', async () => {
    mount()
    expect(await screen.findByText('Jordan’s logbook')).toBeTruthy()
    expect(screen.getByText('Working toward journeyman plumber')).toBeTruthy()
    expect(screen.getByText('Ana Ruiz')).toBeTruthy()
    expect(screen.queryByText('Gone Master')).toBeNull()
    expect(screen.getByTestId('logbook-unlicensed-trade').textContent).toContain('6 hours of electrical work count toward no license.')
    expect(screen.getByText(/Office, not counted/)).toBeTruthy()
  })

  it('prints the summary sheet with the teammate named', async () => {
    mount()
    await screen.findByText('Jordan’s logbook')
    fireEvent.click(screen.getByRole('button', { name: 'Print summary sheet' }))
    expect(screen.getByText('Teammate')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Print the summary sheet' })).toBeTruthy()
  })

  it('says who it opens for when the viewer cannot see Licenses', () => {
    state.canAccessLicenses = false
    mount()
    expect(screen.getByText(/The logbook opens for the people who can see People, Licenses/)).toBeTruthy()
  })
})
