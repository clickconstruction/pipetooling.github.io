// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { installDomShims } from '../test/renderSmokeMocks'

const state = vi.hoisted(() => ({ canAccessLicenses: true, tables: {} as Record<string, unknown>, rpc: [] as unknown, writes: [] as string[] }))

vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'viewer' }, profileName: 'Lou Lead' }) }))
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
    b.single = b.maybeSingle
    b.insert = (row: { user_id: string }) => {
      state.writes.push(`insert ${table} ${row.user_id}`)
      state.tables[table] = [{ user_id: row.user_id, shown_by: 'viewer', shown_at: '2026-11-04T15:00:00Z' }]
      return b
    }
    b.delete = () => {
      state.writes.push(`delete ${table}`)
      state.tables[table] = null
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

function mount(path = '/logbook/u1') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/logbook/:userId" element={<Logbook />} />
        <Route path="/my-logbook" element={<Logbook own />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeAll(() => {
  installDomShims()
})

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
    logbook_shares: null,
  }
  state.writes = []
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

  it('reads the office’s goal and the hours before the clock, and offers Edit the goal', async () => {
    state.tables.license_targets = [{ trade: 'plumbing', target_class: 'journeyman', target_amount: 7000, opening_amount: 1200, opening_source: 'Hours at Rio Plumbing' }]
    mount()
    expect(await screen.findByText('Jordan’s logbook')).toBeTruthy()
    expect(screen.getByTestId('logbook-goal').textContent).toContain('Working toward journeyman plumberset by the office')
    expect(screen.getByTestId('logbook-opening').textContent).toBe('Includes 1,200 hours before the clock started: Hours at Rio Plumbing.')
    expect(screen.getByText(/of 7,000 hours/)).toBeTruthy()
    fireEvent.click(screen.getByTestId('logbook-edit-goal'))
    expect(await screen.findByText('Jordan’s plumbing goal')).toBeTruthy()
    expect((screen.getByTestId('license-target-class') as HTMLSelectElement).value).toBe('journeyman')
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

  it('shows the logbook to its teammate with one press, and stops it', async () => {
    mount()
    expect((await screen.findByTestId('logbook-share-strip')).textContent).toContain('Jordan cannot see this logbook.')
    fireEvent.click(screen.getByRole('button', { name: 'Show Jordan this logbook' }))
    expect((await screen.findByRole('button', { name: 'Stop showing' })).textContent).toBe('Stop showing')
    expect(screen.getByTestId('logbook-share-strip').textContent).toContain('Jordan sees this logbook in the app’s menu. Shown Nov 4 by Lou Lead.')
    fireEvent.click(screen.getByRole('button', { name: 'Stop showing' }))
    expect(await screen.findByRole('button', { name: 'Show Jordan this logbook' })).toBeTruthy()
    expect(state.writes).toEqual(['insert logbook_shares u1', 'delete logbook_shares'])
  })
})

describe('My logbook (own)', () => {
  it('reads the teammate their own logbook, without the office’s controls', async () => {
    state.canAccessLicenses = false
    state.rpc = {
      name: 'Jordan Price',
      hours: [hours('2026-10-27', 40, 'Plumbing')],
      licenses: [{ id: 'l1', license_type: 'Plumber Apprentice #191717', date_of_expiry: '2099-08-31' }],
      signers: [{ person_name: 'Ana Ruiz', license_type: 'Master Plumber #41130', date_of_expiry: '2099-05-31' }],
      targets: [{ trade: 'plumbing', target_class: null, target_amount: null, opening_amount: 1200, opening_source: 'Hours at Rio Plumbing' }],
      office_job_id: null,
    }
    mount('/my-logbook')
    expect(await screen.findByText('Your logbook')).toBeTruthy()
    expect(screen.getByText('Working toward journeyman plumber')).toBeTruthy()
    expect(screen.getByTestId('logbook-opening').textContent).toBe('Includes 1,200 hours before the clock started: Hours at Rio Plumbing.')
    expect(screen.getByText(/1,240/)).toBeTruthy()
    expect(screen.queryByTestId('logbook-edit-goal')).toBeNull()
    expect(screen.getByText('Ana Ruiz')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Print summary sheet' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Add a license' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull()
    expect(screen.queryByTestId('logbook-share-strip')).toBeNull()
    expect(screen.queryByText(/People · Licenses/)).toBeNull()
  })

  it('says how it opens when the office has not shown it', async () => {
    state.rpc = null
    mount('/my-logbook')
    expect((await screen.findByTestId('logbook-not-shown')).textContent).toContain('Your logbook opens here once the office shows it to you.')
  })
})
