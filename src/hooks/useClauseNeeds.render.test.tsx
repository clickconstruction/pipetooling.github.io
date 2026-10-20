// @vitest-environment jsdom
/**
 * useClauseNeeds (Messages, cut 4c): a controller or a dev reads the clause changes waiting on their approval; anyone
 * else gets none, without a read. The Dashboard's Needs you and Follow up's both take these rows.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

const auth = vi.hoisted(() => ({ role: 'controller' }))
vi.mock('../lib/supabase', async () => ({ supabase: (await import('../test/renderSmokeMocks')).makeSupabaseStub() }))
vi.mock('./useAuth', async () => {
  const m = await import('../test/renderSmokeMocks')
  return { ...m.useAuthModuleMock(), useAuth: () => m.makeUseAuthValue({ role: auth.role }) }
})
vi.mock('../lib/contracts/clausesIo', () => ({ loadClauseNeeds: vi.fn() }))

import { loadClauseNeeds } from '../lib/contracts/clausesIo'
import type { ClauseNeedRow } from '../lib/contracts/approval'
import { useClauseNeeds } from './useClauseNeeds'

const ROW = { title: 'Rosa changed clause 2 of the master agreement.' } as ClauseNeedRow

beforeEach(() => {
  vi.mocked(loadClauseNeeds).mockReset().mockResolvedValue([ROW])
})

describe('useClauseNeeds', () => {
  it.each(['controller', 'dev'])('reads the waiting changes for a %s', async (role) => {
    auth.role = role
    const { result } = renderHook(() => useClauseNeeds())
    await waitFor(() => expect(result.current.rows).toEqual([ROW]))
    expect(vi.mocked(loadClauseNeeds).mock.calls[0]?.[0]).toBe(role)
  })

  it.each(['assistant', 'estimator', 'master_technician', 'superintendent'])('reads nothing for a %s', async (role) => {
    auth.role = role
    const { result } = renderHook(() => useClauseNeeds())
    await new Promise((r) => setTimeout(r, 0))
    expect(result.current.rows).toEqual([])
    expect(loadClauseNeeds).not.toHaveBeenCalled()
  })

  it('reads nothing while it is off', async () => {
    auth.role = 'controller'
    const { result } = renderHook(() => useClauseNeeds(false))
    await new Promise((r) => setTimeout(r, 0))
    expect(result.current.rows).toEqual([])
    expect(loadClauseNeeds).not.toHaveBeenCalled()
  })
})
