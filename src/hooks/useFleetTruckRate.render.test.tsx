// @vitest-environment jsdom
/**
 * The Bids crew-rate card's truck read (Wheels PR 3, v2.5039): one RPC with today's date, parsed by
 * `parseFleetTruckRate`, and null whenever it cannot be read, so the card shows no truck line.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

const rpc = vi.fn()
vi.mock('../lib/supabase', () => ({ supabase: { rpc: (fn: string, args: unknown) => rpc(fn, args) } }))
vi.mock('../utils/dateUtils', () => ({ todayYmdInAppTz: () => '2026-10-09' }))

import { useFleetTruckRate } from './useFleetTruckRate'

beforeEach(() => {
  rpc.mockReset()
})

describe('useFleetTruckRate', () => {
  it('reads the trucks’ rate for today and parses it', async () => {
    rpc.mockResolvedValue({ data: { rate: 180.29, fixed_usd: 3245.3, field_hours: 18, trucks: 4, days: 90 }, error: null })
    const { result } = renderHook(() => useFleetTruckRate(true))
    await waitFor(() => expect(result.current).not.toBeNull())
    expect(rpc).toHaveBeenCalledWith('fleet_truck_rate_per_field_hour', { p_today: '2026-10-09' })
    expect(result.current).toEqual({ rate: 180.29, fixedUsd: 3245.3, fieldHours: 18, trucks: 4, days: 90 })
  })

  it('is null with no bid open, and reads nothing', () => {
    const { result } = renderHook(() => useFleetTruckRate(false))
    expect(result.current).toBeNull()
    expect(rpc).not.toHaveBeenCalled()
  })

  it('a refusal, a missing function or a thrown read leaves no truck line', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'Only the office and estimators read the trucks’ rate.' } })
    const refused = renderHook(() => useFleetTruckRate(true))
    await waitFor(() => expect(rpc).toHaveBeenCalledTimes(1))
    expect(refused.result.current).toBeNull()
    rpc.mockRejectedValue(new Error('offline'))
    const thrown = renderHook(() => useFleetTruckRate(true))
    await waitFor(() => expect(rpc).toHaveBeenCalledTimes(2))
    expect(thrown.result.current).toBeNull()
  })
})
