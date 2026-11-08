/**
 * The board's reads hand the kernel the same window they covered. Found on the dev walk as the
 * Sample assistant (3-week window): the kernel counted eight weeks over three weeks of sessions,
 * so five weeks read as nothing recorded and a steady helper read "light four weeks running".
 */
import { describe, expect, it, vi } from 'vitest'

vi.mock('../supabase', () => ({ supabase: { rpc: async () => ({ data: [], error: null }), from: () => ({ select: () => ({ eq: () => ({ gte: () => ({ lte: () => ({ is: () => ({ is: async () => ({ data: [], error: null }) }) }) }) }) }) }) } }))
vi.mock('./rosterPeople', () => ({ fetchRosterPeople: async () => [] }))
vi.mock('../userTimeOffByCell', () => ({ fetchUserTimeOffForUsersInRange: async () => ({ data: [] }) }))
vi.mock('./payFlagsIndex', () => ({ buildPayFlagsIndex: () => ({ get: () => undefined }) }))
vi.mock('../supabasePaging', () => ({ fetchAllRows: async () => [] }))

import { fetchMyUtilization, fetchUtilizationBoard } from './fetchUtilizationBoard'
import { localAvailabilityIo } from './availabilityIo'

describe('fetchUtilizationBoard', () => {
  it('counts the weeks the reads covered, not the default eight', async () => {
    const read = await fetchUtilizationBoard(localAvailabilityIo(), { weeks: 3, todayYmd: '2026-11-08', nowMs: Date.UTC(2026, 10, 8, 18) })
    expect(read.board.team).toHaveLength(3)
    expect(read.startYmd).toBe(read.board.team[0]!.week.start)
    expect(read.endYmd).toBe(read.board.team[2]!.week.end)
  })

  it('My Time reads the same count it asked for', async () => {
    const read = await fetchMyUtilization({ userId: 'u1', name: 'Pat', role: 'helpers', isSalary: false, io: localAvailabilityIo(), weeks: 4 })
    expect(read.board.team).toHaveLength(4)
  })
})
