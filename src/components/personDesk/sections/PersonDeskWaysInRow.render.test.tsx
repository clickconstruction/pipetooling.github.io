// @vitest-environment jsdom
/**
 * v2.8671: the person desk's Ways in row. A dev sees whether the login has a password and whether Google
 * is linked, and takes the Google link off after a question. Every person and address here is made up.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { PersonDeskWaysInRow } from './PersonDeskWaysInRow'

type Answer = { data: unknown; error: { message: string } | null }
const answers: { ways: Answer; unlink: Answer } = { ways: { data: null, error: null }, unlink: { data: { removed: 1 }, error: null } }
const rpc = vi.fn(async (name: string, _args: unknown) => (name === 'dev_login_ways' ? answers.ways : answers.unlink))

vi.mock('../../../lib/supabase', () => ({ supabase: { rpc: (name: string, args: unknown) => rpc(name, args) } }))

const LINKED = {
  has_login: true,
  has_password: true,
  ways: [
    { provider: 'email', email: 'zz.test.estimator@example.com', last_sign_in_at: null, linked_at: '2026-10-01T12:00:00Z' },
    { provider: 'google', email: 'zz.test.estimator@example.com', last_sign_in_at: new Date().toISOString(), linked_at: '2026-11-26T14:00:00Z' },
  ],
}

function renderRow(confirm = vi.fn(async () => true), rosterEmail = 'zz.test.estimator@example.com') {
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
  render(<PersonDeskWaysInRow userId="u-zz" rosterEmail={rosterEmail} displayName="ZZ Test Estimator" busy={null} run={run} confirm={confirm} />)
  return { toasts, confirm }
}

beforeEach(() => {
  rpc.mockClear()
  answers.ways = { data: LINKED, error: null }
  answers.unlink = { data: { removed: 1 }, error: null }
})
afterEach(cleanup)

describe('the desk’s Ways in row', () => {
  it('says the password is set and Google is linked, with the address and when it was last used', async () => {
    renderRow()
    const row = await screen.findByTestId('desk-ways-in')
    expect(within(row).getByText('set')).toBeTruthy()
    expect(within(row).getByText('linked')).toBeTruthy()
    expect(within(row).getByText('zz.test.estimator@example.com')).toBeTruthy()
    expect(within(row).getByText('last used today')).toBeTruthy()
    expect(within(row).queryByText('address differs')).toBeNull()
    expect(rpc).toHaveBeenCalledWith('dev_login_ways', { p_user_id: 'u-zz' })
  })

  it('says not linked, and offers nothing to unlink, for a login with no Google', async () => {
    answers.ways = { data: { has_login: true, has_password: false, ways: [{ provider: 'email', email: 'zz.test.estimator@example.com' }] }, error: null }
    renderRow()
    const row = await screen.findByTestId('desk-ways-in')
    expect(within(row).getByText('not set')).toBeTruthy()
    expect(within(row).getByText('not linked')).toBeTruthy()
    expect(within(row).queryByRole('button', { name: 'Unlink Google' })).toBeNull()
  })

  it('marks a Google account on another address than the roster', async () => {
    renderRow(undefined, 'zz.moved@example.com')
    expect(await screen.findByText('address differs')).toBeTruthy()
  })

  it('unlinks after a yes, and says so', async () => {
    const { toasts, confirm } = renderRow()
    fireEvent.click(await screen.findByRole('button', { name: 'Unlink Google' }))
    await vi.waitFor(() => expect(toasts).toEqual(["Google is off ZZ Test Estimator's login."]))
    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ confirmLabel: 'Unlink Google' }))
    expect(rpc).toHaveBeenCalledWith('dev_unlink_google', { p_user_id: 'u-zz' })
  })

  it('a no sends nothing', async () => {
    const { toasts } = renderRow(vi.fn(async () => false))
    fireEvent.click(await screen.findByRole('button', { name: 'Unlink Google' }))
    await vi.waitFor(() => expect(rpc).toHaveBeenCalledTimes(1))
    expect(rpc).not.toHaveBeenCalledWith('dev_unlink_google', expect.anything())
    expect(toasts).toEqual([])
  })

  it('says the database’s own refusal when Google is the only way in', async () => {
    answers.unlink = { data: null, error: { message: 'Google is their only way in. Set a password first.' } }
    const { toasts } = renderRow()
    fireEvent.click(await screen.findByRole('button', { name: 'Unlink Google' }))
    await vi.waitFor(() => expect(toasts).toEqual(['failed: Google is their only way in. Set a password first.']))
  })

  it('says why when the read is refused, and offers to read again', async () => {
    answers.ways = { data: null, error: { message: 'Could not find the function public.dev_login_ways' } }
    renderRow()
    expect(await screen.findByText(/Their ways in could not be read\./)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Read again' })).toBeTruthy()
  })
})
