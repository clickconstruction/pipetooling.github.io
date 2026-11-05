// @vitest-environment jsdom
/**
 * + Hire finds a teammate who left (punch list #256 PR 4, v2.6525): a name or an email that matches an archived
 * person stops the form with the amber line, "Bring back <first>" opens their desk's Bring back window, and
 * "This is someone else" lets the form go on.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { HirePersonModal } from './HirePersonModal'
import { renderWithProviders, settle } from '../../test/renderSmokeMocks'

const open = vi.fn()
vi.mock('../../contexts/PersonDeskContext', () => ({ useOptionalPersonDesk: () => ({ open, close: () => {}, payload: null, changeKey: 0, markChanged: () => {}, canOpen: true }) }))

vi.mock('../../lib/supabase', () => {
  function builder(table: string): Record<string, unknown> {
    const b: Record<string, unknown> = {}
    for (const op of ['select', 'eq', 'is', 'in', 'limit', 'order', 'not', 'or']) {
      b[op] = () => b
    }
    b.then = (ok: (v: unknown) => unknown) => {
      const data =
        table === 'users'
          ? [{ id: 'u-corinne', name: 'Corinne Vela', email: 'corinne.vela@example.com', is_sample: false, is_digital_twin: false, is_walk_tester: false }]
          : table === 'people'
            ? [{ id: 'p-corinne', name: 'Corinne Vela', email: null, end_date: '2026-11-03', account_user_id: 'u-corinne', archived_at: '2026-11-03T18:00:00Z' }]
            : []
      return Promise.resolve({ data, error: null }).then(ok)
    }
    return b
  }
  return { supabase: { from: (table: string) => builder(table), functions: { invoke: () => Promise.resolve({ data: null, error: null }) } } }
})

describe('HirePersonModal and a teammate who left', () => {
  beforeEach(() => open.mockClear())

  it('stops on the old name, offers Bring back, and goes on after This is someone else', async () => {
    const onClose = vi.fn()
    renderWithProviders(<HirePersonModal authUserId="u-dev" isDev={true} canAccessPay={true} canAccessContracts={false} onClose={onClose} onHired={vi.fn()} />)
    await settle()
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'corinne vela' } })
    await screen.findByText('Corinne Vela left on Nov 3, 2026.')
    expect(screen.getByText('Their hours, logbook and HR file are on that account.')).toBeTruthy()
    const hire = screen.getByRole('button', { name: /^Hire/ }) as HTMLButtonElement
    expect(hire.disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'This is someone else' }))
    await waitFor(() => expect(screen.queryByText('Corinne Vela left on Nov 3, 2026.')).toBeNull())
  })

  it('matches the old email under a new name and opens the desk with the window up', async () => {
    const onClose = vi.fn()
    renderWithProviders(<HirePersonModal authUserId="u-dev" isDev={true} canAccessPay={true} canAccessContracts={false} onClose={onClose} onHired={vi.fn()} />)
    await settle()
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Corinne Ortega' } })
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'Corinne.Vela@example.com' } })
    await screen.findByText('Corinne Vela left on Nov 3, 2026.')
    fireEvent.click(screen.getByRole('button', { name: 'Bring back Corinne' }))
    expect(open).toHaveBeenCalledWith({ userId: 'u-corinne', personId: 'p-corinne', displayName: 'Corinne Vela', flow: 'bring_back' })
    expect(onClose).toHaveBeenCalled()
  })
})
