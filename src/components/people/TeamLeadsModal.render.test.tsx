// @vitest-environment jsdom
/**
 * Render-smoke tests for TeamLeadsModal (the team_leader_assignments manager
 * moved here from Settings → Dashboard & alerts): open/close wiring, the role
 * gate, and that loaded assignment rows render with leader/member labels.
 * Crash-on-mount / missed-prop class — kernels can't pin the modal wiring.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'

const AUTH_OVERRIDES: Record<string, unknown> = {}

vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return {
    ...useAuthModuleMock(),
    useAuth: () => ({
      user: { id: 'smoke-auth-user-1', email: 'smoke@example.com' },
      role: 'dev',
      profileName: 'Smoke Dev',
      loading: false,
      ...AUTH_OVERRIDES,
    }),
  }
})

vi.mock('../../lib/supabase', () => {
  const tableData: Record<string, unknown[]> = {
    users: [
      { id: 'u-lead', name: 'Lena Leader', email: 'lena@example.com' },
      { id: 'u-member', name: 'Manny Member', email: 'manny@example.com' },
    ],
    team_leader_assignments: [
      {
        id: 'tla-1',
        leader_user_id: 'u-lead',
        member_user_id: 'u-member',
        dashboard_hours_visibility: 'full',
      },
    ],
  }
  function makeBuilder(table: string): Record<string, unknown> {
    const result = () => Promise.resolve({ data: tableData[table] ?? [], error: null, count: 0 })
    const builder: Record<string, unknown> = {}
    for (const m of ['select', 'insert', 'update', 'delete', 'eq', 'is', 'in', 'order', 'limit']) {
      builder[m] = () => builder
    }
    builder.single = () => Promise.resolve({ data: null, error: null })
    builder.maybeSingle = () => Promise.resolve({ data: null, error: null })
    builder.then = (onFulfilled?: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
      result().then(onFulfilled, onRejected)
    return builder
  }
  return { supabase: { from: (table: string) => makeBuilder(table) } }
})

import TeamLeadsModal from './TeamLeadsModal'

describe('TeamLeadsModal render smoke', () => {
  it('renders nothing when closed', () => {
    const { container } = renderWithProviders(<TeamLeadsModal open={false} onClose={() => {}} />)
    expect(container.querySelector('[role="dialog"]')).toBeNull()
  })

  it('open: dialog mounts with title, pickers, and the loaded assignment row', async () => {
    const utils = renderWithProviders(<TeamLeadsModal open={true} onClose={() => {}} />)
    expect(utils.getByRole('dialog', { name: 'Team leads' })).toBeTruthy()
    expect(utils.getByText('Leader')).toBeTruthy()
    expect(utils.getByText('Member')).toBeTruthy()
    // Assignment row loads async from the mocked supabase (the names show in
    // both the leader-picker options and the table row, so expect >= 2 hits).
    expect((await utils.findAllByText('Lena Leader')).length).toBeGreaterThanOrEqual(2)
    expect((await utils.findAllByText('Manny Member')).length).toBeGreaterThanOrEqual(1)
    // Per-row visibility select renders with the row's value.
    const visibilitySelect = utils.container.querySelector<HTMLSelectElement>('tbody select')
    expect(visibilitySelect).toBeTruthy()
    expect(visibilitySelect?.value).toBe('full')
  })

  it('Close button calls onClose', async () => {
    const onClose = vi.fn()
    const utils = renderWithProviders(<TeamLeadsModal open={true} onClose={onClose} />)
    await utils.findAllByText('Lena Leader')
    fireEvent.click(utils.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('non-manager roles render nothing even when open', () => {
    AUTH_OVERRIDES.role = 'primary'
    try {
      const { container } = renderWithProviders(<TeamLeadsModal open={true} onClose={() => {}} />)
      expect(container.querySelector('[role="dialog"]')).toBeNull()
    } finally {
      delete AUTH_OVERRIDES.role
    }
  })
})
