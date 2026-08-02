// @vitest-environment jsdom
/**
 * Render-smoke tests for TeamLeadsModal — now modal chrome around the shared
 * leader-centric TeamLeadsManager (also rendered by People → Teams):
 * open/close wiring, the role gate, leader-card grouping, archived-member
 * labeling ("(archived)" + "Remove stale link"), and the dev-only Full/Strip
 * segmented toggle. Crash-on-mount / missed-prop class — the grouping kernel
 * tests can't pin the modal/manager wiring.
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
      { id: 'u-lead', name: 'Lena Leader', email: 'lena@example.com', archived_at: null },
      { id: 'u-member', name: 'Manny Member', email: 'manny@example.com', archived_at: null },
      { id: 'u-arch', name: 'Arnie Archived', email: 'arnie@example.com', archived_at: '2026-01-01T00:00:00Z' },
    ],
    team_leader_assignments: [
      {
        id: 'tla-1',
        leader_user_id: 'u-lead',
        member_user_id: 'u-member',
        dashboard_hours_visibility: 'full',
      },
      {
        id: 'tla-2',
        leader_user_id: 'u-lead',
        member_user_id: 'u-arch',
        dashboard_hours_visibility: 'strip_only',
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

  it('open: dialog mounts with title, one expanded leader card, and its member rows', async () => {
    const utils = renderWithProviders(<TeamLeadsModal open={true} onClose={() => {}} />)
    expect(utils.getByRole('dialog', { name: 'Team leads' })).toBeTruthy()
    // Leader card header loads async from the mocked supabase; one leader
    // (≤3) defaults to expanded, so both member rows are visible.
    expect(await utils.findByText('Lena Leader')).toBeTruthy()
    expect(utils.getByText(/2 members/)).toBeTruthy()
    expect(utils.getByText(/1 archived/)).toBeTruthy()
    expect(await utils.findByText('Manny Member')).toBeTruthy()
    // One Full/Strip segmented toggle per member row, pressed per row value.
    const fullButtons = utils.getAllByRole('button', { name: 'Full' })
    const stripButtons = utils.getAllByRole('button', { name: 'Strip' })
    expect(fullButtons).toHaveLength(2)
    expect(stripButtons).toHaveLength(2)
    expect(fullButtons.some((b) => b.getAttribute('aria-pressed') === 'true')).toBe(true)
    expect(stripButtons.some((b) => b.getAttribute('aria-pressed') === 'true')).toBe(true)
  })

  it('archived member is labeled "(archived)" and gets "Remove stale link" instead of the × button', async () => {
    const utils = renderWithProviders(<TeamLeadsModal open={true} onClose={() => {}} />)
    expect(await utils.findByText('Arnie Archived (archived)')).toBeTruthy()
    expect(utils.getByRole('button', { name: 'Remove stale link' })).toBeTruthy()
    // The active member keeps the compact × remove control.
    expect(utils.getByRole('button', { name: "Remove Manny Member from Lena Leader's team" })).toBeTruthy()
  })

  it('Close button calls onClose', async () => {
    const onClose = vi.fn()
    const utils = renderWithProviders(<TeamLeadsModal open={true} onClose={onClose} />)
    await utils.findByText('Lena Leader')
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

  it('non-dev managers see the visibility state but the Full/Strip toggle is disabled with an explainer title', async () => {
    AUTH_OVERRIDES.role = 'assistant'
    try {
      const utils = renderWithProviders(<TeamLeadsModal open={true} onClose={() => {}} />)
      await utils.findByText('Lena Leader')
      const toggles = [
        ...utils.getAllByRole('button', { name: 'Full' }),
        ...utils.getAllByRole('button', { name: 'Strip' }),
      ]
      expect(toggles).toHaveLength(4)
      for (const b of toggles) {
        expect((b as HTMLButtonElement).disabled).toBe(true)
        expect(b.getAttribute('title')).toBe('Only a developer can change this setting.')
      }
    } finally {
      delete AUTH_OVERRIDES.role
    }
  })
})
