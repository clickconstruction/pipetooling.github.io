// @vitest-environment jsdom
/**
 * Render smokes for DevMcpKeysCard (v2.3640): issuing writes the sha256 and the dev's own
 * id — never the key — and shows the key once with its shell line; a missing table (client
 * ahead of the migration) reads as "not switched on yet", not an error.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'

const state: { inserts: Record<string, unknown>[]; rows: Record<string, unknown>[]; loadError: { message: string } | null } = { inserts: [], rows: [], loadError: null }

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: state.loadError ? null : state.rows, error: state.loadError }) }) }),
      insert: (v: Record<string, unknown>) => {
        state.inserts.push(v)
        return Promise.resolve({ error: null })
      },
      update: () => ({ eq: () => Promise.resolve({ error: null }) }),
    }),
  },
}))
vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock()
})

import DevMcpKeysCard from './DevMcpKeysCard'
import { renderWithProviders, SMOKE_AUTH_USER_ID } from '../../test/renderSmokeMocks'

describe('DevMcpKeysCard', () => {
  it('issues a key for the signed-in dev: the hash is stored, the key is shown once', async () => {
    state.inserts = []
    state.loadError = null
    state.rows = [{ id: 'k1', label: 'Old laptop', created_at: new Date().toISOString(), last_used_at: null, revoked_at: null }]
    renderWithProviders(<DevMcpKeysCard />)
    await waitFor(() => expect(screen.getByText('Old laptop')).toBeTruthy())

    fireEvent.change(screen.getByLabelText('Key label'), { target: { value: "Robert's MacBook" } })
    fireEvent.click(screen.getByText('Issue a key'))
    await waitFor(() => expect(screen.getByText('Your new key — shown ONCE')).toBeTruthy())

    expect(state.inserts).toHaveLength(1)
    const row = state.inserts[0] ?? {}
    expect(row.user_id).toBe(SMOKE_AUTH_USER_ID)
    expect(row.label).toBe("Robert's MacBook")
    expect(String(row.token_hash)).toMatch(/^[0-9a-f]{64}$/)
    expect(JSON.stringify(row)).not.toContain('ptd_')
    expect(screen.getByText(/^export PT_DEV_MCP_TOKEN='ptd_[0-9a-f]{64}'$/)).toBeTruthy()
  })

  it('says it is not switched on when the table is not there yet', async () => {
    state.loadError = { message: 'relation "public.dev_mcp_credentials" does not exist' }
    renderWithProviders(<DevMcpKeysCard />)
    await waitFor(() => expect(screen.getByText(/Not switched on yet/)).toBeTruthy())
    expect(screen.queryByText('Issue a key')).toBeNull()
  })
})
