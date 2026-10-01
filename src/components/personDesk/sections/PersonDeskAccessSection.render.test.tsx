// @vitest-environment jsdom
/**
 * Account on the desk (PR B): the desk's Access & account section holds every per-person account
 * control, so nothing on it opens the Active Accounts window any more. A dev changes the name,
 * trades, extra access and password here; a leader sees the values with a tag saying who can, and
 * flips what the database lets them (supervision, training).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, within } from '@testing-library/react'
import { PersonDeskAccessSection } from './PersonDeskAccessSection'
import { renderWithProviders, settle } from '../../../test/renderSmokeMocks'
import type { PersonDeskUserRow } from '../../../hooks/usePersonDesk'
import type { PersonDeskViewer } from '../../../lib/people/personDeskGates'

const calls: Array<{ table: string; op: string; args: unknown[] }> = []
const invoke = vi.fn(async () => ({ data: {}, error: null }))

vi.mock('../../../lib/supabase', () => {
  function builder(table: string): Record<string, unknown> {
    const b: Record<string, unknown> = {}
    let write = false
    for (const op of ['select', 'eq', 'ilike', 'is', 'limit', 'in', 'order', 'or']) {
      b[op] = (...args: unknown[]) => {
        calls.push({ table, op, args })
        return b
      }
    }
    b.update = (...args: unknown[]) => {
      write = true
      calls.push({ table, op: 'update', args })
      return b
    }
    b.single = () => Promise.resolve({ data: null, error: null })
    b.maybeSingle = () => Promise.resolve({ data: null, error: null })
    b.then = (ok: (v: unknown) => unknown) => Promise.resolve({ data: write ? [{ id: 'u-kai' }] : [], error: null }).then(ok)
    return b
  }
  return {
    supabase: {
      from: (table: string) => builder(table),
      functions: { invoke: (...args: unknown[]) => invoke(...(args as [])) },
    },
  }
})

const KAI: PersonDeskUserRow = {
  id: 'u-kai',
  name: 'Kai Moss',
  email: 'kai@example.com',
  role: 'helpers',
  archived_at: null,
  read_only: false,
  last_sign_in_at: null,
  estimator_service_type_ids: null,
  primary_service_type_ids: null,
  superintendent_service_type_ids: null,
  subcontractor_service_type_ids: null,
  helpers_service_type_ids: ['plum'],
  needs_supervision: true,
  team_prospects_access: false,
  estimator_prospects_access: false,
  counttooling_user_id: null,
}
const WENDI: PersonDeskUserRow = { ...KAI, id: 'u-wendi', name: 'Wendi', email: 'wendi@example.com', role: 'estimator', helpers_service_type_ids: null, estimator_service_type_ids: null, needs_supervision: false, team_prospects_access: true }

const DEV: PersonDeskViewer = { role: 'dev', isDev: true, canAccessPay: true, canAccessHours: true, canAccessVehicles: true, canAccessLicenses: true, canAccessContracts: true, readOnly: false }
const LEADER: PersonDeskViewer = { ...DEV, role: 'master_technician', isDev: false }
const TRADES = new Map([
  ['plum', 'Plumbing'],
  ['elec', 'Electrical'],
])

function renderSection(user: PersonDeskUserRow, viewer: PersonDeskViewer, onChanged = vi.fn()) {
  renderWithProviders(<PersonDeskAccessSection user={user} viewer={viewer} viewerUserId="u-me" serviceTypeNames={TRADES} onChanged={onChanged} />)
  return { onChanged }
}

const updates = () => calls.filter((c) => c.op === 'update').map((c) => c.args[0])

describe('PersonDeskAccessSection', () => {
  beforeEach(() => {
    calls.length = 0
    invoke.mockClear()
  })

  it('a dev sees every account control on the desk, and no door to the Active Accounts window', () => {
    renderSection(KAI, DEV)
    expect(screen.getByText('Kai Moss')).toBeTruthy()
    expect(screen.getByText('kai@example.com')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Edit' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Trades…' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Set password…' })).toBeTruthy()
    expect(screen.getByLabelText('Can run a job on their own')).toBeTruthy()
    expect(screen.getByText('Plumbing')).toBeTruthy()
    expect(screen.queryByText(/Manage account/)).toBeNull()
    // A helper has no Hiring board or CountTooling row.
    expect(screen.queryByText('Extra access')).toBeNull()
    expect(screen.queryByText('CountTooling')).toBeNull()
  })

  it('renames in place, and the pay rows follow', async () => {
    const { onChanged } = renderSection(KAI, DEV)
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    expect(screen.getByText('Their pay and hours rows follow the new name.')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Kai Moss Jr' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await settle()
    await vi.waitFor(() => expect(onChanged).toHaveBeenCalled())
    expect(updates()).toContainEqual({ name: 'Kai Moss Jr' })
  })

  it('trades open as a checklist and save to the role\'s own column', async () => {
    const { onChanged } = renderSection(KAI, DEV)
    fireEvent.click(screen.getByRole('button', { name: 'Trades…' }))
    const box = screen.getByRole('group', { name: 'Trades' })
    fireEvent.click(within(box).getByLabelText('Electrical'))
    fireEvent.click(within(box).getByRole('button', { name: 'Save trades' }))
    await vi.waitFor(() => expect(onChanged).toHaveBeenCalled())
    expect(updates()).toContainEqual({ helpers_service_type_ids: ['plum', 'elec'] })
  })

  it('the supervision box asks "can they run a job", stored as needs_supervision', async () => {
    const { onChanged } = renderSection(KAI, DEV)
    expect(screen.getByText('While this is off, someone who can run a job works beside them.')).toBeTruthy()
    fireEvent.click(screen.getByLabelText('Can run a job on their own'))
    await vi.waitFor(() => expect(onChanged).toHaveBeenCalled())
    expect(updates()).toContainEqual({ needs_supervision: false })
  })

  it('Set password checks the two boxes match before it calls the function', async () => {
    renderSection(KAI, DEV)
    fireEvent.click(screen.getByRole('button', { name: 'Set password…' }))
    const dialog = screen.getByRole('dialog', { name: 'Set a password for Kai Moss' })
    fireEvent.change(within(dialog).getByLabelText('New password'), { target: { value: 'secret12' } })
    fireEvent.change(within(dialog).getByLabelText('Type it again'), { target: { value: 'secret13' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Set password' }))
    expect(await within(dialog).findByText('The two passwords do not match.')).toBeTruthy()
    expect(invoke).not.toHaveBeenCalled()
    fireEvent.change(within(dialog).getByLabelText('Type it again'), { target: { value: 'secret12' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Set password' }))
    await vi.waitFor(() => expect(invoke).toHaveBeenCalledWith('set-user-password', { body: { user_id: 'u-kai', password: 'secret12' } }))
  })

  it('an estimator has Extra access and a CountTooling row', () => {
    renderSection(WENDI, DEV)
    expect((screen.getByLabelText('Hiring board') as HTMLInputElement).checked).toBe(true)
    expect((screen.getByLabelText('Prospects') as HTMLInputElement).checked).toBe(false)
    expect(screen.getByRole('button', { name: 'Make a seat' })).toBeTruthy()
    // An estimator has no supervision switch.
    expect(screen.queryByLabelText('Can run a job on their own')).toBeNull()
  })

  it('a leader sees the values with a tag, and flips only what the database lets them', () => {
    renderSection(KAI, LEADER)
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Set password…' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Trades…' })).toBeNull()
    expect(screen.getAllByText('dev only').length).toBeGreaterThan(0)
    expect((screen.getByLabelText('Can run a job on their own') as HTMLInputElement).disabled).toBe(false)
    expect(screen.getByRole('button', { name: 'Archive…' })).toBeTruthy()
  })
})
