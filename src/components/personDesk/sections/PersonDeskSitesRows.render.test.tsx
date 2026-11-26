// @vitest-environment jsdom
/**
 * v2.8667: the person desk's Sites rows. A dev reads the person's seat on CountTooling and on
 * TakeoffTooling, makes, retires or brings back a seat, and sets the role it holds there. Every press
 * goes over that site's bridge. Every person and address here is made up.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { PersonDeskSitesRows, type SitesRowsUser } from './PersonDeskSitesRows'

type Body = Record<string, unknown>
const rosters: { ct: unknown; tt: unknown } = { ct: { roster: [] }, tt: { roster: [] } }
const invoke = vi.fn(async (name: string, opts: { body: Body }) => {
  if (opts.body.verb === 'roster') return { data: name === 'ct-bridge' ? rosters.ct : rosters.tt, error: null }
  if (opts.body.verb === 'create') return { data: name === 'ct-bridge' ? { ct_user_id: 'ct-new' } : { tt_user_id: 'tt-new' }, error: null }
  return { data: { ok: true }, error: null }
})
const updates: Array<{ table: string; patch: unknown }> = []

vi.mock('../../../lib/supabase', () => ({
  supabase: {
    functions: { invoke: (name: string, opts: { body: Body }) => invoke(name, opts) },
    from: (table: string) => ({
      update: (patch: unknown) => {
        updates.push({ table, patch })
        const chain: Record<string, unknown> = {}
        chain.eq = () => chain
        chain.select = () => chain
        chain.then = (ok: (v: unknown) => unknown) => Promise.resolve({ data: [{ id: 'u-zz' }], error: null }).then(ok)
        return chain
      },
    }),
  },
}))

const ZZ: SitesRowsUser = { id: 'u-zz', email: 'zz.test.estimator@example.com', name: 'ZZ Test Estimator', counttooling_user_id: 'ct-1' }
const writes = () => invoke.mock.calls.filter(([, o]) => o.body.verb !== 'roster').map(([name, o]) => [name, o.body])

function renderRows(user: SitesRowsUser = ZZ, confirm = vi.fn(async () => true)) {
  const toasts: string[] = []
  const run = vi.fn(async (_key: string, write: () => Promise<unknown>, success: string) => {
    try {
      await write()
      toasts.push(success)
      return true
    } catch (e) {
      toasts.push(e instanceof Error ? `failed: ${e.message}` : 'failed')
      return false
    }
  })
  render(<PersonDeskSitesRows user={user} displayName={user.name ?? 'them'} busy={null} run={run} confirm={confirm} />)
  return { toasts, confirm, run }
}

beforeEach(() => {
  invoke.mockClear()
  updates.length = 0
  rosters.ct = { roster: [{ ct_user_id: 'ct-1', email: 'zz.test.estimator@example.com', is_admin: false, is_overseer: true, is_lead: false, is_digital_twin: false, active: true }] }
  rosters.tt = { roster: [] }
})
afterEach(cleanup)

describe('the desk’s Sites rows', () => {
  it('shows the seat on each site and the role it holds on CountTooling', async () => {
    renderRows()
    const ct = await screen.findByTestId('desk-site-count')
    expect(within(ct).getByText('active')).toBeTruthy()
    expect(within(ct).getByRole('button', { name: 'Retire here' })).toBeTruthy()
    expect(within(ct).getByRole('button', { name: 'Overseer on CountTooling' }).getAttribute('aria-pressed')).toBe('true')
    expect(within(ct).getByRole('button', { name: 'Lead on CountTooling' }).getAttribute('aria-pressed')).toBe('false')
    expect(within(ct).getByRole('button', { name: 'Admin on CountTooling' }).getAttribute('aria-pressed')).toBe('false')
    const tt = await screen.findByTestId('desk-site-takeoff')
    expect(within(tt).getByText('no seat')).toBeTruthy()
    expect(within(tt).getByRole('button', { name: 'Make their seat' })).toBeTruthy()
    expect(within(tt).queryByText('Role there')).toBeNull()
    expect(writes()).toEqual([])
  })

  it('pressing Lead sends that one flag, with no question asked', async () => {
    const { toasts, confirm } = renderRows()
    fireEvent.click(await screen.findByRole('button', { name: 'Lead on CountTooling' }))
    await vi.waitFor(() => expect(toasts).toEqual(['ZZ Test Estimator is now a lead on CountTooling.']))
    expect(confirm).not.toHaveBeenCalled()
    expect(writes()).toEqual([['ct-bridge', { verb: 'set_flags', ct_user_id: 'ct-1', is_lead: true }]])
  })

  it('pressing Overseer on a seat that holds it takes it away', async () => {
    const { toasts } = renderRows()
    fireEvent.click(await screen.findByRole('button', { name: 'Overseer on CountTooling' }))
    await vi.waitFor(() => expect(toasts).toEqual(['ZZ Test Estimator is no longer an overseer on CountTooling.']))
    expect(writes()).toEqual([['ct-bridge', { verb: 'set_flags', ct_user_id: 'ct-1', is_overseer: false }]])
  })

  it('making an admin asks first, and a no sends nothing', async () => {
    const confirm = vi.fn(async () => false)
    renderRows(ZZ, confirm)
    fireEvent.click(await screen.findByRole('button', { name: 'Admin on CountTooling' }))
    await vi.waitFor(() => expect(confirm).toHaveBeenCalledWith({ message: "Make ZZ Test Estimator an admin on CountTooling? An admin manages CountTooling's users.", confirmLabel: 'Make admin' }))
    expect(writes()).toEqual([])
  })

  it('retiring a seat asks first, then bans it on that site alone', async () => {
    const { toasts, confirm } = renderRows()
    fireEvent.click(await screen.findByRole('button', { name: 'Retire here' }))
    await vi.waitFor(() => expect(toasts).toEqual(["ZZ Test Estimator's seat on CountTooling is retired."]))
    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ confirmLabel: 'Retire the seat' }))
    expect(writes()).toEqual([['ct-bridge', { verb: 'deactivate', ct_user_id: 'ct-1' }]])
  })

  it('a retired seat offers Bring back, with no question', async () => {
    rosters.ct = { roster: [{ ct_user_id: 'ct-1', email: 'zz.test.estimator@example.com', active: false }] }
    const { toasts, confirm } = renderRows()
    fireEvent.click(await screen.findByRole('button', { name: 'Bring back' }))
    await vi.waitFor(() => expect(toasts).toEqual(["ZZ Test Estimator's seat on CountTooling is back."]))
    expect(confirm).not.toHaveBeenCalled()
    expect(writes()).toEqual([['ct-bridge', { verb: 'reactivate', ct_user_id: 'ct-1' }]])
  })

  it('makes a TakeoffTooling seat by address, and sets its one role', async () => {
    const { toasts } = renderRows()
    const tt = await screen.findByTestId('desk-site-takeoff')
    fireEvent.click(within(tt).getByRole('button', { name: 'Make their seat' }))
    await vi.waitFor(() => expect(toasts).toEqual(['TakeoffTooling seat ready for ZZ Test Estimator.']))
    expect(writes()).toEqual([['tt-bridge', { verb: 'create', email: 'zz.test.estimator@example.com', name: 'ZZ Test Estimator' }]])
    expect(updates).toEqual([])
  })

  it('a TakeoffTooling seat holds one role, and pressing the one it holds sends nothing', async () => {
    rosters.tt = { roster: [{ tt_user_id: 'tt-1', email: 'zz.test.estimator@example.com', role: 'user', active: true, last_sign_in_at: null }] }
    const { toasts, confirm } = renderRows()
    const tt = await screen.findByTestId('desk-site-takeoff')
    expect(within(tt).getByRole('button', { name: 'User on TakeoffTooling' }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(within(tt).getByRole('button', { name: 'User on TakeoffTooling' }))
    fireEvent.click(within(tt).getByRole('button', { name: 'Admin on TakeoffTooling' }))
    await vi.waitFor(() => expect(toasts).toEqual(['ZZ Test Estimator is now an admin on TakeoffTooling.']))
    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ confirmLabel: 'Make admin' }))
    expect(writes()).toEqual([['tt-bridge', { verb: 'set_role', tt_user_id: 'tt-1', role: 'admin' }]])
  })

  it('a site that cannot be read says why, and the other still shows', async () => {
    rosters.tt = { error: 'Unknown or missing verb' }
    renderRows()
    expect(await screen.findByText('TakeoffTooling could not be read. Unknown or missing verb')).toBeTruthy()
    expect(within(await screen.findByTestId('desk-site-count')).getByText('active')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Read again' })).toBeTruthy()
  })

  it('a robot’s seat is shown and never pressed from a desk', async () => {
    rosters.ct = { roster: [{ ct_user_id: 'ct-7', email: 'twin-estimator-1@twins.counttooling.local', is_digital_twin: true, active: true }] }
    renderRows({ id: 'u-twin', email: 'twin-estimator-1@twins.pipetooling.local', name: 'ZZ Test Robot', counttooling_user_id: 'ct-7' })
    const ct = await screen.findByTestId('desk-site-count')
    expect(within(ct).getByText('active')).toBeTruthy()
    expect(within(ct).queryByRole('button')).toBeNull()
    expect(within(ct).getByText("A robot's or a sample's seat is made where the fleet is made, not here.")).toBeTruthy()
  })
})
