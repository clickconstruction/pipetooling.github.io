import { beforeEach, describe, expect, it, vi } from 'vitest'

const rpcMock = vi.fn()
vi.mock('./supabase', () => ({
  supabase: {
    schema: () => ({ rpc: (name: string, args: unknown) => rpcMock(name, args) }),
    auth: { getSession: async () => ({ data: { session: null } }) },
  },
}))

import { approveClockSessions, heldFromApproveResult } from './approveClockSessions'

describe('approveClockSessions', () => {
  beforeEach(() => rpcMock.mockReset())

  it('calls the v2 function and returns what it left for someone else', async () => {
    rpcMock.mockResolvedValueOnce({ data: [{ approved_count: 2, held_own: 1, held_typed: 1, error_message: null }], error: null })
    const res = await approveClockSessions(['a', 'b', 'c', 'd'])
    expect(rpcMock).toHaveBeenCalledTimes(1)
    expect(rpcMock).toHaveBeenCalledWith('approve_clock_sessions_v2', { p_session_ids: ['a', 'b', 'c', 'd'] })
    expect(res.error).toBeNull()
    expect(heldFromApproveResult(res.data)).toEqual({ heldOwn: 1, heldTyped: 1 })
  })

  it('falls back to the old function when v2 is not on the database', async () => {
    rpcMock
      .mockResolvedValueOnce({ data: null, error: { message: 'Could not find the function public.approve_clock_sessions_v2', code: 'PGRST202' } })
      .mockResolvedValueOnce({ data: [{ approved_count: 1, error_message: null }], error: null })
    const res = await approveClockSessions(['a'])
    expect(rpcMock.mock.calls.map((c) => c[0])).toEqual(['approve_clock_sessions_v2', 'approve_clock_sessions'])
    expect(res.data?.[0]?.approved_count).toBe(1)
    expect(heldFromApproveResult(res.data)).toEqual({ heldOwn: 0, heldTyped: 0 })
  })

  it('does not fall back on a real refusal', async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: { message: 'You typed these hours, so someone else has to approve them.', code: 'P0001' } })
    const res = await approveClockSessions(['a'])
    expect(rpcMock).toHaveBeenCalledTimes(1)
    expect(res.error?.message).toBe('You typed these hours, so someone else has to approve them.')
  })

  it('reads a missing result as nothing held', () => {
    expect(heldFromApproveResult(null)).toEqual({ heldOwn: 0, heldTyped: 0 })
    expect(heldFromApproveResult([])).toEqual({ heldOwn: 0, heldTyped: 0 })
  })
})
